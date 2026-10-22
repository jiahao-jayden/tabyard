// 剪藏标签：规范化与最近使用历史
import { browser } from 'wxt/browser';

const TAGS_KEY = 'clipTags';

export function normalizeTag(input: string): string {
  return input.trim().replace(/^#+/, '').trim();
}

export function normalizeTags(inputs: string[]): string[] {
  return [...new Set(inputs.map(normalizeTag).filter(Boolean))];
}

export async function loadTagHistory(): Promise<string[]> {
  const stored = (await browser.storage.local.get(TAGS_KEY))[TAGS_KEY];
  return Array.isArray(stored) ? normalizeTags(stored.filter((t): t is string => typeof t === 'string')) : [];
}

export async function saveUsedTags(tags: string[]): Promise<void> {
  const used = normalizeTags(tags);
  if (used.length === 0) return;
  const history = normalizeTags([...used, ...(await loadTagHistory())]).slice(0, 30);
  await browser.storage.local.set({ [TAGS_KEY]: history });
}
