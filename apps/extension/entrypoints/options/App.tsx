import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { Check, Crown, Download, Share2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { setLanguagePref } from '@/utils/i18n';
import { packToGroups, parsePack, toPack, type RulePack } from '@/utils/pack';
import type { Group } from '@tabyard/shared';
import { enabledCount, FREE_GROUP_LIMIT, getPlan, type Plan } from '@/utils/plan';
import {
  DEFAULT_SETTINGS,
  loadConfig,
  loadLanguagePref,
  saveConfig,
  type FallbackMode,
  type GroupSettings,
  type LanguagePref,
} from '@/utils/rules';
import { GroupEditor } from './GroupEditor';
import { ImportPackDialog } from './ImportPackDialog';
import { ImportSourceDialog } from './ImportSourceDialog';
import { PublishDialog } from './PublishDialog';
import { RulesTable } from './RulesTable';

type RulesView = 'groups' | 'table' | 'json';
const VIEWS: RulesView[] = ['groups', 'table', 'json'];

export default function App() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<GroupSettings>(DEFAULT_SETTINGS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [plan, setPlan] = useState<Plan>('free');
  const [langPref, setLangPref] = useState<LanguagePref>('auto');
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [view, setView] = useState<RulesView>('groups');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [importing, setImporting] = useState<{ pack: RulePack; base: Group[]; version?: number } | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [publishing, setPublishing] = useState<Group[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const [cfg, p, lang] = await Promise.all([loadConfig(), getPlan(), loadLanguagePref()]);
      setSettings(cfg.settings);
      setGroups(cfg.groups);
      setPlan(p);
      setLangPref(lang);
      setLoaded(true);
    })();
  }, []);

  const flash = useCallback((message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(''), 3000);
  }, []);

  const serialize = useCallback(
    (list: Group[]) => JSON.stringify(toPack(list, t('rules.exportName')), null, 2),
    [t],
  );

  /** JSON 视图下以文本为准；解析失败或超出套餐限制时返回 null 并显示错误 */
  const resolveGroups = useCallback((): Group[] | null => {
    let current = groups;
    if (view === 'json') {
      try {
        current = packToGroups(parsePack(jsonText));
      } catch (error) {
        setJsonError(t('rules.invalidPack', { msg: (error as Error).message }));
        return null;
      }
    }
    if (plan === 'free' && enabledCount(current) > FREE_GROUP_LIMIT) {
      const msg = t('rules.overLimit', { limit: FREE_GROUP_LIMIT });
      if (view === 'json') setJsonError(msg);
      else flash(msg);
      return null;
    }
    setJsonError('');
    return current;
  }, [groups, view, jsonText, plan, t, flash]);

  const commitGroups = useCallback((next: Group[]) => {
    setGroups(next);
    if (view === 'json') setJsonText(serialize(next));
  }, [view, serialize]);

  const changeView = useCallback((next: RulesView) => {
    if (next === view) return;
    const current = resolveGroups();
    if (!current) return;
    setGroups(current);
    if (next === 'json') setJsonText(serialize(current));
    setView(next);
  }, [view, resolveGroups, serialize]);

  const save = useCallback(async () => {
    const current = resolveGroups();
    if (!current) return;
    const clean = current
      .map((g) => ({ ...g, name: g.name.trim(), patterns: g.patterns.map((p) => p.trim()).filter(Boolean) }))
      .filter((g) => g.name);
    try {
      await saveConfig({ settings, groups: clean });
    } catch (error) {
      flash(t('rules.saveFailed', { msg: (error as Error).message }));
      return;
    }
    commitGroups(clean);
    setStatus(t('rules.applying'));
    try {
      await browser.runtime.sendMessage({ type: 'regroup' });
      flash(t('rules.saved'));
    } catch {
      flash(t('rules.savedLater'));
    }
  }, [settings, resolveGroups, commitGroups, flash, t]);

  const exportJson = useCallback(() => {
    const current = resolveGroups();
    if (!current) return;
    const blob = new Blob([serialize(current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tabyard-rules.json';
    link.click();
    URL.revokeObjectURL(url);
  }, [resolveGroups, serialize]);

  const openImport = useCallback(() => {
    if (resolveGroups()) setSourceOpen(true);
  }, [resolveGroups]);

  const startImport = useCallback((pack: RulePack, version?: number) => {
    const base = resolveGroups();
    if (!base) return;
    setSourceOpen(false);
    setImporting({ pack, base, version });
  }, [resolveGroups]);

  const importFile = useCallback(async (file: File) => {
    try {
      startImport(parsePack(await file.text()));
    } catch (error) {
      flash(t('rules.importFailed', { msg: (error as Error).message }));
    }
  }, [startImport, flash, t]);

  const openPublish = useCallback(() => {
    const current = resolveGroups();
    if (current) setPublishing(current);
  }, [resolveGroups]);

  const confirmImport = useCallback((next: Group[], count: number) => {
    commitGroups(next);
    setImporting(null);
    flash(t('rules.imported', { n: count }));
  }, [commitGroups, flash, t]);

  const changeLanguage = useCallback((pref: LanguagePref) => {
    setLangPref(pref);
    void setLanguagePref(pref);
  }, []);

  if (!loaded) {
    return <div className="p-8 text-sm text-muted-foreground">{t('app.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-medium tracking-tight">
            <img src="/logo.svg" alt="" className="size-9" />{t('app.title')}</h1>
          <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{t('app.subtitle')}</p>
        </div>
        <Select value={langPref} onValueChange={(v) => changeLanguage(v as LanguagePref)}>
          <SelectTrigger className="w-36 shrink-0 rounded-full bg-card backdrop-blur" aria-label={t('app.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t('app.langAuto')}</SelectItem>
            <SelectItem value="zh-CN">中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('master.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">{t('master.enabled')}</Label>
            <Switch
              id="enabled"
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="autoCollapse">{t('master.autoCollapse')}</Label>
            <Switch
              id="autoCollapse"
              checked={settings.autoCollapse}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, autoCollapse: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('fallback.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={plan === 'free' && settings.fallback === 'domain' ? 'none' : settings.fallback}
            onValueChange={(v) => setSettings((s) => ({ ...s, fallback: v as FallbackMode }))}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="other" id="fb-other" />
              <Label htmlFor="fb-other" className="flex items-center gap-2 font-normal">
                {t('fallback.joinPrefix')}
                <Input
                  className="h-8 w-28"
                  value={settings.otherGroupName}
                  onChange={(e) => setSettings((s) => ({ ...s, otherGroupName: e.target.value }))}
                />
                {t('fallback.joinSuffix')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="domain" id="fb-domain" disabled={plan === 'free'} />
              <Label htmlFor="fb-domain" className="font-normal">
                {t('fallback.domain')}
              </Label>
              {plan === 'free' && (
                <span
                  title={t('fallback.proHint')}
                  className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-[#2a5f91] to-[#4f8fcf] px-2.5 py-0.5 text-xs font-semibold text-white shadow-[0_2px_10px_rgb(42_95_145/0.35)] ring-1 ring-white/40"
                >
                  <Crown className="size-3.5" />
                  Pro
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="none" id="fb-none" />
              <Label htmlFor="fb-none" className="font-normal">
                {t('fallback.none')}
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('rules.title')}</CardTitle>
          <CardDescription>{t('rules.desc')}</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openImport}>
              <Upload />
              {t('rules.import')}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importFile(file);
              }}
            />
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download />
              {t('rules.export')}
            </Button>
            <Button variant="outline" size="sm" onClick={openPublish}>
              <Share2 />
              {t('rules.publish')}
            </Button>
            <div className="flex rounded-full border bg-white/60 p-0.5">
              {VIEWS.map((v) => (
                <Button
                  key={v}
                  variant={view === v ? 'secondary' : 'ghost'}
                  size="xs"
                  onClick={() => changeView(v)}
                >
                  {t(`rules.view${v === 'groups' ? 'Groups' : v === 'table' ? 'Table' : 'Json'}`)}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {view === 'groups' && <GroupEditor groups={groups} plan={plan} onChange={commitGroups} />}
          {view === 'table' && <RulesTable groups={groups} onChange={commitGroups} />}
          {view === 'json' && (
            <div className="space-y-2">
              <textarea
                value={jsonText}
                onChange={(event) => { setJsonText(event.target.value); setJsonError(''); }}
                spellCheck={false}
                className="min-h-96 w-full rounded-xl border border-input bg-white/80 px-3 py-2 font-mono text-xs leading-relaxed shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t('rules.jsonLabel')}
              />
              {jsonError && <p className="text-sm text-destructive">{jsonError}</p>}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={() => void save()}>
              <Check />
              {t('rules.save')}
            </Button>
            {status && <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </CardContent>
      </Card>

      <ImportSourceDialog
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onLoaded={(remote) => startImport(remote.pack, remote.version)}
        onPickFile={() => fileInputRef.current?.click()}
      />

      <PublishDialog
        open={publishing !== null}
        groups={publishing ?? []}
        onClose={() => setPublishing(null)}
      />

      <ImportPackDialog
        pack={importing?.pack ?? null}
        version={importing?.version}
        groups={importing?.base ?? groups}
        plan={plan}
        onClose={() => setImporting(null)}
        onConfirm={confirmImport}
      />

      <p className="text-center text-xs text-muted-foreground">{t('app.footer')}</p>
    </div>
  );
}
