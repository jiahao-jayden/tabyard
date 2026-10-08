// 数据模型与存储：background 与 UI 共用
import { browser } from 'wxt/browser';
import { hostnameOf, type Group, type GroupColor, type TabLike } from '@tabyard/shared';

export type FallbackMode = 'domain' | 'other' | 'none';

export interface GroupSettings {
  enabled: boolean;
  fallback: FallbackMode;
  otherGroupName: string;
  otherColor: GroupColor;
  autoCollapse: boolean;
}

export type Language = 'zh-CN' | 'en';
export type LanguagePref = Language | 'auto';

export function resolveLanguage(pref: LanguagePref | undefined): Language {
  if (pref === 'zh-CN' || pref === 'en') return pref;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export const DEFAULT_OTHER_NAME: Record<Language, string> = { 'zh-CN': '其他', en: 'Other' };

export const DEFAULT_SETTINGS: GroupSettings = {
  enabled: true,
  fallback: 'other',
  otherGroupName: '',
  otherColor: 'grey',
  autoCollapse: false,
};

export function uid(): string {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fallbackGroupFor(
  tab: TabLike,
  settings: GroupSettings,
): { groupName: string; color: GroupColor } | null {
  if (settings.fallback === 'domain') {
    const host = hostnameOf(tab.url || '');
    if (!host) return null;
    return { groupName: host, color: 'grey' };
  }
  if (settings.fallback === 'other') {
    return { groupName: settings.otherGroupName.trim(), color: settings.otherColor };
  }
  return null;
}

/** sync 单 key 上限 8 KB，放不下上百条规则，因此用 local */
const storage = browser.storage.local;
export const CONFIG_STORAGE_AREA = 'local';

export async function saveConfig(patch: { settings?: GroupSettings; groups?: Group[] }): Promise<void> {
  await storage.set(patch);
}

export async function loadLanguagePref(): Promise<LanguagePref> {
  const { language } = await storage.get('language');
  return language === 'zh-CN' || language === 'en' ? language : 'auto';
}

export async function saveLanguagePref(pref: LanguagePref): Promise<void> {
  await storage.set({ language: pref });
}

export async function loadConfig(): Promise<{ settings: GroupSettings; groups: Group[] }> {
  const stored = await storage.get(['settings', 'groups', 'language']);
  const settings = { ...DEFAULT_SETTINGS, ...((stored.settings as Partial<GroupSettings>) || {}) };
  if (!settings.otherGroupName.trim()) {
    settings.otherGroupName = DEFAULT_OTHER_NAME[resolveLanguage(stored.language as LanguagePref)];
  }
  return {
    settings,
    groups: Array.isArray(stored.groups) ? (stored.groups as Group[]) : [],
  };
}
