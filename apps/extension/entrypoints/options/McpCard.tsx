import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL, mcpUrl } from '@/utils/api';
import type { Plan } from '@/utils/plan';

/** 密钥在网站上生成和管理，这里只放入口 */
export function McpCard({ plan }: { plan: Plan }) {
  const { t, i18n } = useTranslation();
  const pro = plan === 'pro';
  const open = (url: string) => void browser.tabs.create({ url });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mcp.title')}</CardTitle>
        <CardDescription>{t(pro ? 'mcp.desc' : 'mcp.proHint')}</CardDescription>
        <CardAction>
          {pro ? (
            <Button variant="outline" onClick={() => open(mcpUrl(i18n.language))}>{t('mcp.manage')}</Button>
          ) : (
            <Button onClick={() => open(`${API_URL}/api/checkout`)}>{t('account.upgrade')}</Button>
          )}
        </CardAction>
      </CardHeader>
    </Card>
  );
}
