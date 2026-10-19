// 后台任务：打开一个 x.com 标签页，让 X 自己发出一次书签请求，抓下请求头，再注入脚本翻页。
// 运行在 Service Worker 里，所以状态都落在 storage，不依赖内存
import { browser, type Browser } from 'wxt/browser';
import {
  beginXFetch, finishXFetch, loadXState, mergeXPage, saveXState, XFETCH_STALE_MS,
} from './cache';
import { X_ORIGINS } from './origins';
import { extractedTweetSchema } from './tweet';
import { z } from 'zod';
import type { XFetchJob } from '../../entrypoints/x-fetch';

const TEMPLATE_KEY = 'xTemplate';
const BOOKMARKS_PAGE = 'https://x.com/i/bookmarks';
const TEMPLATE_TIMEOUT_MS = 20_000;

interface Template extends XFetchJob {
  capturedAt: number;
}

/** 记下 X 页面自己发出的 Bookmarks 请求：地址，以及 authorization 和 x- 开头的请求头。只放内存型的 session 存储 */
function captureTemplate(details: Browser.webRequest.OnBeforeSendHeadersDetails): undefined {
  if (!new URL(details.url).pathname.endsWith('/Bookmarks')) return undefined;
  const headers: Record<string, string> = {};
  for (const h of details.requestHeaders ?? []) {
    const name = h.name.toLowerCase();
    if (h.value && (name === 'authorization' || name === 'content-type' || name.startsWith('x-'))) headers[name] = h.value;
  }
  if (!headers.authorization) return undefined;
  const template: Template = { url: details.url, headers, capturedAt: Date.now() };
  void browser.storage.session.set({ [TEMPLATE_KEY]: template });
  return undefined;
}

function registerListener(): void {
  if (!browser.webRequest?.onBeforeSendHeaders) return;
  try {
    browser.webRequest.onBeforeSendHeaders.removeListener(captureTemplate);
    browser.webRequest.onBeforeSendHeaders.addListener(
      captureTemplate,
      { urls: ['*://x.com/i/api/graphql/*', '*://twitter.com/i/api/graphql/*'] },
      ['requestHeaders', 'extraHeaders'],
    );
  } catch {
    /* 未授予 x.com 权限时无法监听，抓取时会给出提示 */
  }
}

/** 授权 x.com 之后重新注册，确保新授予的权限立即生效 */
export function watchBookmarksRequests(): void {
  registerListener();
  browser.permissions?.onAdded.addListener(registerListener);
}

async function waitForTemplate(since: number): Promise<Template | null> {
  const deadline = Date.now() + TEMPLATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const stored = (await browser.storage.session.get(TEMPLATE_KEY))[TEMPLATE_KEY] as Template | undefined;
    if (stored && stored.capturedAt >= since) return stored;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function waitForTabComplete(tabId: number): Promise<void> {
  const deadline = Date.now() + TEMPLATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab || tab.status === 'complete') return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function closeJobTab(): Promise<void> {
  const { tabId } = await loadXState();
  if (tabId !== undefined) await browser.tabs.remove(tabId).catch(() => undefined);
}

export async function startXFetch(full: boolean): Promise<void> {
  const state = await loadXState();
  if (state.status === 'running' && Date.now() - state.updatedAt < XFETCH_STALE_MS) return;

  if (!(await browser.permissions.contains({ origins: X_ORIGINS }))) {
    await saveXState({ status: 'error', error: 'permission' });
    return;
  }

  const since = Date.now();
  const tab = await browser.tabs.create({ url: BOOKMARKS_PAGE, active: false });
  if (tab.id === undefined) return;
  await beginXFetch(tab.id, full);

  // X 页面加载时会自己请求书签，等它发出来；没登录会跳转到登录页，请求不会出现
  const template = await waitForTemplate(since);
  if (!template) {
    await finishXFetch('not-logged-in');
    await closeJobTab();
    return;
  }

  await waitForTabComplete(tab.id);
  // 两次注入共享同一个隔离环境，先把任务参数放进去
  await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: (job: XFetchJob) => { window.__tabyardXFetch = job; },
    args: [{ url: template.url, headers: template.headers }],
  });
  await browser.scripting.executeScript({ target: { tabId: tab.id }, files: ['x-fetch.js'] });
}

const pageMessageSchema = z.object({ type: z.literal('x-fetch-page'), tweets: z.array(z.unknown()).max(200) });

/** 页面脚本发来一页数据：校验、写缓存，并回复是否继续 */
export async function handleXFetchPage(msg: unknown): Promise<{ continue: boolean }> {
  const parsed = pageMessageSchema.safeParse(msg);
  if (!parsed.success) return { continue: false };
  // 逐条校验：个别不合规的帖子跳过，不能让整页丢失
  const valid = parsed.data.tweets.flatMap((tweet) => {
    const result = extractedTweetSchema.safeParse(tweet);
    return result.success ? [result.data] : [];
  });
  const { hitKnown } = await mergeXPage(valid);
  const { mode } = await loadXState();
  return { continue: !(mode === 'incremental' && hitKnown) };
}

const endMessageSchema = z.object({
  error: z.string().optional(),
  pages: z.number().int().nonnegative().optional(),
  reason: z.enum(['end', 'empty', 'known', 'cap']).optional(),
  counts: z.array(z.number().int().nonnegative()).max(300).optional(),
});

export async function handleXFetchEnd(msg: unknown): Promise<void> {
  const parsed = endMessageSchema.safeParse(msg);
  const { error, pages, reason, counts } = parsed.success
    ? parsed.data
    : { error: 'invalid message', pages: undefined, reason: undefined, counts: undefined };
  await finishXFetch(error, { pages, reason, counts });
  await closeJobTab();
}

/** 抓取用的标签页被用户关掉，任务就算中断 */
export function watchJobTabClosed(): void {
  browser.tabs.onRemoved.addListener((tabId) => {
    void loadXState().then((state) => {
      if (state.status === 'running' && state.tabId === tabId) void finishXFetch('interrupted');
    });
  });
}
