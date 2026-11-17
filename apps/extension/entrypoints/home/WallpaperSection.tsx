import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { cn } from 'cn';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  mutateNewtabSettings, SOLID_COLORS, WALLPAPER_EFFECTS, type Wallpaper, type WallpaperSource,
} from '@/utils/newtab-settings';
import { CURATED, CURATED_CATEGORIES, findCurated, type CuratedCategory } from '@/utils/wallpaper-catalog';
import {
  addLocalWallpaper, listLocalWallpapers, removeLocalWallpaper, type LocalWallpaper,
} from '@/utils/wallpapers';
import { Group, Row, ToggleRow } from './SettingsParts';
import { useBingWallpaper, useObjectUrl } from './useWallpaper';

const TABS = ['builtin', 'local', 'bing', 'curated'] as const;
type Tab = (typeof TABS)[number];

const tabOf = (source: WallpaperSource): Tab =>
  source.type === 'default' || source.type === 'solid' ? 'builtin' : source.type;

const patch = (change: Partial<Wallpaper>) =>
  mutateNewtabSettings((s) => ({ ...s, wallpaper: { ...s.wallpaper, ...change } }));
const select = (source: WallpaperSource) => patch({ source });

function Tile({ selected, label, onClick, className, children }: {
  selected: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'relative block aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted transition',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-popover',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const Cover = ({ src }: { src: string | undefined }) =>
  src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null;

function BuiltinTab({ source }: { source: WallpaperSource }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile selected={source.type === 'default'} label={t('newtab.wallpaperDefault')} onClick={() => void select({ type: 'default' })}>
        <Cover src="/bg.webp" />
      </Tile>
      {SOLID_COLORS.map((color) => (
        <Tile
          key={color}
          selected={source.type === 'solid' && source.color.toLowerCase() === color}
          label={color}
          onClick={() => void select({ type: 'solid', color })}
        >
          <span className="block size-full" style={{ backgroundColor: color }} />
        </Tile>
      ))}
    </div>
  );
}

function LocalTile({ item, selected }: { item: LocalWallpaper; selected: boolean }) {
  const { t } = useTranslation();
  const thumb = useObjectUrl(item.thumb);
  return (
    <div className="group relative">
      <Tile selected={selected} label={t('newtab.wallpaperTabLocal')} onClick={() => void select({ type: 'local', id: item.id })}>
        <Cover src={thumb} />
      </Tile>
      <button
        type="button"
        aria-label={t('newtab.wallpaperDelete')}
        className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => void removeLocal(item.id, selected)}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

async function removeLocal(id: string, selected: boolean) {
  await removeLocalWallpaper(id);
  if (selected) await select({ type: 'default' });
  window.dispatchEvent(new Event(LOCAL_CHANGED));
}

const LOCAL_CHANGED = 'tabyard-wallpapers-changed';

function LocalTab({ source }: { source: WallpaperSource }) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<LocalWallpaper[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reload = () => void listLocalWallpapers().then(setItems);
    reload();
    window.addEventListener(LOCAL_CHANGED, reload);
    return () => window.removeEventListener(LOCAL_CHANGED, reload);
  }, []);

  const add = async (file: File) => {
    setFailed(false);
    try {
      await select({ type: 'local', id: await addLocalWallpaper(file) });
      window.dispatchEvent(new Event(LOCAL_CHANGED));
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <LocalTile key={item.id} item={item} selected={source.type === 'local' && source.id === item.id} />
        ))}
        <button
          type="button"
          aria-label={t('newtab.wallpaperAdd')}
          className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => fileInput.current?.click()}
        >
          <Plus className="size-5" />
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void add(file);
        }}
      />
      {failed && <p className="text-xs text-destructive">{t('newtab.wallpaperFailed')}</p>}
    </div>
  );
}

function BingTab({ source }: { source: WallpaperSource }) {
  const { t } = useTranslation();
  const bing = useBingWallpaper(true);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Tile
          selected={source.type === 'bing'}
          label="Bing"
          className="col-span-2"
          onClick={() => void select({ type: 'bing' })}
        >
          <Cover src={bing?.url} />
        </Tile>
      </div>
      <p className="text-xs text-muted-foreground">
        {bing === null ? t('newtab.wallpaperBingFailed') : bing?.copyright ?? t('newtab.wallpaperBingLoading')}
      </p>
      <p className="text-xs text-muted-foreground">{t('newtab.wallpaperBingHint')}</p>
    </div>
  );
}

function CuratedTab({ source }: { source: WallpaperSource }) {
  const { t } = useTranslation();
  const picked = source.type === 'curated' ? findCurated(source.id) : undefined;
  const [category, setCategory] = useState<CuratedCategory>(
    picked && CURATED.art.includes(picked) ? 'art' : 'nature',
  );
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {CURATED_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              category === c ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent',
            )}
            onClick={() => setCategory(c)}
          >
            {t(`newtab.wallpaperCategory_${c}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CURATED[category].map((item) => (
          <Tile
            key={item.id}
            selected={source.type === 'curated' && source.id === item.id}
            label={item.title || item.author}
            onClick={() => void select({ type: 'curated', id: item.id })}
          >
            <Cover src={item.thumb} />
          </Tile>
        ))}
      </div>
      {picked && (
        <p className="text-xs text-muted-foreground">{[picked.author, picked.title].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2">
      <Row label={label}><span className="text-xs text-muted-foreground tabular-nums">{value}%</span></Row>
      <Slider aria-label={label} min={0} max={100} step={1} value={[value]} onValueChange={([v]) => v !== undefined && onChange(v)} />
    </div>
  );
}

/** 设置侧边栏里的壁纸：来源分内置、本地、Bing、精选四类，另有遮罩和滤镜 */
export function WallpaperSection({ wallpaper }: { wallpaper: Wallpaper }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>(tabOf(wallpaper.source));
  const { source } = wallpaper;

  return (
    <Group title={t('newtab.wallpaperTitle')}>
      <ToggleRow
        id="nt-wallpaper"
        label={t('newtab.wallpaperEnabled')}
        checked={wallpaper.enabled}
        onChange={(enabled) => void patch({ enabled })}
      />
      {wallpaper.enabled && (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-3">
            <TabsList className="w-full border-0 bg-muted">
              {TABS.map((id) => (
                <TabsTrigger key={id} value={id} className="flex-1 px-2 data-[state=active]:bg-background">{t(`newtab.wallpaperTab_${id}`)}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="builtin"><BuiltinTab source={source} /></TabsContent>
            <TabsContent value="local"><LocalTab source={source} /></TabsContent>
            <TabsContent value="bing"><BingTab source={source} /></TabsContent>
            <TabsContent value="curated"><CuratedTab source={source} /></TabsContent>
          </Tabs>
          {source.type !== 'solid' && (
            <SliderRow label={t('newtab.wallpaperOverlay')} value={wallpaper.overlay} onChange={(overlay) => void patch({ overlay })} />
          )}
          <Row label={t('newtab.wallpaperEffect')}>
            <Select value={wallpaper.effect} onValueChange={(v) => void patch({ effect: v as Wallpaper['effect'] })}>
              <SelectTrigger className="w-36" aria-label={t('newtab.wallpaperEffect')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {WALLPAPER_EFFECTS.map((e) => (
                  <SelectItem key={e} value={e}>{t(`newtab.wallpaperEffect_${e}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          {wallpaper.effect !== 'none' && (
            <SliderRow label={t('newtab.wallpaperStrength')} value={wallpaper.strength} onChange={(strength) => void patch({ strength })} />
          )}
        </>
      )}
    </Group>
  );
}
