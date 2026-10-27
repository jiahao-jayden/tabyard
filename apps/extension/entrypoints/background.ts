// 后台 Service Worker：监听标签页变化，按规则自动归入 Chrome 原生分组
import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Group } from '@tabyard/shared';
import { findBestGroup } from '@/utils/match';
import { refreshPlan } from '@/utils/plan';
import { loadConfig } from '@/utils/rules';
import { syncIfPro, syncNow } from '@/utils/sync';
import { syncXButton } from '@/utils/x/button-script';
import { watchBookmarksRequests, watchJobTabClosed } from '@/utils/x/fetch-job';
import { handleXMessage } from '@/utils/x/messages';
import { fetchPushShare, PUSH_CONTENT_REQUEST } from '@/utils/clip/push-share';
import { takeScreenshot, type ScreenshotRequest } from '@/utils/screenshot/capture';
import { handleRecordMessage, watchRecording } from '@/utils/record/controller';
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

/** 插件创建过的分组，加上当前配置里的分组名（覆盖重装或 managedGroups 之前创建的分组） */
async function getOwnedTitles(settings: GroupSettings, groups: Group[]): Promise<Set<string>> {
  const owned = await getManagedTitles();
  for (const g of groups) {
    const name = g.name.trim();
    if (name) owned.add(name);
  }
  if (settings.fallback === 'other') owned.add(settings.otherGroupName.trim());
  return owned;
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
  /**
   * 新建或网址变化时传入插件管理的分组名：标签页若在这些分组里（继承自打开者或页内跳转），
   * 按当前网址重新归类；用户自建的分组不动
   */
  reclassifyFrom: Set<string> | null = null,
  /** 仅事件触发的单个标签页才按设置插入；批量整理保持原有相对顺序 */
  insertAtStart = false,
): Promise<void> {
  let currentTitle: string | undefined;
  if (tab.groupId !== -1) {
    if (!reclassifyFrom) return;
    currentTitle = (await browser.tabGroups.get(tab.groupId).catch(() => null))?.title;
    if (currentTitle == null || !reclassifyFrom.has(currentTitle)) return;
  }

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
  if (!groupName || tab.windowId == null || currentTitle === groupName) return;

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

const RETRY_DELAYS = [300, 1000];

async function groupTabById(tabId: number, reclassify: boolean): Promise<void> {
  let tab: Browser.tabs.Tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return;
  }
  if (!isGroupableUrl(tab.url)) return;
  const { settings, groups } = await loadConfig();
  if (!settings.enabled) return;
  const owned = reclassify ? await getOwnedTitles(settings, groups) : null;
  // 拖动标签页等瞬时状态下 Chrome 会拒绝分组，稍后重试
  for (let attempt = 0; ; attempt++) {
    try {
      await groupTab(tab, settings, groups, owned, settings.insertPosition === 'start');
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

/** 防抖窗口内出现过新建或网址变化的标签页 */
const pendingReclassify = new Set<number>();

function scheduleGroupTab(tabId: number, reclassify: boolean): void {
  const prev = pendingTimers.get(tabId);
  if (prev) clearTimeout(prev);
  if (reclassify) pendingReclassify.add(tabId);
  pendingTimers.set(
    tabId,
    setTimeout(() => {
      pendingTimers.delete(tabId);
      const shouldReclassify = pendingReclassify.delete(tabId);
      void groupTabById(tabId, shouldReclassify);
    }, DEBOUNCE_MS),
  );
}

async function groupAllTabs(): Promise<void> {
  const { settings, groups } = await loadConfig();
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
  const { settings, groups: allGroups } = await loadConfig();
  if (!settings.enabled) return;
  const owned = await getOwnedTitles(settings, allGroups);
  const chromeGroups = await browser.tabGroups.query({});
  const managedIds = new Set(
    chromeGroups.filter((g) => owned.has(g.title ?? '')).map((g) => g.id),
  );
  if (managedIds.size > 0) {
    const tabs = await browser.tabs.query({});
    const toFree = tabs
      .filter((t) => t.groupId != null && t.groupId !== -1 && managedIds.has(t.groupId))
      .map((t) => t.id!);
    if (toFree.length > 0) {
      await browser.tabs.ungroup(toFree as [number, ...number[]]).catch((e) => {
        console.warn('[tabyard] ungroup failed:', e);
      });
    }
  }
  await groupAllTabs();
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => void groupAllTabs());
  browser.runtime.onStartup.addListener(() => void groupAllTabs());

  browser.tabs.onCreated.addListener((tab) => {
    if (tab.id == null) return;
    scheduleGroupTab(tab.id, true);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete' || (changeInfo as { title?: string }).title) {
      scheduleGroupTab(tabId, !!changeInfo.url);
    }
  });

  let regroupTimer: ReturnType<typeof setTimeout> | null = null;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== CONFIG_STORAGE_AREA) return;
    if (changes.settings || changes.groups || changes.collect || changes.plan) void syncIfPro();
    if (!changes.settings && !changes.groups && !changes.plan) return;
    if (regroupTimer) clearTimeout(regroupTimer);
    regroupTimer = setTimeout(() => void regroupAll(), 500);
  });

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const type = (msg as { type?: string } | undefined)?.type;
    if (type === PUSH_CONTENT_REQUEST) {
      void fetchPushShare(sender).then(sendResponse);
      return true;
    }
    if (type === 'screenshot') {
      void takeScreenshot(msg as ScreenshotRequest).then(
        (done) => sendResponse({ ok: true, done }),
        (e: Error) => {
          console.warn('[tabyard] screenshot failed:', e);
          sendResponse({ ok: false, error: e.message });
        },
      );
      return true;
    }
    if (type === 'regroup') {
      void regroupAll().finally(() => sendResponse({ ok: true }));
      return true;
    }
    const recordReply = handleRecordMessage(msg);
    if (recordReply) {
      void recordReply.then(sendResponse, (e: Error) => {
        console.warn('[tabyard] record failed:', e);
        sendResponse({ ok: false, error: e.message });
      });
      return true;
    }
    // 来自 x.com 页面上的脚本或设置页的消息
    const reply = handleXMessage(msg);
    if (reply) {
      void reply.then(sendResponse, () => sendResponse(undefined));
      return true;
    }
  });

  watchRecording();
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
