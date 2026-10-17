// 注入到 x.com 页面里翻页请求书签接口。请求头、地址取自 X 自己刚发出的那次请求，
// 在页面里以同源方式发出，所以 Cookie、Origin 都和 X 自己的一样。由后台任务注入，不常驻
import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { parseBookmarksResponse } from '@/utils/x/parse';

export interface XFetchJob {
  url: string;
  headers: Record<string, string>;
}

declare global {
  interface Window {
    __tabyardXFetch?: XFetchJob;
  }
}

const MAX_PAGES = 300;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(): Promise<void> {
  const job = window.__tabyardXFetch;
  if (!job) return;
  delete window.__tabyardXFetch;

  const counts: number[] = [];
  const end = (error?: string, reason?: string) =>
    browser.runtime.sendMessage({ type: 'x-fetch-end', error, pages: counts.length, reason, counts });
  const base = new URL(job.url);
  let cursor: string | null = null;
  let reason = 'cap';

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(base);
      const variables = JSON.parse(url.searchParams.get('variables') ?? '{}') as Record<string, unknown>;
      if (cursor) variables.cursor = cursor;
      else delete variables.cursor;
      url.searchParams.set('variables', JSON.stringify(variables));

      const res = await fetch(url, { headers: job.headers, credentials: 'include' });
      if (!res.ok) {
        await end(`HTTP ${res.status}`);
        return;
      }
      const { tweets, nextCursor } = parseBookmarksResponse(await res.json());
      counts.push(tweets.length);
      // 后台写入缓存后告诉我们是否继续：增量更新碰到已缓存的推文就该停了
      const reply = (await browser.runtime.sendMessage({ type: 'x-fetch-page', tweets })) as { continue: boolean } | undefined;
      if (!reply) {
        await end('no response from the extension');
        return;
      }
      if (!reply.continue) { reason = 'known'; break; }
      if (tweets.length === 0) { reason = 'empty'; break; }
      if (!nextCursor) { reason = 'end'; break; }
      cursor = nextCursor;
      await sleep(400 + Math.random() * 500);
    }
    await end(undefined, reason);
  } catch (error) {
    await end((error as Error).message);
  }
}

// 循环放到后台继续跑，注入调用立即返回：抓完后后台会关掉标签页，不能让 executeScript 等到那时
export default defineUnlistedScript(() => {
  void run();
});
