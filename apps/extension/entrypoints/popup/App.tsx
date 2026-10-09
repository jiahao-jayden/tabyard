import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { ChevronRight, LoaderCircle, Settings2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { loadConfig, patchSettings } from '@/utils/rules';

interface Stats {
  tabCount: number;
  groupedCount: number;
  groupCount: number;
}

export default function App() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { settings } = await loadConfig();
    setEnabled(settings.enabled);
    const [tabs, groups] = await Promise.all([
      browser.tabs.query({ currentWindow: true }),
      browser.tabGroups.query({ windowId: browser.windows.WINDOW_ID_CURRENT }),
    ]);
    setStats({
      tabCount: tabs.length,
      groupedCount: tabs.filter((tab) => tab.groupId !== -1).length,
      groupCount: groups.length,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    await patchSettings({ enabled: v });
  };

  const regroup = async () => {
    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: 'regroup' });
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 1200));
    setBusy(false);
    void refresh();
  };

  const statItems = [
    { label: t('popup.tabs'), value: stats?.tabCount },
    { label: t('popup.grouped'), value: stats?.groupedCount },
    { label: t('popup.groups'), value: stats?.groupCount },
  ];

  return (
    <div className="w-72 bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        <img src="/logo.svg" alt="" className="size-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium leading-tight">{t('app.title')}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
            {enabled ? t('popup.on') : t('popup.off')}
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={(v) => void toggle(v)} aria-label={t('popup.toggleLabel')} />
      </header>

      <div className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {statItems.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl bg-white/80 px-2 py-2.5 shadow-[0_4px_14px_rgb(42_95_145/0.1)]"
            >
              <div className="text-lg font-medium leading-none">{value ?? '–'}</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground">{t('popup.scope')}</p>

        <Button size="lg" className="h-9 w-full rounded-full" onClick={() => void regroup()} disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {busy ? t('popup.regrouping') : t('popup.regroup')}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => void browser.runtime.openOptionsPage()}
        className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings2 className="size-4" />
        <span className="flex-1 text-left">{t('popup.settings')}</span>
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
