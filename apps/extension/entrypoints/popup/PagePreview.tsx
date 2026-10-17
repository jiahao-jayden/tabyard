import { useState } from 'react';
import { Globe } from 'lucide-react';
import { hostnameOf } from '@tabyard/shared';
import type { PageInfo } from '@/utils/collect/capture';

function Thumb({ page }: { page: PageInfo }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  if (page.image && !imageFailed) {
    return (
      <img
        src={page.image}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        className="size-14 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
      {page.favicon && !iconFailed ? (
        <img src={page.favicon} alt="" onError={() => setIconFailed(true)} className="size-7 rounded" />
      ) : (
        <Globe className="size-6 text-muted-foreground" />
      )}
    </div>
  );
}

/** 当前页面的收藏预览：封面、标题、描述（没有描述时显示域名） */
export function PagePreview({ page }: { page: PageInfo | null }) {
  if (!page) {
    return (
      <div className="flex items-center gap-3" aria-hidden>
        <div className="size-14 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Thumb page={page} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="line-clamp-2 text-sm font-medium leading-snug">{page.title}</div>
        <div className="truncate text-xs text-muted-foreground">{page.description || hostnameOf(page.url)}</div>
      </div>
    </div>
  );
}
