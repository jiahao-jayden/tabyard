// 后台 Service Worker：监听标签页变化，按规则自动归入 Chrome 原生分组
import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Group } from '@tabyard/shared';
import { findBestGroup } from '@/utils/match';
import { loadActiveConfig, refreshPlan } from '@/utils/plan';
import { syncIfPro, syncNow } from '@/utils/sync';
import { syncXButton } from '@/utils/x/button-script';
import { watchBookmarksRequests, watchJobTabClosed } from '@/utils/x/fetch-job';
import { handleXMessage } from '@/utils/x/messages';
import {
  CONFIG_STORAGE_AREA,
  fallbackGroupFor,
  type GroupSettings,
} from '@/utils/rules';

const DEBOUNCE_MS = 800;
const pendingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const groupLocks = new Map<string, Promise<void>>();

function isGroupableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return !/^(chrome|chrome-extension|edge|about|view-source):/.test(url);
}

async function getManagedTitles(): Promise<Set<string>> {
  const { managedGroups } = await browser.storage.local.get('managedGroups');
  return new Set((managedGroups as string[]) || []);
}

async function markManaged(title: string): Promise<void> {
  const set = await getManagedTitles();
  if (!set.has(title)) {
    set.add(title);
    await browser.storage.local.set({ managedGroups: [...set] });
  }
}

async function groupTab(
  tab: Browser.tabs.Tab,
  settings: GroupSettings,
  groups: Group[],
  /** 刚新建的标签页可能继承了打开者的分组，需要按自己的网址重新归类 */
  fresh = false,
  /** 仅事件触发的单个标签页才按设置插入；批量整理保持原有相对顺序 */
  insertAtStart = false,
): Promise<void> {
  if (tab.groupId !== -1 && !fresh) return;

  const matched = findBestGroup(tab, groups);
  let groupName: string;
  let color: Browser.tabGroups.Color;
  if (matched) {
    groupName = matched.name.trim();
    color = matched.color as Browser.tabGroups.Color;
  } else {
    const fb = fallbackGroupFor(tab, settings);
    if (!fb) return;
    groupName = fb.groupName;
    color = fb.color as Browser.tabGroups.Color;
  }
  if (!groupName || tab.windowId == null) return;
  if (tab.groupId !== -1) {
    const current = await browser.tabGroups.get(tab.groupId).catch(() => null);
    if (current?.title === groupName) return;
  }

  // Multiple tab update events can arrive together. Serialize each
  // window/group pair so concurrent events cannot create duplicate groups.
  const lockKey = `${tab.windowId}:${groupName}`;
  const previous = groupLocks.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  groupLocks.set(lockKey, previous.then(() => current));
  await previous;
  try {
    const groups = await browser.tabGroups.query({ windowId: tab.windowId });
    const [existing, ...duplicates] = groups.filter((g) => g.title === groupName);

    if (existing) {
      if (existing.color !== color) {
        await browser.tabGroups.update(existing.id, { color });
      }
      const tabIds = [tab.id!];
      if (duplicates.length > 0) {
        const duplicateIds = new Set(duplicates.map((g) => g.id));
        const windowTabs = await browser.tabs.query({ windowId: tab.windowId });
        for (const t of windowTabs) {
          if (t.id != null && duplicateIds.has(t.groupId!)) tabIds.push(t.id);
        }
      }
      await browser.tabs.group({ tabIds: tabIds as [number, ...number[]], groupId: existing.id });
      if (insertAtStart) {
        // 加入后默认在分组末尾；移到分组第一个标签页的位置即插到最前
        const members = await browser.tabs.query({ windowId: tab.windowId, groupId: existing.id });
        const first = Math.min(...members.map((m) => m.index));
        await browser.tabs.move(tab.id!, { index: first });
      }
    } else {
      // Without windowId, Chrome creates the group in the focused window and moves the tab there.
      const groupId = await browser.tabs.group({
        tabIds: [tab.id!],
        createProperties: { windowId: tab.windowId },
      });
      await browser.tabGroups.update(groupId, {
        title: groupName,
        color,
        collapsed: !!settings.autoCollapse,
      });
    }
    await markManaged(groupName);
  } finally {
    release();
    if (groupLocks.get(lockKey) === current) groupLocks.delete(lockKey);
  }
}

// 刚创建、还没按网址处理过的标签页
const freshTabs = new Set<number>();
const RETRY_DELAYS = [300, 1000];

