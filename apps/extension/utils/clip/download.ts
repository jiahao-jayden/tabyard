export function safeFilename(title: string, ext: string, fallback: string): string {
  const cleaned = title.normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(?:md|markdown|html?|png)$/i, '')
    .replace(/^[. ]+|[. ]+$/g, '')
  const encoder = new TextEncoder()
  let name = ''
  let bytes = 0
  for (const character of cleaned) {
    bytes += encoder.encode(character).length
    if (bytes > 180) break
    name += character
  }
  name = name.replace(/[. ]+$/g, '') || fallback
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`
  return `${name}.${ext}`
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  let started = false
  try {
    link.href = url
    link.download = filename
    link.hidden = true
    document.body.append(link)
    link.click()
    started = true
  } finally {
    link.remove()
    // The browser consumes the Blob asynchronously after the click.
    if (started) setTimeout(() => URL.revokeObjectURL(url), 60_000)
    else URL.revokeObjectURL(url)
  }
}

/** Initiate a browser download of exactly the text shown by the popup. */
export function downloadMarkdown(markdown: string, title: string): string {
  const filename = safeFilename(title, 'md', 'page-clip')
  downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), filename)
  return filename
}
