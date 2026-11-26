import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Browser } from 'wxt/browser';
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from 'lucide-react';
import { FolderPicker } from '@/components/FolderPicker';
import { Button } from '@/components/ui/button';
import { captureCover } from '@/utils/collect/covers';
import { capturePage, isCollectable, type PageInfo } from '@/utils/collect/capture';
import { addBookmark, loadCollect, type Folder } from '@/utils/collect/store';
import { normalizeUrl } from '@/utils/collect/url';
import { PagePreview } from './PagePreview';

interface CurrentTab {
  id?: number;
  windowId?: number;
  url: string;
  title?: string;
  favIconUrl?: string;
}

export function CollectSection({ activeTab }: { activeTab: Browser.tabs.Tab | undefined }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CurrentTab | null>(null);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  // undefined = 未收藏；否则为已收藏所在的文件夹（null = 未分类）
  const [savedFolder, setSavedFolder] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadCollect().then((data) => {
      setFolders(data.folders);
      if (!isCollectable(activeTab?.url)) return;
      const current = { id: activeTab.id, windowId: activeTab.windowId, url: activeTab.url, title: activeTab.title, favIconUrl: activeTab.favIconUrl };
      setTab(current);
      void capturePage(current).then(setPage);
      const existing = data.bookmarks.find((b) => b.url === normalizeUrl(current.url));
      if (existing) {
        setSavedFolder(existing.folderId);
        setFolder(existing.folderId);
      }
    });
  }, [activeTab]);

  const save = async () => {
    if (!page) return;
    setBusy(true);
    try {
      if (!page.image && tab?.windowId != null) await captureCover(tab.windowId, page.url);
      await addBookmark({ ...page, folderId: folder });
      setSavedFolder(folder);
    } finally {
      setBusy(false);
    }
  };

  const isSaved = savedFolder !== undefined;
  const unchanged = isSaved && savedFolder === folder;
  const savedFolderName = savedFolder == null ? t('collect.unfiled') : folders.find((f) => f.id === savedFolder)?.name;

  return (
    <div className="space-y-3">
      {tab && <PagePreview page={page} />}
      {isSaved && (
        <p className="text-xs text-muted-foreground">{t('popup.collectSavedIn', { folder: savedFolderName })}</p>
      )}
      <FolderPicker
        folders={folders}
        value={folder}
        onChange={setFolder}
        onCreated={(created) => setFolders((list) => [...list, created])}
        disabled={!tab}
        className="w-full"
      />
      <Button
        size="lg"
        className="h-9 w-full rounded-full"
        onClick={() => void save()}
        disabled={!page || busy || unchanged}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : unchanged ? <BookmarkCheck /> : <BookmarkPlus />}
        {!tab
          ? t('popup.collectUnsupported')
          : unchanged
            ? t('popup.collectSaved')
            : isSaved
              ? t('popup.collectMove')
              : t('popup.collectSave')}
      </Button>
    </div>
  );
}
