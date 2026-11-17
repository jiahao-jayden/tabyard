import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WallpaperSource } from '@/utils/newtab-settings';
import { findCurated } from '@/utils/wallpaper-catalog';
import { getLocalWallpaper, loadBingWallpaper, type BingWallpaper } from '@/utils/wallpapers';

/** Blob 的 object URL；Blob 变化或卸载时释放 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

/** 当天的 Bing 壁纸：undefined 表示获取中，null 表示获取失败 */
export function useBingWallpaper(enabled: boolean): BingWallpaper | null | undefined {
  const { i18n } = useTranslation();
  const [bing, setBing] = useState<BingWallpaper | null>();
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadBingWallpaper(i18n.language).then((result) => !cancelled && setBing(result));
    return () => { cancelled = true; };
  }, [enabled, i18n.language]);
  return bing;
}

/** 壁纸来源对应的图片地址；纯色或还没取到时为 null */
export function useWallpaperImage(source: WallpaperSource | null): string | null {
  const bing = useBingWallpaper(source?.type === 'bing');
  const localId = source?.type === 'local' ? source.id : null;
  const [blob, setBlob] = useState<Blob>();
  useEffect(() => {
    setBlob(undefined);
    if (!localId) return;
    let cancelled = false;
    void getLocalWallpaper(localId).then((image) => !cancelled && setBlob(image));
    return () => { cancelled = true; };
  }, [localId]);
  const localUrl = useObjectUrl(blob);

  switch (source?.type) {
    case 'default': return '/bg.webp';
    case 'curated': return findCurated(source.id)?.full ?? null;
    case 'bing': return bing?.url ?? null;
    case 'local': return localUrl ?? null;
    default: return null;
  }
}
