import { CHROME_EXTENSION_ID } from '~/i18n';

// Chrome 浏览器自己检查更新用的接口，返回商店当前上架的版本；失败返回 null
const UPDATE_URL = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=130.0&acceptformat=crx3&x=id%3D${CHROME_EXTENSION_ID}%26uc`;

export async function getStoreVersion(): Promise<string | null> {
  try {
    const res = await fetch(UPDATE_URL, { cf: { cacheTtl: 600, cacheEverything: true } });
    if (!res.ok) return null;
    return (await res.text()).match(/<updatecheck[^>]*\sversion="([\d.]+)"/)?.[1] ?? null;
  } catch (e) {
    console.error(e);
    return null;
  }
}
