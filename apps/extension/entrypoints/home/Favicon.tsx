import { useState } from 'react';
import { cn } from 'cn';
import { AdaptiveImage } from './AdaptiveImage';

/** 站点图标由浏览器的 _favicon 接口提供；取不到时退回首字母 */
export function Favicon({ url, title, className }: { url: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = `${location.origin}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
  if (failed) {
    return (
      <span className={cn('flex items-center justify-center font-medium', className)}>
        {(title.trim() || new URL(url).hostname).charAt(0).toUpperCase()}
      </span>
    );
  }
  return <AdaptiveImage src={src} className={cn('object-contain', className)} onError={() => setFailed(true)} />;
}
