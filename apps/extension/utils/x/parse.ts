// 解析 X 书签接口（GraphQL Bookmarks）的响应。
// 接口结构经常变，所以不按固定路径取值，而是在整棵 JSON 里找「长得像推文」的节点，取不到的字段留空
import type { ExtractedTweet } from './tweet';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const decodeEntities = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** 推文正文里的 t.co 短链换成真实地址，末尾的媒体短链去掉 */
function expandText(text: string, entities: unknown, media: unknown): string {
  let result = text;
  const urls = isObject(entities) && Array.isArray(entities.urls) ? entities.urls : [];
  for (const u of urls) {
    if (isObject(u) && str(u.url) && str(u.expanded_url)) result = result.replace(str(u.url), str(u.expanded_url));
  }
  for (const m of Array.isArray(media) ? media : []) {
    if (isObject(m) && str(m.url)) result = result.replace(str(m.url), '');
  }
  return decodeEntities(result).trim();
}

function toTweet(node: Json): ExtractedTweet | null {
  const legacy = node.legacy;
  if (!isObject(legacy)) return null;

  // 转推取被转的原推
  const retweeted = isObject(legacy.retweeted_status_result) ? legacy.retweeted_status_result.result : undefined;
  if (isObject(retweeted)) return toTweet(isObject(retweeted.tweet) ? retweeted.tweet : retweeted);

  const id = str(node.rest_id);
  const core = isObject(node.core) ? node.core : {};
  const userResults = isObject(core.user_results) ? core.user_results : {};
  const user = isObject(userResults.result) ? userResults.result : {};
  const userCore = isObject(user.core) ? user.core : {};
  const userLegacy = isObject(user.legacy) ? user.legacy : {};
  const avatarObj = isObject(user.avatar) ? user.avatar : {};

  const handle = str(userCore.screen_name) || str(userLegacy.screen_name);
  if (!id || !/^\w{1,15}$/.test(handle)) return null;

  // 长推文的全文在 note_tweet 里
  const note = isObject(node.note_tweet) && isObject(node.note_tweet.note_tweet_results) ? node.note_tweet.note_tweet_results.result : undefined;
  const noteObj = isObject(note) ? note : undefined;
  const extended = isObject(legacy.extended_entities) ? legacy.extended_entities : {};
  const media = Array.isArray(extended.media) ? extended.media : [];
  const text = noteObj
    ? expandText(str(noteObj.text), noteObj.entity_set, media)
    : expandText(str(legacy.full_text), legacy.entities, media);

  const firstMedia = isObject(media[0]) ? str(media[0].media_url_https) : '';
  const avatar = str(avatarObj.image_url) || str(userLegacy.profile_image_url_https);

  return {
    url: `https://x.com/${handle}/status/${id}`,
    authorName: (str(userCore.name) || str(userLegacy.name) || handle).slice(0, 100),
    handle,
    avatar: avatar.startsWith('https://') ? avatar : '',
    text: text.slice(0, 5000),
    image: firstMedia.startsWith('https://') ? `${firstMedia}?name=medium` : '',
    postedAt: Date.parse(str(legacy.created_at)) || 0,
  };
}

export function parseBookmarksResponse(json: unknown): { tweets: ExtractedTweet[]; nextCursor: string | null } {
  const tweets: ExtractedTweet[] = [];
  const seen = new Set<string>();
  let nextCursor: string | null = null;

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isObject(node)) return;
    if (node.cursorType === 'Bottom' && str(node.value)) nextCursor = str(node.value);
    // 找到推文就不再往里走，避免把引用的推文当成独立的收藏
    if (str(node.rest_id) && isObject(node.legacy) && 'full_text' in node.legacy) {
      const tweet = toTweet(node);
      if (tweet && !seen.has(tweet.url)) {
        seen.add(tweet.url);
        tweets.push(tweet);
      }
      return;
    }
    Object.values(node).forEach(walk);
  };
  walk(json);
  return { tweets, nextCursor };
}
