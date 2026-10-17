import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type Bookmark, type TweetSource } from '@/utils/collect/store';

/** 推文卡片内容：作者、正文、配图（没有标题和封面的网页样式） */
export function TweetCardBody({ bookmark, source }: { bookmark: Bookmark; source: TweetSource }) {
  const { i18n } = useTranslation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          {bookmark.favicon && !avatarFailed ? (
            <img
              src={bookmark.favicon}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="size-8 shrink-0 rounded-full"
            />
          ) : (
            <div className="size-8 shrink-0 rounded-full bg-muted" />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">{source.authorName}</div>
            <div className="truncate text-xs text-muted-foreground">@{source.handle}</div>
          </div>
        </div>
        {bookmark.description && (
          <p className="line-clamp-6 text-sm leading-snug whitespace-pre-line">{bookmark.description}</p>
        )}
      </div>
      {bookmark.image && !imageFailed && (
        <img
          src={bookmark.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      <div className="truncate p-3 text-xs text-muted-foreground">
        x.com · {new Date(source.postedAt || bookmark.createdAt).toLocaleDateString(i18n.language)}
      </div>
    </>
  );
}
