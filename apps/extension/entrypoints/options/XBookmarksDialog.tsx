import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { toast } from 'sonner';
import { Download, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { importBookmarks, type CollectData } from '@/utils/collect/store';
import { normalizeUrl } from '@/utils/collect/url';
import { disableXButton, enableXButton, isXButtonEnabled } from '@/utils/x/button-script';
import {
  loadXCache, loadXState, X_CACHE_KEY, X_STATE_KEY, XFETCH_STALE_MS, type XCache, type XFetchState,
} from '@/utils/x/cache';
import { X_ORIGINS } from '@/utils/x/origins';
import { tweetToBookmark } from '@/utils/x/tweet';

/** 缓存和抓取状态都在 storage 里，后台任务更新时界面自动跟随 */
function useXFetch() {
  const [cache, setCache] = useState<XCache | null>(null);
  const [state, setState] = useState<XFetchState | null>(null);

  useEffect(() => {
    const refresh = () => void Promise.all([loadXCache(), loadXState()]).then(([c, s]) => { setCache(c); setState(s); });
    refresh();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && (changes[X_CACHE_KEY] || changes[X_STATE_KEY])) refresh();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  return { cache, state };
}

function XBookmarksBody({ data, onClose }: { data: CollectData; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { cache, state } = useXFetch();
  const [buttonOn, setButtonOn] = useState(false);
  /** 导入哪些由用户自己勾选，默认一条都不选 */
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    void isXButtonEnabled().then(setButtonOn);
  }, []);

  const inCollection = useMemo(() => new Set(data.bookmarks.map((b) => normalizeUrl(b.url))), [data.bookmarks]);
  const tweets = cache?.tweets ?? [];
  const importable = tweets.filter((tw) => !inCollection.has(tw.url));
  const chosen = importable.filter((tw) => picked.has(tw.url));
  const q = query.trim().toLowerCase();
  const visible = q
    ? tweets.filter((tw) => `${tw.text} ${tw.authorName} ${tw.handle}`.toLowerCase().includes(q))
    : tweets;
  const visibleImportable = visible.filter((tw) => !inCollection.has(tw.url));
  const running = state?.status === 'running' && Date.now() - state.updatedAt < XFETCH_STALE_MS;

  const startFetch = async (full: boolean) => {
    // 权限申请依赖本次点击，必须先于其他异步操作
    if (!(await browser.permissions.request({ origins: X_ORIGINS }))) {
      toast.error(t('x.permissionDenied'));
      return;
    }
    void browser.runtime.sendMessage({ type: 'x-fetch-start', full });
  };

  const toggleButton = async (on: boolean) => {
    if (on) setButtonOn(await enableXButton());
    else {
      await disableXButton();
      setButtonOn(false);
    }
  };

  const toggle = (url: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(url)) next.add(url);
      return next;
    });

  const doImport = async () => {
    // 缓存里的先后就是 X 书签的顺序，createdAt 依次递减让收藏集里保持一致
    const base = Date.now();
    const order = new Map(tweets.map((tw, i) => [tw.url, i]));
    const added = await importBookmarks(chosen.map((tw) => tweetToBookmark(tw, base - (order.get(tw.url) ?? 0))));
    toast.success(t('x.imported', { n: added }));
    onClose();
  };

  const errorText = (error: string) =>
    error === 'permission' ? t('x.permissionDenied')
      : error === 'not-logged-in' ? t('x.notLoggedIn')
        : error === 'interrupted' ? t('x.interrupted')
          : t('x.failed', { msg: error });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border bg-white/60 p-3">
        <div className="space-y-0.5">
          <Label htmlFor="x-button">{t('x.buttonTitle')}</Label>
          <p className="text-xs text-muted-foreground">{t('x.buttonDesc')}</p>
        </div>
        <Switch id="x-button" checked={buttonOn} onCheckedChange={(v) => void toggleButton(v)} />
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          {running ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t('x.running', { n: state.fetched })}
            </span>
          ) : cache && cache.updatedAt > 0 ? (
            <span className="text-muted-foreground">
              {t('x.cached', { n: tweets.length, date: new Date(cache.updatedAt).toLocaleString(i18n.language) })}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('x.empty')}</span>
          )}
        </div>
        {tweets.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void startFetch(true)} disabled={running}>
            {t('x.refetchAll')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => void startFetch(false)} disabled={running}>
          <RefreshCw />
          {cache?.complete ? t('x.fetchNew') : t('x.fetch')}
        </Button>
      </div>
      {state?.status === 'error' && state.error && <p className="text-sm text-destructive">{errorText(state.error)}</p>}
      {state?.status === 'done' && state.pages !== undefined && state.reason && (
        <p className="text-xs text-muted-foreground">{t('x.stats', { pages: state.pages, reason: t(`x.reason.${state.reason}`), counts: (state.counts ?? []).slice(0, 15).join(', ') })}</p>
      )}

      {tweets.length > 0 && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('x.search')} className="h-9 pl-9" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-muted-foreground">
              {t('x.selected', { n: chosen.length, total: importable.length })}
              {q && ` · ${t('x.shown', { n: visible.length })}`}
            </span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setPicked((prev) => new Set([...prev, ...visibleImportable.map((tw) => tw.url)]))}
            >
              {q ? t('x.selectShown') : t('collect.selectAll')}
            </Button>
            <Button variant="ghost" size="xs" onClick={() => setPicked(new Set())}>
              {t('x.selectNone')}
            </Button>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
            {visible.map((tw) => {
              const imported = inCollection.has(tw.url);
              return (
                <label
                  key={tw.url}
                  className="flex cursor-pointer items-start gap-3 rounded-xl p-2 [contain-intrinsic-size:auto_60px] [content-visibility:auto] hover:bg-muted aria-disabled:cursor-default aria-disabled:opacity-50"
                  aria-disabled={imported}
                >
                  <Checkbox
                    className="mt-1"
                    checked={picked.has(tw.url)}
                    disabled={imported}
                    onCheckedChange={() => toggle(tw.url)}
                  />
                  {tw.avatar ? (
                    <img src={tw.avatar} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full" />
                  ) : (
                    <div className="size-8 shrink-0 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1 text-sm leading-snug">
                    <div className="truncate font-medium">
                      {tw.authorName} <span className="font-normal text-muted-foreground">@{tw.handle}</span>
                      {imported && <span className="ml-2 text-xs font-normal text-muted-foreground">{t('x.imported_badge')}</span>}
                    </div>
                    <div className="line-clamp-2 text-muted-foreground">{tw.text}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void doImport()} disabled={chosen.length === 0 || running}>
              <Download />
              {t('x.import', { n: chosen.length })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function XBookmarksDialog({
  open, data, onClose,
}: {
  open: boolean;
  data: CollectData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('x.title')}</DialogTitle>
          <DialogDescription>{t('x.desc')}</DialogDescription>
        </DialogHeader>
        {open && <XBookmarksBody data={data} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
