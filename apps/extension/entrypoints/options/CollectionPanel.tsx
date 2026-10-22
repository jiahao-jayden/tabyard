import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { Download, Search, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hostnameOf } from '@tabyard/shared';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { loadModelConfig, type ModelConfig } from '@/utils/collect/llm';
import { COLLECT_KEY } from '@/utils/collect/url';
import {
  deleteBookmarks, loadCollect, moveBookmarks, type Bookmark, type CollectData,
} from '@/utils/collect/store';
import { BookmarkCard } from './BookmarkCard';
import { EditBookmarkDialog } from './EditBookmarkDialog';
import { FolderSidebar, type FolderFilter } from './FolderSidebar';
import { ModelSettingsDialog } from './ModelSettingsDialog';
import { OrganizeDialog } from './OrganizeDialog';
import { XBookmarksDialog } from './XBookmarksDialog';
import { SelectionBar } from './SelectionBar';

type SourceFilter = 'all' | 'web' | 'tweet';
const SOURCES: SourceFilter[] = ['all', 'web', 'tweet'];

export function CollectionPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState<CollectData | null>(null);
  const [filter, setFilter] = useState<FolderFilter>('all');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [xOpen, setXOpen] = useState(false);
  /** 非空表示整理对话框已打开 */
  const [organizing, setOrganizing] = useState<ModelConfig | null>(null);

  useEffect(() => {
    const refresh = () => void loadCollect().then(setData);
    refresh();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === 'local' && changes[COLLECT_KEY]) refresh();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.bookmarks ?? []).filter((b) => {
      if (source !== 'all' && (source === 'tweet') !== !!b.source) return false;
      if (filter === 'none' ? b.folderId !== null : filter !== 'all' && b.folderId !== filter) return false;
      return !q || `${b.title} ${b.description} ${hostnameOf(b.url)}`.toLowerCase().includes(q);
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [data, filter, query, source]);

  if (!data) return null;

  /** 只统计当前可见的选中项；其他上下文删除了收藏时，残留的 id 不会被计入 */
  const chosen = visible.filter((b) => selected.has(b.id)).map((b) => b.id);

  const changeFilter = (next: FolderFilter) => {
    setFilter(next);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const startOrganize = async () => {
    const config = await loadModelConfig();
    if (config) setOrganizing(config);
    else setModelOpen(true);
  };

  const moveChosen = (folderId: string | null) => {
    void moveBookmarks(chosen, folderId);
    setSelected(new Set());
  };

  const deleteChosen = () => {
    if (!window.confirm(t('collect.deleteConfirm', { n: chosen.length }))) return;
    void deleteBookmarks(chosen);
    setSelected(new Set());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('collect.title')}</CardTitle>
        <CardDescription>{t('collect.desc')}</CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setXOpen(true)}>
            <Download />
            {t('x.open')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void startOrganize()} disabled={!data.bookmarks.some((b) => b.folderId === null)}>
            <Sparkles />
            {t('ai.button')}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setModelOpen(true)} aria-label={t('ai.settingsTitle')}>
            <Settings2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <FolderSidebar data={data} selected={filter} onSelect={changeFilter} />
        <div className="min-w-0 flex-1 space-y-4">
          {chosen.length > 0 ? (
            <SelectionBar
              count={chosen.length}
              total={visible.length}
              folders={data.folders}
              onSelectAll={() => setSelected(new Set(visible.map((b) => b.id)))}
              onClear={() => setSelected(new Set())}
              onMove={moveChosen}
              onDelete={deleteChosen}
            />
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('collect.search')}
                  className="h-9 pl-9"
                />
              </div>
              {data.bookmarks.some((b) => b.source) && (
                <div className="flex shrink-0 rounded-full border bg-white/60 p-0.5">
                  {SOURCES.map((v) => (
                    <Button key={v} variant={source === v ? 'secondary' : 'ghost'} size="xs" onClick={() => setSource(v)}>
                      {t(`collect.source${v === 'all' ? 'All' : v === 'web' ? 'Web' : 'Tweet'}`)}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {data.bookmarks.length === 0 ? t('collect.empty') : t('collect.emptyFilter')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((b) => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  folders={data.folders}
                  selected={selected.has(b.id)}
                  selecting={chosen.length > 0}
                  onToggle={() => toggle(b.id)}
                  onEdit={() => setEditing(b)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <ModelSettingsDialog
        open={modelOpen}
        onClose={() => setModelOpen(false)}
        onSaved={() => setModelOpen(false)}
      />
      <OrganizeDialog config={organizing} data={data} onClose={() => setOrganizing(null)} />
      <XBookmarksDialog open={xOpen} data={data} onClose={() => setXOpen(false)} />
      <EditBookmarkDialog bookmark={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
