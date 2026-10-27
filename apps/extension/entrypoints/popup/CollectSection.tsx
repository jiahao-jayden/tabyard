import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Browser } from 'wxt/browser';
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from 'lucide-react';
import { FolderPicker } from '@/components/FolderPicker';
import { Button } from '@/components/ui/button';
import { capturePage, isCollectable, type PageInfo } from '@/utils/collect/capture';
import { addBookmark, loadCollect, type Folder } from '@/utils/collect/store';
import { normalizeUrl } from '@/utils/collect/url';
import { PagePreview } from './PagePreview';

interface CurrentTab {
  id?: number;
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
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadCollect().then((data) => {
      setFolders(data.folders);
      if (!isCollectable(activeTab?.url)) return;
      const current = { id: activeTab.id, url: activeTab.url, title: activeTab.title, favIconUrl: activeTab.favIconUrl };
      setTab(current);
      void capturePage(current).then(setPage);
      const existing = data.bookmarks.find((b) => b.url === normalizeUrl(current.url));
      if (existing) {
        setSaved(true);
        setFolder(existing.folderId);
      }
    });
  }, [activeTab]);

  const save = async () => {
    if (!page) return;
    setBusy(true);
    try {
      await addBookmark({ ...page, folderId: folder });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {tab && <PagePreview page={page} />}
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
        disabled={!page || busy}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : saved ? <BookmarkCheck /> : <BookmarkPlus />}
        {!tab ? t('popup.collectUnsupported') : saved ? t('popup.collectUpdate') : t('popup.collectSave')}
      </Button>
    </div>
  );
}
