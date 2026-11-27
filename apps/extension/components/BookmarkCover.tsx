import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCover } from '@/utils/collect/covers';
import type { Bookmark } from '@/utils/collect/store';

export function BookmarkCover({ bookmark, className = 'aspect-[16/10]' }: {
  bookmark: Bookmark;
  className?: string;
}) {
  const [localCover, setLocalCover] = useState('');
  const [failedImage, setFailedImage] = useState('');
  const [failedIcon, setFailedIcon] = useState('');

  useEffect(() => {
    let url = '';
    let alive = true;
    void getCover(bookmark.url).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setLocalCover(url);
    }).catch(() => { /* 本地截图不可用时仍可展示网页封面 */ });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setLocalCover('');
    };
  }, [bookmark.url]);

  const image = localCover || (failedImage !== bookmark.image && bookmark.image);
  return (
    <div className={cn('flex w-full shrink-0 items-center justify-center overflow-hidden bg-muted', className)}>
      {image ? (
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => localCover ? setLocalCover('') : setFailedImage(bookmark.image)}
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
