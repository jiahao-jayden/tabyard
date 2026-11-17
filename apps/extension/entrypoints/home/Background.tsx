import type { Wallpaper } from '@/utils/newtab-settings';
import { useWallpaperImage } from './useWallpaper';

// 颗粒：SVG 分形噪点平铺
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const MAX_BLUR_PX = 24;

/** 壁纸铺满视口；上面盖一层主题底色（遮罩），浅色和深色下文字都清晰 */
export function Background({ wallpaper }: { wallpaper: Wallpaper }) {
  const { enabled, source, overlay, effect, strength } = wallpaper;
  const image = useWallpaperImage(enabled ? source : null);

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ backgroundColor: enabled && source.type === 'solid' ? source.color : undefined }}
    >
      {image && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url("${image}")`,
              // 放大一点，避免模糊后边缘透出底色
              ...(effect === 'blur' && { filter: `blur(${(strength / 100) * MAX_BLUR_PX}px)`, transform: 'scale(1.1)' }),
            }}
          />
          {/* 深色主题的底色本身就很黑，遮罩打七折，壁纸才不会被压得发黑 */}
          <div
            className="absolute inset-0 bg-background opacity-(--overlay) dark:opacity-[calc(var(--overlay)*0.7)]"
            style={{ '--overlay': overlay / 100 } as React.CSSProperties}
          />
          {effect === 'grain' && (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: GRAIN, opacity: strength / 100, mixBlendMode: 'overlay' }}
            />
          )}
        </>
      )}
    </div>
  );
}
