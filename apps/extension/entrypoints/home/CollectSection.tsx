import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { cn } from 'cn';
import { LayoutGrid, List } from 'lucide-react';
import { hostnameOf } from '@tabyard/shared';
import { BookmarkCover } from '@/components/BookmarkCover';
import { Button } from '@/components/ui/button';
import type { Bookmark, CollectData } from '@/utils/collect/store';
import type { NewtabSettings } from '@/utils/newtab-settings';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { tileClass } from './BookmarkParts';

const MAX_SHOWN = 24;
const VIEWS = [
  { mode: 'compact', icon: List, label: 'newtab.collectCompact' },
  { mode: 'cards', icon: LayoutGrid, label: 'newtab.collectCards' },
] as const;
const TWEET_URL = /^https:\/\/(?:x|twitter)\.com\/(\w{1,15})\/status\//;

/** 推文只看图标认不出内容：改为显示作者和正文；没有抓取到作者信息时用网址里的 @用户名 */
function tweetOf(b: Bookmark): { author: string; text: string } | null {
  const handle = b.url.match(TWEET_URL)?.[1];
  if (!handle) return null;
  return { author: b.source?.authorName ?? `@${handle}`, text: b.description || b.title };
}

function TweetAvatar({ b }: { b: Bookmark }) {
  const [failed, setFailed] = useState(false);
  if (!b.source || !b.favicon || failed) return <Favicon url={b.url} title={b.title} className="size-6 shrink-0" />;
  return (
    <img
      src={b.favicon}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-6 shrink-0 rounded-full"
    />
  );
}

function CollectTile({ bookmark }: { bookmark: Bookmark }) {
  const tweet = tweetOf(bookmark);
  if (tweet) {
    return (
      <>
        <TweetAvatar b={bookmark} />
        <span className="min-w-0 flex-1 text-xs leading-tight">
          <span className="block truncate font-medium">{tweet.author}</span>
          <span className="block truncate text-muted-foreground">{tweet.text}</span>
        </span>
      </>
    );
  }
  return (
    <>
      <Favicon url={bookmark.url} title={bookmark.title} className="size-5 shrink-0" />
      <span className="truncate">{bookmark.title || hostnameOf(bookmark.url)}</span>
    </>
  );
}

function CollectCard({ bookmark }: { bookmark: Bookmark }) {
  const { i18n } = useTranslation();
  const host = hostnameOf(bookmark.url);
  const tweet = tweetOf(bookmark);
  const title = tweet?.text || bookmark.title || host;
  const subtitle = tweet?.author || bookmark.description;
  return (
    <>
      <BookmarkCover bookmark={bookmark} className="h-20" />
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="line-clamp-2 text-sm leading-tight font-medium break-words">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
        <div className="mt-auto flex items-baseline gap-1.5 pt-1 text-[11px] text-muted-foreground">
          <span className="truncate">{host}</span>
          <span className="shrink-0">· {new Date(bookmark.createdAt).toLocaleDateString(i18n.language)}</span>
        </div>
      </div>
    </>
  );
}

/** 展示收藏集；只读，管理仍在设置页的「收藏」里 */
export function CollectSection({ data, openInNewTab, mode, onModeChange }: {
  data: CollectData;
  openInNewTab: boolean;
  mode: NewtabSettings['collectMode'];
  onModeChange: (mode: NewtabSettings['collectMode']) => void;
}) {
  const { t } = useTranslation();
  /** null 表示全部 */
  const [folderId, setFolderId] = useState<string | null>(null);

  if (data.bookmarks.length === 0) return null;

  const collectUrl = browser.runtime.getURL('/options.html#collect');
  const shown = data.bookmarks.filter((b) => folderId == null || b.folderId === folderId);
  const pill = (active: boolean) => cn(
    'rounded-full px-3 py-1 text-xs transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
  );

  return (
    <section className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
          <a href={collectUrl} target="_blank" rel="noopener" className="hover:underline">
            {t('newtab.collectTitle')}
          </a>
        </h2>
        <div className="flex items-center gap-3">
          <div role="group" aria-label={t('newtab.collectView')} className="flex rounded-full bg-card p-0.5 shadow-xs">
            {VIEWS.map(({ mode: value, icon: Icon, label }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t(label)}
                title={t(label)}
                aria-pressed={mode === value}
                onClick={() => onModeChange(value)}
                className="h-7 w-10 text-muted-foreground transition-colors aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11"
              >
                <Icon />
              </Button>
            ))}
          </div>
          <a
            href={collectUrl}
            target="_blank"
            rel="noopener"
            className="text-xs text-muted-foreground hover:text-foreground dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]"
          >
            {t('newtab.collectMore')}
          </a>
        </div>
      </div>
      {data.folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill(folderId == null)} onClick={() => setFolderId(null)}>
            {t('newtab.collectAll')}
          </button>
          {data.folders.map((f) => (
            <button key={f.id} type="button" className={pill(folderId === f.id)} onClick={() => setFolderId(f.id)}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      <ul className={cn('grid', mode === 'cards'
        ? 'grid-cols-2 gap-2.5 min-[480px]:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]'
        : 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2')}>
        {shown.slice(0, MAX_SHOWN).map((b) => (
          <li key={b.id} className="min-w-0">
            <a
              href={b.url}
              {...linkProps(openInNewTab)}
              className={mode === 'cards'
                ? 'flex h-full flex-col overflow-hidden rounded-xl bg-popover/90 shadow-xs transition-colors hover:bg-popover focus-visible:outline-2 focus-visible:outline-offset-2'
                : tileClass}
            >
              {mode === 'cards' ? <CollectCard bookmark={b} /> : <CollectTile bookmark={b} />}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
