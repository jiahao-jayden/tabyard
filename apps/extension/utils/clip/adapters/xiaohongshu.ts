import type { RawCapture } from '../normalize'
import * as generic from './generic'
import type { XhsNote } from '../xhs'

/** 匹配小红书笔记详情页（/explore/{id}、/discovery/item/{id}）。 */
export function matches(url: string): boolean {
  return /https?:\/\/(www\.)?xiaohongshu\.com\/(explore|discovery\/item)\//.test(url)
}

/**
 * 小红书抽取（不硬抓 DOM、不自建 API 签名）：
 * 1) 优先用调用方从 MAIN world 读到的 `__INITIAL_STATE__`（title/desc/imageList）；
 * 2) 未登录/缺失 → DOM 兜底（#detail-title / #detail-desc + 图片）；
 * 3) 再不行 → generic(defuddle)；
 * 4) 仍为空 → 保底（标题 + URL），绝不抛错。
 */
export async function extract(url: string, mainWorldNote: XhsNote | null = null): Promise<RawCapture> {
  let note = mainWorldNote
  if (!note || (!note.desc && !note.title && note.images.length === 0)) {
    note = readFromDom()
  }

  if (note && (note.desc || note.title || note.images.length)) {
    return buildCapture(url, note)
  }

  try {
    const fallback = await generic.extract(url)
    if (fallback.raw_text.trim()) {
      return { ...fallback, source_platform: 'xiaohongshu' }
    }
  } catch {
    // defuddle 抛错也不应中断：继续走最终保底。
  }

  // 最终保底：至少存下标题 + URL。
  return buildCapture(url, {
    title: document.title.replace(/[_\-|].*小红书.*$/, '').trim() || document.title,
    desc: '',
    images: [],
  })
}

/** DOM 兜底：结构不稳，仅作 MAIN world 失败时的补充。 */
function readFromDom(): XhsNote | null {
  const title = (document.querySelector('#detail-title') as HTMLElement | null)?.innerText?.trim() || ''
  const desc =
    (document.querySelector('#detail-desc, .note-text') as HTMLElement | null)?.innerText?.trim() ||
    ''
  const images = new Set<string>()
  document.querySelectorAll<HTMLImageElement>('.swiper-slide img, .note-slider-img').forEach((img) => {
    const src = img.getAttribute('src') || ''
    if (src && !/^data:/i.test(src)) images.add(src)
  })
  if (!title && !desc && images.size === 0) return null
  return { title, desc, images: [...images] }
}

function buildCapture(url: string, note: XhsNote): RawCapture {
  const canonical = url.replace(/\?.*$/, '')
  const noteId = canonical.match(/\/(?:explore|discovery\/item)\/([0-9a-fA-F]+)/)?.[1] || ''

  const parts: string[] = []
  if (note.desc) parts.push(note.desc)
  if (note.images.length) parts.push(note.images.map((u) => `![](${u})`).join('\n\n'))

  return {
    source_platform: 'xiaohongshu',
    source_id: noteId || canonical,
    canonical_url: canonical,
    title: note.title || document.title,
    author: getAuthor(),
    captured_at: new Date().toISOString(),
    raw_text: parts.join('\n\n'),
    outbound_urls: [],
    user_note: '',
    tags: [],
    og_image: '',
  }
}

function getAuthor(): string {
  const el = document.querySelector(
    '.author-wrapper .username, .author-container .name, [class*="author"] .name',
  ) as HTMLElement | null
  return el?.innerText?.trim() || ''
}
