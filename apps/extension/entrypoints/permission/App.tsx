import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, CircleCheck, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * offscreen 文档和嵌入页面的 iframe 都无法弹出权限请求，
 * 需要先在这个扩展页面里向用户申请麦克风 / 摄像头，之后整个扩展都可使用
 */
export default function App() {
  const { t } = useTranslation();
  const params = new URLSearchParams(location.search);
  const mic = params.get('mic') === '1';
  const camera = params.get('camera') === '1';
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [error, setError] = useState('');

  const request = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: mic, video: camera });
      stream.getTracks().forEach((track) => track.stop());
      setStatus('granted');
    } catch (e) {
      setError((e as Error).message);
      setStatus('denied');
    }
  };

  return (
    <div className="mx-auto max-w-md p-6 pt-20">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mic && <Mic className="size-5" />}
            {camera && <Camera className="size-5" />}
            {t('record.permissionTitle')}
          </CardTitle>
          <CardDescription>{t('record.permissionDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === 'granted' ? (
            <>
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CircleCheck className="size-4" />
                {t('record.permissionGranted')}
              </p>
              <Button variant="outline" className="w-full rounded-full" onClick={() => window.close()}>
                {t('record.permissionClose')}
              </Button>
            </>
          ) : (
            <>
              <Button className="w-full rounded-full" onClick={() => void request()}>
                {t('record.permissionAllow')}
              </Button>
              {status === 'denied' && (
                <p className="text-sm text-destructive">{t('record.permissionDenied', { msg: error })}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
