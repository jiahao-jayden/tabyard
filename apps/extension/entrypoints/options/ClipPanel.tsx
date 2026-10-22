import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { requestModelPermission } from '@/utils/collect/llm';
import {
  loadClipSettings, normalizeClipSettings, saveClipSettings, testVaultConnection, validateClipSettings,
  type ClipSettings,
} from '@/utils/clip/obsidian';

type TextField = 'restUrl' | 'restToken' | 'saveBaseDir' | 'pathTemplate';
const FIELDS: { key: TextField; label: 'clip.restUrl' | 'clip.restToken' | 'clip.saveBaseDir' | 'clip.pathTemplate'; password?: boolean }[] = [
  { key: 'restUrl', label: 'clip.restUrl' },
  { key: 'restToken', label: 'clip.restToken', password: true },
  { key: 'saveBaseDir', label: 'clip.saveBaseDir' },
  { key: 'pathTemplate', label: 'clip.pathTemplate' },
];

/** 剪藏设置：可选的 Obsidian 导出。复制与下载 Markdown 不需要任何配置 */
export function ClipPanel() {
  const { t } = useTranslation();
  const [form, setForm] = useState<ClipSettings | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void loadClipSettings().then(setForm);
  }, []);

  if (!form) return null;

  const patch = (value: Partial<ClipSettings>) => setForm({ ...form, ...value });

  /** 返回规范化后的有效设置，无效时提示并返回 null */
  const checked = (): ClipSettings | null => {
    const settings = normalizeClipSettings(form);
    const error = validateClipSettings(settings);
    if (error) toast.error(t(error.key, error.vars));
    return error ? null : settings;
  };

  const test = async () => {
    const settings = checked();
    if (!settings) return;
    setTesting(true);
    try {
      // 权限申请依赖本次点击，必须先于其他异步操作
      if (!(await requestModelPermission(settings.restUrl))) {
        toast.error(t('clip.permissionDenied'));
        return;
      }
      await testVaultConnection(settings);
      toast.success(t('clip.testOk'));
    } catch (error) {
      toast.error(t('clip.testFailed', { msg: (error as Error).message }));
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    // 关闭导出时不校验，允许保留半填的配置
    const settings = form.exportEnabled ? checked() : normalizeClipSettings(form);
    if (!settings) return;
    if (settings.exportEnabled && !(await requestModelPermission(settings.restUrl))) {
      toast.error(t('clip.permissionDenied'));
      return;
    }
    await saveClipSettings(settings);
    setForm(settings);
    toast.success(t('clip.settingsSaved'));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('clip.title')}</CardTitle>
        <CardDescription>{t('clip.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="clip-export">{t('clip.exportEnabled')}</Label>
            <Switch id="clip-export" checked={form.exportEnabled} onCheckedChange={(v) => patch({ exportEnabled: v })} />
          </div>
          <p className="mt-1 max-w-[60ch] text-xs text-muted-foreground">{t('clip.exportDesc')}</p>
        </div>

        {form.exportEnabled && (
          <form className="max-w-md space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            {FIELDS.map(({ key, label, password }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`clip-${key}`}>{t(label)}</Label>
                <Input
                  id={`clip-${key}`}
                  type={password ? 'password' : 'text'}
                  autoComplete="off"
                  value={form[key]}
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
                {key === 'pathTemplate' && <p className="text-xs text-muted-foreground">{t('clip.pathHint')}</p>}
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => void test()} disabled={testing}>
                {testing && <LoaderCircle className="animate-spin" />}
                {t('clip.test')}
              </Button>
              <Button type="submit">{t('collect.save')}</Button>
            </div>
          </form>
        )}
        {!form.exportEnabled && <Button onClick={() => void save()}>{t('collect.save')}</Button>}
      </CardContent>
    </Card>
  );
}
