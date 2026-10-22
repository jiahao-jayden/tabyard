import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { browser, type Browser } from 'wxt/browser';
import { Bookmark, ChevronRight, LoaderCircle, Settings2, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { loadConfig, patchSettings } from '@/utils/rules';
import { Toaster } from 'sonner';
import { ClipSection } from './ClipSection';
import { CollectSection } from './CollectSection';

function MenuRow({
  icon, label, onClick, disabled, chevron = true,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 border-t px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4"
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {chevron && <ChevronRight />}
    </button>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  /** undefined 表示还在读取；读取完成后可能没有活动标签页，用 null 表示 */
  const [activeTab, setActiveTab] = useState<Browser.tabs.Tab | null | undefined>(undefined);

  useEffect(() => {
    void loadConfig().then(({ settings }) => setEnabled(settings.enabled));
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => setActiveTab(tab ?? null));
  }, []);

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
  };

  return (
    <div className="w-80 bg-background text-foreground">
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

      <div className="px-4 pb-4">
        {activeTab === undefined ? null : <CollectSection activeTab={activeTab ?? undefined} />}
      </div>

      <div className="border-t px-4 py-3">
        {activeTab === undefined ? null : <ClipSection activeTab={activeTab ?? undefined} />}
      </div>

      <MenuRow
        icon={busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
        label={busy ? t('popup.regrouping') : t('popup.regroup')}
        onClick={() => void regroup()}
        disabled={busy}
        chevron={false}
      />
      <MenuRow
        icon={<Bookmark />}
        label={t('popup.collectOpen')}
        onClick={() => void browser.tabs.create({ url: `${location.origin}/options.html#collect` })}
      />
      <MenuRow
        icon={<Settings2 />}
        label={t('popup.settings')}
        onClick={() => void browser.runtime.openOptionsPage()}
      />
      <Toaster position="top-center" richColors />
    </div>
  );
}
