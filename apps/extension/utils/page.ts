// 后台向页面注入执行的函数；page* 函数在页面上下文运行，必须自包含
import { browser } from 'wxt/browser';

export async function runInTab<A extends unknown[], R>(
  tabId: number,
  func: (...args: A) => R,
  ...args: A
): Promise<Awaited<R>> {
  const [result] = await browser.scripting.executeScript({ target: { tabId }, func, args });
  return result?.result as Awaited<R>;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 框选时的视口宽度，用于换算截图或视频的实际像素 */
  width: number;
}

/** 在页面上拖动框选一块视口区域，Esc 或区域过小时返回 null */
export function pageSelectRegion(hint: string): Promise<Region | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.25);user-select:none';
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;display:none;border:1px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.35);pointer-events:none';
    const tip = document.createElement('div');
    tip.textContent = hint;
    tip.style.cssText =
      'position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:999px;' +
      'background:rgba(0,0,0,.75);color:#fff;font:13px system-ui,sans-serif;pointer-events:none';
    overlay.append(box, tip);
    document.documentElement.append(overlay);

    let start: { x: number; y: number } | null = null;
    let rect = { x: 0, y: 0, w: 0, h: 0 };

    const finish = (result: typeof rect | null) => {
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
      // 等遮罩从画面上消失再截图
      requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve(result && { ...result, width: window.innerWidth })));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    };
    window.addEventListener('keydown', onKey, true);

    overlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      overlay.style.background = 'transparent';
      tip.style.display = 'none';
    });
    overlay.addEventListener('mousemove', (e) => {
      if (!start) return;
      rect = {
        x: Math.min(start.x, e.clientX),
        y: Math.min(start.y, e.clientY),
        w: Math.abs(e.clientX - start.x),
        h: Math.abs(e.clientY - start.y),
      };
      Object.assign(box.style, {
        display: 'block',
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
      });
    });
    overlay.addEventListener('mouseup', () => {
      if (!start) return;
      finish(rect.w >= 4 && rect.h >= 4 ? rect : null);
    });
  });
}
