import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isNewtabEnabled, setNewtabEnabled } from '@/utils/newtab';

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
        <div className="flex items-center justify-between">
          <Label htmlFor="newtab-enabled">{t('newtab.settingEnabled')}</Label>
          <Switch
            id="newtab-enabled"
            checked={enabled === true}
            disabled={enabled === null}
            onCheckedChange={change}
          />
        </div>
      </CardContent>
    </Card>
  );
}
