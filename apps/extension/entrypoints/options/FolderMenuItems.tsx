import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import type { Folder } from '@/utils/collect/store';

/** 「移动到」菜单项：未分类 + 全部文件夹；current 为当前所在位置（批量时不传） */
export function FolderMenuItems({
  folders, current, onPick,
}: {
  folders: Folder[];
  current?: string | null;
  onPick: (folderId: string | null) => void;
}) {
  const { t } = useTranslation();
  const targets = [{ id: null as string | null, name: t('collect.unfiled') }, ...folders];
  return (
    <>
      <DropdownMenuLabel>{t('collect.moveTo')}</DropdownMenuLabel>
      {targets.map((target) => (
        <DropdownMenuItem key={target.id ?? 'none'} onSelect={() => onPick(target.id)}>
          <span className="flex-1">{target.name}</span>
          {current === target.id && <Check />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
