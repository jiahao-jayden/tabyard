import type { Browser } from 'wxt/browser'

export const PUSH_CONTENT_REQUEST = 'FETCH_PUSH_SHARE'
export const PUSH_CONTENT_ORIGIN = 'https://push-content.com'
const MAX_CONTENT_BYTES = 8 * 1024 * 1024

export type PushContentResponse =
  | { ok: true; html: string; url: string }
  | { ok: false; error: string }

export function pushShareId(value: string, origin = 'https://push.computer'): string | null {
  try {
    const url = new URL(value)
    if (url.origin !== origin || url.username || url.password) return null
    return /^\/s\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1] ?? null
  } catch {
    return null
  }
}

/** Derive the fetch URL from the sender, never from an arbitrary message URL. */
export async function fetchPushShare(
  sender: Browser.runtime.MessageSender,
): Promise<PushContentResponse> {
  const id = sender.url && pushShareId(sender.url)
  if (!id || sender.frameId !== 0 || sender.tab?.id === undefined) {
    return { ok: false, error: 'Invalid Push share sender' }
  }

  const url = `${PUSH_CONTENT_ORIGIN}/s/${id}`
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`Push content HTTP ${response.status}`)
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('text/html')) {
      throw new Error('Unsupported Push content type')
    }
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Empty Push content response')
    const decoder = new TextDecoder()
    let bytes = 0
    let html = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > MAX_CONTENT_BYTES) throw new Error('Push content is too large')
        html += decoder.decode(value, { stream: true })
      }
      html += decoder.decode()
    } finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    return { ok: true, html, url }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
}

/** The published viewer embeds its source as a JSON string; never eval its bootstrap. */
export function parsePushViewerSource(script: string): { kind: 'markdown' | 'html'; content: string } | null {
  const source = /^\s*\(function\(\)\s*\{\s*(?:var|const|let) C\s*=\s*("(?:[^"\\]|\\.)*")\s*;/.exec(script)
  if (!source) return null
  const bootstrap = script.slice(source[0].length)
  const renderer = /function boot\(\)\s*\{\s*try\s*\{\s*window\.(__renderMarkdown|__renderHTMLLive|__renderHTMLPreview)\(C\)/.exec(bootstrap)?.[1]
  if (!renderer) return null
  try {
    const content: unknown = JSON.parse(source[1] ?? '')
    if (typeof content !== 'string' || !content.trim()) return null
    return { kind: renderer === '__renderMarkdown' ? 'markdown' : 'html', content }
  } catch {
    return null
  }
}
