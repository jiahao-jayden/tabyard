import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { cn } from 'cn';
import type { CollectData } from '@/utils/collect/store';
import { Favicon } from './Favicon';
import { linkProps } from './address';
import { tileClass } from './BookmarkParts';

const MAX_SHOWN = 24;

/** 展示收藏集；只读，管理仍在设置页的「收藏」里 */
export function CollectSection({ data, openInNewTab }: { data: CollectData; openInNewTab: boolean }) {
  const { t } = useTranslation();
  /** null 表示全部 */
  const [folderId, setFolderId] = useState<string | null>(null);

  if (data.bookmarks.length === 0) return null;

  const shown = data.bookmarks.filter((b) => folderId == null || b.folderId === folderId);
  const pill = (active: boolean) => cn(
    'rounded-full px-3 py-1 text-xs transition-colors',
    active ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
  );

  return (
    <section className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">{t('newtab.collectTitle')}</h2>
        <a
          href={browser.runtime.getURL('/options.html#collect')}
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
        {shown.slice(0, MAX_SHOWN).map((b) => (
          <li key={b.id}>
            <a
              href={b.url}
              {...linkProps(openInNewTab)}
              className={tileClass}
            >
              <Favicon url={b.url} title={b.title} className="size-5 shrink-0" />
              <span className="truncate">{b.title || new URL(b.url).hostname}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
