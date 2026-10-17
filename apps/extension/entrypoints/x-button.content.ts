// 在 X 的每条推文操作栏里加一个「收藏到 Tabyard」按钮。
// 只在用户开启该功能并授权 x.com 后，由 utils/x/button-script.ts 运行时注册
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import en from '@/locales/en.json';
import zhCN from '@/locales/zh-CN.json';
import type { CollectData } from '@/utils/collect/store';
import { COLLECT_KEY, normalizeUrl } from '@/utils/collect/url';
import { extractTweet } from '@/utils/x/extract';

const BUTTON_ATTR = 'data-tabyard-button';
const ICON_PATH = '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>';
const ICON_ADD = `${ICON_PATH}<path d="M12 10v6"/><path d="M9 13h6"/>`;
const ICON_SAVED = `${ICON_PATH}<path d="m9 13 2 2 4-4"/>`;

declare global {
  interface Window {
    __tabyardXButton?: boolean;
  }
}

async function loadLabels(): Promise<{ save: string; saved: string }> {
  const { language } = await browser.storage.local.get('language');
  const zh = language === 'zh-CN' || (language !== 'en' && navigator.language.toLowerCase().startsWith('zh'));
  return (zh ? zhCN : en).xButton;
}

export default defineContentScript({
  matches: ['*://x.com/*', '*://twitter.com/*'],
  registration: 'runtime',
  async main() {
    if (window.__tabyardXButton) return;
    window.__tabyardXButton = true;

    const labels = await loadLabels();
    let saved = new Set<string>();
    const loadSaved = async () => {
      const data = (await browser.storage.local.get(COLLECT_KEY))[COLLECT_KEY] as Partial<CollectData> | undefined;
      saved = new Set((data?.bookmarks ?? []).map((b) => normalizeUrl(b.url)));
    };
    await loadSaved();

    const render = (button: HTMLButtonElement) => {
      const tweet = button.closest('article') && extractTweet(button.closest('article')!);
      const active = !!tweet && saved.has(tweet.url);
      button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${active ? ICON_SAVED : ICON_ADD}</svg>`;
      button.title = active ? labels.saved : labels.save;
      button.style.color = active ? 'rgb(29, 155, 240)' : 'rgb(113, 118, 123)';
    };

    const send = (message: unknown) => browser.runtime.sendMessage(message).catch(() => undefined);

    const mount = (article: Element) => {
      if (article.querySelector(`[${BUTTON_ATTR}]`)) return;
      const bar = Array.from(article.querySelectorAll('[role="group"]')).find((g) => g.querySelector('[data-testid="reply"]'));
      if (!bar) return;
      const button = document.createElement('button');
      button.setAttribute(BUTTON_ATTR, '');
      button.type = 'button';
      button.style.cssText = 'all:unset;display:flex;align-items:center;justify-content:center;align-self:center;flex:none;width:34px;height:34px;border-radius:50%;cursor:pointer';
      button.onmouseenter = () => { button.style.background = 'rgba(29,155,240,.1)'; };
      button.onmouseleave = () => { button.style.background = 'transparent'; };
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const tweet = extractTweet(article);
        if (!tweet) return;
        void send(saved.has(tweet.url) ? { type: 'x-unsave', url: tweet.url } : { type: 'x-save', tweet });
      };
      render(button);
      // 放在 X 自带收藏按钮旁边；向上取最外层只含它自己的包装元素，避免插进按钮内部
      let anchor = bar.querySelector('[data-testid="bookmark"], [data-testid="removeBookmark"]');
      while (anchor?.parentElement && anchor.parentElement !== bar && anchor.parentElement.children.length === 1) {
        anchor = anchor.parentElement;
      }
      if (anchor) anchor.after(button);
      else bar.append(button);
    };

    const scan = () => {
      document.querySelectorAll('article[data-testid="tweet"]').forEach(mount);
      document.querySelectorAll<HTMLButtonElement>(`[${BUTTON_ATTR}]`).forEach(render);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(scan, 300);
    };
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[COLLECT_KEY]) void loadSaved().then(scan);
    });
    scan();
  },
});
