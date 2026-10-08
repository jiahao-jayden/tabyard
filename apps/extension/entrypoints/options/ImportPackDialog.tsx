import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  applyImport, defaultMapping, planImport, type GroupMapping, type RulePack,
} from '@/utils/pack';
import { enabledCount, groupLimit, type Plan } from '@/utils/plan';
import type { Group } from '@tabyard/shared';
import { COLOR_DOT } from './colors';

interface Props {
  pack: RulePack | null;
  version?: number;
  groups: Group[];
  plan: Plan;
  onClose: () => void;
  onConfirm: (groups: Group[], importedCount: number) => void;
}

export function ImportPackDialog({ pack, version, groups, plan, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={pack !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {pack ? (
          <Body key={pack.meta.id} pack={pack} version={version} groups={groups} plan={plan} onConfirm={onConfirm} />
        ) : (
          <DialogTitle className="sr-only">{t('import.title')}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

const NEW = '__new__';
const SKIP = '__skip__';

function Body({ pack, version, groups, plan, onConfirm }: Omit<Props, 'pack' | 'onClose'> & { pack: RulePack }) {
  const { t } = useTranslation();
  const limit = groupLimit(plan);
  const initialSlots = limit - enabledCount(groups);

  const [step, setStep] = useState<1 | 2>(1);
  const [mapping, setMapping] = useState<GroupMapping[]>(() => defaultMapping(groups, pack, initialSlots));
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const newCount = mapping.filter((m) => m.type === 'new').length;
  const slotsLeft = initialSlots - newCount;
  const importPlan = useMemo(() => planImport(groups, pack, mapping), [groups, pack, mapping]);
  const fresh = importPlan.items.filter((i) => !i.conflictWith);
  const conflicts = importPlan.items.filter((i) => i.conflictWith);

  const setTarget = (index: number, value: string) =>
    setMapping((prev) => prev.map((m, i) => {
      if (i !== index) return m;
      if (value === NEW) return { type: 'new' };
      if (value === SKIP) return { type: 'skip' };
      return { type: 'existing', groupId: value };
    }));

  const goNext = () => {
    setPicked(new Set(planImport(groups, pack, mapping).items.filter((i) => !i.conflictWith).map((i) => i.id)));
    setStep(2);
  };

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const allFreshPicked = fresh.length > 0 && fresh.every((i) => picked.has(i.id));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('import.title')}</DialogTitle>
        <DialogDescription>
          {step === 1
            ? t('import.step1', { name: pack.meta.name, count: pack.groups.length })
              + (pack.meta.author && version
                ? ` ${t('importSource.by', { author: pack.meta.author, version })}`
                : '')
            : t('import.step2', { n: importPlan.items.length, d: importPlan.duplicates })}
        </DialogDescription>
      </DialogHeader>

      {step === 1 ? (
        <div className="space-y-2">
          {Number.isFinite(limit) && (
            <p className="text-xs text-muted-foreground">{t('import.slots', { n: Math.max(slotsLeft, 0) })}</p>
          )}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {pack.groups.map((pg, i) => {
              const m = mapping[i]!;
              const value = m.type === 'existing' ? m.groupId : m.type === 'new' ? NEW : SKIP;
              return (
                <div key={i} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <span className={`size-2.5 shrink-0 rounded-full ${COLOR_DOT[pg.color]}`} />
                  <span className="min-w-0 flex-1 truncate">{pg.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{pg.patterns.length}</span>
                  <Select value={value} onValueChange={(v) => setTarget(i, v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW} disabled={value !== NEW && slotsLeft <= 0}>
                        {t('import.mapNew')}
                      </SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name || '—'}</SelectItem>
                      ))}
                      <SelectItem value={SKIP}>{t('import.mapSkip')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto">
          {importPlan.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('import.nothing')}</p>
          )}
          {fresh.length > 0 && (
            <div className="rounded-md border">
              <label className="flex cursor-pointer items-center gap-3 border-b bg-muted/50 px-3 py-2 font-medium">
                <Checkbox
                  checked={allFreshPicked ? true : fresh.some((i) => picked.has(i.id)) ? 'indeterminate' : false}
                  onCheckedChange={(v) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      fresh.forEach((i) => (v === true ? next.add(i.id) : next.delete(i.id)));
                      return next;
                    })}
                />
                {t('import.normalTitle')}（{t('import.selectAll')}）
              </label>
              {fresh.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
                  <Checkbox checked={picked.has(item.id)} onCheckedChange={(v) => toggle(item.id, v === true)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.pattern}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{pack.groups[item.packGroupIndex]!.name}</span>
                </label>
              ))}
            </div>
          )}
          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-300">
              <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800">{t('import.conflictTitle')}</p>
              {conflicts.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-1.5 last:border-b-0">
                  <Checkbox checked={picked.has(item.id)} onCheckedChange={(v) => toggle(item.id, v === true)} />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.pattern}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t('import.alreadyIn', { name: item.conflictWith!.name })} → {pack.groups[item.packGroupIndex]!.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <DialogFooter>
        {step === 1 ? (
          <Button onClick={goNext}>{t('import.next')}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => setStep(1)}>{t('import.back')}</Button>
            <Button
              disabled={picked.size === 0}
              onClick={() => onConfirm(applyImport(groups, pack, mapping, importPlan, picked), picked.size)}
            >
              {t('import.confirm', { n: picked.size })}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
