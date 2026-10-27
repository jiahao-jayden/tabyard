// 后台截图：可视区域、整页滚动拼接、框选区域。依赖用户点开 popup 时授予的 activeTab
import { browser, type Browser } from 'wxt/browser';
import { capturePage } from '../collect/capture';
import { pageSelectRegion, runInTab } from '../page';
import { putScreenshot } from './store';

export type ScreenshotMode = 'visible' | 'full' | 'region';

export interface ScreenshotRequest {
  type: 'screenshot';
  mode: ScreenshotMode;
  tabId: number;
  /** 框选时页面上显示的提示，由 popup 按当前语言传入 */
  hint: string;
}

/** Chrome 限制 captureVisibleTab 每秒最多 2 次 */
const CAPTURE_INTERVAL_MS = 550;
/** Canvas 单边上限 */
const MAX_CANVAS_SIZE = 32767;

let lastCaptureAt = 0;

async function captureViewport(windowId: number): Promise<ImageBitmap> {
  const wait = lastCaptureAt + CAPTURE_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCaptureAt = Date.now();
  const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
  return createImageBitmap(await (await fetch(dataUrl)).blob());
}

/** 以下 page* 函数在页面上下文执行，必须自包含 */

function pagePrepareFull() {
  const style = document.createElement('style');
  style.id = '__tabyard_shot_style';
  style.textContent = 'html,body{scroll-behavior:auto!important}::-webkit-scrollbar{display:none!important}';
  document.documentElement.append(style);
  const root = document.scrollingElement ?? document.documentElement;
  return {
    width: window.innerWidth,
    viewport: window.innerHeight,
    height: Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0),
    x: window.scrollX,
    y: window.scrollY,
  };
}

async function pageScrollTo(y: number): Promise<number> {
  window.scrollTo(0, y);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await new Promise((r) => setTimeout(r, 120));
  return window.scrollY;
}

/** 首屏之后隐藏固定 / 粘性元素，避免导航栏在每一屏重复出现 */
function pageHideFixed() {
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const { position } = getComputedStyle(el);
    if (position !== 'fixed' && position !== 'sticky') continue;
    el.dataset.tabyardVisibility = el.style.getPropertyValue('visibility');
    el.style.setProperty('visibility', 'hidden', 'important');
  }
}

function pageRestoreFull(x: number, y: number) {
  document.getElementById('__tabyard_shot_style')?.remove();
  for (const el of document.querySelectorAll<HTMLElement>('[data-tabyard-visibility]')) {
    const previous = el.dataset.tabyardVisibility;
    if (previous) el.style.setProperty('visibility', previous);
    else el.style.removeProperty('visibility');
    delete el.dataset.tabyardVisibility;
  }
  window.scrollTo(x, y);
}

async function toPng(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/png' });
}

async function captureVisible(tab: Browser.tabs.Tab): Promise<Blob> {
  const bitmap = await captureViewport(tab.windowId!);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  return toPng(canvas);
}

async function captureFull(tab: Browser.tabs.Tab): Promise<Blob> {
  const tabId = tab.id!;
  const page = await runInTab(tabId, pagePrepareFull);
  try {
    const shots: { y: number; bitmap: ImageBitmap }[] = [];
    let scale = 1;
    let height = page.height;
    for (let target = 0; target < height; target += page.viewport) {
      const y = await runInTab(tabId, pageScrollTo, target);
      if (shots.length > 0 && y <= shots[shots.length - 1]!.y) break;
      const bitmap = await captureViewport(tab.windowId!);
      if (shots.length === 0) {
        scale = bitmap.width / page.width;
        height = Math.min(height, Math.floor(MAX_CANVAS_SIZE / scale));
        await runInTab(tabId, pageHideFixed);
      }
      shots.push({ y, bitmap });
    }
    const canvas = new OffscreenCanvas(shots[0]!.bitmap.width, Math.round(height * scale));
    const ctx = canvas.getContext('2d')!;
    for (const { y, bitmap } of shots) ctx.drawImage(bitmap, 0, Math.round(y * scale));
    return toPng(canvas);
  } finally {
    await runInTab(tabId, pageRestoreFull, page.x, page.y).catch(() => {});
  }
}

async function captureRegion(tab: Browser.tabs.Tab, hint: string): Promise<Blob | null> {
  const rect = await runInTab(tab.id!, pageSelectRegion, hint);
  if (!rect) return null;
  const bitmap = await captureViewport(tab.windowId!);
  const scale = bitmap.width / rect.width;
  const w = Math.round(rect.w * scale);
  const h = Math.round(rect.h * scale);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d')!.drawImage(bitmap, Math.round(rect.x * scale), Math.round(rect.y * scale), w, h, 0, 0, w, h);
  return toPng(canvas);
}

/** 截图并在新标签页打开结果；用户取消框选时返回 false */
export async function takeScreenshot({ mode, tabId, hint }: ScreenshotRequest): Promise<boolean> {
  const tab = await browser.tabs.get(tabId);
  if (tab.windowId == null) throw new Error('Tab has no window');
  const blob =
    mode === 'visible' ? await captureVisible(tab)
      : mode === 'full' ? await captureFull(tab)
        : await captureRegion(tab, hint);
  if (!blob) return false;
  const page = await capturePage({ id: tabId, url: tab.url ?? '', title: tab.title, favIconUrl: tab.favIconUrl });
  const id = await putScreenshot({ blob, page });
  await browser.tabs.create({
    url: browser.runtime.getURL(`/screenshot.html#${id}`),
    windowId: tab.windowId,
    index: tab.index + 1,
  });
  return true;
}
