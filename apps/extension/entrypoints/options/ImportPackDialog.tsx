import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { applyImport, defaultMapping, planImport, type RulePack } from '@/utils/pack';
import type { Group } from '@tabyard/shared';
import { COLOR_DOT } from './colors';

interface Props {
  pack: RulePack | null;
  version?: number;
  groups: Group[];
  onClose: () => void;
  onConfirm: (groups: Group[], importedCount: number) => void;
}

export function ImportPackDialog({ pack, version, groups, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={pack !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {pack ? (
          <Body key={pack.meta.id} pack={pack} version={version} groups={groups} onConfirm={onConfirm} />
        ) : (
          <DialogTitle className="sr-only">{t('import.title')}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ pack, version, groups, onConfirm }: Omit<Props, 'pack' | 'onClose'> & { pack: RulePack }) {
  const { t } = useTranslation();
  const mapping = useMemo(() => defaultMapping(groups, pack), [groups, pack]);
  const importPlan = useMemo(() => planImport(groups, pack, mapping), [groups, pack, mapping]);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(importPlan.items.filter((i) => !i.conflictWith).map((i) => i.id)),
  );

  const setMany = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const note = (index: number) => {
    const m = mapping[index]!;
    if (m.type === 'existing') return t('import.toExisting', { name: groups.find((g) => g.id === m.groupId)?.name });
    return null;
  };

  const allIds = importPlan.items.map((i) => i.id);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('import.title')}</DialogTitle>
        <DialogDescription>
          {t('import.summary', { name: pack.meta.name, count: pack.groups.length })}
          {pack.meta.author && version ? ` ${t('importSource.by', { author: pack.meta.author, version })}` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {importPlan.duplicates > 0 ? t('import.duplicates', { n: importPlan.duplicates }) : ''}
        </span>
        <Button variant="ghost" size="xs" onClick={() => setMany(allIds, picked.size < allIds.length)}>
          {picked.size < allIds.length ? t('import.selectAll') : t('import.selectNone')}
        </Button>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {pack.groups.map((pg, gi) => {
          const items = importPlan.items.filter((i) => i.packGroupIndex === gi);
          const ids = items.map((i) => i.id);
          const count = ids.filter((id) => picked.has(id)).length;
          return (
            <div key={gi} className="rounded-md border">
              <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/50 px-3 py-2">
                <Checkbox
                  disabled={items.length === 0}
                  checked={count === 0 ? false : count === ids.length ? true : 'indeterminate'}
                  onCheckedChange={(v) => setMany(ids, v === true)}
                />
                <span className={`size-2.5 shrink-0 rounded-full ${COLOR_DOT[pg.color]}`} />
                <span className="min-w-0 flex-1 truncate font-medium">{pg.name}</span>
                {note(gi) && (
                  <span className={"shrink-0 text-xs text-muted-foreground"}>
                    {note(gi)}
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {count} / {pg.patterns.length}
                </span>
              </label>
              {items.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
                  <Checkbox checked={picked.has(item.id)} onCheckedChange={(v) => setMany([item.id], v === true)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.pattern}</span>
                  {item.conflictWith && (
                    <span className="shrink-0 text-xs text-amber-700">
                      {t('import.alreadyIn', { name: item.conflictWith.name })}
                    </span>
                  )}
                </label>
              ))}
            </div>
          );
        })}

        {importPlan.items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('import.nothing')}</p>
        )}
      </div>

      <DialogFooter>
        <Button
          disabled={picked.size === 0}
          onClick={() => onConfirm(applyImport(groups, pack, mapping, importPlan, picked), picked.size)}
        >
          {t('import.confirm', { n: picked.size })}
        </Button>
      </DialogFooter>
    </>
  );
}
