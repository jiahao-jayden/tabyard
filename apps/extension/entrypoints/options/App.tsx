import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast, Toaster } from 'sonner';
import { browser } from 'wxt/browser';
import { ChevronDown, Crown, Download, Library, Share2, Upload } from 'lucide-react';
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
import { API_URL, fetchOfficialPacks, fetchPack, packsUrl, type OfficialPack } from '@/utils/api';
import { AccountButton } from './AccountButton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { enabledCount, FREE_GROUP_LIMIT, getPlan, refreshPlan, type Plan } from '@/utils/plan';
import {
  CONFIG_STORAGE_AREA,
  DEFAULT_OTHER_NAME,
  DEFAULT_SETTINGS,
  loadConfig,
  loadLanguagePref,
  resolveLanguage,
  saveConfig,
  type FallbackMode,
  type GroupSettings,
  type InsertPosition,
  type LanguagePref,
} from '@/utils/rules';
import { GroupEditor } from './GroupEditor';
import { ImportPackDialog } from './ImportPackDialog';
import { ImportSourceDialog } from './ImportSourceDialog';
import { PublishDialog } from './PublishDialog';
import { RulesTable } from './RulesTable';
import { SyncCard } from './SyncCard';

function cleanGroups(list: Group[]): Group[] {
  return list
    .map((g) => ({ ...g, name: g.name.trim(), patterns: g.patterns.map((p) => p.trim()).filter(Boolean) }))
    .filter((g) => g.name);
}

type RulesView = 'groups' | 'table' | 'json';
const VIEWS: RulesView[] = ['groups', 'table', 'json'];

