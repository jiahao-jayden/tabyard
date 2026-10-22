const PLATFORM_LABELS: Record<string, string> = {
  x: 'X',
  zhihu: '知乎',
  wechat: '微信',
  weibo: '微博',
  xiaohongshu: '小红书',
  reddit: 'Reddit',
  medium: 'Medium',
  github: 'GitHub',
  youtube: 'YouTube',
  hackernews: 'Hacker News',
  bilibili: 'B站',
  article: 'article',
}

/** 按 hostname 粗分类平台名（popup 即时展示与 defuddle 兜底共用）。 */
export function hostToPlatform(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  const isHost = (domain: string) => host === domain || host.endsWith(`.${domain}`)

  if (isHost('zhihu.com')) return 'zhihu'
  if (isHost('mp.weixin.qq.com')) return 'wechat'
  if (isHost('weibo.com') || isHost('weibo.cn')) return 'weibo'
  if (isHost('xiaohongshu.com')) return 'xiaohongshu'
  if (isHost('reddit.com')) return 'reddit'
  if (isHost('medium.com')) return 'medium'
  if (isHost('github.com')) return 'github'
  if (isHost('youtube.com') || isHost('youtu.be')) return 'youtube'
  if (isHost('news.ycombinator.com')) return 'hackernews'
  if (isHost('bilibili.com') || isHost('b23.tv')) return 'bilibili'
  if (isHost('x.com') || isHost('twitter.com')) return 'x'
  return 'article'
}

export function platformDisplayName(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform
}
