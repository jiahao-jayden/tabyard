import { useTranslation } from 'react-i18next';
import { Favicon } from './Favicon';
import { FolderMenu } from './BookmarkMenu';
import { BookmarkModeMenu, BookmarkSection, FolderIcon, tileClass } from './BookmarkParts';
import { isFolder, isLink, type BookmarkNode } from './useBookmarkTree';
import type { BookmarksMode } from '@/utils/newtab-settings';

const PREVIEW_COUNT = 3;

/** 每个文件夹一块磁贴；根目录里直接放着的书签合成一块，以根目录名命名 */
function tilesOf(roots: BookmarkNode[]): BookmarkNode[] {
  return roots.flatMap((root) => {
    const children = root.children ?? [];
    const loose = children.filter(isLink);
    return [
      ...(loose.length > 0 ? [{ ...root, children: loose }] : []),
      ...children.filter(isFolder),
    ];
  });
}

/** 多级列表视图：文件夹磁贴，点开后在菜单里逐级展开 */
export function BookmarkList({ roots, openInNewTab, mode, onModeChange }: {
  roots: BookmarkNode[];
  openInNewTab: boolean;
  mode: BookmarksMode;
  onModeChange: (mode: BookmarksMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <BookmarkSection
      title={t('newtab.bookmarksTitle')}
      actions={<BookmarkModeMenu mode={mode} onModeChange={onModeChange} />}
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
        {tilesOf(roots).map((node) => (
          <li key={node.id}>
            <FolderMenu
              title={node.title}
              nodes={node.children ?? []}
              openInNewTab={openInNewTab}
              triggerClassName={`${tileClass} data-[state=open]:bg-muted`}
            >
              <FolderIcon />
              <span className="truncate">{node.title}</span>
              <span className="ml-auto flex shrink-0 -space-x-1">
                {(node.children ?? []).filter(isLink).slice(0, PREVIEW_COUNT).map((link) => (
                  <Favicon key={link.id} url={link.url} title={link.title} className="size-4 rounded-sm" />
                ))}
              </span>
            </FolderMenu>
          </li>
        ))}
      </ul>
    </BookmarkSection>
  );
}