export default function App() {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState<GroupSettings>(DEFAULT_SETTINGS);
  const [groups, setGroups] = useState<Group[]>([]);
  const [plan, setPlan] = useState<Plan>('free');
  const [langPref, setLangPref] = useState<LanguagePref>('en');
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<RulesView>('groups');
  const [jsonText, setJsonText] = useState('');
  const [importing, setImporting] = useState<{ pack: RulePack; base: Group[]; version?: number } | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [officialPacks, setOfficialPacks] = useState<OfficialPack[] | null>(null);
  const [publishing, setPublishing] = useState<Group[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 最近一次已落盘（或刚加载）的内容，用来跳过无变化的保存 */
  const lastSaved = useRef('');

  useEffect(() => {
    void (async () => {
      const [cfg, p, lang] = await Promise.all([loadConfig(), getPlan(), loadLanguagePref()]);
      lastSaved.current = JSON.stringify({ settings: cfg.settings, groups: cleanGroups(cfg.groups) });
      setSettings(cfg.settings);
      setGroups(cfg.groups);
      setPlan(p);
      setLangPref(lang);
      setLoaded(true);
    })();
    const sync = () => void refreshPlan().then(setPlan);
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  useEffect(() => {
    document.title = t('app.pageTitle');
  }, [t, i18n.language]);

  const serialize = useCallback(
    (list: Group[]) => JSON.stringify(toPack(list, t('rules.exportName')), null, 2),
    [t],
  );

  /** 其他上下文（popup、后台同步）改了配置时，以存储为准刷新界面；自己刚写入的内容不处理 */
  useEffect(() => {
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area !== CONFIG_STORAGE_AREA || (!changes.settings && !changes.groups)) return;
      void loadConfig().then((cfg) => {
        const key = JSON.stringify({ settings: cfg.settings, groups: cleanGroups(cfg.groups) });
        if (key === lastSaved.current) return;
        lastSaved.current = key;
        setSettings(cfg.settings);
        setGroups(cfg.groups);
        if (view === 'json') setJsonText(serialize(cfg.groups));
      });
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, [view, serialize]);

  /** JSON 视图下以文本为准；解析失败或超出套餐限制时返回 null 并显示错误 */
  const resolveGroups = useCallback((): Group[] | null => {
    let current = groups;
    if (view === 'json') {
      try {
        current = packToGroups(parsePack(jsonText));
      } catch (error) {
        toast.error(t('rules.invalidPack', { msg: (error as Error).message }), { id: 'rules-error' });
        return null;
      }
    }
    if (plan === 'free' && enabledCount(current) > FREE_GROUP_LIMIT) {
      toast.error(t('rules.overLimit', { limit: FREE_GROUP_LIMIT }), { id: 'rules-error' });
      return null;
    }
    return current;
  }, [groups, view, jsonText, plan, t]);

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

  /** 自动保存：落盘的是清理后的副本，编辑中的界面状态不动；后台监听存储变化后自动重新分组 */
  const save = useCallback(async () => {
    const current = resolveGroups();
    if (!current) return;
    const key = JSON.stringify({ settings, groups: cleanGroups(current) });
    if (key === lastSaved.current) return;
    try {
      await saveConfig({ settings, groups: cleanGroups(current) });
    } catch (error) {
      toast.error(t('rules.saveFailed', { msg: (error as Error).message }), { id: 'rules-saved' });
      return;
    }
    lastSaved.current = key;
    toast.success(t('rules.saved'), { id: 'rules-saved' });
  }, [settings, resolveGroups, t]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => void save(), 600);
    return () => clearTimeout(timer);
  }, [loaded, save, groups, jsonText]);

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

  const loadOfficial = useCallback((open: boolean) => {
    if (open) void fetchOfficialPacks().then(setOfficialPacks, () => setOfficialPacks([]));
  }, []);

  const importOfficial = useCallback(async (code: string) => {
    try {
      const remote = await fetchPack(code);
      startImport(remote.pack, remote.version);
    } catch (error) {
      toast.error(t('rules.importFailed', { msg: (error as Error).message }));
    }
  }, [startImport, t]);

  const importFile = useCallback(async (file: File) => {
    try {
      startImport(parsePack(await file.text()));
    } catch (error) {
      toast.error(t('rules.importFailed', { msg: (error as Error).message }));
    }
  }, [startImport, t]);

  const openPublish = useCallback(() => {
    const current = resolveGroups();
    if (current) setPublishing(current);
  }, [resolveGroups]);

  const confirmImport = useCallback((next: Group[], count: number) => {
    commitGroups(next);
    setImporting(null);
    toast.success(t('rules.imported', { n: count }));
  }, [commitGroups, t]);

  const changeLanguage = useCallback((pref: LanguagePref) => {
    setLangPref(pref);
    void setLanguagePref(pref);
    const next = DEFAULT_OTHER_NAME[resolveLanguage(pref)];
    setSettings((s) =>
      Object.values(DEFAULT_OTHER_NAME).includes(s.otherGroupName.trim()) ? { ...s, otherGroupName: next } : s,
    );
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
        <div className="flex shrink-0 items-center gap-2">
          {plan === 'free' && (
            <Button onClick={() => void browser.tabs.create({ url: `${API_URL}/api/checkout` })}>
              <Crown />
              {t('account.upgrade')}
            </Button>
          )}
          <AccountButton pro={plan === 'pro'} />
          <Select value={langPref} onValueChange={(v) => changeLanguage(v as LanguagePref)}>
          <SelectTrigger className="w-36 rounded-full bg-card backdrop-blur" aria-label={t('app.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t('app.langAuto')}</SelectItem>
            <SelectItem value="zh-CN">中文</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
          </Select>
        </div>
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
          <div className="flex items-center justify-between">
            <Label>{t('master.insertPosition')}</Label>
            <Select
              value={settings.insertPosition}
              onValueChange={(v) => setSettings((s) => ({ ...s, insertPosition: v as InsertPosition }))}
            >
              <SelectTrigger className="w-36" aria-label={t('master.insertPosition')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="end">{t('master.insertEnd')}</SelectItem>
                <SelectItem value="start">{t('master.insertStart')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <SyncCard plan={plan} />

      <Card>
        <CardHeader>
          <CardTitle>{t('fallback.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.fallback}
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
              <RadioGroupItem value="domain" id="fb-domain" />
              <Label htmlFor="fb-domain" className="font-normal">
                {t('fallback.domain')}
              </Label>
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
            <DropdownMenu onOpenChange={loadOfficial}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Library />
                  {t('rules.packs')}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {officialPacks && officialPacks.length > 0 && (
                  <>
                    <DropdownMenuLabel>{t('rules.official')}</DropdownMenuLabel>
                    {officialPacks.map((p) => (
                      <DropdownMenuItem key={p.code} onSelect={() => void importOfficial(p.code)}>
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.patternCount}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => void browser.tabs.create({ url: packsUrl(i18n.language) })}>
                  <Library />
                  {t('rules.browse')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openImport}>
                  <Upload />
                  {t('rules.import')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportJson}>
                  <Download />
                  {t('rules.export')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openPublish}>
                  <Share2 />
                  {t('rules.publish')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                onChange={(event) => setJsonText(event.target.value)}
                spellCheck={false}
                className="min-h-96 w-full rounded-xl border border-input bg-white/80 px-3 py-2 font-mono text-xs leading-relaxed shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t('rules.jsonLabel')}
              />
            </div>
          )}

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
      <Toaster position="top-center" richColors />
    </div>
  );
}
