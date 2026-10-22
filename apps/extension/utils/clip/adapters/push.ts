import { browser } from 'wxt/browser'
import type { RawCapture } from '../normalize'
import { captureFromDefuddle, defuddleExtract } from '../pipeline'
import { parsePushViewerSource, PUSH_CONTENT_ORIGIN, PUSH_CONTENT_REQUEST, pushShareId } from '../push-share'
import type { PushContentResponse } from '../push-share'
import * as generic from './generic'

export function matches(url: string): boolean {
  return pushShareId(url) !== null
}

export async function extract(url: string): Promise<RawCapture> {
  const pageTitle = document.title.trim()
  try {
    const id = pushShareId(url)
    const frame = [...document.querySelectorAll('iframe[src]')].find(
      (element) => pushShareId((element as HTMLIFrameElement).src, PUSH_CONTENT_ORIGIN) === id,
    )
    if (!id || !frame) return generic.extract(url)

    const result: PushContentResponse = await browser.runtime.sendMessage({ type: PUSH_CONTENT_REQUEST })
    if (!result?.ok || result.url !== `${PUSH_CONTENT_ORIGIN}/s/${id}`) return generic.extract(url)
    const viewer = new DOMParser().parseFromString(result.html, 'text/html')
    const source = [...viewer.querySelectorAll('script')].map((script) => parsePushViewerSource(script.textContent ?? '')).find(Boolean)
    let contentDocument = viewer
    let markdown = ''
    let title = ''
    if (source?.kind === 'markdown') {
      markdown = source.content.trim()
      title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? ''
    } else {
      if (source?.kind === 'html') {
        contentDocument = new DOMParser().parseFromString(source.content, 'text/html')
      }
      const extracted = await defuddleExtract(result.url, undefined, contentDocument)
      markdown = extracted.markdown
      title = contentDocument.querySelector('h1')?.textContent?.trim() || extracted.response.title
      if (markdown.trim()) {
        return captureFromDefuddle(url, extracted, {
          source_platform: 'push', source_id: url, canonical_url: url,
          title: pageTitle || title,
        })
      }
    }
    if (!markdown.trim()) return generic.extract(url)
    return {
      source_platform: 'push', source_id: url, canonical_url: url,
      title: pageTitle || title, author: '', captured_at: new Date().toISOString(),
      raw_text: markdown, outbound_urls: [], user_note: '', tags: [], og_image: '',
    }
  } catch {
    return generic.extract(url)
  }
}
