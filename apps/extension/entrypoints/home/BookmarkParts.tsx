import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, MoreHorizontal } from 'lucide-react';
import { cn } from 'cn';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BOOKMARKS_MODES, type BookmarksMode } from '@/utils/newtab-settings';

export const tileClass = 'flex h-12 w-full items-center gap-3 rounded-xl bg-card px-3 text-left text-sm shadow-xs transition-colors hover:bg-muted';

export function FolderIcon({ className }: { className?: string }) {
  return <Folder className={cn('size-5 shrink-0 fill-sky-200 text-sky-400', className)} />;
}

export function IconButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'flex size-8 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

/** 三种展示方式的切换菜单，三种视图共用 */
export function BookmarkModeMenu({ mode, onModeChange }: { mode: BookmarksMode; onModeChange: (mode: BookmarksMode) => void }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={t('newtab.bookmarksMore')}><MoreHorizontal className="size-4" /></IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuLabel>{t('newtab.bookmarksMode')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => onModeChange(v as BookmarksMode)}>
          {BOOKMARKS_MODES.map((m) => (
            <DropdownMenuRadioItem key={m} value={m}>{t(`newtab.bookmarksMode_${m}`)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BookmarkSection({ title, actions, children }: { title: string; actions: ReactNode; children: ReactNode }) {
  return (
    <section className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-sm font-medium dark:[text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}
