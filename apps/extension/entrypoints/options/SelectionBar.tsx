import { useTranslation } from 'react-i18next';
import { ChevronDown, FolderInput, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Folder } from '@/utils/collect/store';
import { FolderMenuItems } from './FolderMenuItems';

export function SelectionBar({
  count, total, folders, onSelectAll, onClear, onMove, onDelete,
}: {
  count: number;
  total: number;
  folders: Folder[];
  onSelectAll: () => void;
  onClear: () => void;
  onMove: (folderId: string | null) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border bg-white/80 pr-1 pl-4 text-sm">
      <span className="font-medium">{t('collect.selected', { n: count })}</span>
      {count < total && (
        <Button variant="link" size="sm" className="px-1" onClick={onSelectAll}>
          {t('collect.selectAll')}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderInput />
              {t('collect.moveTo')}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <FolderMenuItems folders={folders} onPick={onMove} />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
          <Trash2 />
          {t('collect.delete')}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label={t('collect.cancel')}>
          <X />
        </Button>
      </div>
    </div>
  );
}
