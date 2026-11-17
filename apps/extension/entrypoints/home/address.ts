import { browser } from 'wxt/browser';
import { buildSearchUrl, type SearchSource } from '@/utils/search-sources';

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;
const LOCALHOST = /^localhost(:\d+)?([/?#]\S*)?$/i;
const DOMAIN_LIKE = /^[^\s/?#]+\.[^\s/?#]{2,}([/?#]\S*)?$/;

/** 把输入解析成 http(s) 网址；不像网址（含空格、无点号的普通词）返回 null */
export function resolveUrl(input: string): string | null {
  const text = input.trim();
  let candidate: string;
  if (HAS_SCHEME.test(text)) candidate = text;
  else if (LOCALHOST.test(text)) candidate = `http://${text}`;
  else if (DOMAIN_LIKE.test(text)) candidate = `https://${text}`;
  else return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function openUrl(url: string, newTab: boolean): void {
  if (newTab) void browser.tabs.create({ url });
  else location.href = url;
}

/** 像网址就直接打开，否则用所选搜索源搜索 */
export function runSearch(text: string, source: SearchSource, newTab: boolean): void {
  openUrl(resolveUrl(text) ?? buildSearchUrl(source, text), newTab);
}

/** 链接的打开方式 */
export function linkProps(newTab: boolean): { target?: string; rel?: string } {
  return newTab ? { target: '_blank', rel: 'noopener' } : {};
}
