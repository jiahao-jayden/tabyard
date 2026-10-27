import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';
import { BookmarkCheck, BookmarkPlus, Copy, Download, LoaderCircle } from 'lucide-react';
import { FolderPicker } from '@/components/FolderPicker';
import { Button } from '@/components/ui/button';
import { downloadBlob, safeFilename } from '@/utils/clip/download';
import { makeCover, putCover } from '@/utils/collect/covers';
import { addBookmark, loadCollect, type Folder } from '@/utils/collect/store';
import { normalizeUrl } from '@/utils/collect/url';
import { getScreenshot, type Screenshot } from '@/utils/screenshot/store';

/** 截图结果：预览、复制到剪贴板、下载 PNG、收藏来源网页 */
export default function App() {
  const { t } = useTranslation();
  /** undefined 表示读取中，null 表示截图已不存在 */
  const [shot, setShot] = useState<Screenshot | null | undefined>(undefined);
  const [src, setSrc] = useState('');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let url = '';
    void Promise.all([getScreenshot(location.hash.slice(1)), loadCollect()]).then(([result, collect]) => {
      setShot(result ?? null);
      if (!result) return;
      url = URL.createObjectURL(result.blob);
      setSrc(url);
      document.title = `${t('screenshot.pageTitle')} · ${result.page.title}`;
      setFolders(collect.folders);
      const existing = collect.bookmarks.find((b) => b.url === normalizeUrl(result.page.url));
      if (existing) {
        setSaved(true);
        setFolder(existing.folderId);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [t]);

  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': shot!.blob })]);
      toast.success(t('screenshot.copied'));
    } catch (error) {
      toast.error(t('screenshot.copyFailed', { msg: (error as Error).message }));
    }
  };

  const download = () => {
    const name = safeFilename(shot!.page.title, 'png', 'screenshot');
    downloadBlob(shot!.blob, name);
    toast.success(t('screenshot.downloaded', { name }));
  };

  const collect = async () => {
    setSaving(true);
    try {
      await putCover(shot!.page.url, await makeCover(shot!.blob));
      await addBookmark({ ...shot!.page, folderId: folder });
      setSaved(true);
      toast.success(t('screenshot.collected'));
    } catch (error) {
      toast.error(t('screenshot.collectFailed', { msg: (error as Error).message }));
    } finally {
      setSaving(false);
    }
  };

  if (shot === undefined) return null;
  if (shot === null) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{t('screenshot.missing')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <img src="/logo.svg" alt="" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{shot.page.title || t('screenshot.pageTitle')}</div>
          <div className="truncate text-xs text-muted-foreground">
            {size && `${size.w} × ${size.h} · `}
            {shot.page.url}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FolderPicker
            folders={folders}
            value={folder}
            onChange={setFolder}
            onCreated={(created) => setFolders((list) => [...list, created])}
            className="w-44"
          />
          <Button variant="outline" className="rounded-full" onClick={() => void collect()} disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : saved ? <BookmarkCheck /> : <BookmarkPlus />}
            {saved ? t('popup.collectUpdate') : t('screenshot.collect')}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => void copy()}>
            <Copy />
            {t('screenshot.copy')}
          </Button>
          <Button className="rounded-full" onClick={download}>
            <Download />
            {t('screenshot.download')}
          </Button>
        </div>
      </header>
      <img
        src={src}
        alt={shot.page.title}
        onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className="mx-auto block max-w-full rounded-xl border bg-white shadow-sm"
      />
      <Toaster position="top-center" richColors />
    </div>
  );
}
