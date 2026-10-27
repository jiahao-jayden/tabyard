import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { hostnameOf } from '@tabyard/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCover } from '@/utils/collect/covers';
import { deleteBookmarks, moveBookmarks, type Bookmark, type Folder } from '@/utils/collect/store';
import { cn } from '@/lib/utils';
import { FolderMenuItems } from './FolderMenuItems';
import { TweetCardBody } from './TweetCardBody';

function Cover({ bookmark }: { bookmark: Bookmark }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  /** 本机保存的截图封面优先于网页 og 图 */
  const [localCover, setLocalCover] = useState('');

  useEffect(() => {
    let url = '';
    let alive = true;
    void getCover(bookmark.url).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setLocalCover(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setLocalCover('');
    };
  }, [bookmark.url]);

  if (localCover) {
    return <img src={localCover} alt="" className="aspect-[16/10] w-full object-cover object-top" />;
  }

  if (bookmark.image && !imageFailed) {
    return (
      <img
        src={bookmark.image}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="aspect-[16/10] w-full object-cover"
      />
    );
  }
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted">
      {bookmark.favicon && !iconFailed ? (
        <img
          src={bookmark.favicon}
          alt=""
          onError={() => setIconFailed(true)}
          className="size-10 rounded-lg"
        />
      ) : (
        <Globe className="size-8 text-muted-foreground" />
      )}
    </div>
  );
}

export function BookmarkCard({
  bookmark, folders, selected, selecting, onToggle, onEdit,
}: {
  bookmark: Bookmark;
  folders: Folder[];
  selected: boolean;
  /** 已有选中项：点击卡片改为切换选中，而不是打开网页 */
  selecting: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const host = hostnameOf(bookmark.url);

  return (
    <Card className={cn('group/bookmark relative gap-0 py-0', selected && 'ring-2 ring-primary')}>
      <a
        href={bookmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col"
        onClick={(e) => {
          if (!selecting) return;
          e.preventDefault();
          onToggle();
        }}
      >
        {bookmark.source ? (
          <TweetCardBody bookmark={bookmark} source={bookmark.source} />
        ) : (
          <>
            <Cover bookmark={bookmark} />
            <div className="space-y-1 p-3">
              <div className="line-clamp-2 text-sm font-medium leading-snug">{bookmark.title}</div>
              {bookmark.description && (
                <div className="line-clamp-1 text-xs text-muted-foreground">{bookmark.description}</div>
              )}
              <div className="truncate text-xs text-muted-foreground">
                {host} · {new Date(bookmark.createdAt).toLocaleDateString(i18n.language)}
              </div>
            </div>
          </>
        )}
      </a>
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        aria-label={t('collect.select')}
        className={cn(
          'absolute top-2 left-2 size-5 bg-white/90 opacity-0 transition-opacity group-hover/bookmark:opacity-100 focus-visible:opacity-100',
          selecting && 'opacity-100',
        )}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/bookmark:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
            aria-label={t('collect.more')}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t('collect.edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <FolderMenuItems
            folders={folders}
            current={bookmark.folderId}
            onPick={(folderId) => void moveBookmarks([bookmark.id], folderId)}
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void deleteBookmarks([bookmark.id])}>
            <Trash2 />
            {t('collect.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
