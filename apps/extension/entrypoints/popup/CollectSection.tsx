import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Browser } from 'wxt/browser';
import { BookmarkCheck, BookmarkPlus, Check, LoaderCircle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { capturePage, isCollectable, type PageInfo } from '@/utils/collect/capture';
import {
  addBookmark, addFolder, loadCollect, type Folder,
} from '@/utils/collect/store';
import { normalizeUrl } from '@/utils/collect/url';
import { PagePreview } from './PagePreview';

const UNFILED = 'none';
const NEW_FOLDER = '__new__';

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
  const [folder, setFolder] = useState(UNFILED);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
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
        setFolder(existing.folderId ?? UNFILED);
      }
    });
  }, [activeTab]);

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await addFolder(newName);
    setFolders((list) => [...list, created]);
    setFolder(created.id);
    setNewName('');
    setCreating(false);
  };

  const save = async () => {
    if (!page) return;
    setBusy(true);
    try {
      await addBookmark({ ...page, folderId: folder === UNFILED ? null : folder });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {tab && <PagePreview page={page} />}
      {creating ? (
        <form onSubmit={(e) => void createFolder(e)} className="flex items-center gap-1">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('collect.newFolder')}
            maxLength={40}
            className="h-9 rounded-full"
          />
          <Button type="submit" size="icon" disabled={!newName.trim()} aria-label={t('collect.addFolder')}>
            <Check />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setCreating(false)} aria-label={t('popup.collectCancel')}>
            <X />
          </Button>
        </form>
      ) : (
      <Select
        value={folder}
        onValueChange={(v) => (v === NEW_FOLDER ? setCreating(true) : setFolder(v))}
        disabled={!tab}
      >
        <SelectTrigger className="h-9 w-full rounded-full bg-card" aria-label={t('popup.collectFolder')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNFILED}>{t('collect.unfiled')}</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NEW_FOLDER}>
            <Plus />
            {t('popup.collectNewFolder')}
          </SelectItem>
        </SelectContent>
      </Select>
      )}
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
