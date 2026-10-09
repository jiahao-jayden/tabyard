import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, fetchAccount } from '@/utils/api';
import type { Plan } from '@/utils/plan';
import { syncNow } from '@/utils/sync';

const storage = browser.storage.local;

function relativeTime(ts: number, lang: string): string {
  const minutes = Math.round((ts - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
  if (Math.abs(minutes) < 1440) return rtf.format(Math.round(minutes / 60), 'hour');
  return rtf.format(Math.round(minutes / 1440), 'day');
}

export function SyncCard({ plan }: { plan: Plan }) {
  const { t, i18n } = useTranslation();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [lastSyncAt, setLastSyncAt] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    const result = await syncNow();
    if (result === 'error') toast.error(t('sync.failed'), { id: 'sync-failed' });
    setBusy(false);
  }, [t]);

  useEffect(() => {
    void storage.get('lastSyncAt').then((s) => setLastSyncAt(s.lastSyncAt as number | undefined));
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes.lastSyncAt) setLastSyncAt(changes.lastSyncAt.newValue as number);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  useEffect(() => {
    const refresh = () => {
      void fetchAccount().then((user) => {
        setSignedIn(!!user);
        if (user && plan === 'pro') void run();
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [plan, run]);

  if (signedIn === undefined) return null;

  const openUrl = (path: string) => void browser.tabs.create({ url: `${API_URL}${path}` });

  let description = t('sync.proHint');
  let action: React.ReactNode = (
    <Button onClick={() => openUrl('/api/checkout')}>{t('account.upgrade')}</Button>
  );
  if (plan === 'pro') {
    description = lastSyncAt
      ? t('sync.last', { time: relativeTime(lastSyncAt, i18n.language) })
      : t('sync.never');
    action = signedIn ? (
      <Button variant="outline" disabled={busy} onClick={() => void run()}>
        {busy ? t('sync.syncing') : t('sync.now')}
      </Button>
    ) : (
      <Button variant="outline" onClick={() => openUrl('/login')}>{t('account.signIn')}</Button>
    );
    if (!signedIn) description = t('sync.signInHint');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sync.title')}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>{action}</CardAction>
      </CardHeader>
    </Card>
  );
}
