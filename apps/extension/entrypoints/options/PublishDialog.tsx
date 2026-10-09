import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  loadPublished, publishPack, savePublished, type PublishedRecord, type PublishResult,
} from '@/utils/api';
import { toPack } from '@/utils/pack';
import type { Group } from '@tabyard/shared';
import { COLOR_DOT } from './colors';
import { errorMessage } from './errors';

interface Props {
  open: boolean;
  groups: Group[];
  onClose: () => void;
}

const NEW = '__new__';
const key = (gi: number, pi: number) => `${gi}:${pi}`;

export function PublishDialog({ open, groups, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {open ? (
          <Body groups={groups} onClose={onClose} />
        ) : (
          <DialogTitle className="sr-only">{t('publish.title')}</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ groups, onClose }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(groups.flatMap((g, gi) => g.patterns.map((_, pi) => key(gi, pi)))),
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [name, setName] = useState(t('rules.exportName'));
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [records, setRecords] = useState<PublishedRecord[]>([]);
  const [target, setTarget] = useState(NEW);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(PublishResult & { name: string }) | null>(null);

  useEffect(() => {
    void loadPublished().then(setRecords);
  }, []);

  /** 选择覆盖已发布的包时，带出它上次发布的名称、作者和描述，避免被默认值悄悄覆盖 */
  const selectTarget = (code: string) => {
    setTarget(code);
    const record = records.find((r) => r.code === code);
    if (!record) return;
    setName(record.name);
    setAuthor(record.author ?? '');
    setDescription(record.description ?? '');
  };

  const picks = useMemo(
    () => groups.map((g, gi) => g.patterns.filter((_, pi) => picked.has(key(gi, pi)))),
    [groups, picked],
  );
  const total = picks.reduce((n, p) => n + p.length, 0);

  const setMany = (keys: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
      return next;
    });

  const submit = async () => {
    setBusy(true);
    try {
      const chosen = groups
        .map((g, gi) => ({ ...g, patterns: picks[gi]! }))
        .filter((g) => g.patterns.length > 0);
      const pack = toPack(chosen, name.trim());
      if (author.trim()) pack.meta.author = author.trim();
      if (description.trim()) pack.meta.description = description.trim();

      const record = records.find((r) => r.code === target);
      const res = await publishPack(pack, record && { code: record.code, editToken: record.editToken });
      await savePublished({
        code: res.code,
        editToken: res.editToken ?? record!.editToken,
        name: pack.meta.name,
        author: author.trim(),
        description: description.trim(),
        version: res.version,
      });
      setResult({ ...res, name: pack.meta.name });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(result!.code);
    toast.success(t('publish.copied'));
  };

  if (result) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('publish.doneTitle')}</DialogTitle>
          <DialogDescription>
            {t('publish.doneDesc', { name: result.name, version: result.version })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border py-6 text-center font-mono text-3xl font-semibold tracking-widest">
          {result.code}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>
            {t('publish.copy')}
          </Button>
          <Button onClick={onClose}>{t('publish.done')}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('publish.title')}</DialogTitle>
        <DialogDescription>{t('publish.desc')}</DialogDescription>
      </DialogHeader>

      <div className="max-h-64 overflow-y-auto rounded-md border">
        {groups.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('publish.empty')}</p>
        )}
        {groups.map((g, gi) => {
          const keys = g.patterns.map((_, pi) => key(gi, pi));
          const count = picks[gi]!.length;
          const open = expanded.has(gi);
          return (
            <div key={g.id} className="border-b last:border-b-0">
              <div className="flex items-center gap-3 bg-muted/50 px-3 py-2">
                <Checkbox
                  checked={count === keys.length && count > 0 ? true : count > 0 ? 'indeterminate' : false}
                  onCheckedChange={(v) => setMany(keys, v === true)}
                />
                <span className={`size-2.5 shrink-0 rounded-full ${COLOR_DOT[g.color]}`} />
                <span className="min-w-0 flex-1 truncate font-medium">{g.name || '—'}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{count}/{keys.length}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (open) next.delete(gi);
                      else next.add(gi);
                      return next;
                    })}
                >
                  {open ? t('editor.collapse') : t('editor.expand')}
                </Button>
              </div>
              {open && g.patterns.map((p, pi) => (
                <label key={pi} className="flex cursor-pointer items-center gap-3 border-t px-3 py-1.5 pl-9">
                  <Checkbox
                    checked={picked.has(key(gi, pi))}
                    onCheckedChange={(v) => setMany([key(gi, pi)], v === true)}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{p}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('publish.selected', { n: total })}</p>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pub-name">{t('publish.name')}</Label>
          <Input id="pub-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pub-author">{t('publish.author')}</Label>
            <Input id="pub-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pub-desc">{t('publish.description')}</Label>
            <Input id="pub-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
        </div>
        {records.length > 0 && (
          <div className="space-y-1">
            <Label>{t('publish.target')}</Label>
            <Select value={target} onValueChange={selectTarget}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW}>{t('publish.new')}</SelectItem>
                {records.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {t('publish.overwrite', { name: r.name, code: r.code, version: r.version })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button disabled={busy || total === 0 || !name.trim()} onClick={() => void submit()}>
          {busy ? t('publish.submitting') : t('publish.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}
