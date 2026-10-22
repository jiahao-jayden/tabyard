import type { RawCapture } from '../normalize'
import { defuddleExtract, captureFromDefuddle } from '../pipeline'

/** 判断当前页面是否是单条推文/线程页 */
export function matches(url: string): boolean {
  return /https?:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(url)
}

/**
 * 推文抽取：优先用 defuddle 的 twitter/x extractor（保留图片/线程结构），
 * 失败时回退到读取可见 tweetText 节点拼接，保证至少能存下 URL。
 * 无论哪条路径，都统一补齐 source_platform='x' 与 source_id=推文 id。
 */
export async function extract(url: string): Promise<RawCapture> {
  const source_id = url.match(/status\/(\d+)/)?.[1] ?? ''
  const author = url.match(/(?:x|twitter)\.com\/([^/]+)\/status/)?.[1] ?? ''

  // 不要复制评论：只保留作者自己的推文（含连续 thread），排除他人回复。
  const result = await defuddleExtract(url, { includeReplies: false })
  if (result.markdown) {
    return captureFromDefuddle(url, result, {
      source_platform: 'x',
      source_id,
      author: result.response.author || author,
    })
  }

  return fallbackExtract(url, source_id, author)
}

/** 读取一条推文 article 的作者 handle（去掉开头的 `@`），读不到时返回空字符串。 */
function getArticleHandle(article: Element): string {
  const nameElement = article.querySelector('[data-testid="User-Name"]')
  const links = nameElement?.querySelectorAll('a')
  const handle = links?.[1]?.textContent?.trim() ?? ''
  return handle.replace(/^@/, '')
}

/**
 * defuddle 抽空时的 DOM 兜底。
 * 只保留主推文作者本人、连续排在最前的推文（thread），遇到第一条他人的推文就停止——
 * 与 defuddle 的 `includeReplies: false` 行为对齐，不把评论当正文复制。
 * 一条都没匹配上（比如页面结构变化、拿不到 handle）时退回第一条 tweetText，保证至少有内容。
 */
function fallbackExtract(url: string, source_id: string, author: string): RawCapture {
  const authorHandle = author.toLowerCase()
  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'))

  const keptArticles: Element[] = []
  for (const article of articles) {
    const handle = getArticleHandle(article).toLowerCase()
    if (!handle || handle !== authorHandle) break
    keptArticles.push(article)
  }

  const tweetTextOf = (scope: Element | Document) =>
    (scope.querySelector('[data-testid="tweetText"]') as HTMLElement | null)?.innerText.trim() ??
    ''

  const blocks = keptArticles.map(tweetTextOf).filter(Boolean)
  // 一条也没保留（比如拿不到 handle）时，退回第一条 tweetText，保证至少有内容。
  const textBlocks = blocks.length ? blocks : [tweetTextOf(document)].filter(Boolean)
  const raw_text = textBlocks.length ? textBlocks.join('\n\n---\n\n') : document.title

  const outbound_urls = keptArticles
    .flatMap((article) =>
      Array.from(article.querySelectorAll('a[href^="https://t.co/"], a[href^="http"]')),
    )
    .map((a) => (a as HTMLAnchorElement).href)
    .filter((h) => !/(x|twitter)\.com/.test(h))

  return {
    source_platform: 'x',
    source_id,
    canonical_url: url.replace(/\?.*$/, ''),
    title: textBlocks[0]?.slice(0, 80) || `@${author} 的推文`,
    author,
    captured_at: new Date().toISOString(),
    raw_text,
    outbound_urls: [...new Set(outbound_urls)],
    user_note: '',
    tags: [],
    og_image: '',
  }
}
