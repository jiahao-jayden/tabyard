// 录屏时注入当前标签页的控制栏、标注画布和摄像头小窗；标签页录制会把它们一并录进视频。
// 不在 manifest 里静态注册，由后台在开始录制和页面跳转后通过 activeTab 注入
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import en from '@/locales/en.json';
import zhCN from '@/locales/zh-CN.json';
import { elapsedMs, formatDuration, OVERLAY_REMOVE, type RecordState } from '@/utils/record/types';

declare global {
  interface Window {
    __tabyardRecord?: boolean;
  }
}

type Tool = 'cursor' | 'pen' | 'arrow' | 'rect';
type Point = [number, number];
interface Shape {
  tool: Exclude<Tool, 'cursor'>;
  color: string;
  points: Point[];
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#111827'];
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  grip: svg('<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>'),
  pause: svg('<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>'),
  resume: svg('<polygon points="6 3 20 12 6 21 6 3"/>'),
  stop: svg('<rect width="14" height="14" x="5" y="5" rx="2" fill="currentColor"/>'),
  cursor: svg('<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>'),
  pen: svg('<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>'),
  arrow: svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  rect: svg('<rect width="18" height="18" x="3" y="3" rx="2"/>'),
  clear: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
};

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483645; }
canvas.drawing { pointer-events: auto; cursor: crosshair; }
.bar { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 2147483647;
  display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 999px;
  background: rgba(17, 17, 17, .9); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.25); user-select: none; }
