// 读取当前页面的 og 信息：依赖 popup 点击时授予的 activeTab 权限
import { browser } from 'wxt/browser';
import type { BookmarkInput } from './store';

export type PageInfo = Omit<BookmarkInput, 'folderId'>;

export function isCollectable(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/** 在页面上下文执行，必须自包含 */
function readPage() {
  const meta = (key: string) =>
    document.querySelector(`meta[property="${key}"], meta[name="${key}"]`)?.getAttribute('content')?.trim() || '';
  const absolute = (value: string) => {
    try {
      const u = new URL(value, location.href);
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  };
  return {
    title: meta('og:title') || document.title,
    description: meta('og:description') || meta('description'),
    image: absolute(meta('og:image') || meta('twitter:image')),
  };
}

export async function capturePage(tab: { id?: number; url: string; title?: string; favIconUrl?: string }): Promise<PageInfo> {
  let page = { title: '', description: '', image: '' };
  try {
    if (tab.id !== undefined) {
      const [injected] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: readPage });
      if (injected?.result) page = injected.result;
    }
  } catch {
    /* 页面禁止注入（如应用商店）时，退回标签页自带的 title / favicon */
  }
  return {
    url: tab.url,
    title: page.title || tab.title || tab.url,
    description: page.description,
    image: page.image,
    favicon: tab.favIconUrl ?? '',
  };
}
