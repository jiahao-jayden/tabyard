import Defuddle from 'defuddle'
import type { DefuddleOptions, DefuddleResponse } from 'defuddle'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import type { RawCapture } from './normalize'
import { hostToPlatform } from './platform'

/** 把可能是相对路径的 URL 补全为绝对 URL。失败时原样返回。 */
function absolutize(url: string, base: string): string {
  if (!url) return url
  if (/^(data:|blob:|mailto:|javascript:)/i.test(url)) return url
  try {
    return new URL(url, base).href
  } catch {
    return url
  }
}

/**
 * 构造一个统一风格的 turndown 实例：
 * - 标题用 atx (`#`)，代码块用 fenced (```)
 * - 启用 GFM（表格/删除线/任务列表）
 * - 图片保留为 `![alt](src)`，相对链接/图链补全为绝对 URL
 */
function buildTurndown(base: string): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    linkStyle: 'inlined',
  })
  td.use(gfm)

  td.addRule('absoluteImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const el = node as unknown as HTMLImageElement
      const raw =
        el.getAttribute('src') ||
        el.getAttribute('data-src') ||
        el.getAttribute('data-original') ||
        el.getAttribute('data-actualsrc') ||
        ''
      if (!raw) return ''
      const alt = el.getAttribute('alt') || ''
      return `![${alt}](${absolutize(raw, base)})`
    },
  })

  td.addRule('absoluteLink', {
    filter: (node) => node.nodeName === 'A' && !!(node as HTMLElement).getAttribute('href'),
    replacement: (content, node) => {
      const href = (node as HTMLElement).getAttribute('href') || ''
      if (!href) return content
      return `[${content}](${absolutize(href, base)})`
    },
  })

  return td
}

/**
 * 统一 HTML→Markdown 管线。
 * @param root  正文根节点（DOM 元素）或 HTML 字符串
 * @param baseUrl  用于补全相对 URL 的基准地址，默认当前页地址
 */
export function htmlToMarkdown(root: string | HTMLElement, baseUrl?: string): string {
  const base = baseUrl ?? (typeof location !== 'undefined' ? location.href : '')
  return buildTurndown(base).turndown(root).trim()
}

export interface DefuddleExtractResult {
  /** 经统一 turndown 管线转换后的正文 markdown */
  markdown: string
  /** defuddle 原始响应（含元数据 / schema.org / extractorType） */
  response: DefuddleResponse
}

/**
 * 用 defuddle 对当前 document 做通用提取（自动命中其内置 site extractor），
 * 再用统一 turndown 管线把正文 HTML 转成 markdown。
 *
 * 用 parseAsync 以便 YouTube 等 extractor 能拉到字幕；失败回退同步 parse。
 * @param options  透传给 defuddle 的额外选项（如 X/Twitter 的 includeReplies）
 * @param sourceDocument  Optional inert document for fetched HTML; defaults to the live page.
 */
export async function defuddleExtract(
  url: string,
  options?: Pick<DefuddleOptions, 'includeReplies'>,
  sourceDocument: Document = document,
): Promise<DefuddleExtractResult> {
  const defuddle = new Defuddle(sourceDocument, {
    url,
    markdown: false,
    useAsync: true,
    ...options,
  })

  let response: DefuddleResponse
  try {
    response = await defuddle.parseAsync()
  } catch {
    response = defuddle.parse()
  }

  const markdown = response.content ? htmlToMarkdown(response.content, url) : ''
  return { markdown, response }
}

/** defuddle extractorType → 我们的 source_platform 命名归一。 */
function platformFromExtractor(extractorType?: string): string | undefined {
  if (!extractorType) return undefined
  const map: Record<string, string> = {
    twitter: 'x',
    'x-article': 'x',
    'x-oembed': 'x',
  }
  return map[extractorType] ?? extractorType
}

/**
 * 把 defuddle 提取结果组装成统一的 RawCapture。
 * overrides 可覆盖任意字段（如专门 adapter 指定 source_platform/source_id）。
 */
export function captureFromDefuddle(
  url: string,
  result: DefuddleExtractResult,
  overrides: Partial<RawCapture> = {},
): RawCapture {
  const { response, markdown } = result
  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') ||
    url.replace(/\?.*$/, '')

  const base: RawCapture = {
    source_platform:
      platformFromExtractor(response.extractorType) ?? hostToPlatform(location.hostname),
    source_id: url.replace(/\?.*$/, ''),
    canonical_url: canonical,
    title: response.title || document.title,
    author: response.author || '',
    captured_at: new Date().toISOString(),
    raw_text: markdown,
    outbound_urls: [],
    user_note: '',
    tags: [],
    og_image: response.image || '',
  }

  return { ...base, ...overrides }
}
