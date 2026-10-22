import type { RawCapture } from '../normalize'
import type { XhsNote } from '../xhs'
import * as twitter from './twitter'
import * as zhihu from './zhihu'
import * as wechat from './wechat'
import * as weibo from './weibo'
import * as xiaohongshu from './xiaohongshu'
import * as generic from './generic'
import * as push from './push'

export interface Adapter {
  /** adapter 名称（仅用于调试/日志） */
  name: string
  /** 是否匹配当前 URL */
  matches(url: string): boolean
  /** 抽取为统一的 RawCapture（可同步或异步） */
  extract(url: string, xhsNote?: XhsNote | null): RawCapture | Promise<RawCapture>
}

/**
 * adapter 注册表：按序匹配，命中第一个专门 adapter；
 * 都不命中时回退到 generic（defuddle 通用提取）。
 * 专门 adapter 排在前面，generic 永远兜底放最后。
 */
// 注：B站不单列 adapter——defuddle 内置的 bilibili extractor 已完整抓取字幕
// （view→player/v2→subtitle_url），故视频页直接走 generic(defuddle) 即可，
// 无需额外权限。
const adapters: Adapter[] = [
  { name: 'twitter', matches: twitter.matches, extract: twitter.extract },
  { name: 'zhihu', matches: zhihu.matches, extract: zhihu.extract },
  { name: 'wechat', matches: wechat.matches, extract: wechat.extract },
  { name: 'weibo', matches: weibo.matches, extract: weibo.extract },
  { name: 'xiaohongshu', matches: xiaohongshu.matches, extract: xiaohongshu.extract },
  { name: 'push', matches: push.matches, extract: push.extract },
  { name: 'generic', matches: generic.matches, extract: generic.extract },
]

/** 路由：选出第一个匹配的 adapter 并执行抽取。 */
export async function extractForUrl(url: string, xhsNote: XhsNote | null = null): Promise<RawCapture> {
  const adapter = adapters.find((a) => a.matches(url)) ?? { extract: generic.extract }
  return await adapter.extract(url, xhsNote)
}
