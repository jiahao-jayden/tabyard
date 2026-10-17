// 「在 X 帖子上显示收藏按钮」：用户开启时才申请 x.com 权限，并运行时注册内容脚本
import { browser } from 'wxt/browser';
import { X_ORIGINS } from './origins';

const SCRIPT_ID = 'x-button';
const FLAG_KEY = 'xButtonEnabled';

async function isRegistered(): Promise<boolean> {
  return (await browser.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })).length > 0;
}

async function register(): Promise<void> {
  if (await isRegistered()) return;
  await browser.scripting.registerContentScripts([
    { id: SCRIPT_ID, matches: X_ORIGINS, js: ['content-scripts/x-button.js'], runAt: 'document_idle', persistAcrossSessions: true },
  ]);
}

export async function isXButtonEnabled(): Promise<boolean> {
  const stored = (await browser.storage.local.get(FLAG_KEY))[FLAG_KEY];
  return stored === true && (await browser.permissions.contains({ origins: X_ORIGINS }));
}

/** 必须在用户点击事件里调用（要弹出权限请求） */
export async function enableXButton(): Promise<boolean> {
  if (!(await browser.permissions.request({ origins: X_ORIGINS }))) return false;
  await register();
  await browser.storage.local.set({ [FLAG_KEY]: true });
  return true;
}

export async function disableXButton(): Promise<void> {
  await browser.storage.local.set({ [FLAG_KEY]: false });
  if (await isRegistered()) await browser.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
}

/** 扩展更新后动态注册的脚本可能丢失，后台启动时按用户的开关补注册 */
export async function syncXButton(): Promise<void> {
  if (await isXButtonEnabled()) await register();
}
