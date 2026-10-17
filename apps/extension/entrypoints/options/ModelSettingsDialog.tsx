import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  fetchModels, loadModelConfig, parseBaseURL, requestModelPermission, saveModelConfig,
} from '@/utils/collect/llm';

function ModelForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  /** 从服务拉取到的模型列表；为空时手动输入 */
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadModelConfig().then((config) => {
      if (!config) return;
      setBaseURL(config.baseURL);
      setApiKey(config.apiKey);
      setModel(config.model);
    });
  }, []);

  const fetchList = async () => {
    const url = parseBaseURL(baseURL);
    if (!url) {
      toast.error(t('ai.invalid'));
      return;
    }
    setLoading(true);
    try {
      // 权限申请依赖本次点击，必须先于其他异步操作
      if (!(await requestModelPermission(url))) {
        toast.error(t('ai.permissionDenied'));
        return;
      }
      const list = await fetchModels(url, apiKey.trim());
      if (list.length === 0) toast.error(t('ai.noModels'));
      setModels(list);
    } catch (error) {
      toast.error(t('ai.fetchFailed', { msg: (error as Error).message }));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    const url = parseBaseURL(baseURL);
    if (!url || !model.trim()) {
      toast.error(t('ai.invalid'));
      return;
    }
    // 权限申请依赖本次点击，必须先于其他异步操作
    if (!(await requestModelPermission(url))) {
      toast.error(t('ai.permissionDenied'));
      return;
    }
    await saveModelConfig({ baseURL: url, apiKey: apiKey.trim(), model: model.trim() });
    toast.success(t('ai.saved'));
    onSaved();
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="space-y-2">
        <Label htmlFor="ai-base">{t('ai.baseURL')}</Label>
        <Input id="ai-base" autoFocus value={baseURL} onChange={(e) => { setBaseURL(e.target.value); setModels([]); }} placeholder="https://api.openai.com/v1" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ai-key">{t('ai.apiKey')}</Label>
        <Input id="ai-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-model">{t('ai.model')}</Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => void fetchList()}
            disabled={loading || !baseURL.trim()}
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            {t('ai.fetchModels')}
          </Button>
        </div>
        {models.length > 0 ? (
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger id="ai-model" className="w-full">
              <SelectValue placeholder={t('ai.pickModel')} />
            </SelectTrigger>
            <SelectContent>
              {(model && !models.includes(model) ? [model, ...models] : models).map((id) => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t('collect.cancel')}</Button>
        <Button type="submit">{t('collect.save')}</Button>
      </DialogFooter>
    </form>
  );
}

export function ModelSettingsDialog({
  open, onClose, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('ai.settingsTitle')}</DialogTitle>
          <DialogDescription>{t('ai.settingsDesc')}</DialogDescription>
        </DialogHeader>
        {open && <ModelForm onSaved={onSaved} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
