// 后台 Service Worker：监听标签页变化，按规则自动归入 Chrome 原生分组
import { browser, type Browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Group } from '@tabyard/shared';
import { findBestGroup } from '@/utils/match';
import { loadActiveConfig, refreshPlan } from '@/utils/plan';
import { pushIfPro, syncNow } from '@/utils/sync';
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
): Promise<void> {
  if (tab.groupId !== -1) return;

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
  try {
    await groupTab(tab, settings, groups);
  } catch (e) {
    console.warn('[tabyard] groupTab failed:', e);
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
    if (tab.id != null) scheduleGroupTab(tab.id);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete' || (changeInfo as { title?: string }).title) {
      scheduleGroupTab(tabId);
    }
  });

  let regroupTimer: ReturnType<typeof setTimeout> | null = null;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== CONFIG_STORAGE_AREA) return;
    if (!changes.settings && !changes.groups && !changes.plan) return;
    if (changes.settings || changes.groups) void pushIfPro();
    if (regroupTimer) clearTimeout(regroupTimer);
    regroupTimer = setTimeout(() => void regroupAll(), 500);
  });

  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && (msg as { type?: string }).type === 'regroup') {
      void regroupAll().then(() => sendResponse({ ok: true }));
      return true;
    }
  });

  browser.alarms.create('sync', { periodInMinutes: 30 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync') void syncNow();
  });

  void refreshPlan().then(() => syncNow());
  console.log('[tabyard] background loaded');
});
