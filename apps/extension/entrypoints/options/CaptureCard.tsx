import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DEFAULT_WATERMARK_POSITION, WATERMARK_POSITIONS, type WatermarkPosition, type WatermarkUser } from '@/utils/watermark';
import {
  getWatermarkPosition,
  isShowUserEnabled,
  isWatermarkEnabled,
  refreshWatermarkUser,
  setShowUserEnabled,
  setWatermarkEnabled,
  setWatermarkPosition,
} from '@/utils/watermark-settings';
import { SettingRow } from './SettingRow';

/** 截图与录屏设置 */
export function CaptureCard() {
  const { t } = useTranslation();
  const [watermark, setWatermark] = useState<boolean | null>(null);
  const [showUser, setShowUser] = useState(false);
  const [position, setPosition] = useState<WatermarkPosition>(DEFAULT_WATERMARK_POSITION);
  /** 当前登录的用户；为 null 表示未登录 */
  const [user, setUser] = useState<WatermarkUser | null>(null);

  useEffect(() => {
    void isWatermarkEnabled().then(setWatermark);
    void isShowUserEnabled().then(setShowUser);
    void getWatermarkPosition().then(setPosition);
    const refresh = () => void refreshWatermarkUser().then(setUser);
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const changeWatermark = (value: boolean) => {
    setWatermark(value);
    void setWatermarkEnabled(value);
  };

  const changeShowUser = (value: boolean) => {
    setShowUser(value);
    void setShowUserEnabled(value);
  };

  const changePosition = (value: WatermarkPosition) => {
    setPosition(value);
    void setWatermarkPosition(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('capture.title')}</CardTitle>
        <CardDescription>{t('capture.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SettingRow id="capture-watermark" label={t('capture.watermark')} hint={t('capture.watermarkHint')}>
          <Switch
            id="capture-watermark"
            checked={watermark === true}
            disabled={watermark === null}
            onCheckedChange={changeWatermark}
          />
        </SettingRow>
        <SettingRow label={t('capture.position')}>
          <Select value={position} onValueChange={(v) => changePosition(v as WatermarkPosition)} disabled={!watermark}>
            <SelectTrigger className="w-36" aria-label={t('capture.position')}><SelectValue /></SelectTrigger>
            <SelectContent>
              {WATERMARK_POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>{t(`capture.pos.${p}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          id="capture-show-user"
          label={t('capture.showUser')}
          hint={user ? t('capture.showUserHint', { name: user.name }) : t('capture.showUserSignIn')}
        >
          <Switch
            id="capture-show-user"
            checked={showUser && user !== null}
            disabled={!watermark || !user}
            onCheckedChange={changeShowUser}
          />
        </SettingRow>
      </CardContent>
    </Card>
  );
}
