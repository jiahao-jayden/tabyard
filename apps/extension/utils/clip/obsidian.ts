// 可选导出：经 Obsidian Local REST API 把 Markdown 写入 vault。设置含密钥，只存本地，不参与云同步
import { browser } from 'wxt/browser';
import { slug, type RawCapture } from './normalize';

export interface ClipSettings {
  exportEnabled: boolean;
  restUrl: string;
  restToken: string;
  saveBaseDir: string;
  pathTemplate: string;
}

export const DEFAULT_CLIP_SETTINGS: ClipSettings = {
  exportEnabled: false,
  restUrl: 'http://localhost:27123',
  restToken: '',
  saveBaseDir: '_raw/bookmarks',
  pathTemplate: '{platform}/{date}-{slug}.md',
};

const SETTINGS_KEY = 'clip';
const TEMPLATE_VARIABLES = ['platform', 'date', 'slug'];

export type ClipErrorKey = 'clip.err.url' | 'clip.err.token' | 'clip.err.baseDir' | 'clip.err.template' | 'clip.err.variables';
export interface ClipError {
  key: ClipErrorKey;
  vars?: { vars: string };
}

const trimSlashes = (value: string) => value.trim().replace(/^\/+|\/+$/g, '');

export function normalizeClipSettings(input: Partial<ClipSettings>): ClipSettings {
  const d = DEFAULT_CLIP_SETTINGS;
  return {
    exportEnabled: input.exportEnabled === true,
    restUrl: (input.restUrl ?? d.restUrl).trim().replace(/\/+$/, ''),
    restToken: (input.restToken ?? d.restToken).trim(),
    saveBaseDir: trimSlashes(input.saveBaseDir ?? d.saveBaseDir),
    pathTemplate: trimSlashes(input.pathTemplate ?? d.pathTemplate),
  };
}

export async function loadClipSettings(): Promise<ClipSettings> {
  const stored = (await browser.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  return normalizeClipSettings(stored && typeof stored === 'object' ? (stored as Partial<ClipSettings>) : {});
}

export function saveClipSettings(settings: ClipSettings): Promise<void> {
  return browser.storage.local.set({ [SETTINGS_KEY]: normalizeClipSettings(settings) });
}

/** 返回第一个配置错误，配置有效时返回 null */
export function validateClipSettings(s: ClipSettings): ClipError | null {
  if (!/^https?:\/\/[^/\s]+/i.test(s.restUrl)) return { key: 'clip.err.url' };
  if (!s.restToken) return { key: 'clip.err.token' };
  if (!s.saveBaseDir) return { key: 'clip.err.baseDir' };
  if (!s.pathTemplate) return { key: 'clip.err.template' };
  const unknown = [...s.pathTemplate.matchAll(/\{([^}]+)\}/g)].map((m) => m[1] ?? '').filter((k) => !TEMPLATE_VARIABLES.includes(k));
  return unknown.length ? { key: 'clip.err.variables', vars: { vars: unknown.map((k) => `{${k}}`).join(', ') } } : null;
}

export function buildVaultPath(capture: RawCapture, s: ClipSettings): string {
  const vars: Record<string, string> = {
    platform: capture.source_platform,
    date: capture.captured_at.slice(0, 10),
    slug: slug(capture.source_id || capture.canonical_url),
  };
  const rendered = s.pathTemplate.replace(/\{([a-z_]+)\}/g, (_, key: string) => vars[key] ?? '');
  return [s.saveBaseDir, rendered].map(trimSlashes).filter(Boolean).join('/');
}

const authHeaders = (s: ClipSettings): Record<string, string> => (s.restToken ? { Authorization: `Bearer ${s.restToken}` } : {});

export async function testVaultConnection(s: ClipSettings): Promise<void> {
  const res = await fetch(`${s.restUrl}/`, { headers: authHeaders(s) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** 写入 vault，返回 vault 内路径 */
export async function saveToVault(capture: RawCapture, markdown: string, s: ClipSettings): Promise<string> {
  const path = buildVaultPath(capture, s);
  const res = await fetch(`${s.restUrl}/vault/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT',
    headers: { ...authHeaders(s), 'Content-Type': 'text/markdown' },
    body: markdown,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return path;
}