async function groupTabById(tabId: number): Promise<void> {
  let tab: Browser.tabs.Tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return;
  }
  if (!isGroupableUrl(tab.url)) return;
  const { settings, groups } = await loadActiveConfig();
  if (!settings.enabled) return;
  const fresh = freshTabs.has(tabId);
  // 拖动标签页等瞬时状态下 Chrome 会拒绝分组，稍后重试
  for (let attempt = 0; ; attempt++) {
    try {
      await groupTab(tab, settings, groups, fresh, settings.insertPosition === 'start');
      freshTabs.delete(tabId);
      return;
    } catch (e) {
      if (attempt >= RETRY_DELAYS.length) {
        console.warn('[tabyard] groupTab failed:', e);
        return;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      try {
        tab = await browser.tabs.get(tabId);
      } catch {
        return;
      }
    }
  }
}

function scheduleGroupTab(tabId: number): void {
  const prev = pendingTimers.get(tabId);
  if (prev) clearTimeout(prev);
  pendingTimers.set(
    tabId,
    setTimeout(() => {
      pendingTimers.delete(tabId);
      void groupTabById(tabId);
    }, DEBOUNCE_MS),
  );
}

async function groupAllTabs(): Promise<void> {
  const { settings, groups } = await loadActiveConfig();
  if (!settings.enabled) return;
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.groupId !== -1 || !isGroupableUrl(tab.url)) continue;
    try {
      await groupTab(tab, settings, groups);
    } catch (e) {
      console.warn('[tabyard] groupAllTabs failed:', e);
    }
  }
}

// 按当前规则重新整理：先解散插件管理过的分组，再全部重新分组
async function regroupAll(): Promise<void> {
  const { settings, allGroups } = await loadActiveConfig();
  if (!settings.enabled) return;
  const managed = await getManagedTitles();
  // Include configured group names so groups created before managedGroups was
  // introduced (or after a reinstall) are also cleaned up.
  const configuredNames = new Set(
    allGroups.map((g) => g.name.trim()).filter(Boolean),
  );
  if (settings.fallback === 'other') configuredNames.add(settings.otherGroupName.trim());
  const chromeGroups = await browser.tabGroups.query({});
  const managedIds = new Set(
    chromeGroups
      .filter((g) => managed.has(g.title ?? '') || configuredNames.has(g.title ?? ''))
      .map((g) => g.id),
  );
  if (managedIds.size > 0) {
    const tabs = await browser.tabs.query({});
    const toFree = tabs
      .filter((t) => t.groupId != null && t.groupId !== -1 && managedIds.has(t.groupId))
      .map((t) => t.id!);
    if (toFree.length > 0) await browser.tabs.ungroup(toFree as [number, ...number[]]);
  }
  await groupAllTabs();
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void groupAllTabs());
  browser.runtime.onStartup.addListener(() => void groupAllTabs());

  browser.tabs.onCreated.addListener((tab) => {
    if (tab.id == null) return;
    freshTabs.add(tab.id);
    scheduleGroupTab(tab.id);
  });
  browser.tabs.onRemoved.addListener((tabId) => freshTabs.delete(tabId));

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete' || (changeInfo as { title?: string }).title) {
      scheduleGroupTab(tabId);
    }
  });

  let regroupTimer: ReturnType<typeof setTimeout> | null = null;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== CONFIG_STORAGE_AREA) return;
    if (!changes.settings && !changes.groups && !changes.plan) return;
    if (changes.settings || changes.groups) void syncIfPro();
    if (regroupTimer) clearTimeout(regroupTimer);
    regroupTimer = setTimeout(() => void regroupAll(), 500);
  });

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const type = (msg as { type?: string } | undefined)?.type;
    if (type === 'regroup') {
      void regroupAll().then(() => sendResponse({ ok: true }));
      return true;
    }
    // 来自 x.com 页面上的脚本或设置页的消息
    const reply = handleXMessage(msg);
    if (reply) {
      void reply.then(sendResponse);
      return true;
    }
  });

  watchBookmarksRequests();
  watchJobTabClosed();
  void syncXButton();

  browser.alarms.create('sync', { periodInMinutes: 30 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync') void syncNow();
  });

  void refreshPlan().then(() => syncNow());
  console.log('[tabyard] background loaded');
});
