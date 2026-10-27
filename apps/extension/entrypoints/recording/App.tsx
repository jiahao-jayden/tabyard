import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob, safeFilename } from '@/utils/clip/download';
import { loadRecording, type RecordingMeta } from '@/utils/record/store';

type Recording = RecordingMeta & { blob: Blob };

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** 录屏结果：预览与下载 */
export default function App() {
  const { t } = useTranslation();
  /** undefined 表示读取中，null 表示录像已不存在 */
  const [recording, setRecording] = useState<Recording | null | undefined>(undefined);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let url = '';
    void loadRecording(location.hash.slice(1)).then((result) => {
      setRecording(result);
      if (!result) return;
      url = URL.createObjectURL(result.blob);
      setSrc(url);
      document.title = `${t('record.pageTitle')} · ${result.title}`;
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [t]);

  const download = () => {
    const ext = recording!.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const name = safeFilename(recording!.title, ext, 'recording');
    downloadBlob(recording!.blob, name);
    toast.success(t('record.downloaded', { name }));
  };

  if (recording === undefined) return null;
  if (recording === null) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{t('record.missing')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <img src="/logo.svg" alt="" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{recording.title || t('record.pageTitle')}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatSize(recording.blob.size)} · {recording.url}
          </div>
        </div>
        <Button className="rounded-full" onClick={download}>
          <Download />
          {t('record.download')}
        </Button>
      </header>
      <video src={src} controls autoPlay className="mx-auto block max-h-[80vh] max-w-full rounded-xl border bg-black shadow-sm" />
      <Toaster position="top-center" richColors />
    </div>
  );
}
