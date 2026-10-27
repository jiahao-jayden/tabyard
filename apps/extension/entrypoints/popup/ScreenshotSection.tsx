import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { browser, type Browser } from 'wxt/browser';
import { AppWindow, Crop, LoaderCircle, ScrollText } from 'lucide-react';
import { isCollectable } from '@/utils/collect/capture';
import type { ScreenshotMode, ScreenshotRequest } from '@/utils/screenshot/capture';

function ModeTile({
  icon, label, onClick, disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-xl border bg-card px-2 py-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-white disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-6 [&_svg]:text-primary"
    >
      {icon}
      {label}
    </button>
  );
}

export function ScreenshotSection({ activeTab }: { activeTab: Browser.tabs.Tab | undefined }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<ScreenshotMode | null>(null);
  const tabId = activeTab?.id;

  if (tabId === undefined || !isCollectable(activeTab?.url)) {
    return <p className="text-xs text-muted-foreground">{t('screenshot.unsupported')}</p>;
  }

  const capture = async (mode: ScreenshotMode) => {
    const request: ScreenshotRequest = { type: 'screenshot', mode, tabId, hint: t('screenshot.regionHint') };
    // 框选需要在页面上操作，先关闭 popup，结果由后台直接打开
    if (mode === 'region') {
      void browser.runtime.sendMessage(request);
      window.close();
      return;
    }
    setBusy(mode);
    const res = (await browser.runtime.sendMessage(request).catch((e: Error) => ({ ok: false, error: e.message }))) as
      | { ok: true }
      | { ok: false; error: string };
    setBusy(null);
    if (res.ok) window.close();
    else toast.error(t('screenshot.failed', { msg: res.error }));
  };

  const tile = (mode: ScreenshotMode, icon: ReactNode) => (
    <ModeTile
      icon={busy === mode ? <LoaderCircle className="animate-spin" /> : icon}
      label={t(`screenshot.${mode}`)}
      onClick={() => void capture(mode)}
      disabled={busy !== null}
    />
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {tile('visible', <AppWindow />)}
      {tile('full', <ScrollText />)}
      {tile('region', <Crop />)}
    </div>
  );
}
