import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder as FolderIcon, FolderPlus, Inbox, Library, Pencil, X } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addFolder, deleteFolder, renameFolder, type CollectData } from '@/utils/collect/store';
import { API_URL } from '@/utils/api';
import { FREE_FOLDER_LIMIT, type Plan } from '@/utils/plan';
import { cn } from '@/lib/utils';

/** 'all' 全部、'none' 未分类，其余为文件夹 id */
export type FolderFilter = string;

export function FolderSidebar({
  data, plan, selected, onSelect,
}: {
  data: CollectData;
  plan: Plan;
  selected: FolderFilter;
  onSelect: (filter: FolderFilter) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const count = (folderId: string | null) => data.bookmarks.filter((b) => b.folderId === folderId).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setName('');
    void addFolder(name).then((folder) => onSelect(folder.id));
  };

  const commitRename = () => {
    if (renaming?.name.trim()) void renameFolder(renaming.id, renaming.name);
    setRenaming(null);
  };

  const remove = (id: string) => {
    if (selected === id) onSelect('all');
    void deleteFolder(id);
  };

  const rows = [
    { id: 'all', label: t('collect.all'), icon: <Library />, n: data.bookmarks.length },
    { id: 'none', label: t('collect.unfiled'), icon: <Inbox />, n: count(null) },
  ];

  return (
    <nav className="w-48 shrink-0 space-y-1" aria-label={t('collect.folders')}>
      {rows.map((row) => (
        <FolderRow key={row.id} active={selected === row.id} onClick={() => onSelect(row.id)} icon={row.icon} label={row.label} n={row.n} />
      ))}
      {data.folders.map((folder) =>
        renaming?.id === folder.id ? (
          <Input
            key={folder.id}
            autoFocus
            value={renaming.name}
            maxLength={40}
            className="h-8"
            onChange={(e) => setRenaming({ id: folder.id, name: e.target.value })}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(null);
            }}
          />
        ) : (
        <FolderRow
          key={folder.id}
          active={selected === folder.id}
          onClick={() => onSelect(folder.id)}
          icon={<FolderIcon />}
          label={folder.name}
          n={count(folder.id)}
          onRename={() => setRenaming({ id: folder.id, name: folder.name })}
          renameLabel={t('collect.renameFolder')}
          onRemove={() => remove(folder.id)}
          removeLabel={t('collect.deleteFolder')}
        />
        ),
      )}
      {plan === 'free' && data.folders.length >= FREE_FOLDER_LIMIT ? (
        <div className="space-y-1 px-3 pt-2 text-xs text-muted-foreground">
          <p>{t('collect.folderLimit', { limit: FREE_FOLDER_LIMIT })}</p>
          <button
            type="button"
            className="font-medium text-foreground hover:underline"
            onClick={() => void browser.tabs.create({ url: `${API_URL}/api/checkout` })}
          >
            {t('account.upgrade')}
          </button>
        </div>
      ) : (
      <form onSubmit={submit} className="flex items-center gap-1 pt-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('collect.newFolder')}
          className="h-8"
          maxLength={40}
        />
        <Button type="submit" variant="outline" size="icon" disabled={!name.trim()} aria-label={t('collect.addFolder')}>
          <FolderPlus />
        </Button>
      </form>
      )}
    </nav>
  );
}

function FolderRow({
  active, onClick, icon, label, n, onRename, renameLabel, onRemove, removeLabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  n: number;
  onRename?: () => void;
  renameLabel?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div
      className={cn(
        'group/row flex items-center rounded-full pr-1 text-sm transition-colors',
        active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left [&_svg]:size-4 [&_svg]:shrink-0">
        {icon}
        <span className="flex-1 truncate">{label}</span>
        <span className="text-xs text-muted-foreground group-hover/row:hidden group-focus-within/row:hidden">{n}</span>
      </button>
      {onRename && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="hidden group-hover/row:inline-flex group-focus-within/row:inline-flex"
          onClick={onRename}
          aria-label={renameLabel}
        >
          <Pencil />
        </Button>
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="hidden group-hover/row:inline-flex group-focus-within/row:inline-flex"
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <X />
        </Button>
      )}
    </div>
  );
}
