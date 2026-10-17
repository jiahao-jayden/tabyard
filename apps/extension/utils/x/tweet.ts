// 推文的数据形状与校验：页面脚本、后台、界面共用，不依赖 DOM 或浏览器 API
import { z } from 'zod';
import type { BookmarkInput } from '../collect/store';

const httpsUrlOrEmpty = z.union([z.literal(''), z.string().url().startsWith('https://')]).pipe(z.string().max(1000));

export const extractedTweetSchema = z.object({
  url: z.string().regex(/^https:\/\/x\.com\/\w{1,15}\/status\/\d+$/),
  authorName: z.string().max(100),
  handle: z.string().regex(/^\w{1,15}$/),
  avatar: httpsUrlOrEmpty,
  text: z.string().max(5000),
  image: httpsUrlOrEmpty,
  postedAt: z.number().int().nonnegative(),
});

export type ExtractedTweet = z.infer<typeof extractedTweetSchema>;

/** createdAt 决定收藏集里的先后：导入时按 X 的顺序依次递减，保证和 X 一致 */
export function tweetToBookmark(tweet: ExtractedTweet, createdAt: number): BookmarkInput & { createdAt: number } {
  return {
    url: tweet.url,
    title: `${tweet.authorName} (@${tweet.handle})`,
    description: tweet.text,
    image: tweet.image,
    favicon: tweet.avatar,
    folderId: null,
    source: { type: 'tweet', authorName: tweet.authorName, handle: tweet.handle, postedAt: tweet.postedAt },
    createdAt,
  };
}
