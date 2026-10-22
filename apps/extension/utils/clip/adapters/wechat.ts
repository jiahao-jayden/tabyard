import type { RawCapture } from '../normalize'
import { htmlToMarkdown } from '../pipeline'
import * as generic from './generic'

/** 匹配微信公众号图文页。 */
export function matches(url: string): boolean {
  return /https?:\/\/mp\.weixin\.qq\.com\//.test(url)
}

/**
 * 微信公众号抽取：正文固定在 `#js_content`，把懒加载图 data-src 回填到 src 后
 * 走统一 turndown 管线。正文为空（图片/视频消息、付费内容）时回退 generic。
 */
export async function extract(url: string): Promise<RawCapture> {
  const root = (document.querySelector('#js_content') ||
    document.querySelector('#js_article')) as HTMLElement | null
  if (!root || !root.textContent?.trim()) {
    return generic.extract(url)
  }

  const clone = root.cloneNode(true) as HTMLElement
  fixImages(clone)

  const markdown = htmlToMarkdown(clone, url)
  if (!markdown) {
    return generic.extract(url)
  }

  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') || url

  return {
    source_platform: 'wechat',
    source_id: canonical,
    canonical_url: canonical,
    title: getTitle(),
    author: getAuthor(),
    captured_at: new Date().toISOString(),
    raw_text: markdown,
    outbound_urls: [],
    user_note: '',
    tags: [],
    og_image: '',
  }
}

/** 回填懒加载图真实地址（data-src），并移除 svg 占位图。 */
function fixImages(root: HTMLElement): void {
  root.querySelectorAll('img').forEach((img) => {
    const real = img.getAttribute('data-src')
    if (real) img.setAttribute('src', real)
    const src = img.getAttribute('src') || ''
    if (!src || /^data:image\/svg/i.test(src)) img.remove()
  })
}

function getTitle(): string {
  return (
    (document.querySelector('#activity-name') as HTMLElement | null)?.innerText?.trim() ||
    document.title.trim()
  )
}

function getAuthor(): string {
  const author = (
    document.querySelector('#js_author_name') as HTMLElement | null
  )?.innerText?.trim()
  const account = (document.querySelector('#js_name') as HTMLElement | null)?.innerText?.trim()
  return author || account || ''
}
