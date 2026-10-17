// 网页收藏集的数据与存储：独立于标签分组配置，不参与同步
import { browser } from 'wxt/browser';
import { getPlan, FREE_FOLDER_LIMIT } from '../plan';
import { withLock } from '../rules';
import { COLLECT_KEY, normalizeUrl } from './url';

/** 来自 X 的推文；没有该字段的就是普通网页 */
export interface TweetSource {
  type: 'tweet';
  authorName: string;
  handle: string;
  postedAt: number;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description: string;
  /** og:image 的绝对地址；没有则为空，界面显示占位图 */
  image: string;
  favicon: string;
  /** null 表示未分类 */
  folderId: string | null;
  createdAt: number;
  source?: TweetSource;
}

export interface Folder {
  id: string;
  name: string;
}

export interface CollectData {
  bookmarks: Bookmark[];
  folders: Folder[];
}

const COLLECT_LOCK = 'tabyard-collect';

export type BookmarkInput = Omit<Bookmark, 'id' | 'createdAt'>;

export async function loadCollect(): Promise<CollectData> {
  const stored = (await browser.storage.local.get(COLLECT_KEY))[COLLECT_KEY] as Partial<CollectData> | undefined;
  return {
    bookmarks: Array.isArray(stored?.bookmarks) ? stored.bookmarks : [],
    folders: Array.isArray(stored?.folders) ? stored.folders : [],
  };
}

/** 读-改-写放在锁内，popup 与收藏集页面可能同时操作 */
function mutate<T>(fn: (data: CollectData) => T): Promise<T> {
  return withLock(COLLECT_LOCK, async () => {
    const data = await loadCollect();
    const result = fn(data);
    await browser.storage.local.set({ [COLLECT_KEY]: data });
    return result;
  });
}

/** 同一网址已收藏时更新其信息与文件夹，不新增 */
export function addBookmark(input: BookmarkInput): Promise<Bookmark> {
  return mutate((data) => {
    const url = normalizeUrl(input.url);
    const existing = data.bookmarks.find((b) => b.url === url);
    if (existing) {
      Object.assign(existing, input, { url });
      return existing;
    }
    const bookmark: Bookmark = { ...input, url, id: crypto.randomUUID(), createdAt: Date.now() };
    data.bookmarks.unshift(bookmark);
    return bookmark;
  });
}

/** 批量导入：已收藏的网址跳过（不改动其文件夹），返回新增数量 */
export function importBookmarks(items: (BookmarkInput & { createdAt: number })[]): Promise<number> {
  return mutate((data) => {
    const known = new Set(data.bookmarks.map((b) => b.url));
    let added = 0;
    for (const item of items) {
      const url = normalizeUrl(item.url);
      if (known.has(url)) continue;
      known.add(url);
      data.bookmarks.push({ ...item, url, id: crypto.randomUUID() });
      added++;
    }
    return added;
  });
}

export function removeBookmarkByUrl(url: string): Promise<void> {
  return mutate((data) => {
    const target = normalizeUrl(url);
    data.bookmarks = data.bookmarks.filter((b) => b.url !== target);
  });
}

export function updateBookmark(id: string, patch: Partial<Pick<Bookmark, 'title' | 'description'>>): Promise<void> {
  return mutate((data) => {
    const target = data.bookmarks.find((b) => b.id === id);
    if (target) Object.assign(target, patch);
  });
}

export function moveBookmarks(ids: string[], folderId: string | null): Promise<void> {
  return mutate((data) => {
    const set = new Set(ids);
    for (const b of data.bookmarks) if (set.has(b.id)) b.folderId = folderId;
  });
}

export function deleteBookmarks(ids: string[]): Promise<void> {
  return mutate((data) => {
    const set = new Set(ids);
    data.bookmarks = data.bookmarks.filter((b) => !set.has(b.id));
  });
}

export async function addFolder(name: string): Promise<Folder> {
  const plan = await getPlan();
  return mutate((data) => {
    if (plan === 'free' && data.folders.length >= FREE_FOLDER_LIMIT) throw new Error('folder-limit');
    const folder: Folder = { id: crypto.randomUUID(), name: name.trim() };
    data.folders.push(folder);
    return folder;
  });
}

export function renameFolder(id: string, name: string): Promise<void> {
  return mutate((data) => {
    const target = data.folders.find((f) => f.id === id);
    if (target && name.trim()) target.name = name.trim();
  });
}

/** 删除文件夹不删除网页，其中的收藏回到未分类 */
export function deleteFolder(id: string): Promise<void> {
  return mutate((data) => {
    data.folders = data.folders.filter((f) => f.id !== id);
    for (const b of data.bookmarks) if (b.folderId === id) b.folderId = null;
  });
}

/** 一组要移动到同一文件夹的收藏；folderId 为空表示需要新建名为 name 的文件夹 */
export interface OrganizeGroup {
  name: string;
  folderId: string | null;
  ids: string[];
}

export interface OrganizeUndo {
  createdFolderIds: string[];
  previous: { id: string; folderId: string | null }[];
}

export function applyOrganization(groups: OrganizeGroup[]): Promise<OrganizeUndo> {
  return mutate((data) => {
    const undo: OrganizeUndo = { createdFolderIds: [], previous: [] };
    for (const group of groups) {
      let folderId = group.folderId;
      if (!folderId) {
        const folder: Folder = { id: crypto.randomUUID(), name: group.name };
        data.folders.push(folder);
        undo.createdFolderIds.push(folder.id);
        folderId = folder.id;
      }
      const ids = new Set(group.ids);
      for (const b of data.bookmarks) {
        if (!ids.has(b.id)) continue;
        undo.previous.push({ id: b.id, folderId: b.folderId });
        b.folderId = folderId;
      }
    }
    return undo;
  });
}

export function undoOrganization(undo: OrganizeUndo): Promise<void> {
  return mutate((data) => {
    const previous = new Map(undo.previous.map((p) => [p.id, p.folderId]));
    const created = new Set(undo.createdFolderIds);
    for (const b of data.bookmarks) {
      if (previous.has(b.id)) b.folderId = previous.get(b.id)!;
      else if (b.folderId && created.has(b.folderId)) b.folderId = null;
    }
    data.folders = data.folders.filter((f) => !created.has(f.id));
  });
}
