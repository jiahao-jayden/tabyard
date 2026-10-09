// 数据模型与存储：background 与 UI 共用
import { browser } from 'wxt/browser';
import { getDomain } from 'tldts';
import { hostnameOf, type Group, type GroupColor, type TabLike } from '@tabyard/shared';

export type InsertPosition = 'end' | 'start';
export type FallbackMode = 'domain' | 'other' | 'none';

export interface GroupSettings {
  enabled: boolean;
  fallback: FallbackMode;
  otherGroupName: string;
  otherColor: GroupColor;
  autoCollapse: boolean;
  /** 新标签页加入已有分组时的位置 */
  insertPosition: InsertPosition;
}

export type Language = 'zh-CN' | 'en';
export type LanguagePref = Language | 'auto';

export function resolveLanguage(pref: LanguagePref | undefined): Language {
  if (pref === 'zh-CN' || pref === 'en') return pref;
  if (pref === 'auto') return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
  return 'en';
}

export const DEFAULT_OTHER_NAME: Record<Language, string> = { 'zh-CN': '其他', en: 'Other' };

export const DEFAULT_SETTINGS: GroupSettings = {
  enabled: true,
  fallback: 'domain',
  otherGroupName: '',
  otherColor: 'grey',
  autoCollapse: false,
  insertPosition: 'end',
};

export function uid(): string {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fallbackGroupFor(
  tab: TabLike,
  settings: GroupSettings,
): { groupName: string; color: GroupColor } | null {
  if (settings.fallback === 'domain') {
    // 取一级域名（eTLD+1），如 docs.github.com → github.com；IP、localhost 保留原主机名
    const host = hostnameOf(tab.url || '');
    if (!host) return null;
    return { groupName: getDomain(host) ?? host, color: 'grey' };
  }
  if (settings.fallback === 'other') {
    return { groupName: settings.otherGroupName.trim(), color: settings.otherColor };
  }
  return null;
}

/** sync 单 key 上限 8 KB，放不下上百条规则，因此用 local */
const storage = browser.storage.local;
export const CONFIG_STORAGE_AREA = 'local';

/**
 * 配置的读-改-写会发生在多个上下文（选项页、popup、后台同步），
 * 用 Web Locks 跨上下文串行化，避免互相覆盖。
 * CONFIG_LOCK 只包住短小的存储操作，网络请求绝不放在里面。
 */
export const CONFIG_LOCK = 'tabyard-config';
export const withLock = <T>(name: string, task: () => Promise<T>): Promise<T> =>
  navigator.locks.request(name, task) as Promise<T>;

type ConfigPatch = { settings?: GroupSettings; groups?: Group[] };

/** 必须在 CONFIG_LOCK 内调用；modifiedAt 单调递增，保证后写的一定更新 */
async function writeConfig(patch: ConfigPatch): Promise<void> {
  const { settings } = patch;
  if (settings && Object.values(DEFAULT_OTHER_NAME).includes(settings.otherGroupName.trim())) {
    patch = { ...patch, settings: { ...settings, otherGroupName: '' } };
  }
  const { modifiedAt = 0 } = await storage.get('modifiedAt');
  await storage.set({ ...patch, modifiedAt: Math.max(Date.now(), (modifiedAt as number) + 1) });
}

export function saveConfig(patch: ConfigPatch): Promise<void> {
  return withLock(CONFIG_LOCK, () => writeConfig(patch));
}

/** 只改部分设置项（如 popup 的总开关），在锁内读取最新值再写，不会覆盖其他字段 */
export function patchSettings(patch: Partial<GroupSettings>): Promise<void> {
  return withLock(CONFIG_LOCK, async () => {
    const { settings } = await loadConfig();
    await writeConfig({ settings: { ...settings, ...patch } });
  });
}

export async function loadLanguagePref(): Promise<LanguagePref> {
  const { language } = await storage.get('language');
  if (language === 'zh-CN' || language === 'en' || language === 'auto') return language;
  return 'en';
}

export async function saveLanguagePref(pref: LanguagePref): Promise<void> {
  await storage.set({ language: pref });
}

export async function loadConfig(): Promise<{ settings: GroupSettings; groups: Group[] }> {
  const stored = await storage.get(['settings', 'groups', 'language']);
  const settings = { ...DEFAULT_SETTINGS, ...((stored.settings as Partial<GroupSettings>) || {}) };
  if (!settings.otherGroupName.trim() || Object.values(DEFAULT_OTHER_NAME).includes(settings.otherGroupName.trim())) {
    settings.otherGroupName = DEFAULT_OTHER_NAME[resolveLanguage(stored.language as LanguagePref)];
  }
  return {
    settings,
    groups: Array.isArray(stored.groups) ? (stored.groups as Group[]) : [],
  };
}
