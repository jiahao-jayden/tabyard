import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { createModel, type ModelConfig } from '@/utils/collect/llm';
import { proposeOrganization } from '@/utils/collect/organize';
import {
  applyOrganization, undoOrganization, type CollectData, type OrganizeGroup,
} from '@/utils/collect/store';

type Stage =
  | { name: 'idle' }
  | { name: 'running'; done: number; total: number }
  | { name: 'preview'; groups: OrganizeGroup[] }
  | { name: 'error'; message: string };

/** 方案预览：每个分组可单独取消勾选，只应用勾选的 */
function Preview({
  groups, titleOf, onApply, onClose,
}: {
  groups: OrganizeGroup[];
  titleOf: Map<string, string>;
  onApply: (groups: OrganizeGroup[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const picked = groups.filter((g) => !skipped.has(g.name));
  const count = picked.reduce((n, g) => n + g.ids.length, 0);
  const existing = groups.filter((g) => g.folderId);
  const fresh = groups.filter((g) => !g.folderId);

  const toggle = (name: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const section = (title: string, list: OrganizeGroup[]) =>
    list.length > 0 && (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        {list.map((g) => (
          <label key={g.name} className="flex cursor-pointer items-start gap-3 rounded-xl border bg-white/60 p-3">
            <Checkbox checked={!skipped.has(g.name)} onCheckedChange={() => toggle(g.name)} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="flex-1 truncate">{g.name}</span>
                <span className="text-xs font-normal text-muted-foreground">{g.ids.length}</span>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                {g.ids.slice(0, 3).map((id) => (
                  <li key={id} className="truncate">{titleOf.get(id)}</li>
                ))}
                {g.ids.length > 3 && <li>…</li>}
              </ul>
            </div>
          </label>
        ))}
      </div>
    );

  return (
    <>
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('ai.nothing')}</p>
      ) : (
        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {section(t('ai.sectionExisting'), existing)}
          {section(t('ai.sectionNew'), fresh)}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('collect.cancel')}</Button>
        {groups.length > 0 && (
          <Button onClick={() => onApply(picked)} disabled={count === 0}>
            {t('ai.apply', { n: count })}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function OrganizeBody({
  data, config, onClose,
}: {
  data: CollectData;
  config: ModelConfig;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [stage, setStage] = useState<Stage>({ name: 'idle' });
  const abort = useRef<AbortController | null>(null);

  /** 对话框被关闭时中止进行中的请求 */
  useEffect(() => () => abort.current?.abort(), []);

  const targets = data.bookmarks.filter((b) => b.folderId === null);
  const titleOf = new Map(data.bookmarks.map((b) => [b.id, b.title]));

  const start = async () => {
    const controller = new AbortController();
    abort.current = controller;
    setStage({ name: 'running', done: 0, total: targets.length });
    try {
      const groups = await proposeOrganization({
        model: createModel(config),
        bookmarks: targets,
        folders: data.folders,
        language: i18n.language === 'zh-CN' ? 'Simplified Chinese' : 'English',
        signal: controller.signal,
        onProgress: (done, total) => setStage({ name: 'running', done, total }),
      });
      setStage({ name: 'preview', groups });
    } catch (error) {
      if (controller.signal.aborted) return;
      setStage({ name: 'error', message: (error as Error).message });
    }
  };

  const cancelRun = () => {
    abort.current?.abort();
    setStage({ name: 'idle' });
  };

  const apply = async (groups: OrganizeGroup[]) => {
    const undo = await applyOrganization(groups);
    const moved = groups.reduce((n, g) => n + g.ids.length, 0);
    toast.success(t('ai.applied', { n: moved }), {
      action: { label: t('ai.undo'), onClick: () => void undoOrganization(undo) },
      duration: 10000,
    });
    onClose();
  };

  if (stage.name === 'running') {
    return (
      <>
        <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          {t('ai.running', { done: stage.done, total: stage.total })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cancelRun}>{t('collect.cancel')}</Button>
        </DialogFooter>
      </>
    );
  }

  if (stage.name === 'preview') {
    return <Preview groups={stage.groups} titleOf={titleOf} onApply={(g) => void apply(g)} onClose={onClose} />;
  }

  return (
    <>
      <p className="text-sm">{t('ai.target', { n: targets.length })}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('ai.privacy', { model: config.model })}</p>
      {stage.name === 'error' && <p className="text-sm text-destructive">{stage.message}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t('collect.cancel')}</Button>
        <Button onClick={() => void start()} disabled={targets.length === 0}>
          <Sparkles />
          {stage.name === 'error' ? t('ai.retry') : t('ai.start')}
        </Button>
      </DialogFooter>
    </>
  );
}

export function OrganizeDialog({
  config, data, onClose,
}: {
  /** 为空表示对话框关闭 */
  config: ModelConfig | null;
  data: CollectData;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={config !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('ai.title')}</DialogTitle>
          <DialogDescription>{t('ai.desc')}</DialogDescription>
        </DialogHeader>
        {config && <OrganizeBody data={data} config={config} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
