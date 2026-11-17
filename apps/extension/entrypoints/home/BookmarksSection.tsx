import type { BookmarksMode } from '@/utils/newtab-settings';
import { BookmarkBar } from './BookmarkBar';
import { BookmarkFolders } from './BookmarkFolders';
import { BookmarkList } from './BookmarkList';
import { useBookmarkTree } from './useBookmarkTree';

const VIEWS = { folders: BookmarkFolders, list: BookmarkList, bar: BookmarkBar };

/** 浏览器自带书签，只读；三种展示方式由 mode 决定 */
export function BookmarksSection({ mode, onModeChange, openInNewTab }: {
  mode: BookmarksMode;
  onModeChange: (mode: BookmarksMode) => void;
  openInNewTab: boolean;
}) {
  const roots = useBookmarkTree();
  if (roots.length === 0) return null;
  const View = VIEWS[mode];
  return <View roots={roots} openInNewTab={openInNewTab} mode={mode} onModeChange={onModeChange} />;
}
