import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { browser } from 'wxt/browser';
import { fetchPack, packsUrl, type RemotePack } from '@/utils/api';
import { errorMessage } from './errors';

interface Props {
  open: boolean;
  onClose: () => void;
  onLoaded: (remote: RemotePack) => void;
  onPickFile: () => void;
}

export function ImportSourceDialog({ open, onClose, onLoaded, onPickFile }: Props) {
  const { t, i18n } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      onLoaded(await fetchPack(code));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importSource.title')}</DialogTitle>
          <DialogDescription>{t('importSource.desc')}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(e) => { e.preventDefault(); if (code.trim()) void submit(); }}
        >
          <Label htmlFor="pack-code">{t('importSource.codeLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id="pack-code"
              autoFocus
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder={t('importSource.codePlaceholder')}
              className="font-mono uppercase"
            />
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? t('importSource.fetching') : t('importSource.fetch')}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter className="sm:justify-between">
          <Button variant="link" className="px-0" onClick={() => void browser.tabs.create({ url: packsUrl(i18n.language) })}>
            {t('importSource.browse')}
          </Button>
          <Button variant="outline" onClick={onPickFile}>{t('importSource.file')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
