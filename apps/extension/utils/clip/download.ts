export function markdownFilename(title: string): string {
  const cleaned = title.normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.(?:md|markdown|html?)$/i, '')
    .replace(/^[. ]+|[. ]+$/g, '')
  const encoder = new TextEncoder()
  let name = ''
  let bytes = 0
  for (const character of cleaned) {
    bytes += encoder.encode(character).length
    if (bytes > 180) break
    name += character
  }
  name = name.replace(/[. ]+$/g, '') || 'page-clip'
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`
  return `${name}.md`
}

/** Initiate a browser download of exactly the text shown by the popup. */
export function downloadMarkdown(markdown: string, title: string): string {
  const filename = markdownFilename(title)
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
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
  return filename
}
