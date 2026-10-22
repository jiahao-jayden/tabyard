import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { browser } from 'wxt/browser';
import { Bookmark, Crown, Layers, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { API_URL } from '@/utils/api';
import { setLanguagePref } from '@/utils/i18n';
import { getPlan, refreshPlan, type Plan } from '@/utils/plan';
import { loadLanguagePref, type LanguagePref } from '@/utils/rules';
import { AccountButton } from './AccountButton';
import { ClipPanel } from './ClipPanel';
import { CollectionPanel } from './CollectionPanel';
import { TabGroupsPanel } from './TabGroupsPanel';

type PanelId = 'groups' | 'collect' | 'clip';
const PANELS: PanelId[] = ['groups', 'collect', 'clip'];

export default function App() {
  const { t, i18n } = useTranslation();
  const [plan, setPlan] = useState<Plan>('free');
  const [langPref, setLangPref] = useState<LanguagePref>('en');
  const [loaded, setLoaded] = useState(false);
  const [panel, setPanel] = useState<PanelId>(PANELS.find((id) => location.hash === `#${id}`) ?? 'groups');

  useEffect(() => {
    void Promise.all([getPlan(), loadLanguagePref()]).then(([p, lang]) => {
      setPlan(p);
      setLangPref(lang);
      setLoaded(true);
    });
    const sync = () => void refreshPlan().then(setPlan);
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  useEffect(() => {
    document.title = t('app.pageTitle');
  }, [t, i18n.language]);

  const changeLanguage = (pref: LanguagePref) => {
    setLangPref(pref);
    void setLanguagePref(pref);
  };

  if (!loaded) {
    return <div className="p-8 text-sm text-muted-foreground">{t('app.loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
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

      <Tabs value={panel} onValueChange={(v) => setPanel(v as PanelId)}>
        <TabsList>
          <TabsTrigger value="groups">
            <Layers />
            {t('tabs.groups')}
          </TabsTrigger>
          <TabsTrigger value="collect">
            <Bookmark />
            {t('tabs.collect')}
          </TabsTrigger>
          <TabsTrigger value="clip">
            <Scissors />
            {t('tabs.clip')}
          </TabsTrigger>
        </TabsList>
        {/* forceMount：切换时保留编辑状态，避免未落盘的自动保存被卸载取消 */}
        <TabsContent value="groups" forceMount>
          <TabGroupsPanel plan={plan} />
        </TabsContent>
        <TabsContent value="collect" forceMount>
          <CollectionPanel />
        </TabsContent>
        <TabsContent value="clip">
          <ClipPanel />
        </TabsContent>
      </Tabs>

      <Toaster position="top-center" richColors />
    </div>
  );
}
