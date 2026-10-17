// 从 X 页面上的一条推文节点读取数据。只用 DOM，导入脚本与推文上的按钮共用
import type { ExtractedTweet } from './tweet';

/** 把节点转成纯文本：保留换行，emoji 是 <img alt>，要取 alt */
function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLImageElement) return node.alt;
  if (node instanceof HTMLBRElement) return '\n';
  return Array.from(node.childNodes).map(textOf).join('');
}

const httpsOrEmpty = (value: string | null | undefined) => (value && value.startsWith('https://') ? value : '');

/** X 的图片地址带 name=small 之类的尺寸参数，换成更清晰的 medium */
const mediumSize = (src: string) => src.replace(/([?&]name=)\w+/, '$1medium');

export function extractTweet(article: Element): ExtractedTweet | null {
  const time = article.querySelector('time');
  const match = time?.closest('a')?.getAttribute('href')?.match(/^\/(\w{1,15})\/status\/(\d+)/);
  if (!time || !match) return null;
  const [, handle, id] = match;

  const nameEl = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const authorName = (nameEl?.innerText.split('\n')[0] ?? '').trim() || handle!;
  const textEl = article.querySelector('[data-testid="tweetText"]');
  const photo = article.querySelector<HTMLImageElement>('[data-testid="tweetPhoto"] img');
  const poster = article.querySelector<HTMLVideoElement>('[data-testid="videoPlayer"] video')?.poster;

  return {
    url: `https://x.com/${handle}/status/${id}`,
    authorName,
    handle: handle!,
    avatar: httpsOrEmpty(article.querySelector<HTMLImageElement>('[data-testid="Tweet-User-Avatar"] img')?.src),
    text: textEl ? textOf(textEl).trim() : '',
    image: httpsOrEmpty(photo ? mediumSize(photo.src) : poster),
    postedAt: Date.parse(time.dateTime) || 0,
  };
}
