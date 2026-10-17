// 收藏集的存储键与网址规范化：纯函数，内容脚本也会引用，所以不能依赖 rules 等较重的模块

export const COLLECT_KEY = 'collect';

/** 去掉 hash，避免同一页面因锚点不同被重复收藏；推文统一成 x.com/用户/status/ID */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (/^(www\.|mobile\.)?(x|twitter)\.com$/.test(u.hostname)) {
      u.hostname = 'x.com';
      const tweet = u.pathname.match(/^\/\w+\/status\/\d+/);
      if (tweet) {
        u.pathname = tweet[0];
        u.search = '';
      }
    }
    return u.href;
  } catch {
    return url;
  }
}
