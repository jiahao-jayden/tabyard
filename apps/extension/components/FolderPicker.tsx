import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { addFolder, type Folder } from '@/utils/collect/store';

const UNFILED = 'none';
const NEW_FOLDER = '__new__';

/** 收藏时选择文件夹，可就地新建；value 为 null 表示未分类 */
export function FolderPicker({
  folders, value, onChange, onCreated, disabled, className,
}: {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  onCreated: (folder: Folder) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const created = await addFolder(newName);
    onCreated(created);
    onChange(created.id);
    setNewName('');
    setCreating(false);
  };

  if (creating) {
    return (
      <form onSubmit={(e) => void createFolder(e)} className={`flex items-center gap-1 ${className ?? ''}`}>
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
    );
  }

  return (
    <Select
      value={value ?? UNFILED}
      onValueChange={(v) => (v === NEW_FOLDER ? setCreating(true) : onChange(v === UNFILED ? null : v))}
      disabled={disabled}
    >
      <SelectTrigger className={`h-9 rounded-full bg-card ${className ?? ''}`} aria-label={t('popup.collectFolder')}>
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
  );
}
