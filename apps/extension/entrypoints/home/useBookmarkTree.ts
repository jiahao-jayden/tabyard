import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

export type BookmarkNode = Browser.bookmarks.BookmarkTreeNode;

export const isFolder = (node: BookmarkNode) => node.children !== undefined;
export const isLink = (node: BookmarkNode): node is BookmarkNode & { url: string } =>
  !!node.url && /^https?:\/\//i.test(node.url);

const EVENTS = ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded'] as const;

/** 书签栏、其他书签等有内容的根目录；书签变化后自动刷新 */
export function useBookmarkTree(): BookmarkNode[] {
  const [roots, setRoots] = useState<BookmarkNode[]>([]);
  useEffect(() => {
    const refresh = () => void browser.bookmarks.getTree().then(([root]) =>
      setRoots((root?.children ?? []).filter((top) => top.children?.length)));
    refresh();
    for (const event of EVENTS) browser.bookmarks[event].addListener(refresh);
    return () => {
      for (const event of EVENTS) browser.bookmarks[event].removeListener(refresh);
    };
  }, []);
  return roots;
}
