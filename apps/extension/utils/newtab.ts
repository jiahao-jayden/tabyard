// 新标签页是用户自选的功能，默认关闭。manifest 的 chrome_url_overrides 无法运行时开关，
// 所以不声明覆盖：开启后由后台把浏览器原生新标签页重定向到 home.html。
// 只存本机，不参与云同步，也不动配置的 modifiedAt。
import { browser, type Browser } from 'wxt/browser';

export const NEWTAB_ENABLED_KEY = 'newtabEnabled';

const NATIVE_NEWTAB = /^(chrome|edge):\/\/(newtab|new-tab-page)\/?$/;

export async function isNewtabEnabled(): Promise<boolean> {
  return (await browser.storage.local.get(NEWTAB_ENABLED_KEY))[NEWTAB_ENABLED_KEY] === true;
}

export function setNewtabEnabled(enabled: boolean): Promise<void> {
  return browser.storage.local.set({ [NEWTAB_ENABLED_KEY]: enabled });
}

/**
 * 新建的标签页若是浏览器原生新标签页，且用户已开启，就换成 Tabyard 的。
 * 不用 tabs.update 原地跳转：那样浏览器会让焦点留在地址栏，搜索框拿不到光标；
 * 新建页面再关掉原生页，焦点才会进到页面里。新页面成功创建后才关闭原生页。
 */
export async function redirectNativeNewtab(tab: Browser.tabs.Tab): Promise<void> {
  const url = tab.pendingUrl ?? tab.url;
  if (tab.id == null || !url || !NATIVE_NEWTAB.test(url)) return;
  if (!(await isNewtabEnabled())) return;
  const created = await browser.tabs.create({
    url: browser.runtime.getURL('/home.html'),
    windowId: tab.windowId,
    index: tab.index,
    active: tab.active,
    openerTabId: tab.openerTabId,
  }).catch(() => null);
  if (created?.id == null) return;
  if (tab.groupId != null && tab.groupId !== -1) {
    await browser.tabs.group({ tabIds: [created.id], groupId: tab.groupId }).catch(() => {});
  }
  // 原生页可能已被用户关闭
  await browser.tabs.remove(tab.id).catch(() => {});
}
