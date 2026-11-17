// 获取网站的高清图标：读首页声明的图标（矢量优先、尺寸大优先），再试常见路径，最后用 Google 的图标服务兜底。
// 取到后存成 data URL，之后不再联网。做法参考 Lumno 的 shortcut-icons。
import { blobToDataUrl, rasterToDataUrl } from './shortcuts';

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML = 300_000;
const MAX_ICON_BYTES = 512 * 1024;
const MIN_DIMENSION = 16;

interface Candidate {
  url: string;
  score: number;
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return (match?.[2] ?? match?.[3] ?? match?.[4] ?? '').trim();
}

/** 声明的最大边长（"16x16 32x32"）；any 视为无穷大，没声明为 0 */
function declaredSize(sizes: string): number {
  if (/\bany\b/i.test(sizes)) return Infinity;
  return Math.max(0, ...[...sizes.matchAll(/(\d+)\s*x\s*(\d+)/gi)].map((m) => Math.min(Number(m[1]), Number(m[2]))));
}

function score(size: number, vector: boolean, apple: boolean): number {
  const base = vector ? 1200 : size >= 180 ? 1000 : size >= 128 ? 800 : size >= 64 ? 700 : size > 0 ? 100 : 520;
  return base + (apple ? 50 : 0);
}

function pageCandidates(html: string, pageUrl: string): Candidate[] {
  const head = html.slice(0, Math.max(html.search(/<\/head>/i), 0) || MAX_HTML);
  const found: Candidate[] = [];
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, 'rel').toLowerCase();
    const href = attr(tag, 'href');
    if (!href || !/icon/.test(rel) || /mask-icon/.test(rel)) continue;
    try {
      const url = new URL(href, pageUrl).href;
      const vector = /svg/i.test(attr(tag, 'type')) || /\.svg(?:[?#]|$)/i.test(url);
      found.push({ url, score: score(declaredSize(attr(tag, 'sizes')), vector, rel.includes('apple-touch-icon')) });
    } catch {
      // 无法解析的地址直接跳过
    }
  }
  return found;
}

function fetchSignal(signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function request(url: string, signal: AbortSignal | undefined, refresh: boolean): Promise<Response> {
  return fetch(url, {
    signal: fetchSignal(signal),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: refresh ? 'reload' : 'default',
  });
}

/** 一个候选地址能否作为图标：SVG 原样保存，位图缩进 128px 以内再保存 */
async function loadIcon(url: string, signal: AbortSignal | undefined, refresh: boolean): Promise<string | null> {
  try {
    const response = await request(url, signal, refresh);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0 || blob.size > MAX_ICON_BYTES) return null;
    if (/svg/i.test(blob.type) || /\.svg(?:[?#]|$)/i.test(url)) {
      const text = await blob.text();
      return text.includes('<svg') ? blobToDataUrl(new Blob([text], { type: 'image/svg+xml' })) : null;
    }
    const bitmap = await createImageBitmap(blob);
    return Math.max(bitmap.width, bitmap.height) < MIN_DIMENSION ? null : await rasterToDataUrl(blob);
  } catch {
    return null;
  }
}

/** 取不到任何可用图标时返回 null */
export async function fetchSiteIcon(
  pageUrl: string,
  options: { signal?: AbortSignal; refresh?: boolean } = {},
): Promise<string | null> {
  const { signal, refresh = false } = options;
  const origin = new URL(pageUrl).origin;
  const candidates = new Map<string, number>();
  const add = ({ url, score: s }: Candidate) => candidates.set(url, Math.max(candidates.get(url) ?? 0, s));

  try {
    const response = await request(`${origin}/`, signal, refresh);
    if (response.ok && /html/i.test(response.headers.get('content-type') ?? '')) {
      pageCandidates((await response.text()).slice(0, MAX_HTML), response.url).forEach(add);
    }
  } catch {
    // 首页读不到时仍然尝试常见路径和图标服务
  }
  add({ url: `${origin}/apple-touch-icon.png`, score: 640 });
  add({ url: `${origin}/favicon.ico`, score: 300 });
  add({
    url: `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`${origin}/`)}&size=128`,
    score: 200,
  });

  for (const [url] of [...candidates].sort((a, b) => b[1] - a[1])) {
    if (signal?.aborted) return null;
    const icon = await loadIcon(url, signal, refresh);
    if (icon) return icon;
  }
  return null;
}
