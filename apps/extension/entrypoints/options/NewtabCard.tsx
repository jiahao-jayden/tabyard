import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { isNewtabEnabled, setNewtabEnabled } from '@/utils/newtab';
import { SettingRow } from './SettingRow';

export function NewtabCard() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    void isNewtabEnabled().then(setEnabled);
  }, []);

  const change = (value: boolean) => {
    setEnabled(value);
    void setNewtabEnabled(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('newtab.settingTitle')}</CardTitle>
        <CardDescription>{t('newtab.settingDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow id="newtab-enabled" label={t('newtab.settingEnabled')}>
          <Switch
            id="newtab-enabled"
            checked={enabled === true}
            disabled={enabled === null}
            onCheckedChange={change}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
