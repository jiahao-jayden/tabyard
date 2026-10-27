// 截图收藏的封面：图片太大，不进收藏集和云同步，只存本机 IndexedDB，按规范化网址关联
import { createStore, get, set } from 'idb-keyval';
import { normalizeUrl } from './url';

const store = createStore('tabyard-covers', 'covers');

const COVER_WIDTH = 640;
/** 与收藏卡片的封面比例一致；长截图只取顶部 */
const COVER_ASPECT = 16 / 10;

export async function makeCover(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const srcHeight = Math.min(bitmap.height, Math.round(bitmap.width / COVER_ASPECT));
  const width = Math.min(COVER_WIDTH, bitmap.width);
  const height = Math.round((srcHeight * width) / bitmap.width);
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, bitmap.width, srcHeight, 0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}

export function putCover(url: string, cover: Blob): Promise<void> {
  return set(normalizeUrl(url), cover, store);
}

export function getCover(url: string): Promise<Blob | undefined> {
  return get<Blob>(normalizeUrl(url), store);
}
