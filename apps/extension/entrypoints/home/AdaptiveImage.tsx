import { useState } from 'react';
import { cn } from 'cn';

type Tone = 'dark' | 'light' | 'neutral';

const SAMPLE = 32;

/**
 * 判断图标是不是「透明底上的单色深色/浅色线条」（如 GitHub、Notion 的黑色图标）。
 * 彩色图标，以及铺满不透明底色的图标（如黑底白 X）都不算，保持原样。
 */
function measureTone(img: HTMLImageElement): Tone {
  const ctx = new OffscreenCanvas(SAMPLE, SAMPLE).getContext('2d', { willReadFrequently: true });
  if (!ctx) return 'neutral';
  try {
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
    let visible = 0;
    let luminance = 0;
    let spread = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] ?? 0) <= 128) continue;
      const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
      visible++;
      luminance += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      spread += (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    }
    if (visible < 8 || visible / (SAMPLE * SAMPLE) > 0.9 || spread / visible > 0.12) return 'neutral';
    const mean = luminance / visible;
    return mean < 0.3 ? 'dark' : mean > 0.8 ? 'light' : 'neutral';
  } catch {
    return 'neutral';
  }
}

/** 单色图标在对比度不够的主题下反色，让图标在深色、浅色主题里都看得清 */
export function AdaptiveImage({ className, onLoad, alt = '', ...props }: React.ComponentProps<'img'>) {
  const [tone, setTone] = useState<Tone>('neutral');
  return (
    <img
      {...props}
      alt={alt}
      className={cn(className, tone === 'dark' && 'dark:invert', tone === 'light' && 'invert dark:invert-0')}
      onLoad={(e) => {
        setTone(measureTone(e.currentTarget));
        onLoad?.(e);
      }}
    />
  );
}
