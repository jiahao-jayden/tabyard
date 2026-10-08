// 云同步（Pro）：以 modifiedAt 判定新旧，最后修改者胜出
import { syncDataSchema, type SyncData, type SyncRecord } from '@tabyard/shared';
import { browser } from 'wxt/browser';
import { API_URL } from './api';
import { getPlan } from './plan';
import { DEFAULT_SETTINGS } from './rules';

const storage = browser.storage.local;

export type SyncResult = 'ok' | 'skipped' | 'needs-choice' | 'error';

interface LocalState {
  data: SyncData;
  modifiedAt: number;
  syncedAt: number | undefined;
}

async function readLocal(): Promise<LocalState> {
  const s = await storage.get(['settings', 'groups', 'modifiedAt', 'syncedAt']);
  return {
    data: {
      settings: { ...DEFAULT_SETTINGS, ...((s.settings as object) || {}) },
      groups: Array.isArray(s.groups) ? s.groups : [],
    } as SyncData,
    modifiedAt: (s.modifiedAt as number | undefined) ?? 0,
    syncedAt: s.syncedAt as number | undefined,
  };
}

async function applyRemote(record: SyncRecord): Promise<void> {
  await storage.set({
    settings: record.data.settings,
    groups: record.data.groups,
    modifiedAt: record.modifiedAt,
    syncedAt: record.modifiedAt,
    lastSyncAt: Date.now(),
  });
}

type Remote = { status: 'ok'; record: SyncRecord | null } | { status: 'skipped' | 'error' };

async function fetchRemote(): Promise<Remote> {
  try {
    const res = await fetch(`${API_URL}/api/sync`, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) return { status: 'skipped' };
    if (!res.ok) return { status: 'error' };
    const { record } = (await res.json()) as { record: SyncRecord | null };
    if (record && !syncDataSchema.safeParse(record.data).success) return { status: 'error' };
    return { status: 'ok', record };
  } catch {
    return { status: 'error' };
  }
}

async function push(local: LocalState): Promise<SyncResult> {
  try {
    const res = await fetch(`${API_URL}/api/sync`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify({ data: local.data, modifiedAt: local.modifiedAt }),
    });
    if (res.status === 401 || res.status === 403) return 'skipped';
    if (res.status === 409) {
      const { record } = (await res.json()) as { record: SyncRecord };
      await applyRemote(record);
      return 'ok';
    }
    if (!res.ok) return 'error';
    await storage.set({ syncedAt: local.modifiedAt, lastSyncAt: Date.now() });
    return 'ok';
  } catch {
    return 'error';
  }
}

let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(task: () => Promise<T>): Promise<T> => {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
};

/** 先拉后推；本机从未同步过、本机有规则、云端也有数据时不自动覆盖，交给用户选择 */
export function syncNow(): Promise<SyncResult> {
  return serial(async () => {
    const remote = await fetchRemote();
    if (remote.status !== 'ok') return remote.status;
    const local = await readLocal();

    if (remote.record) {
      if (local.syncedAt === undefined && local.data.groups.length > 0) return 'needs-choice';
      if (remote.record.modifiedAt > local.modifiedAt) {
        await applyRemote(remote.record);
        return 'ok';
      }
    }
    if (local.modifiedAt > (local.syncedAt ?? 0)) return push(local);
    await storage.set({ lastSyncAt: Date.now() });
    return 'ok';
  });
}

/** 首次关联时用户的选择：采用云端，或用本机覆盖云端 */
export function resolveFirstSync(choice: 'remote' | 'local'): Promise<SyncResult> {
  return serial(async () => {
    const remote = await fetchRemote();
    if (remote.status !== 'ok' || !remote.record) return remote.status === 'ok' ? 'ok' : remote.status;
    if (choice === 'remote') {
      await applyRemote(remote.record);
      return 'ok';
    }
    const local = await readLocal();
    const modifiedAt = Math.max(Date.now(), remote.record.modifiedAt + 1);
    await storage.set({ modifiedAt });
    return push({ ...local, modifiedAt });
  });
}

/** 配置变化后的自动上传：仅 Pro，且已完成首次关联 */
export async function pushIfPro(): Promise<void> {
  if ((await getPlan()) !== 'pro') return;
  const local = await readLocal();
  if (local.syncedAt === undefined) {
    await syncNow();
    return;
  }
  if (local.modifiedAt <= local.syncedAt) return;
  await serial(async () => push(await readLocal()));
}
