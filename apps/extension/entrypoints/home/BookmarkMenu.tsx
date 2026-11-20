import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { FolderIcon } from './BookmarkParts';
import { isFolder, isLink, type BookmarkNode } from './useBookmarkTree';

// 高度跟随 Radix 按碰撞计算出的可用空间，避免在页面下方展开时超出视口
const panel = 'max-h-(--radix-dropdown-menu-content-available-height) w-60 overflow-y-auto';

function MenuNodes({ nodes, openInNewTab }: { nodes: BookmarkNode[]; openInNewTab: boolean }) {
  const { t } = useTranslation();
  if (nodes.length === 0) return <DropdownMenuItem disabled>{t('newtab.bookmarksEmpty')}</DropdownMenuItem>;
  return nodes.map((node) => {
    if (isLink(node)) {
      return (
        <DropdownMenuItem key={node.id} asChild>
          <a href={node.url} {...linkProps(openInNewTab)}>
            <Favicon url={node.url} title={node.title} className="size-4 shrink-0" />
            <span className="truncate">{node.title || new URL(node.url).hostname}</span>
          </a>
        </DropdownMenuItem>
      );
    }
    if (!isFolder(node)) return null;
    return (
      <DropdownMenuSub key={node.id}>
        <DropdownMenuSubTrigger>
          <FolderIcon className="size-4" />
          <span className="truncate">{node.title}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent collisionPadding={8} className={panel}>
          <MenuNodes nodes={node.children ?? []} openInNewTab={openInNewTab} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  });
}

/** 点击展开的文件夹菜单，子文件夹继续往右展开；顶部书签栏和多级列表视图共用 */
export function FolderMenu({ title, nodes, openInNewTab, triggerClassName, children }: {
  title: string;
  nodes: BookmarkNode[];
  openInNewTab: boolean;
  triggerClassName: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={triggerClassName}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" collisionPadding={8} className={panel}>
        <DropdownMenuLabel className="truncate">{title}</DropdownMenuLabel>
        <MenuNodes nodes={nodes} openInNewTab={openInNewTab} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
