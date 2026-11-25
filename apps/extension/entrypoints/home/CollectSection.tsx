import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { cn } from 'cn';
import type { Bookmark, CollectData } from '@/utils/collect/store';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { tileClass } from './BookmarkParts';

const MAX_SHOWN = 24;
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

/** 展示收藏集；只读，管理仍在设置页的「收藏」里 */
export function CollectSection({ data, openInNewTab }: { data: CollectData; openInNewTab: boolean }) {
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
        <a
          href={collectUrl}
          target="_blank"
          rel="noopener"
          className="text-xs text-muted-foreground hover:text-foreground dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]"
        >
          {t('newtab.collectMore')}
        </a>
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
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {shown.slice(0, MAX_SHOWN).map((b) => {
          const tweet = tweetOf(b);
          return (
            <li key={b.id}>
              <a href={b.url} {...linkProps(openInNewTab)} className={tileClass}>
                {tweet ? (
                  <>
                    <TweetAvatar b={b} />
                    <span className="min-w-0 flex-1 text-xs leading-tight">
                      <span className="block truncate font-medium">{tweet.author}</span>
                      <span className="block truncate text-muted-foreground">{tweet.text}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Favicon url={b.url} title={b.title} className="size-5 shrink-0" />
                    <span className="truncate">{b.title || new URL(b.url).hostname}</span>
                  </>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
