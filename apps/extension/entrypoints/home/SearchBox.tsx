import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe, Search, Settings } from 'lucide-react';
import { cn } from 'cn';
import { mutateNewtabSettings, type NewtabSettings } from '@/utils/newtab-settings';
import { getSource, SEARCH_SOURCES, type SearchSource, type SearchSourceId } from '@/utils/search-sources';
import { Favicon } from './Favicon';
import { SourceIcon } from './SourceIcon';
import { PANEL_COLUMNS, SourcePanel } from './SourcePanel';
import { openUrl, resolveUrl, runSearch } from './address';
import { useHistorySuggestions } from './useHistorySuggestions';
import { useWebSuggestions } from './useWebSuggestions';

export interface Candidate {
  title: string;
  url: string;
}

type Item =
  | { kind: 'primary'; query: string; url: string | null }
  | { kind: 'web'; query: string }
  | { kind: 'local'; title: string; url: string }
  | { kind: 'history'; title: string; url: string };

const MAX_LOCAL = 5;

const barButton = 'flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

/**
 * 搜索框。输入后第一项永远是「打开网址」或「用当前搜索源搜索」，回车即执行；
 * 其后是联网建议，最后是匹配到的快捷方式和收藏。
 * 右侧的面板按钮打开搜索源面板：选搜索引擎会设为默认，选站内搜索只在本次页面内生效。
 */
