// 水印的本机设置，不参与云同步。只在后台和设置页使用：offscreen 文档读不了存储，
// 所以后台用 loadWatermarkConfig 读好再传给它
import { browser } from 'wxt/browser';
import { fetchAccount } from './api';
import {
  DEFAULT_WATERMARK_POSITION,
  WATERMARK_POSITIONS,
  type WatermarkConfig,
  type WatermarkPosition,
  type WatermarkUser,
} from './watermark';

export const WATERMARK_KEY = 'watermarkEnabled';
export const WATERMARK_SHOW_USER_KEY = 'watermarkShowUser';
export const WATERMARK_POSITION_KEY = 'watermarkPosition';
export const WATERMARK_USER_KEY = 'watermarkUser';

/** 本机缓存的登录用户；image 是头像原地址，只用来判断头像是否需要重新下载 */
interface CachedUser extends WatermarkUser {
  image: string | null;
}

/** 截图和录屏开始前确认登录态的最长等待，超时按未登录处理 */
const VERIFY_TIMEOUT_MS = 3000;
const AVATAR_SIZE = 64;

const storage = () => browser.storage.local;

export async function isWatermarkEnabled(): Promise<boolean> {
  return (await storage().get(WATERMARK_KEY))[WATERMARK_KEY] !== false;
}

export function setWatermarkEnabled(enabled: boolean): Promise<void> {
  return storage().set({ [WATERMARK_KEY]: enabled });
}

/** 用户名会烧进图片和视频，发出去撤不回来，所以默认关闭 */
export async function isShowUserEnabled(): Promise<boolean> {
  return (await storage().get(WATERMARK_SHOW_USER_KEY))[WATERMARK_SHOW_USER_KEY] === true;
}

export function setShowUserEnabled(enabled: boolean): Promise<void> {
  return storage().set({ [WATERMARK_SHOW_USER_KEY]: enabled });
}

export async function getWatermarkPosition(): Promise<WatermarkPosition> {
  const stored = (await storage().get(WATERMARK_POSITION_KEY))[WATERMARK_POSITION_KEY];
  return WATERMARK_POSITIONS.find((p) => p === stored) ?? DEFAULT_WATERMARK_POSITION;
}

export function setWatermarkPosition(position: WatermarkPosition): Promise<void> {
  return storage().set({ [WATERMARK_POSITION_KEY]: position });
}

export async function getCachedUser(): Promise<WatermarkUser | null> {
  return ((await storage().get(WATERMARK_USER_KEY))[WATERMARK_USER_KEY] as CachedUser | undefined) ?? null;
}

/** 头像居中裁成正方形并缩小，避免缓存和跨上下文传递过大的数据 */
async function shrinkAvatar(url: string): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(AVATAR_SIZE, AVATAR_SIZE);
    canvas.getContext('2d')!.drawImage(
      bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE,
    );
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * 向服务端确认登录态并刷新用户缓存，返回当前登录的用户；未登录、离线或超时都返回 null 并清掉缓存。
 * 头像地址没变就不重新下载
 */
export async function refreshWatermarkUser(): Promise<WatermarkUser | null> {
  const user = await Promise.race([
    fetchAccount(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), VERIFY_TIMEOUT_MS)),
  ]);
  if (!user) {
    await storage().remove(WATERMARK_USER_KEY);
    return null;
  }
  const cached = (await storage().get(WATERMARK_USER_KEY))[WATERMARK_USER_KEY] as CachedUser | undefined;
  const avatar = cached && cached.image === user.image
    ? cached.avatar
    : user.image ? await shrinkAvatar(user.image) : null;
  await storage().set({ [WATERMARK_USER_KEY]: { name: user.name, image: user.image, avatar } satisfies CachedUser });
  return { name: user.name, avatar };
}

/** 水印关闭时返回 null；用户段必须同时满足：开关打开且此刻确认已登录 */
export async function loadWatermarkConfig(): Promise<WatermarkConfig | null> {
  if (!(await isWatermarkEnabled())) return null;
  return {
    user: (await isShowUserEnabled()) ? await refreshWatermarkUser() : null,
    position: await getWatermarkPosition(),
  };
}
