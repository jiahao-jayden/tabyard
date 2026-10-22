import type { RawCapture } from '../normalize'
import { defuddleExtract, captureFromDefuddle } from '../pipeline'

/**
 * 通用兜底 adapter：任意网页都可用。
 * 走 defuddle 通用提取（自动命中其内置 site extractor，如 reddit/medium/github/
 * youtube/hackernews/bilibili）+ 统一 turndown 管线，保留标题/段落/列表/代码块/图片。
 */
export function matches(_url: string): boolean {
  return true
}

export async function extract(url: string): Promise<RawCapture> {
  const result = await defuddleExtract(url)
  return captureFromDefuddle(url, result)
}
