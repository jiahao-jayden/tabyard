// 截图与录屏角落里的水印：金属铭牌样式，品牌段（图标 + 网址）必有，可选再加一段用户头像和用户名。
// 后台 Service Worker 和 offscreen 文档都要用，所以这里只放绘制，只依赖 OffscreenCanvas，不碰 DOM。
// offscreen 文档没有 chrome.storage：配置由后台用 watermark-settings.ts 读好再传入，
// 这个文件不能引入读写存储的模块（如 api.ts、watermark-settings.ts）
import { browser } from 'wxt/browser';

/** 水印里展示的登录用户；avatar 是压缩后的 dataURL，缺失时画首字母 */
export interface WatermarkUser {
  name: string;
  avatar: string | null;
}

export const WATERMARK_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];
export const DEFAULT_WATERMARK_POSITION: WatermarkPosition = 'bottom-right';

export interface WatermarkConfig {
  user: WatermarkUser | null;
  position: WatermarkPosition;
}

export interface Watermark {
  draw(ctx: OffscreenCanvasRenderingContext2D, width: number, height: number): void;
}

const MAX_NAME_CHARS = 16;

const clip = (name: string) => {
  const chars = Array.from(name);
  return chars.length > MAX_NAME_CHARS ? `${chars.slice(0, MAX_NAME_CHARS - 1).join('')}…` : name;
};

async function decode(url: string): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(await (await fetch(url)).blob());
  } catch {
    return null;
  }
}

/** 预先加载图标和头像；铭牌按画面尺寸预渲染一次，之后每帧只是一次 drawImage */
export async function createWatermark({ user, position }: WatermarkConfig): Promise<Watermark> {
  const logo = (await decode(browser.runtime.getURL('/icon/48.png')))!;
  const avatar = user?.avatar ? await decode(user.avatar) : null;
  const host = new URL(import.meta.env.WXT_API_URL).host;
  const brand = user ? host : `Created by Tabyard · ${host}`;
  const name = user ? clip(user.name) : '';

  let cache: { unit: number; sprite: OffscreenCanvas; bleed: number; boxW: number; boxH: number } | null = null;

  /** 画一张带投影的铭牌；四周留出 bleed 给阴影 */
  function render(unit: number) {
    const icon = Math.round(unit * 1.4);
    const pad = Math.round(unit * 0.5);
    const gap = Math.round(unit * 0.4);
    const edge = Math.max(1, unit * 0.07);
    const bleed = Math.ceil(unit * 1.2);
    const font = `600 ${unit}px system-ui, -apple-system, "Segoe UI", sans-serif`;

    const measure = new OffscreenCanvas(1, 1).getContext('2d')!;
    measure.font = font;
    const nameW = user ? icon + gap + measure.measureText(name).width : 0;
    const brandW = icon + gap + measure.measureText(brand).width;
    const dividerW = user ? gap * 2 + edge * 2 : 0;
    const boxW = pad + nameW + dividerW + brandW + pad;
    const boxH = icon + pad;
    const radius = boxH * 0.3;

    const sprite = new OffscreenCanvas(Math.ceil(boxW + bleed * 2), Math.ceil(boxH + bleed * 2));
    const ctx = sprite.getContext('2d')!;
    const x = bleed;
    const y = bleed;
    ctx.font = font;
    ctx.textBaseline = 'middle';

    // 铭牌金属板：上半亮、下半暗的硬分界模拟镀铬反光，外加投影
    const plate = ctx.createLinearGradient(0, y, 0, y + boxH);
    plate.addColorStop(0, '#fdfdfe');
    plate.addColorStop(0.5, '#dde1e6');
    plate.addColorStop(0.5, '#cdd2d9');
    plate.addColorStop(1, '#aeb4bd');
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = unit * 0.7;
    ctx.shadowOffsetY = unit * 0.25;
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, boxH, radius);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // 外沿暗线 + 内沿高光线，形成倒角
    ctx.lineWidth = edge;
    ctx.strokeStyle = 'rgba(52, 58, 68, 0.6)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x + edge, y + edge, boxW - edge * 2, boxH - edge * 2, radius - edge);
    ctx.stroke();

    const midY = y + boxH / 2;
    const iconY = y + (boxH - icon) / 2;
    /** 文字压印：下方一道白色高光，上面是深色字 */
    const engrave = (text: string, tx: number) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(text, tx, midY + edge);
      ctx.fillStyle = '#2a2f37';
      ctx.fillText(text, tx, midY);
    };
    const withShadow = (draw: () => void) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = edge * 2;
      ctx.shadowOffsetY = edge;
      draw();
      ctx.restore();
    };

    let cursor = x + pad;
    if (user) {
      const cx = cursor + icon / 2;
      withShadow(() => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, midY, icon / 2, 0, Math.PI * 2);
        ctx.clip();
        if (avatar) {
          ctx.drawImage(avatar, cursor, iconY, icon, icon);
        } else {
          ctx.fillStyle = '#3b5f9e';
          ctx.fillRect(cursor, iconY, icon, icon);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(Array.from(user.name)[0]?.toUpperCase() ?? '', cx, midY + edge / 2);
          ctx.textAlign = 'start';
        }
        ctx.restore();
      });
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = edge;
      ctx.beginPath();
      ctx.arc(cx, midY, icon / 2, 0, Math.PI * 2);
      ctx.stroke();
      engrave(name, cursor + icon + gap);
      cursor += nameW;

      // 压印竖线：一道暗线贴一道亮线
      const lineX = cursor + gap;
      const lineH = boxH * 0.55;
      ctx.fillStyle = 'rgba(52, 58, 68, 0.45)';
      ctx.fillRect(lineX, midY - lineH / 2, edge, lineH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(lineX + edge, midY - lineH / 2, edge, lineH);
      cursor += dividerW;
    }
    withShadow(() => ctx.drawImage(logo, cursor, iconY, icon, icon));
    engrave(brand, cursor + icon + gap);

    return { unit, sprite, bleed, boxW, boxH };
  }

  return {
    draw(ctx, width, height) {
      // 字号随画面宽度缩放，保持相对大小一致
      const unit = Math.max(11, Math.round(width / 110));
      if (cache?.unit !== unit) cache = render(unit);
      const { sprite, bleed, boxW, boxH } = cache;
      const x = position.endsWith('left') ? unit - bleed : width - boxW - unit - bleed;
      const y = position.startsWith('top') ? unit - bleed : height - boxH - unit - bleed;
      ctx.drawImage(sprite, x, y);
    },
  };
}
