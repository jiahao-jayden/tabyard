import { z } from 'zod';

const timestamp = z.number().int().nonnegative();
const id = z.string().min(1).max(128);
const webUrl = z.string().max(16_384).url().refine((value) => /^https?:\/\//i.test(value));

export const collectSchema = z.object({
  bookmarks: z.array(z.object({
    id,
    url: webUrl,
    title: z.string().max(16_384),
    description: z.string().max(100_000),
    image: z.string().max(100_000),
    favicon: z.string().max(100_000),
    folderId: id.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp.optional(),
    source: z.object({
      type: z.literal('tweet'),
      authorName: z.string().max(16_384),
      handle: z.string().max(1024),
      postedAt: timestamp,
    }).optional(),
  })).max(50_000),
  folders: z.array(z.object({ id, name: z.string().max(16_384), updatedAt: timestamp.optional() })).max(10_000),
  deletedBookmarks: z.record(z.string(), timestamp).default({}),
  deletedFolders: z.record(z.string(), timestamp).default({}),
});

export type CollectData = z.infer<typeof collectSchema>;
export type Bookmark = CollectData['bookmarks'][number];
export type Folder = CollectData['folders'][number];
export type TweetSource = NonNullable<Bookmark['source']>;

export function emptyCollect(): CollectData {
  return { bookmarks: [], folders: [], deletedBookmarks: {}, deletedFolders: {} };
}

/** 删除标记保留，以防离线设备把旧记录重新带回。网址是收藏的跨设备唯一键。 */
export function mergeCollect(remote: CollectData, local: CollectData, localWins: boolean): CollectData {
  const mergeDeleted = (a: Record<string, number>, b: Record<string, number>) => {
    const result = { ...a };
    for (const [key, time] of Object.entries(b)) result[key] = Math.max(result[key] ?? 0, time);
    return result;
  };
  const deletedBookmarks = mergeDeleted(remote.deletedBookmarks, local.deletedBookmarks);
  const deletedFolders = mergeDeleted(remote.deletedFolders, local.deletedFolders);
  function merge<T extends { updatedAt?: number }>(a: T[], b: T[], key: (item: T) => string, deleted: Record<string, number>): T[] {
    const items = new Map<string, T>();
    for (const item of [...(localWins ? a : b), ...(localWins ? b : a)]) {
      const k = key(item);
      const current = items.get(k);
      if (!current || (item.updatedAt ?? 0) >= (current.updatedAt ?? 0)) items.set(k, { ...item });
    }
    return [...items.entries()].filter(([k, item]) => deleted[k] === undefined || (item.updatedAt ?? 0) > deleted[k]).map(([, item]) => item);
  }
  const folders = merge(remote.folders, local.folders, (f) => f.id, deletedFolders);
  const folderIds = new Set(folders.map((f) => f.id));
  const bookmarks = merge(remote.bookmarks, local.bookmarks, (b) => b.url, deletedBookmarks)
    .map((b) => ({ ...b, folderId: b.folderId && folderIds.has(b.folderId) ? b.folderId : null }))
    .sort((a, b) => b.createdAt - a.createdAt);
  return { bookmarks, folders, deletedBookmarks, deletedFolders };
}
