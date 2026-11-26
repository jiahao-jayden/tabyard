// 升级提示：记录用户已看过的版本，只存本机，不参与云同步
import { browser } from 'wxt/browser';
import { CHANGELOG } from '@tabyard/shared';

export const SEEN_VERSION_KEY = 'seenVersion';

/** 从未看过返回空串：useStored 用 null 表示「还在读取」，两者必须区分，否则每次打开都会先闪一下 */
export async function loadSeenVersion(): Promise<string> {
  const stored = await browser.storage.local.get(SEEN_VERSION_KEY);
  return (stored[SEEN_VERSION_KEY] as string | undefined) ?? '';
}

/** 当前版本；没有对应日志条目时返回 undefined，不弹提示 */
export function currentChangelogEntry() {
  const version = browser.runtime.getManifest().version;
  return CHANGELOG.find((entry) => entry.version === version);
}

export function markVersionSeen(): Promise<void> {
  return browser.storage.local.set({ [SEEN_VERSION_KEY]: browser.runtime.getManifest().version });
}