export function SearchBox({ settings, candidates, onOpenSettings }: {
  settings: NewtabSettings;
  candidates: Candidate[];
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelActive, setPanelActive] = useState(0);
  /** 站内搜索；null 表示用默认搜索引擎 */
  const [scope, setScope] = useState<SearchSource | null>(null);
  const source = scope ?? getSource(settings.engine);
  const query = text.trim();
  const web = useWebSuggestions(query, source, settings.webSuggestions);
  const history = useHistorySuggestions(query, settings.historySuggestions);

  const panelSources = useMemo(() => {
    const filter = text.trim().toLowerCase();
    return filter
      ? SEARCH_SOURCES.filter((s) => s.label.toLowerCase().includes(filter) || s.id.includes(filter))
      : SEARCH_SOURCES;
  }, [text]);

  const items = useMemo<Item[]>(() => {
    if (!query) return [];
    const lower = query.toLowerCase();
    const seen = new Set<string>();
    const local = settings.suggestions
      ? candidates
          .filter((c) => c.title.toLowerCase().includes(lower) || c.url.toLowerCase().includes(lower))
          .filter((c) => !seen.has(c.url) && seen.add(c.url))
          .slice(0, MAX_LOCAL)
          .map((c): Item => ({ kind: 'local', title: c.title, url: c.url }))
      : [];
    return [
      { kind: 'primary', query, url: resolveUrl(query) },
      ...web.filter((s) => s !== query).map((s): Item => ({ kind: 'web', query: s })),
      ...local,
      // 已经作为快捷方式或收藏列出的网址，不在历史里重复
      ...history.filter((h) => !seen.has(h.url)).map((h): Item => ({ kind: 'history', title: h.title, url: h.url })),
    ];
  }, [query, web, history, candidates, settings.suggestions]);

  const suggestionsOpen = focused && !panelOpen && items.length > 0;

  const togglePanel = () => {
    setPanelOpen(!panelOpen);
    setText('');
    // 展开时高亮落在当前搜索源上，方向键从这里开始移动
    setPanelActive(Math.max(0, SEARCH_SOURCES.findIndex((s) => s.id === source.id)));
    inputRef.current?.focus();
  };

  const pick = (picked: SearchSource) => {
    if (picked.group === 'engine') {
      setScope(null);
      void mutateNewtabSettings((s) => ({ ...s, engine: picked.id as SearchSourceId }));
    } else {
      setScope(picked);
    }
    setPanelOpen(false);
    setText('');
    inputRef.current?.focus();
  };

  const run = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'local' || item.kind === 'history' || (item.kind === 'primary' && item.url)) {
      openUrl(item.kind === 'primary' ? item.url! : item.url, settings.openInNewTab);
    } else {
      runSearch(item.query, source, settings.openInNewTab);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 输入框为空时退格，去掉站内搜索的标签，回到默认引擎
    if (e.key === 'Backspace' && !text && scope) {
      e.preventDefault();
      setScope(null);
      return;
    }
    if (panelOpen) {
      const steps: Record<string, number> = {
        ArrowLeft: -1, ArrowRight: 1, ArrowUp: -PANEL_COLUMNS, ArrowDown: PANEL_COLUMNS,
      };
      const step = steps[e.key];
      if (step !== undefined) {
        e.preventDefault();
        setPanelActive((i) => Math.min(Math.max(i + step, 0), panelSources.length - 1));
      } else if (e.key === 'Escape') {
        togglePanel();
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!suggestionsOpen) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
  };

  const submit = () => {
    if (panelOpen) {
      const picked = panelSources[panelActive];
      if (picked) pick(picked);
    } else {
      run(items[active]);
    }
  };

  const firstLocal = items.findIndex((item) => item.kind === 'local');
  const firstHistory = items.findIndex((item) => item.kind === 'history');

  return (
    <form
      className="relative w-full max-w-xl"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // 焦点移出整个搜索区域才收起面板和建议
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setFocused(false);
        setPanelOpen(false);
      }}
    >
      <div className={cn(
        'flex h-12 items-center gap-1 rounded-full border border-border bg-card pr-2 pl-4 shadow-xs backdrop-blur transition-colors',
        focused && 'border-ring/40',
      )}>
        <button
          type="button"
          aria-label={t('newtab.engineTitle')}
          aria-expanded={panelOpen}
          className={cn(barButton, 'mr-1 -ml-2', panelOpen && 'bg-muted text-foreground')}
          onClick={togglePanel}
        >
          <Search className="size-4" />
        </button>
        {(panelOpen || scope) && (
          <button
            type="button"
            aria-label={t('newtab.engineTitle')}
            className="flex h-8 shrink-0 items-center gap-2 rounded-full bg-muted px-2.5 text-xs font-medium"
            onClick={togglePanel}
          >
            <span className="flex size-5 items-center justify-center rounded bg-white">
              <SourceIcon source={source} className="size-3.5" />
            </span>
            {source.label}
            <span className="font-normal text-muted-foreground">{t('newtab.current')}</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        )}
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => { setText(e.target.value); setActive(0); setPanelActive(0); }}
          onKeyDown={onKeyDown}
          placeholder={panelOpen ? t('newtab.filterPlaceholder') : scope ? t('newtab.searchInSite') : t('newtab.searchPlaceholder')}
          aria-label={t('newtab.searchPlaceholder')}
          role="combobox"
          aria-expanded={suggestionsOpen || panelOpen}
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground"
        />
        <button type="button" aria-label={t('newtab.settings')} className={barButton} onClick={onOpenSettings}>
          <Settings className="size-4" />
        </button>
      </div>
      {panelOpen && (
        <SourcePanel
          sources={panelSources}
          active={panelActive}
          currentId={source.id}
          onPick={pick}
          onHover={setPanelActive}
        />
      )}
      {suggestionsOpen && (
        <ul role="listbox" className="absolute top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
          {items.map((item, i) => (
            <li key={`${item.kind}:${item.kind === 'local' || item.kind === 'history' ? item.url : item.query}`} role="presentation">
              {(i === firstLocal || i === firstHistory) && (
                <div className="mt-1 border-t border-border px-3 pt-2 pb-1 text-xs text-muted-foreground">
                  {t(i === firstLocal ? 'newtab.localHeading' : 'newtab.historyHeading')}
                </div>
              )}
              {/* mousedown 先于输入框失焦，保证点击能触发 */}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm',
                  i === active && 'bg-muted',
                )}
                onMouseMove={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); run(item); }}
              >
                {item.kind === 'local' || item.kind === 'history'
                  ? <Favicon url={item.url} title={item.title} className="size-4 shrink-0" />
                  : item.kind === 'primary' && item.url
                    ? <Globe className="size-4 shrink-0 text-muted-foreground" />
                    : <Search className="size-4 shrink-0 text-muted-foreground" />}
                {item.kind === 'local' || item.kind === 'history' ? (
                  <>
                    <span className="truncate">{item.title}</span>
                    <span className="ml-auto max-w-[40%] truncate text-xs text-muted-foreground">{new URL(item.url).hostname}</span>
                  </>
                ) : item.kind === 'primary' ? (
                  <>
                    <span className="truncate font-medium">{item.url ?? item.query}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {item.url ? t('newtab.openAddress') : t('newtab.searchWith', { engine: source.label })}
                    </span>
                  </>
                ) : (
                  <span className="truncate">{item.query}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
