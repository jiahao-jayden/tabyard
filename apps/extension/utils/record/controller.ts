// 后台录屏控制：状态存 storage.session，实际录制交给 offscreen 文档，页面控制栏按需注入
import { browser, type Browser } from 'wxt/browser';
import { pageSelectRegion, runInTab } from '../page';
import { resetRecording } from './store';
import {
  OVERLAY_REMOVE,
  type OffscreenCommand,
  type RecordCommand,
  type RecordFinished,
  type RecordOptions,
  type RecordState,
} from './types';

const STATE_KEY = 'recordState';

async function getState(): Promise<RecordState | null> {
  return ((await browser.storage.session.get(STATE_KEY))[STATE_KEY] as RecordState | undefined) ?? null;
}

async function setState(state: RecordState | null): Promise<void> {
  if (state) await browser.storage.session.set({ [STATE_KEY]: state });
  else await browser.storage.session.remove(STATE_KEY);
  await browser.action.setBadgeText({ text: state ? 'REC' : '' });
  if (state) await browser.action.setBadgeBackgroundColor({ color: '#dc2626' });
}

async function hasOffscreen(): Promise<boolean> {
  const contexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as Browser.runtime.ContextType],
  });
  return contexts.length > 0;
}

async function closeOffscreen(): Promise<void> {
  if (await hasOffscreen()) await browser.offscreen.closeDocument();
}

function toOffscreen(cmd: OffscreenCommand): Promise<{ ok: boolean; error?: string } | undefined> {
  return browser.runtime.sendMessage(cmd);
}

const needsOverlay = (options: RecordOptions) => options.controls || options.camera;

async function injectOverlay(tabId: number): Promise<void> {
  await browser.scripting
    .executeScript({ target: { tabId }, files: ['/content-scripts/record.js'] })
    .catch((e) => console.warn('[tabyard] record overlay failed:', e));
}

/** 返回 false 表示用户取消了框选 */
async function start({ tabId, options, hint }: Extract<RecordCommand, { type: 'record-start' }>): Promise<boolean> {
  if (await getState()) throw new Error('A recording is already in progress');
  const tab = await browser.tabs.get(tabId);
  const region = options.mode === 'region' ? await runInTab(tabId, pageSelectRegion, hint) : null;
  if (options.mode === 'region' && !region) return false;

  await closeOffscreen();
  await browser.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA' as Browser.offscreen.Reason],
    justification: 'Record the current tab',
  });
  const streamId = await browser.tabCapture.getMediaStreamId({ targetTabId: tabId });
  const id = crypto.randomUUID();
  await resetRecording();
  const res = await toOffscreen({
    target: 'offscreen',
    type: 'start',
    id,
    streamId,
    options,
    region,
    title: tab.title ?? '',
    url: tab.url ?? '',
  });
  if (!res?.ok) {
    await closeOffscreen();
    throw new Error(res?.error ?? 'Recorder did not respond');
  }
  await setState({ id, tabId, options, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
  if (needsOverlay(options)) await injectOverlay(tabId);
  return true;
}

async function pause(): Promise<RecordState | null> {
  const state = await getState();
  if (!state || state.pausedAt !== null) return state;
  await toOffscreen({ target: 'offscreen', type: 'pause' });
  const next = { ...state, pausedAt: Date.now() };
  await setState(next);
  return next;
}

async function resume(): Promise<RecordState | null> {
  const state = await getState();
  if (!state || state.pausedAt === null) return state;
  await toOffscreen({ target: 'offscreen', type: 'resume' });
  const next = { ...state, pausedMs: state.pausedMs + Date.now() - state.pausedAt, pausedAt: null };
  await setState(next);
  return next;
}

async function stop(): Promise<void> {
  if (await hasOffscreen()) await toOffscreen({ target: 'offscreen', type: 'stop' });
  else await setState(null);
}

/** offscreen 写完最后一个分片后通知：清理状态并打开结果页 */
async function finished({ id }: RecordFinished): Promise<void> {
  const state = await getState();
  await setState(null);
  await closeOffscreen();
  const tab = state ? await browser.tabs.get(state.tabId).catch(() => null) : null;
  if (tab?.id != null) await browser.tabs.sendMessage(tab.id, { type: OVERLAY_REMOVE }).catch(() => {});
  await browser.tabs.create({
    url: browser.runtime.getURL(`/recording.html#${id}`),
    ...(tab ? { windowId: tab.windowId, index: tab.index + 1 } : {}),
  });
}

/** 处理 popup、页面控制栏和 offscreen 发来的录屏消息；不是录屏消息时返回 undefined */
export function handleRecordMessage(msg: RecordCommand | RecordFinished): Promise<unknown> | undefined {
  switch (msg?.type) {
    case 'record-start':
      return start(msg).then((done) => ({ ok: true, done }));
    case 'record-state':
      return getState();
    case 'record-pause':
      return pause();
    case 'record-resume':
      return resume();
    case 'record-stop':
      return stop().then(() => ({ ok: true }));
    case 'record-finished':
      return finished(msg).then(() => ({ ok: true }));
    default:
      return undefined;
  }
}

export function watchRecording(): void {
  // 标签页跳转后控制栏随页面消失，加载完成后重新注入
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') return;
    void getState().then((state) => {
      if (state?.tabId === tabId && needsOverlay(state.options)) void injectOverlay(tabId);
    });
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    void getState().then((state) => {
      if (state?.tabId === tabId) void stop();
    });
  });
  // 浏览器重启或扩展重载后 offscreen 文档已不在，残留状态作废
  void Promise.all([getState(), hasOffscreen()]).then(([state, alive]) => {
    if (state && !alive) void setState(null);
  });
}
