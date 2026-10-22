import type { RawCapture } from '../normalize'
import { htmlToMarkdown } from '../pipeline'
import * as generic from './generic'

/** 匹配知乎回答 / 专栏文章 / 想法 等页面。 */
export function matches(url: string): boolean {
  return /https?:\/\/([\w-]+\.)?zhihu\.com\//.test(url)
}

/** 正文根节点候选（按页面类型从具体到通用排序）。 */
const ROOT_SELECTORS = [
  '.Post-RichTextContainer .RichText', // 专栏文章
  '.AnswerCard .RichContent-inner .RichText', // 回答（详情页）
  '.ContentItem .RichText', // 回答（列表内）
  '.PinItem .RichText', // 想法 pin
  '.RichText', // 兜底
]

/**
 * 知乎抽取：定位正文 `.RichText` 根节点 → 回填懒加载图真实地址、还原公式 LaTeX
 * → 统一 turndown 管线转 markdown。定位不到正文时优雅回退 generic(defuddle)。
 */
export async function extract(url: string): Promise<RawCapture> {
  expandCollapsed()

  const root = findRoot()
  if (!root || !root.textContent?.trim()) {
    return generic.extract(url)
  }

  const clone = root.cloneNode(true) as HTMLElement
  fixImages(clone)
  fixFormulas(clone)

  const markdown = htmlToMarkdown(clone, url)
  if (!markdown) {
    return generic.extract(url)
  }

  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') || url.replace(/\?.*$/, '')

  return {
    source_platform: 'zhihu',
    source_id: url.replace(/\?.*$/, ''),
    canonical_url: canonical,
    title: getTitle(url),
    author: getAuthor(),
    captured_at: new Date().toISOString(),
    raw_text: markdown,
    outbound_urls: [],
    user_note: '',
    tags: [],
    og_image: '',
  }
}

/** 若回答处于折叠态，点击「展开全文」让正文完整呈现（知乎折叠仅是 CSS，内容已在 DOM 中）。 */
function expandCollapsed(): void {
  const more = document.querySelector(
    '.RichContent.is-collapsed .ContentItem-more',
  ) as HTMLElement | null
  more?.click()
}

function findRoot(): HTMLElement | null {
  for (const sel of ROOT_SELECTORS) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el?.textContent?.trim()) return el
  }
  return null
}

/** 把懒加载图的真实地址回填到 src，避免 turndown 取到 svg 占位图。 */
function fixImages(root: HTMLElement): void {
  root.querySelectorAll('img').forEach((img) => {
    const real = realImageUrl(img)
    if (real) img.setAttribute('src', real)
  })
}

/** 真实图链优先级：data-actualsrc → data-original → src（排除 svg/data 占位）→ figure>noscript 兜底。 */
function realImageUrl(img: HTMLImageElement): string {
  const candidates = [
    img.getAttribute('data-actualsrc'),
    img.getAttribute('data-original'),
    img.getAttribute('src'),
  ]
  for (const c of candidates) {
    if (c && !/^data:/i.test(c)) return c
  }

  const noscript = img.closest('figure')?.querySelector('noscript')
  if (noscript?.textContent) {
    const m = noscript.textContent.match(/<img[^>]+(?:data-original|src)="([^"]+)"/i)
    if (m?.[1]) return m[1]
  }
  return ''
}

/** 知乎公式渲染为 SVG，真实 LaTeX 藏在 data-tex；还原成 `$...$` 否则丢失。 */
function fixFormulas(root: HTMLElement): void {
  root.querySelectorAll('span.ztext-math[data-tex]').forEach((span) => {
    const tex = span.getAttribute('data-tex')
    if (tex) span.replaceWith(span.ownerDocument.createTextNode(`$${tex}$`))
  })
}

function getTitle(url: string): string {
  const isColumn = /zhuanlan\.zhihu\.com\/p\//.test(url)
  const sel = isColumn ? '.Post-Title' : '.QuestionHeader-title'
  return (
    (document.querySelector(sel) as HTMLElement | null)?.innerText?.trim() ||
    document.title.replace(/ - 知乎$/, '').trim()
  )
}

function getAuthor(): string {
  const el = document.querySelector(
    '.AuthorInfo-name .UserLink-link, .AuthorInfo-name, .AuthorInfo .UserLink-link',
  ) as HTMLElement | null
  return el?.innerText?.trim() || ''
}
