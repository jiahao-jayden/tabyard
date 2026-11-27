// 截图收藏的封面：图片太大，不进收藏集和云同步，只存本机 IndexedDB，按规范化网址关联
import { createStore, get, set } from 'idb-keyval';
import { browser } from 'wxt/browser';
import { normalizeUrl } from './url';

const store = createStore('tabyard-covers', 'covers');

const COVER_WIDTH = 640;
/** 与收藏卡片的封面比例一致；长截图只取顶部 */
const COVER_ASPECT = 16 / 10;

export async function makeCover(image: Blob): Promise<Blob> {
  if (image.type.startsWith('image/svg+xml')) {
    const url = URL.createObjectURL(image);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return drawCover(img, img.naturalWidth, img.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const bitmap = await createImageBitmap(image);
  try {
    return drawCover(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

function drawCover(image: CanvasImageSource, srcWidth: number, srcFullHeight: number): Promise<Blob> {
  const srcHeight = Math.min(srcFullHeight, Math.max(1, Math.round(srcWidth / COVER_ASPECT)));
  const width = Math.min(COVER_WIDTH, srcWidth);
  const height = Math.max(1, Math.round((srcHeight * width) / srcWidth));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, srcWidth, srcHeight, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

export function putCover(url: string, cover: Blob): Promise<void> {
  return set(normalizeUrl(url), cover, store);
}

export function getCover(url: string): Promise<Blob | undefined> {
  return get<Blob>(normalizeUrl(url), store);
}

/** 网页没有 og 图时，用当前可见区域做封面；依赖 popup 点击时授予的 activeTab，失败则不设封面 */
export async function captureCover(windowId: number, url: string): Promise<void> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 90 });
    await putCover(url, await makeCover(await (await fetch(dataUrl)).blob()));
  } catch {
    /* 截图被拒绝（受限页面、窗口最小化）时保持无封面 */
  }
}
