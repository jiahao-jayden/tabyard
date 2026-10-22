import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Browser } from 'wxt/browser';
import { ChevronRight, Copy, Download, LoaderCircle, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isCollectable } from '@/utils/collect/capture';
import { downloadMarkdown } from '@/utils/clip/download';
import { extractTab } from '@/utils/clip/extract';
import { toMarkdown, type RawCapture } from '@/utils/clip/normalize';
import {
  loadClipSettings, saveToVault, validateClipSettings, type ClipSettings,
} from '@/utils/clip/obsidian';
import { platformDisplayName } from '@/utils/clip/platform';
import { loadTagHistory, saveUsedTags } from '@/utils/clip/tags';
import { TagInput } from './TagInput';

/** 当前页面剪藏：按需抽取为 Markdown，复制 / 下载 / 可选保存到 Obsidian */
export function ClipSection({ activeTab }: { activeTab: Browser.tabs.Tab | undefined }) {
  const { t } = useTranslation();
  const tabId = activeTab?.id;
  const url = activeTab?.url;
  const clippable = tabId !== undefined && isCollectable(url);

  const [settings, setSettings] = useState<ClipSettings | null>(null);
  const [capture, setCapture] = useState<RawCapture | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagHistory, setTagHistory] = useState<string[]>([]);

  useEffect(() => {
    void loadClipSettings().then(setSettings);
    void loadTagHistory().then(setTagHistory);
  }, []);

  const exportEnabled = settings?.exportEnabled === true;
  const configError = settings && exportEnabled ? validateClipSettings(settings) : null;

  // 打开 popup 即抽取；抽取成功且有正文前，按钮保持置灰
  useEffect(() => {
    if (!clippable) return;
    let alive = true;
    setLoading(true);
    extractTab({ id: tabId, title: activeTab?.title }, url)
      .then((result) => alive && setCapture(result))
      .catch((error: Error) => alive && toast.error(t('clip.extractFailed', { msg: error.message })))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, url]);

  const ready = !!capture?.raw_text.trim();

  const run = async (action: (data: RawCapture, md: string) => Promise<void> | void) => {
    setBusy(true);
    try {
      if (!capture) return;
      const data = capture;
      // 备注和标签只在开启导出时出现，也只在此时写入 frontmatter
      const md = toMarkdown({ ...data, user_note: exportEnabled ? note : '', tags: exportEnabled ? tags : [] });
      await action(data, md);
      if (exportEnabled) {
        await saveUsedTags(tags);
        setTagHistory(await loadTagHistory());
      }
    } catch {
      /* 抽取失败已提示；各操作自己的失败在 action 内提示 */
    } finally {
      setBusy(false);
    }
  };

  const copy = () => run(async (_, md) => {
    try {
      await navigator.clipboard.writeText(md);
      toast.success(t('clip.copied'));
    } catch (error) {
      toast.error(t('clip.copyFailed', { msg: (error as Error).message }));
      throw error;
    }
  });

  const download = () => run((data, md) => {
    toast.success(t('clip.downloaded', { name: downloadMarkdown(md, data.title) }));
  });

  const saveToObsidian = () => run(async (data, md) => {
    try {
      toast.success(t('clip.saved', { path: await saveToVault(data, md, settings!) }));
    } catch (error) {
      toast.error(t('clip.saveFailed', { msg: (error as Error).message }));
      throw error;
    }
  });

  if (!clippable) {
    return <p className="text-xs text-muted-foreground">{t('clip.unsupported')}</p>;
  }

  const disabled = busy || !ready;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" className="h-9 flex-1 rounded-full" onClick={() => void copy()} disabled={disabled}>
          {busy || loading ? <LoaderCircle className="animate-spin" /> : <Copy />}
          {t('clip.copy')}
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          onClick={() => void download()}
          disabled={disabled}
          title={t('clip.download')}
          aria-label={t('clip.download')}
          className="rounded-full"
        >
          <Download />
        </Button>
        {exportEnabled && (
          <Button
            variant="outline"
            size="icon-lg"
            onClick={() => void saveToObsidian()}
            disabled={disabled || !!configError}
            title={configError ? t('clip.needSetup') : t('clip.saveTo')}
            aria-label={t('clip.saveTo')}
            className="rounded-full"
          >
            <Scissors />
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
        {t('clip.preview')}
      </button>

      {open && (
        <div className="space-y-2">
          {exportEnabled && (
            <>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('clip.notePlaceholder')}
                aria-label={t('clip.note')}
                className="h-8 rounded-lg text-xs"
              />
              <TagInput tags={tags} history={tagHistory} onChange={setTags} />
            </>
          )}
          <div className="max-h-44 overflow-auto rounded-lg border bg-muted/45 px-2.5 py-2 text-xs leading-5">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <LoaderCircle className="size-3.5 animate-spin" />
                {t('clip.extracting')}
              </div>
            ) : capture ? (
              <>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  {platformDisplayName(capture.source_platform)}
                  {capture.author && ` · ${capture.author}`}
                  {` · ${t('clip.chars', { n: capture.raw_text.length.toLocaleString() })}`}
                </div>
                <pre className="font-mono whitespace-pre-wrap break-words text-foreground/90">
                  {capture.raw_text.trim().slice(0, 20000) || t('clip.empty')}
                </pre>
              </>
            ) : (
              <span className="text-muted-foreground">{t('clip.empty')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
