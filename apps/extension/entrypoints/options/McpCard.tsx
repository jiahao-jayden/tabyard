import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { API_URL, ApiError, createMcpKey, fetchAccount, fetchMcpKey, revokeMcpKey, type McpKeyStatus } from '@/utils/api';
import type { Plan } from '@/utils/plan';

const ENDPOINT = `${API_URL}/api/mcp`;

export function McpCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const [status, setStatus] = useState<McpKeyStatus | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const user = await fetchAccount();
    setSignedIn(!!user);
    if (!user || plan !== 'pro') return;
    try {
      setStatus(await fetchMcpKey());
      setFailed(false);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') setSignedIn(false);
      else setFailed(true);
    }
  }, [plan, t]);

  useEffect(() => {
    void load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('mcp.copied'));
  };

  const generate = async () => {
    setBusy(true);
    try {
      const created = await createMcpKey();
      setFreshKey(created.key);
      setStatus(created);
    } catch {
      toast.error(t('mcp.failed'));
    }
    setBusy(false);
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeMcpKey();
      setFreshKey(null);
      setStatus(await fetchMcpKey());
    } catch {
      toast.error(t('mcp.failed'));
    }
    setBusy(false);
  };

  if (signedIn === undefined) return null;

  const openUrl = (path: string) => void browser.tabs.create({ url: `${API_URL}${path}` });
  let description = t('mcp.proHint');
  let action: ReactNode = <Button onClick={() => openUrl('/api/checkout')}>{t('account.upgrade')}</Button>;
  if (plan === 'pro' && !signedIn) {
    description = t('mcp.signInHint');
    action = <Button variant="outline" onClick={() => openUrl('/login')}>{t('account.signIn')}</Button>;
  } else if (plan === 'pro' && failed && !status) {
    description = t('mcp.failed');
    action = <Button variant="outline" onClick={() => void load()}>{t('mcp.retry')}</Button>;
  } else if (plan === 'pro' && status) {
    description = t('mcp.usage', { used: status.used, limit: status.limit });
    action = status.prefix ? (
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          if (window.confirm(t('mcp.regenerateConfirm'))) void generate();
        }}
      >
        {t('mcp.regenerate')}
      </Button>
    ) : (
      <Button disabled={busy} onClick={() => void generate()}>{t('mcp.generate')}</Button>
    );
  } else if (plan === 'pro') {
    action = null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mcp.title')}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      {plan === 'pro' && signedIn && status && (
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={ENDPOINT} className="font-mono text-xs" aria-label={t('mcp.endpoint')} />
            <Button variant="outline" onClick={() => void copy(ENDPOINT)}>{t('mcp.copy')}</Button>
          </div>
          <p className="text-muted-foreground">{t('mcp.header')}</p>
          {freshKey ? (
            <div className="space-y-2">
              <p>{t('mcp.keyOnce')}</p>
              <div className="flex gap-2">
                <Input readOnly value={freshKey} className="font-mono text-xs" aria-label={t('mcp.title')} />
                <Button variant="outline" onClick={() => void copy(freshKey)}>{t('mcp.copy')}</Button>
              </div>
            </div>
          ) : status.prefix ? (
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs">{status.prefix}…</p>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('mcp.revokeConfirm'))) void revoke();
                }}
              >
                {t('mcp.revoke')}
              </Button>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
