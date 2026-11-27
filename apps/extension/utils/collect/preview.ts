import { createStore, get, set } from 'idb-keyval';
import { makeCover } from './covers';

// 与用户手动保存的截图分开，自动补图不会覆盖截图或触发云同步。
const store = createStore('tabyard-page-previews', 'previews');
const HTML_LIMIT = 512 * 1024;
const IMAGE_LIMIT = 10 * 1024 * 1024;
const pending = new Set<Promise<Blob | undefined>>();

function webUrl(value: string | null, base: string): string {
  if (!value?.trim()) return '';
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function imageCandidates(html: string, pageUrl: string): string[] {
  // template 的内容不会加载脚本、iframe 或图片。
  const template = document.createElement('template');
  template.innerHTML = html;
  const doc = template.content;
  const base = webUrl(doc.querySelector('base[href]')?.getAttribute('href') ?? null, pageUrl) || pageUrl;
  const candidates = new Set<string>();
  const add = (value: string | null) => {
    const url = webUrl(value, base);
    if (url && url !== pageUrl) candidates.add(url);
  };
  for (const key of ['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']) {
    for (const meta of doc.querySelectorAll(`meta[property="${key}"], meta[name="${key}"]`)) add(meta.getAttribute('content'));
  }
  add(doc.querySelector('link[rel~="image_src"]')?.getAttribute('href') ?? null);
  // 有些页面只有正文配图；优先取主内容，跳过尺寸很小的图标。
  for (const selector of ['main img, article img, img[fetchpriority="high"]', 'img']) {
    for (const img of doc.querySelectorAll<HTMLImageElement>(selector)) {
      if ((img.width && img.width < 96) || (img.height && img.height < 64)) continue;
      add(img.getAttribute('data-src') || img.getAttribute('src'));
      if (candidates.size >= 5) break;
    }
  }
  return [...candidates].slice(0, 5);
}

// 网页只解析前半兆，图片超过上限则跳过；没有 Content-Length 时也限制实际读取量。
async function readBody(response: Response, limit: number, allowPrefix = false): Promise<Blob> {
  const reader = response.body!.getReader();
  const parts: BlobPart[] = [];
  let remaining = limit;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!allowPrefix && value.length > remaining) throw new Error('Preview image too large');
      parts.push(value.slice(0, remaining));
      remaining -= value.length;
      if (allowPrefix && remaining <= 0) break;
    }
    return new Blob(parts, { type: response.headers.get('content-type') ?? '' });
  } finally {
    void reader.cancel().catch(() => {});
  }
}

async function fetchPreview(url: string, signal: AbortSignal): Promise<Blob | undefined> {
  const request = (src: string) => fetch(src, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  });
  const page = await request(url);
  const type = page.headers.get('content-type') ?? '';
  if (page.ok && /^image\//i.test(type)) return makeCover(await readBody(page, IMAGE_LIMIT));
  if (!page.ok || !/html/i.test(type)) {
    void page.body?.cancel();
    return;
  }
  const html = await (await readBody(page, HTML_LIMIT, true)).text();
  for (const src of imageCandidates(html, page.url)) {
    signal.throwIfAborted();
    try {
      const image = await request(src);
      if (image.ok) return await makeCover(await readBody(image, IMAGE_LIMIT));
      void image.body?.cancel();
    } catch {
      // 声明的图片可能已经下线或不是图片，继续试下一个。
    }
  }
}

/** 卡片进入视口后才调用。缓存缩略图，短暂记住失败；离线或切走卡片后仍可重试。 */
export async function getPagePreview(url: string, signal: AbortSignal): Promise<Blob | undefined> {
  const cached = await get<Blob | number>(url, store).catch(() => undefined);
  if (cached instanceof Blob) return cached;
  if ((cached && cached > Date.now()) || signal.aborted || !navigator.onLine) return;
  while (pending.size >= 4) {
    await Promise.race(pending);
    if (signal.aborted) return;
  }
  const task = fetchPreview(url, AbortSignal.any([signal, AbortSignal.timeout(20_000)])).catch(() => undefined);
  pending.add(task);
  const preview = await task;
  pending.delete(task);
  if (!signal.aborted && navigator.onLine) {
    await set(url, preview ?? Date.now() + 5 * 60_000, store).catch(() => {});
  }
  return preview;
}
