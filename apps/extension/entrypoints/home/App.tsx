import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COLLECT_KEY } from '@/utils/collect/url';
import { loadCollect } from '@/utils/collect/store';
import { loadNewtabSettings, mutateNewtabSettings, NEWTAB_SETTINGS_KEY } from '@/utils/newtab-settings';
import { loadShortcuts, SHORTCUTS_KEY } from '@/utils/shortcuts';
import { Background } from './Background';
import { BookmarksSection } from './BookmarksSection';
import { Clock } from './Clock';
import { CollectSection } from './CollectSection';
import { SearchBox, type Candidate } from './SearchBox';
import { SettingsSheet } from './SettingsSheet';
import { Shortcuts } from './Shortcuts';
import { UpdateNotice } from './UpdateNotice';
import { useStored } from './useStored';

export default function App() {
  const { t, i18n } = useTranslation();
  const settings = useStored(NEWTAB_SETTINGS_KEY, loadNewtabSettings);
  const shortcuts = useStored(SHORTCUTS_KEY, loadShortcuts);
  const collect = useStored(COLLECT_KEY, loadCollect);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = settings?.theme;

  useEffect(() => {
    document.title = t('newtab.pageTitle');
  }, [t, i18n.language]);

  useEffect(() => {
    if (!theme) return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'auto' && media.matches));
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const candidates = useMemo<Candidate[]>(
    () => [...(shortcuts ?? []), ...(collect?.bookmarks ?? [])].map(({ title, url }) => ({ title, url })),
    [shortcuts, collect],
  );

  // 设置读取完成前不渲染，避免先闪默认主题再切换
  if (!settings) return null;

  return (
    <>
      <Background wallpaper={settings.wallpaper} />
      <main className="flex min-h-screen flex-col items-center gap-8 px-6 pt-[12vh] pb-12">
        {settings.sections.clock && <Clock hour24={settings.clock24h} />}
        <SearchBox settings={settings} candidates={candidates} onOpenSettings={() => setSettingsOpen(true)} />
        <UpdateNotice />
        {settings.sections.shortcuts && <Shortcuts list={shortcuts ?? []} openInNewTab={settings.openInNewTab} />}
        {/* 书签、标签组、收藏共用同一宽度，卡片网格才对得齐 */}
        <div className="flex w-full max-w-6xl flex-col gap-8">
          {settings.sections.bookmarks && (
            <BookmarksSection
              mode={settings.bookmarksMode}
              onModeChange={(bookmarksMode) => void mutateNewtabSettings((s) => ({ ...s, bookmarksMode }))}
              openInNewTab={settings.openInNewTab}
            />
          )}
          {settings.sections.collect && collect && (
            <CollectSection
              data={collect}
              mode={settings.collectMode}
              onModeChange={(collectMode) => void mutateNewtabSettings((s) => ({ ...s, collectMode }))}
              openInNewTab={settings.openInNewTab}
            />
          )}
        </div>
      </main>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </>
  );
}
