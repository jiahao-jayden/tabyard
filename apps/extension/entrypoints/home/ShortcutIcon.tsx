import { Link2 } from 'lucide-react';
import { cn } from 'cn';
import type { Shortcut } from '@/utils/shortcuts';
import { AdaptiveImage } from './AdaptiveImage';
import { Favicon } from './Favicon';

type IconProps = Pick<Shortcut, 'icon'> & { title: string; url: string | null };

/**
 * 快捷方式的图标方块，页面上的磁贴和编辑弹窗的预览共用；className 决定方块大小。
 * url 为空（还没填）时显示占位。
 */
export function ShortcutIcon({ title, url, icon, className }: IconProps & { className?: string }) {
  const inner = 'size-[66%] rounded-lg';
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-xs backdrop-blur',
        className,
      )}
    >
      {!url ? (
        <Link2 className="size-[40%] text-muted-foreground" />
      ) : (icon.type === 'image' || icon.type === 'online') ? (
        <AdaptiveImage src={icon.data} className={cn('object-contain', inner)} />
      ) : icon.type === 'letter' ? (
        <span className={cn('flex items-center justify-center text-xl font-medium', inner)}>
          {(title.trim() || new URL(url).hostname).charAt(0).toUpperCase()}
        </span>
      ) : (
        <Favicon url={url} title={title} className={cn('text-xl', inner)} />
      )}
    </span>
  );
}
