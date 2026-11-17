import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus } from 'lucide-react';
import { MAX_SHORTCUTS, NEW_SHORTCUT, type Shortcut } from '@/utils/shortcuts';
import { ShortcutDialog, type ShortcutDraft } from './ShortcutDialog';
import { ShortcutIcon } from './ShortcutIcon';
import { linkProps } from './address';

export function Shortcuts({ list, openInNewTab }: { list: Shortcut[]; openInNewTab: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ShortcutDraft | null>(null);

  return (
    <>
      <ul className="flex w-full max-w-3xl flex-wrap justify-center gap-4">
        {list.map((shortcut) => (
          <li key={shortcut.id} className="group relative">
            <a
              href={shortcut.url}
              title={shortcut.title}
              {...linkProps(openInNewTab)}
              className="block transition-transform hover:scale-105"
            >
              <ShortcutIcon className="size-14" {...shortcut} />
            </a>
            <button
              type="button"
              aria-label={t('newtab.editShortcut')}
              className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => setDraft(shortcut)}
            >
              <Pencil className="size-2.5" />
            </button>
          </li>
        ))}
        {list.length < MAX_SHORTCUTS && (
          <li>
            <button
              type="button"
              title={t('newtab.addShortcut')}
              aria-label={t('newtab.addShortcut')}
              className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-xs backdrop-blur transition-transform hover:scale-105"
              onClick={() => setDraft(NEW_SHORTCUT)}
            >
              <Plus className="size-5" />
            </button>
          </li>
        )}
      </ul>
      <ShortcutDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}
