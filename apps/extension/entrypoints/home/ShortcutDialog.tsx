import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { hostnameOf } from '@tabyard/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { fetchSiteIcon } from '@/utils/site-icon';
import { mutateShortcuts, rasterToDataUrl, type Shortcut } from '@/utils/shortcuts';
import { resolveUrl } from './address';
import { ShortcutIcon } from './ShortcutIcon';

/** null 表示关闭；没有 id 的草稿表示新增 */
export type ShortcutDraft = Omit<Shortcut, 'id'> & { id?: string };

type IconType = Shortcut['icon']['type'];

const field = 'h-10 rounded-xl border-transparent bg-muted px-3 text-sm';

function ShortcutForm({ draft, onClose }: { draft: ShortcutDraft; onClose: () => void }) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(draft.title);
  const [address, setAddress] = useState(draft.url);
  const [invalid, setInvalid] = useState(false);
  const [iconType, setIconType] = useState<IconType>(draft.icon.type);
  const [imageData, setImageData] = useState(draft.icon.type === 'image' ? draft.icon.data : '');
  const [imageFailed, setImageFailed] = useState(false);
  const [onlineData, setOnlineData] = useState(draft.icon.type === 'online' ? draft.icon.data : '');
  const [onlineStatus, setOnlineStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [refreshCount, setRefreshCount] = useState(0);
  // 已经取过图标的网址；编辑已有快捷方式时不重复联网
  const fetchedFor = useRef(draft.icon.type === 'online' && draft.icon.data ? draft.url : '');

  const url = resolveUrl(address);
  const icon: Shortcut['icon'] =
    iconType === 'image' ? { type: 'image', data: imageData }
      : iconType === 'online' ? { type: 'online', data: onlineData }
        : { type: iconType };
  const needsImage = (iconType === 'image' && !imageData) || (iconType === 'online' && !onlineData);

  useEffect(() => {
    if (iconType !== 'online' || !url) return;
    if (refreshCount === 0 && fetchedFor.current === url) return;
    const controller = new AbortController();
    setOnlineStatus('loading');
    // 输入网址时稍等一下再取，避免每个字符都联网
    const timer = setTimeout(async () => {
      const data = await fetchSiteIcon(url, { signal: controller.signal, refresh: refreshCount > 0 });
      if (controller.signal.aborted) return;
      fetchedFor.current = data ? url : '';
      setOnlineData(data ?? '');
      setOnlineStatus(data ? 'idle' : 'failed');
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [iconType, url, refreshCount]);

  const submit = async () => {
    if (!url) {
      setInvalid(true);
      return;
    }
    const next = { id: draft.id ?? crypto.randomUUID(), title: title.trim() || hostnameOf(url), url, icon };
    await mutateShortcuts((list) =>
      draft.id ? list.map((s) => (s.id === draft.id ? next : s)) : [...list, next]);
    onClose();
  };

  const remove = async () => {
    await mutateShortcuts((list) => list.filter((s) => s.id !== draft.id));
    onClose();
  };

  const upload = async (file: File) => {
    setImageFailed(false);
    try {
      setImageData(await rasterToDataUrl(file));
    } catch {
      setImageFailed(true);
    }
  };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="space-y-2">
        <Label htmlFor="sc-title" className="text-base">{t('newtab.fieldTitle')}</Label>
        <Input
          id="sc-title"
          className={field}
          value={title}
          placeholder={url ? hostnameOf(url) : 'GitHub'}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sc-url" className="text-base">{t('newtab.fieldUrl')}</Label>
        <Input
          id="sc-url"
          autoFocus
          className={field}
          value={address}
          aria-invalid={invalid}
          placeholder="https://github.com"
          onChange={(e) => { setAddress(e.target.value); setInvalid(false); }}
        />
        {invalid && <p className="text-xs text-destructive">{t('newtab.invalidUrl')}</p>}
      </div>
      <div className="space-y-2">
        <Label className="text-base">{t('newtab.iconSource')}</Label>
        <Select value={iconType} onValueChange={(v) => setIconType(v as IconType)}>
          <SelectTrigger className="w-full rounded-xl border-transparent bg-muted px-3 text-sm data-[size=default]:h-10" aria-label={t('newtab.iconSource')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online">{t('newtab.iconOnline')}</SelectItem>
            <SelectItem value="cache">{t('newtab.iconCache')}</SelectItem>
            <SelectItem value="letter">{t('newtab.iconLetter')}</SelectItem>
            <SelectItem value="image">{t('newtab.iconImage')}</SelectItem>
          </SelectContent>
        </Select>
        {(iconType === 'cache' || iconType === 'online') && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(iconType === 'cache' ? 'newtab.iconCacheHint' : 'newtab.iconOnlineHint')}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-base">{t('newtab.currentIcon')}</Label>
        <div className="flex items-center gap-3">
          <ShortcutIcon
            className="size-20"
            title={title}
            url={iconType === 'image' ? (imageData ? url ?? 'https://example.com' : null)
              : iconType === 'online' ? (onlineData ? url : null) : url}
            icon={icon}
          />
          {iconType === 'online' && (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={!url || onlineStatus === 'loading'}
                onClick={() => setRefreshCount((n) => n + 1)}
              >
                <RefreshCw className={onlineStatus === 'loading' ? 'animate-spin' : ''} />
                {t('newtab.iconRefresh')}
              </Button>
              {onlineStatus === 'failed' && <span className="text-xs text-destructive">{t('newtab.iconFetchFailed')}</span>}
            </>
          )}
          {iconType === 'image' && (
            <>
              <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
                {t('newtab.iconUpload')}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void upload(file);
                }}
              />
              {imageFailed && <span className="text-xs text-destructive">{t('newtab.iconFailed')}</span>}
            </>
          )}
        </div>
      </div>
      <DialogFooter className="m-0 border-0 bg-transparent p-0">
        {draft.id && (
          <Button type="button" variant="destructive" className="h-9 px-4 sm:mr-auto" onClick={() => void remove()}>
            {t('newtab.delete')}
          </Button>
        )}
        <Button type="button" variant="secondary" className="h-9 px-5" onClick={onClose}>{t('newtab.cancel')}</Button>
        <Button type="submit" className="h-9 px-5" disabled={needsImage || onlineStatus === 'loading'}>{t('newtab.save')}</Button>
      </DialogFooter>
    </form>
  );
}

export function ShortcutDialog({ draft, onClose }: { draft: ShortcutDraft | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-5 overflow-y-auto p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{draft?.id ? t('newtab.editShortcut') : t('newtab.addShortcut')}</DialogTitle>
        </DialogHeader>
        {/* key 保证切换到另一个快捷方式时表单重新初始化 */}
        {draft && <ShortcutForm key={draft.id ?? 'new'} draft={draft} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
