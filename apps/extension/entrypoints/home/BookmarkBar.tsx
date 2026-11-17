import type { BookmarksMode } from '@/utils/newtab-settings';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { FolderMenu } from './BookmarkMenu';
import { BookmarkModeMenu, FolderIcon } from './BookmarkParts';
import { isFolder, isLink, type BookmarkNode } from './useBookmarkTree';

// Chrome 和 Edge 里书签栏的节点 id 都是 '1'
const BAR_ID = '1';
const item = 'flex shrink-0 max-w-44 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-muted';

function BarFolder({ node, openInNewTab }: { node: BookmarkNode; openInNewTab: boolean }) {
  return (
    <FolderMenu
      title={node.title}
      nodes={node.children ?? []}
      openInNewTab={openInNewTab}
      triggerClassName={`${item} data-[state=open]:bg-muted`}
    >
      <FolderIcon className="size-4" />
      <span className="truncate">{node.title}</span>
    </FolderMenu>
  );
}

/** 顶部书签栏：固定在页面顶部，文件夹以菜单展开 */
export function BookmarkBar({ roots, openInNewTab, mode, onModeChange }: {
  roots: BookmarkNode[];
  openInNewTab: boolean;
  mode: BookmarksMode;
  onModeChange: (mode: BookmarksMode) => void;
}) {
  const barItems = roots.find((r) => r.id === BAR_ID)?.children ?? [];
  const others = roots.filter((r) => r.id !== BAR_ID);
  return (
    <nav className="fixed inset-x-0 top-0 z-20 flex h-12 items-center gap-2 border-b border-border bg-card/60 px-3 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {barItems.map((node) =>
          isLink(node) ? (
            <a key={node.id} href={node.url} {...linkProps(openInNewTab)} className={item}>
              <Favicon url={node.url} title={node.title} className="size-4 shrink-0" />
              <span className="truncate">{node.title || new URL(node.url).hostname}</span>
            </a>
          ) : isFolder(node) ? (
            <BarFolder key={node.id} node={node} openInNewTab={openInNewTab} />
          ) : null)}
        {others.map((node) => <BarFolder key={node.id} node={node} openInNewTab={openInNewTab} />)}
      </div>
      <BookmarkModeMenu mode={mode} onModeChange={onModeChange} />
    </nav>
  );
}
