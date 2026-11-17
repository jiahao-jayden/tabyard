import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import type { SearchSource } from '@/utils/search-sources';
import { SourceIcon } from './SourceIcon';

/** 面板网格的列数；上下键按这个步长移动 */
export const PANEL_COLUMNS = 6;

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">{children}</kbd>;
}

/** 搜索引擎与站内搜索的选择面板；sources 是已筛选的结果，active 是其中的下标 */
export function SourcePanel({ sources, active, currentId, onPick, onHover }: {
  sources: readonly SearchSource[];
  active: number;
  currentId: string;
  onPick: (source: SearchSource) => void;
  onHover: (index: number) => void;
}) {
  const { t } = useTranslation();
  const groups = [
    { key: 'engine', title: t('newtab.panelEngines') },
    { key: 'site', title: t('newtab.panelSites') },
  ] as const;

  return (
    <div
      className="absolute top-full z-10 mt-2 w-full overflow-hidden rounded-3xl border border-border bg-popover shadow-lg"
      // 点击面板时保持输入框焦点：输入的文字用来筛选
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
        {sources.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('newtab.panelEmpty')}</p>}
        {groups.map(({ key, title }) => {
          const items = sources.map((source, index) => ({ source, index })).filter((x) => x.source.group === key);
          if (items.length === 0) return null;
          return (
            <section key={key} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
              <ul className="grid gap-1" style={{ gridTemplateColumns: `repeat(${PANEL_COLUMNS}, minmax(0, 1fr))` }}>
                {items.map(({ source, index }) => (
                  <li key={source.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full flex-col items-center gap-1.5 rounded-xl border border-transparent p-2 text-xs transition-colors',
                        source.id === currentId && 'border-primary/40 bg-primary/10 font-medium',
                        index === active && 'border-ring bg-muted',
                      )}
                      onMouseMove={() => onHover(index)}
                      onClick={() => onPick(source)}
                    >
                      {/* 白底：黑色图标（X、GitHub 等）在深色主题下也看得清 */}
                      <span className="flex size-11 items-center justify-center rounded-xl bg-white shadow-sm">
                        <SourceIcon source={source} className="size-6" />
                      </span>
                      <span className="w-full truncate text-center">{source.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
        <span className="mr-auto">{t('newtab.panelFilter')}</span>
        <span className="flex items-center gap-1.5"><Kbd>←↑↓→</Kbd>{t('newtab.panelMove')}</span>
        <span className="flex items-center gap-1.5"><Kbd>Enter</Kbd>{t('newtab.panelSelect')}</span>
        <span className="flex items-center gap-1.5"><Kbd>Esc</Kbd>{t('newtab.panelClose')}</span>
      </div>
    </div>
  );
}
