import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { BookmarkModeMenu, BookmarkSection, FolderIcon, IconButton, tileClass } from './BookmarkParts';
import { isFolder, isLink, type BookmarkNode } from './useBookmarkTree';
import type { BookmarksMode } from '@/utils/newtab-settings';

const MAX_SHOWN = 48;

function findFolder(nodes: BookmarkNode[], id: string): BookmarkNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = node.children && findFolder(node.children, id);
    if (found) return found;
  }
  return undefined;
}

/** 多层文件夹视图：以磁贴列出当前文件夹，点文件夹进入，用前进后退导航 */
export function BookmarkFolders({ roots, openInNewTab, mode, onModeChange }: {
  roots: BookmarkNode[];
  openInNewTab: boolean;
  mode: BookmarksMode;
  onModeChange: (mode: BookmarksMode) => void;
}) {
  const { t } = useTranslation();
  // null 表示最上层（书签栏、其他书签）
  const [history, setHistory] = useState<{ ids: (string | null)[]; index: number }>({ ids: [null], index: 0 });
  const id = history.ids[history.index] ?? null;
  const folder = id ? findFolder(roots, id) : undefined;
  const items = (folder ? folder.children ?? [] : roots).filter((n) => isFolder(n) || isLink(n));

  const open = (next: string) =>
    setHistory((h) => ({ ids: [...h.ids.slice(0, h.index + 1), next], index: h.index + 1 }));
  const move = (delta: number) => setHistory((h) => ({ ...h, index: h.index + delta }));

  return (
    <BookmarkSection
      title={folder?.title || t('newtab.bookmarksTitle')}
      actions={
        <>
          <IconButton aria-label={t('newtab.bookmarksBack')} disabled={history.index === 0} onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton
            aria-label={t('newtab.bookmarksForward')}
            disabled={history.index === history.ids.length - 1}
            onClick={() => move(1)}
          >
            <ChevronRight className="size-4" />
          </IconButton>
          <BookmarkModeMenu mode={mode} onModeChange={onModeChange} />
        </>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('newtab.bookmarksEmpty')}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {items.slice(0, MAX_SHOWN).map((node) => (
            <li key={node.id}>
              {isFolder(node) ? (
                <button type="button" className={tileClass} onClick={() => open(node.id)}>
                  <FolderIcon />
                  <span className="truncate">{node.title}</span>
                </button>
              ) : (
                <a href={node.url} {...linkProps(openInNewTab)} className={tileClass}>
                  <Favicon url={node.url!} title={node.title} className="size-5 shrink-0" />
                  <span className="truncate">{node.title || new URL(node.url!).hostname}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </BookmarkSection>
  );
}
