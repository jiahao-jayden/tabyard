// X 书签的本地缓存与抓取状态。推文体量大，存 IndexedDB；抓取状态很小，留在 storage.local，
// 设置页靠它的 onChanged 刷新（每次写缓存后都会更新状态）。抓取只写这里，导入收藏集是用户之后的单独操作
import { browser } from 'wxt/browser';
import { createStore, get, set } from 'idb-keyval';
import { withLock } from '../rules';
import type { ExtractedTweet } from './tweet';

export interface XCache {
  /** 按 X 书签的顺序，最近收藏的在前 */
  tweets: ExtractedTweet[];
  /** 上一次抓取是否走到了书签的末尾；没走完的缓存不能做增量更新 */
  complete: boolean;
  updatedAt: number;
}

export interface XFetchState {
  status: 'idle' | 'running' | 'done' | 'error';
  mode: 'full' | 'incremental';
  /** 本次已写入缓存的条数，同时是下一页的插入位置 */
  fetched: number;
  tabId?: number;
  error?: string;
  /** 本轮请求了几页、因何结束，用来排查「为什么只抓到这么多」 */
  pages?: number;
  reason?: 'end' | 'empty' | 'known' | 'cap';
  /** 每一页返回的帖子数 */
  counts?: number[];
  updatedAt: number;
}

/** 超过这个时间没有进展，就认为上一次抓取任务已经死了（比如 Service Worker 被回收） */
export const XFETCH_STALE_MS = 2 * 60_000;

const X_CACHE_KEY = 'xBookmarks';
export const X_STATE_KEY = 'xFetchState';
const cacheStore = createStore('tabyard', 'x');
const X_CACHE_LOCK = 'tabyard-x-cache';

const EMPTY_CACHE: XCache = { tweets: [], complete: false, updatedAt: 0 };
const IDLE_STATE: XFetchState = { status: 'idle', mode: 'full', fetched: 0, updatedAt: 0 };

function valid(cache: XCache | undefined): cache is XCache {
  return !!cache && Array.isArray(cache.tweets);
}

export async function loadXCache(): Promise<XCache> {
  const stored = await get<XCache>(X_CACHE_KEY, cacheStore);
  if (valid(stored)) return stored;
  // 旧版本把缓存放在 storage.local：首次读取时搬进 IndexedDB 并删除旧键
  const legacy = (await browser.storage.local.get(X_CACHE_KEY))[X_CACHE_KEY] as XCache | undefined;
  if (!valid(legacy)) return EMPTY_CACHE;
  await set(X_CACHE_KEY, legacy, cacheStore);
  await browser.storage.local.remove(X_CACHE_KEY);
  return legacy;
}

/** 先写缓存再写状态：监听状态变化的界面刷新时一定能读到最新缓存 */
function saveXCache(cache: XCache): Promise<void> {
  return set(X_CACHE_KEY, cache, cacheStore);
}

export async function loadXState(): Promise<XFetchState> {
  const stored = (await browser.storage.local.get(X_STATE_KEY))[X_STATE_KEY] as XFetchState | undefined;
  return stored ?? IDLE_STATE;
}

export function saveXState(patch: Partial<XFetchState>): Promise<void> {
  return withLock(X_CACHE_LOCK, async () => {
    const state = await loadXState();
    await browser.storage.local.set({ [X_STATE_KEY]: { ...state, ...patch, updatedAt: Date.now() } });
  });
}

/** 开始新一轮抓取。没抓完的旧缓存、或用户要求重新获取全部时，丢弃旧缓存完整抓取 */
export function beginXFetch(tabId: number, full: boolean): Promise<XFetchState['mode']> {
  return withLock(X_CACHE_LOCK, async () => {
    const cache = await loadXCache();
    const mode: XFetchState['mode'] = cache.complete && !full ? 'incremental' : 'full';
    const state: XFetchState = { status: 'running', mode, fetched: 0, tabId, updatedAt: Date.now() };
    const next = mode === 'full' ? { ...EMPTY_CACHE } : cache;
    await saveXCache(next);
    await browser.storage.local.set({ [X_STATE_KEY]: state });
    return mode;
  });
}

/** 把一页推文写入缓存：已有的跳过，新的插到本轮的当前位置；返回这一页是否碰到了已缓存的推文 */
export function mergeXPage(tweets: ExtractedTweet[]): Promise<{ hitKnown: boolean }> {
  return withLock(X_CACHE_LOCK, async () => {
    const [cache, state] = await Promise.all([loadXCache(), loadXState()]);
    const known = new Set(cache.tweets.map((t) => t.url));
    const fresh = tweets.filter((t) => !known.has(t.url));
    cache.tweets.splice(state.fetched, 0, ...fresh);
    cache.updatedAt = Date.now();
    await saveXCache(cache);
    await browser.storage.local.set({
      [X_STATE_KEY]: { ...state, fetched: state.fetched + fresh.length, updatedAt: Date.now() },
    });
    return { hitKnown: fresh.length < tweets.length };
  });
}

export function finishXFetch(error?: string, stats?: Pick<XFetchState, 'pages' | 'reason' | 'counts'>): Promise<void> {
  return withLock(X_CACHE_LOCK, async () => {
    const [cache, state] = await Promise.all([loadXCache(), loadXState()]);
    await saveXCache({ ...cache, complete: error ? cache.complete : true });
    await browser.storage.local.set({
      [X_STATE_KEY]: { ...state, ...stats, status: error ? 'error' : 'done', error, updatedAt: Date.now() },
    });
  });
}
