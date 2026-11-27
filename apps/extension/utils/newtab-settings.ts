// 新标签页的外观与行为设置：只存本机，不参与云同步，也不动配置的 modifiedAt
import { browser } from 'wxt/browser';
import { z } from 'zod';
import { withLock } from './rules';
import { SOURCE_IDS } from './search-sources';

// 整份设置连同默认值一起落盘，改默认值时已存的旧值会盖过新默认；换键即重置，不做迁移
export const NEWTAB_SETTINGS_KEY = 'newtabPrefs';
const LOCK = 'tabyard-newtab-settings';

export const SOLID_COLORS = ['#f4f0e6', '#e3ecf5', '#e4efe6', '#f3e6ee', '#2a2f3a', '#111111'] as const;

export const BOOKMARKS_MODES = ['folders', 'list', 'bar'] as const;
export type BookmarksMode = (typeof BOOKMARKS_MODES)[number];

export const WALLPAPER_EFFECTS = ['none', 'blur', 'grain'] as const;

const wallpaperSchema = z.object({
  enabled: z.boolean(),
  source: z.discriminatedUnion('type', [
    z.object({ type: z.literal('default') }),
    z.object({ type: z.literal('solid'), color: z.string().regex(/^#[0-9a-f]{6}$/i) }),
    /** 本地壁纸库里的壁纸，图片本体在 IndexedDB */
    z.object({ type: z.literal('local'), id: z.string() }),
    /** 当天的 Bing 壁纸 */
    z.object({ type: z.literal('bing') }),
    /** 精选壁纸，id 见 wallpaper-catalog */
    z.object({ type: z.literal('curated'), id: z.string() }),
  ]),
  /** 盖在壁纸上的主题底色的不透明度 */
  overlay: z.number().int().min(0).max(100),
  effect: z.enum(WALLPAPER_EFFECTS),
  strength: z.number().int().min(0).max(100),
});

export type Wallpaper = z.infer<typeof wallpaperSchema>;
export type WallpaperSource = Wallpaper['source'];

const DEFAULT_WALLPAPER: Wallpaper = {
  enabled: true,
  source: { type: 'default' },
  overlay: 40,
  effect: 'none',
  strength: 50,
};

const settingsSchema = z.object({
  sections: z.object({
    shortcuts: z.boolean(),
    bookmarks: z.boolean(),
    collect: z.boolean(),
    clock: z.boolean(),
  }),
  bookmarksMode: z.enum(BOOKMARKS_MODES),
  collectMode: z.enum(['compact', 'cards']).catch('compact'),
  clock24h: z.boolean(),
  theme: z.enum(['auto', 'light', 'dark']),
  wallpaper: wallpaperSchema.catch(DEFAULT_WALLPAPER),
  openInNewTab: z.boolean(),
  /** 默认搜索引擎（搜索源 id）；无法识别的 id 退回 Google */
  engine: z.enum(SOURCE_IDS).catch('google'),
  /** 本地建议：快捷方式和收藏 */
  suggestions: z.boolean(),
  historySuggestions: z.boolean(),
  /** 联网建议：把输入发给所选引擎；manifest 已声明 <all_urls> */
  webSuggestions: z.boolean(),
});

export type NewtabSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_NEWTAB_SETTINGS: NewtabSettings = {
  sections: { shortcuts: true, bookmarks: true, collect: true, clock: true },
  bookmarksMode: 'folders',
  collectMode: 'compact',
  clock24h: true,
  theme: 'auto',
  wallpaper: DEFAULT_WALLPAPER,
  openInNewTab: false,
  engine: 'google',
  suggestions: true,
  historySuggestions: false,
  webSuggestions: true,
};

export async function loadNewtabSettings(): Promise<NewtabSettings> {
  const stored = (await browser.storage.local.get(NEWTAB_SETTINGS_KEY))[NEWTAB_SETTINGS_KEY];
  const prefs = (stored ?? {}) as Partial<NewtabSettings>;
  // sections 逐项合并，之后新增分区时已保存的设置不会因缺字段而读不出来
  return settingsSchema.parse({
    ...DEFAULT_NEWTAB_SETTINGS,
    ...prefs,
    sections: { ...DEFAULT_NEWTAB_SETTINGS.sections, ...prefs.sections },
  });
}

/** 读-改-写放在锁内，多个新标签页可能同时编辑 */
export function mutateNewtabSettings(fn: (settings: NewtabSettings) => NewtabSettings): Promise<void> {
  return withLock(LOCK, async () => {
    const next = settingsSchema.parse(fn(await loadNewtabSettings()));
    await browser.storage.local.set({ [NEWTAB_SETTINGS_KEY]: next });
  });
}
