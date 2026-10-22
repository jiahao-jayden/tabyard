import { normalizeCode, type RulePack } from '@tabyard/shared';
import { browser } from 'wxt/browser';

export const API_URL = import.meta.env.WXT_API_URL;
export const REPO_URL = 'https://github.com/jiahao-jayden/tabyard';

export class ApiError extends Error {
  constructor(readonly code: string, message?: string) {
    super(message ?? code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, init);
  } catch {
    throw new ApiError('network');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? 'internal', body.message);
  return body as T;
}

export function packsUrl(language: string): string {
  return `${API_URL}${language.startsWith('zh') ? '/zh' : ''}/packs`;
}

export interface AccountUser {
  name: string;
  image: string | null;
}

export async function fetchAccount(): Promise<AccountUser | null> {
  try {
    const session = await request<{ user?: { name: string; image?: string | null } } | null>(
      '/api/auth/get-session',
      { credentials: 'include' },
    );
    return session?.user ? { name: session.user.name, image: session.user.image ?? null } : null;
  } catch {
    return null;
  }
}

export interface RemotePack {
  code: string;
  version: number;
  md5: string;
  pack: RulePack;
}

export async function fetchPack(input: string): Promise<RemotePack> {
  const code = normalizeCode(input);
  if (!code) throw new ApiError('invalid_code');
  return request<RemotePack>(`/api/packs/${code}`);
}

export interface OfficialPack {
  code: string;
  name: string;
  patternCount: number;
}

export function fetchOfficialPacks(): Promise<OfficialPack[]> {
  return request<OfficialPack[]>('/api/packs');
}

export interface PublishResult {
  code: string;
  version: number;
  md5: string;
  editToken?: string;
}

export function publishPack(
  pack: RulePack,
  target?: { code: string; editToken: string },
): Promise<PublishResult> {
  return request<PublishResult>('/api/publish', {
    method: 'POST',
    body: JSON.stringify({ pack, ...target }),
  });
}

export interface PublishedRecord {
  code: string;
  editToken: string;
  name: string;
  author: string;
  description: string;
  version: number;
}

const storage = browser.storage.local;

export async function loadPublished(): Promise<PublishedRecord[]> {
  const { published } = await storage.get('published');
  return (published as PublishedRecord[] | undefined) ?? [];
}

export async function savePublished(record: PublishedRecord): Promise<void> {
  const rest = (await loadPublished()).filter((r) => r.code !== record.code);
  await storage.set({ published: [record, ...rest] });
}
