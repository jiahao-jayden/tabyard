// 新标签页的快捷方式：只存本机，不参与云同步，也不动配置的 modifiedAt
import { browser } from 'wxt/browser';
import { z } from 'zod';
import { withLock } from './rules';

export const MAX_SHORTCUTS = 24;

const KEY = 'shortcuts';
const LOCK = 'tabyard-shortcuts';

const iconSchema = z.discriminatedUnion('type', [
  /** 浏览器缓存的站点图标：快，但没访问过的站点取不到 */
  z.object({ type: z.literal('cache') }),
  z.object({ type: z.literal('letter') }),
  /** 从网站读取的高清图标，保存时取一次，之后不再联网 */
  z.object({ type: z.literal('online'), data: z.string().startsWith('data:image/').max(300_000) }),
  /** 用户上传的图片 */
  z.object({ type: z.literal('image'), data: z.string().startsWith('data:image/').max(300_000) }),
]);

const shortcutsSchema = z.array(z.object({
  id: z.string().min(1),
  title: z.string(),
  url: z.string().url().refine((value) => /^https?:\/\//i.test(value)),
  icon: iconSchema.default({ type: 'cache' }),
})).max(MAX_SHORTCUTS);

export type Shortcut = z.infer<typeof shortcutsSchema>[number];
export type ShortcutIcon = Shortcut['icon'];

/** 新增时默认从网站读取图标；data 在弹窗里取到后才填 */
export const NEW_SHORTCUT: Omit<Shortcut, 'id'> = { title: '', url: '', icon: { type: 'online', data: '' } };

const ICON_SIZE = 128;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 位图等比缩到 128px 以内（不放大），存成 PNG data URL */
export async function rasterToDataUrl(image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, ICON_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return blobToDataUrl(await canvas.convertToBlob({ type: 'image/png' }));
}

export const SHORTCUTS_KEY = KEY;

export async function loadShortcuts(): Promise<Shortcut[]> {
  const stored = (await browser.storage.local.get(KEY))[KEY];
  return shortcutsSchema.parse(stored ?? []);
}

/** 读-改-写放在锁内，多个新标签页可能同时编辑 */
export function mutateShortcuts(fn: (list: Shortcut[]) => Shortcut[]): Promise<void> {
  return withLock(LOCK, async () => {
    const next = shortcutsSchema.parse(fn(await loadShortcuts()));
    await browser.storage.local.set({ [KEY]: next });
  });
}
