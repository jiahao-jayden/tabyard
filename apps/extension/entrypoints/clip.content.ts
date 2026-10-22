// 页面内抽取正文。不在 manifest 里静态注册，由 utils/clip/extract.ts 在用户点击后按需注入
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { extractForUrl } from '@/utils/clip/adapters';
import { CLIP_EXTRACT, type ExtractResponse } from '@/utils/clip/extract';
import type { XhsNote } from '@/utils/clip/xhs';

declare global {
  interface Window {
    __tabyardClip?: boolean;
  }
}

export default defineContentScript({
  // 仅作为打包入口：不注册、不要求任何站点权限，注入靠 activeTab
  matches: [],
  registration: 'runtime',
  main() {
    // 每次打开 popup 都会注入一次，监听器只注册一次
    if (window.__tabyardClip) return;
    window.__tabyardClip = true;
    browser.runtime.onMessage.addListener((msg: { type?: string; xhsNote?: XhsNote | null }, _sender, sendResponse) => {
      if (msg?.type !== CLIP_EXTRACT) return;
      extractForUrl(location.href, msg.xhsNote ?? null).then(
        (data): void => sendResponse({ ok: true, data } satisfies ExtractResponse),
        (error): void => sendResponse({ ok: false, error: String(error) } satisfies ExtractResponse),
      );
      return true;
    });
  },
});
