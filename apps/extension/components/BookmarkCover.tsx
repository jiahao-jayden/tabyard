import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCover } from '@/utils/collect/covers';
import { getPagePreview } from '@/utils/collect/preview';
import type { Bookmark } from '@/utils/collect/store';

export function BookmarkCover({ bookmark, className = 'aspect-[16/10]' }: {
  bookmark: Bookmark;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [localCover, setLocalCover] = useState<string>();
  const [preview, setPreview] = useState('');
  const [failedImage, setFailedImage] = useState('');
  const [failedIcon, setFailedIcon] = useState('');

  useEffect(() => {
    let url = '';
    let alive = true;
    void getCover(bookmark.url).catch(() => undefined).then((blob) => {
      if (!alive) return;
      if (blob) url = URL.createObjectURL(blob);
      setLocalCover(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setLocalCover(undefined);
    };
  }, [bookmark.url]);

  // 旧版本可能把页面地址误存为 image；交给补图流程按响应类型区分网页和图片直链。
  const savedImage = bookmark.image !== bookmark.url && bookmark.image !== failedImage ? bookmark.image : '';
  useEffect(() => {
    if (localCover !== '' || savedImage || !container.current) return;
    const controller = new AbortController();
    let url = '';
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      void getPagePreview(bookmark.url, controller.signal).then((blob) => {
        if (!blob || controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      });
    }, { rootMargin: '150px' });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      setPreview('');
    };
  }, [bookmark.url, localCover, savedImage]);

  const image = localCover || savedImage || preview;
  return (
    <div ref={container} className={cn('flex w-full shrink-0 items-center justify-center overflow-hidden bg-muted', className)}>
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (localCover) setLocalCover('');
            else if (savedImage) setFailedImage(savedImage);
            else setPreview('');
          }}
          className={cn('size-full object-cover', localCover && 'object-top')}
        />
      ) : bookmark.favicon && bookmark.favicon !== failedIcon ? (
        <img
          src={bookmark.favicon}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedIcon(bookmark.favicon)}
          className="size-10 rounded-lg object-contain"
        />
      ) : (
        <Globe className="size-8 text-muted-foreground" />
      )}
    </div>
  );
}
