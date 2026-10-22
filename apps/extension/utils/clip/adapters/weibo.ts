import type { RawCapture } from '../normalize'
import { htmlToMarkdown } from '../pipeline'
import * as generic from './generic'

/** 匹配微博单条页面（移动端 m.weibo.cn 与桌面端 weibo.com）。 */
export function matches(url: string): boolean {
  return /https?:\/\/(m\.weibo\.cn|(www\.)?weibo\.com)\//.test(url)
}

/** 正文容器候选：优先移动端（DOM 较稳），桌面端类名被哈希故用属性前缀匹配。 */
const TEXT_SELECTORS = [
  '.weibo-text', // m.weibo.cn 单条正文
  '.f-weibo-text',
  '[class*="detail_wbtext"]', // weibo.com 详情页（哈希类名，用前缀匹配）
  '.WB_text', // 旧版桌面端
]

/**
 * 微博抽取：定位单条正文根节点 → 回填懒加载图真实地址、补齐 background-image 图片
 * → 统一 turndown 管线。任一步失败均优雅回退 generic(defuddle)，绝不抛错中断。
 */
export async function extract(url: string): Promise<RawCapture> {
  const root = findRoot()
  if (!root || !root.textContent?.trim()) {
    return generic.extract(url)
  }

  const clone = root.cloneNode(true) as HTMLElement
  fixImages(clone)
  let markdown = htmlToMarkdown(clone, url)

  // 微博图片常脱离正文容器（独立的九宫格区域），单独收集后追加。
  const extraImages = collectImages(root)
  if (extraImages.length) {
    markdown += '\n\n' + extraImages.map((u) => `![](${u})`).join('\n\n')
  }

  if (!markdown.trim()) {
    return generic.extract(url)
  }

  const canonical =
    document.querySelector('link[rel="canonical"]')?.getAttribute('href') || url.replace(/\?.*$/, '')

  return {
    source_platform: 'weibo',
    source_id: url.replace(/\?.*$/, ''),
    canonical_url: canonical,
    title: getTitle(root),
    author: getAuthor(),
    captured_at: new Date().toISOString(),
    raw_text: markdown,
    outbound_urls: [],
    user_note: '',
    tags: [],
    og_image: '',
  }
}

function findRoot(): HTMLElement | null {
  for (const sel of TEXT_SELECTORS) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el?.textContent?.trim()) return el
  }
  return null
}

/** 回填懒加载图真实地址（data-src），移除占位图。 */
function fixImages(root: HTMLElement): void {
  root.querySelectorAll('img').forEach((img) => {
    const real = img.getAttribute('data-src') || img.getAttribute('src')
    if (real && !/^data:/i.test(real)) img.setAttribute('src', real)
    else img.remove()
  })
}

/** 从正文及其相邻媒体区收集图片：含 <img> 与 background-image 形式（移动端九宫格用后者）。 */
function collectImages(root: HTMLElement): string[] {
  const scope =
    (root.closest('.card, .weibo-main, .weibo-og') as HTMLElement | null) ?? document
  const urls = new Set<string>()

  scope.querySelectorAll<HTMLImageElement>('.weibo-media img, .pic-box img, .WB_pic img').forEach(
    (img) => {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || ''
      if (src && !/^data:/i.test(src)) urls.add(src)
    },
  )

  scope.querySelectorAll<HTMLElement>('.f-bg-img, [style*="background-image"]').forEach((el) => {
    const m = el.getAttribute('style')?.match(/background-image:\s*url\((['"]?)(.+?)\1\)/i)
    if (m?.[2] && !/^data:/i.test(m[2])) urls.add(m[2])
  })

  return [...urls]
}

function getTitle(root: HTMLElement): string {
  const text = root.textContent?.replace(/\s+/g, ' ').trim() || ''
  return text.slice(0, 60) || document.title.replace(/ - 微博$/, '').trim()
}

function getAuthor(): string {
  const el = document.querySelector(
    '.weibo-top .name, .card .name, .m-text-box .name, [class*="ProfileHeader_name"]',
  ) as HTMLElement | null
  return el?.innerText?.trim() || ''
}