.bar button { all: unset; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
  border-radius: 999px; cursor: pointer; color: #e5e7eb; }
.bar button:hover { background: rgba(255,255,255,.12); }
.bar button.active { background: rgba(255,255,255,.22); color: #fff; }
.bar button:disabled { opacity: .4; pointer-events: none; }
.grip { cursor: grab; color: #9ca3af; display: flex; padding: 0 2px; }
.time { display: flex; align-items: center; gap: 6px; padding: 0 8px; font-size: 13px; font-variant-numeric: tabular-nums; }
.dot { width: 8px; height: 8px; border-radius: 999px; background: #ef4444; }
.paused .dot { background: #9ca3af; }
.stop { color: #f87171 !important; }
.sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255,255,255,.2); }
.swatch { width: 14px !important; height: 14px !important; margin: 0 3px; border: 2px solid transparent; }
.swatch.active { outline: 2px solid #fff; outline-offset: 1px; }
.camera { position: fixed; right: 24px; bottom: 96px; width: 168px; height: 168px; z-index: 2147483646;
  border-radius: 999px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.3); border: 3px solid #fff; background: #111; }
.camera iframe { width: 100%; height: 100%; border: 0; }
.camera .handle { position: absolute; inset: 0; cursor: grab; }
`;

function loadLabels(language: unknown) {
  const zh = language === 'zh-CN' || (language !== 'en' && navigator.language.toLowerCase().startsWith('zh'));
  return (zh ? zhCN : en).record;
}

/** 拖动 handle 移动 target，改用 left/top 定位 */
function makeDraggable(handle: HTMLElement, target: HTMLElement): void {
  handle.addEventListener('pointerdown', (down) => {
    down.preventDefault();
    const rect = target.getBoundingClientRect();
    const dx = down.clientX - rect.left;
    const dy = down.clientY - rect.top;
    Object.assign(target.style, { transform: 'none', right: 'auto', bottom: 'auto', left: `${rect.left}px`, top: `${rect.top}px` });
    const move = (e: PointerEvent) => {
      target.style.left = `${Math.min(Math.max(0, e.clientX - dx), innerWidth - rect.width)}px`;
      target.style.top = `${Math.min(Math.max(0, e.clientY - dy), innerHeight - rect.height)}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const [first, ...rest] = shape.points;
  if (!first) return;
  const last = shape.points[shape.points.length - 1]!;
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (shape.tool === 'pen') {
    ctx.moveTo(...first);
    for (const p of rest) ctx.lineTo(...p);
  } else if (shape.tool === 'rect') {
    ctx.rect(first[0], first[1], last[0] - first[0], last[1] - first[1]);
  } else {
    const angle = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const head = 16;
    ctx.moveTo(...first);
    ctx.lineTo(...last);
    ctx.moveTo(last[0] - head * Math.cos(angle - Math.PI / 6), last[1] - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(...last);
    ctx.lineTo(last[0] - head * Math.cos(angle + Math.PI / 6), last[1] - head * Math.sin(angle + Math.PI / 6));
  }
  ctx.stroke();
}

function mountAnnotations(root: ShadowRoot) {
  const canvas = document.createElement('canvas');
  root.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const shapes: Shape[] = [];
  let current: Shape | null = null;
  let tool: Tool = 'cursor';
  let color = COLORS[0]!;

  const redraw = () => {
    const dpr = devicePixelRatio;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const shape of current ? [...shapes, current] : shapes) drawShape(ctx, shape);
  };
  const resize = () => {
    canvas.width = innerWidth * devicePixelRatio;
    canvas.height = innerHeight * devicePixelRatio;
    redraw();
  };
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', (e) => {
    if (tool === 'cursor') return;
    canvas.setPointerCapture(e.pointerId);
    current = { tool, color, points: [[e.clientX, e.clientY], [e.clientX, e.clientY]] };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return;
    if (current.tool === 'pen') current.points.push([e.clientX, e.clientY]);
    else current.points[1] = [e.clientX, e.clientY];
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    if (current) shapes.push(current);
    current = null;
    redraw();
  });

  return {
    setTool(next: Tool) {
      tool = next;
      canvas.classList.toggle('drawing', next !== 'cursor');
    },
    setColor(next: string) {
      color = next;
    },
    clear() {
      shapes.length = 0;
      redraw();
    },
    dispose() {
      window.removeEventListener('resize', resize);
    },
  };
}

export default defineContentScript({
  matches: [],
  registration: 'runtime',
  async main() {
    if (window.__tabyardRecord) return;
    const [initial, { language }] = await Promise.all([
      browser.runtime.sendMessage({ type: 'record-state' }) as Promise<RecordState | null>,
      browser.storage.local.get('language'),
    ]);
    if (!initial || window.__tabyardRecord) return;
    window.__tabyardRecord = true;
    let state = initial;
    const labels = loadLabels(language);

    const host = document.createElement('tabyard-recorder');
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = STYLE;
    root.append(style);
    document.documentElement.append(host);

    const cleanups: (() => void)[] = [];
    const remove = () => {
      cleanups.forEach((fn) => fn());
      host.remove();
      window.__tabyardRecord = false;
    };

    if (state.options.camera) {
      const camera = document.createElement('div');
      camera.className = 'camera';
      const frame = document.createElement('iframe');
      frame.src = browser.runtime.getURL(`/camera.html?device=${encodeURIComponent(state.options.cameraDeviceId)}`);
      frame.allow = 'camera';
      const handle = document.createElement('div');
      handle.className = 'handle';
      camera.append(frame, handle);
      root.append(camera);
      makeDraggable(handle, camera);
    }

    if (state.options.controls) {
      const annotations = mountAnnotations(root);
      cleanups.push(annotations.dispose);

      const bar = document.createElement('div');
      bar.className = 'bar';
      const button = (icon: string, title: string, onClick: () => void, className = '') => {
        const el = document.createElement('button');
        el.type = 'button';
        el.innerHTML = icon;
        el.title = title;
        el.setAttribute('aria-label', title);
        el.className = className;
        el.addEventListener('click', onClick);
        return el;
      };
      const separator = () => Object.assign(document.createElement('span'), { className: 'sep' });

      const grip = Object.assign(document.createElement('span'), { className: 'grip', innerHTML: ICONS.grip });
      const time = Object.assign(document.createElement('span'), { className: 'time' });
      const dot = Object.assign(document.createElement('span'), { className: 'dot' });
      const clock = document.createElement('span');
      time.append(dot, clock);

      const render = () => {
        clock.textContent = formatDuration(elapsedMs(state));
        bar.classList.toggle('paused', state.pausedAt !== null);
        pauseButton.innerHTML = state.pausedAt !== null ? ICONS.resume : ICONS.pause;
        pauseButton.title = state.pausedAt !== null ? labels.resume : labels.pause;
      };
      const pauseButton = button(ICONS.pause, labels.pause, () => {
        const type = state.pausedAt !== null ? 'record-resume' : 'record-pause';
        void (browser.runtime.sendMessage({ type }) as Promise<RecordState | null>).then((next) => {
          if (next) state = next;
          render();
        });
      });
      const stopButton = button(ICONS.stop, labels.stop, () => {
        stopButton.disabled = true;
        void browser.runtime.sendMessage({ type: 'record-stop' });
      }, 'stop');

      const toolButtons = new Map<Tool, HTMLButtonElement>();
      const selectTool = (tool: Tool) => {
        annotations.setTool(tool);
        toolButtons.forEach((el, key) => el.classList.toggle('active', key === tool));
      };
      for (const tool of ['cursor', 'pen', 'arrow', 'rect'] as const) {
        toolButtons.set(tool, button(ICONS[tool], labels[tool], () => selectTool(tool)));
      }
      const swatches = COLORS.map((color, i) => {
        const el = button('', labels.color, () => {
          annotations.setColor(color);
          if (toolButtons.get('cursor')!.classList.contains('active')) selectTool('pen');
          swatches.forEach((s) => s.classList.toggle('active', s === el));
        }, `swatch${i === 0 ? ' active' : ''}`);
        el.style.background = color;
        return el;
      });
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') selectTool('cursor');
      };
      window.addEventListener('keydown', onKey);
      cleanups.push(() => window.removeEventListener('keydown', onKey));

      bar.append(
        grip, time, pauseButton, stopButton, separator(),
        ...toolButtons.values(), separator(), ...swatches,
        button(ICONS.clear, labels.clear, () => annotations.clear()),
      );
      root.append(bar);
      makeDraggable(grip, bar);
      selectTool('cursor');
      render();
      const timer = setInterval(render, 500);
      cleanups.push(() => clearInterval(timer));
    }

    browser.runtime.onMessage.addListener(function onMessage(msg: { type?: string }) {
      if (msg?.type !== OVERLAY_REMOVE) return;
      browser.runtime.onMessage.removeListener(onMessage);
      remove();
    });
  },
});
