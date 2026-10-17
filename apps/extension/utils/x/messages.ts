// 后台处理与 X 相关的消息：来自 x.com 页面上的脚本，数据必须校验后再使用
import { z } from 'zod';
import { importBookmarks, removeBookmarkByUrl } from '../collect/store';
import { finishXFetch } from './cache';
import { handleXFetchEnd, handleXFetchPage, startXFetch } from './fetch-job';
import { extractedTweetSchema, tweetToBookmark } from './tweet';

const startSchema = z.object({ full: z.boolean().optional() });
const saveSchema = z.object({ type: z.literal('x-save'), tweet: extractedTweetSchema });
const unsaveSchema = z.object({ type: z.literal('x-unsave'), url: z.string().max(300) });

/** 不是 X 的消息返回 undefined，由调用方继续处理 */
export function handleXMessage(msg: unknown): Promise<unknown> | undefined {
  const type = (msg as { type?: string } | undefined)?.type;
  switch (type) {
    case 'x-fetch-start':
      void startXFetch(startSchema.safeParse(msg).data?.full === true).catch((error: Error) => finishXFetch(error.message));
      return Promise.resolve({ ok: true });
    case 'x-fetch-page':
      return handleXFetchPage(msg);
    case 'x-fetch-end':
      return handleXFetchEnd(msg).then(() => ({ ok: true }));
    case 'x-save': {
      const parsed = saveSchema.safeParse(msg);
      if (!parsed.success) return Promise.resolve({ ok: false });
      return importBookmarks([tweetToBookmark(parsed.data.tweet, Date.now())]).then(() => ({ ok: true }));
    }
    case 'x-unsave': {
      const parsed = unsaveSchema.safeParse(msg);
      if (!parsed.success) return Promise.resolve({ ok: false });
      return removeBookmarkByUrl(parsed.data.url).then(() => ({ ok: true }));
    }
    default:
      return undefined;
  }
}
