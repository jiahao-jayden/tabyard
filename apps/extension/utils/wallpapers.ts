// 新标签页壁纸的数据来源：本地壁纸库（IndexedDB）和 Bing 每日壁纸（缓存在 storage.local）
import { browser } from 'wxt/browser';
import { createStore, del, entries, get, set } from 'idb-keyval';
import { z } from 'zod';

// 壁纸图片体积大，和截图封面一样只存本机 IndexedDB
const localStore = createStore('tabyard-wallpapers', 'local');
const MAX_WIDTH = 2560;
const THUMB_WIDTH = 360;

interface LocalRecord {
  image: Blob;
  thumb: Blob;
  createdAt: number;
}

export interface LocalWallpaper extends LocalRecord {
  id: string;
}

async function scaled(bitmap: ImageBitmap, maxWidth: number, quality: number): Promise<Blob> {
  const width = Math.min(maxWidth, bitmap.width);
  const canvas = new OffscreenCanvas(width, Math.round((bitmap.height * width) / bitmap.width));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

export async function listLocalWallpapers(): Promise<LocalWallpaper[]> {
  const rows = await entries<string, LocalRecord>(localStore);
  return rows.map(([id, record]) => ({ id, ...record })).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getLocalWallpaper(id: string): Promise<Blob | undefined> {
  return (await get<LocalRecord>(id, localStore))?.image;
}

/** 缩小后存入本地壁纸库，返回新壁纸的 id */
export async function addLocalWallpaper(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const id = crypto.randomUUID();
  await set(id, {
    image: await scaled(bitmap, MAX_WIDTH, 0.85),
    thumb: await scaled(bitmap, THUMB_WIDTH, 0.8),
    createdAt: Date.now(),
  } satisfies LocalRecord, localStore);
  return id;
}

export function removeLocalWallpaper(id: string): Promise<void> {
  return del(id, localStore);
}

const BING_KEY = 'newtabBing';
const BING_ORIGIN = 'https://www.bing.com';

const bingSchema = z.object({
  date: z.string(),
  market: z.string(),
  url: z.string().url(),
  title: z.string(),
  copyright: z.string(),
});

export type BingWallpaper = z.infer<typeof bingSchema>;

const bingResponseSchema = z.object({
  images: z.array(z.object({ url: z.string(), title: z.string(), copyright: z.string() })).min(1),
});

function localDay(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** 当天的 Bing 壁纸；每天只请求一次，请求失败时退回上次缓存的那张 */
export async function loadBingWallpaper(language: string): Promise<BingWallpaper | null> {
  const market = language.startsWith('zh') ? 'zh-CN' : 'en-US';
  const cached = bingSchema.safeParse((await browser.storage.local.get(BING_KEY))[BING_KEY]);
  const saved = cached.success ? cached.data : null;
  if (saved && saved.date === localDay() && saved.market === market) return saved;
  try {
    const response = await fetch(`${BING_ORIGIN}/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=${market}`);
    if (!response.ok) return saved;
    const [image] = bingResponseSchema.parse(await response.json()).images;
    if (!image) return saved;
    const next: BingWallpaper = {
      date: localDay(),
      market,
      url: new URL(image.url, BING_ORIGIN).href,
      title: image.title,
      copyright: image.copyright,
    };
    await browser.storage.local.set({ [BING_KEY]: next });
    return next;
  } catch {
    return saved;
  }
}
