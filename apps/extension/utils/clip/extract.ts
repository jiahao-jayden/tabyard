// 在当前标签页抽取正文：按需注入内容脚本，不常驻任何页面（依赖 popup 点击时授予的 activeTab）
import { browser } from 'wxt/browser';
import type { RawCapture } from './normalize';
import { isXhsNoteUrl, readXhsNote } from './xhs';

export const CLIP_EXTRACT = 'clip-extract';

export type ExtractResponse = { ok: true; data: RawCapture } | { ok: false; error: string };

export async function extractTab(tab: { id: number; title?: string }, url: string): Promise<RawCapture> {
  const xhsNote = isXhsNoteUrl(url)
    ? (await browser.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: readXhsNote }))[0]?.result ?? null
    : null;
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['/content-scripts/clip.js'] });
  const res: ExtractResponse | undefined = await browser.tabs.sendMessage(tab.id, { type: CLIP_EXTRACT, xhsNote });
  if (!res?.ok) throw new Error(res?.error ?? 'No response from page');
  // 标签页标题是用户在浏览器里看到的标题，比页面内抽取的更稳定
  const title = tab.title?.trim();
  return title ? { ...res.data, title } : res.data;
}
