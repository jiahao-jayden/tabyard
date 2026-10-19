// 云同步（Pro）
//
// 本地字段：
//   modifiedAt  本地配置最后一次修改时间（saveConfig 单调递增）
//   syncedAt    最近一次与云端达成一致的版本号（= 当时的 modifiedAt）
// 判定：
//   本地脏   = modifiedAt > syncedAt
//   云端更新 = remote.modifiedAt > syncedAt
// 两边都变过 → 合并（不丢数据）；只有一边变过 → 直接拉取或推送。
//
// 并发：
//   SYNC_LOCK   整个同步流程跨上下文串行（选项页、后台各有自己的 JS 环境）。
//   CONFIG_LOCK 只包住本地读-改-写；网络请求在锁外，期间用户的编辑不会被阻塞。
//   推送以快照版本号为准，推送期间的新编辑版本号更大，仍然保持"脏"，下一轮会再推送。
//   云端用 modifiedAt 做条件写入，被别的设备抢先时返回 409，重新拉取合并后重试。
import { LIMITS, collectSchema, emptyCollect, mergeCollect, syncDataSchema, type Group, type SyncData, type SyncRecord } from '@tabyard/shared';
import { browser } from 'wxt/browser';
import { API_URL } from './api';
import { getPlan } from './plan';
import { CONFIG_LOCK, DEFAULT_SETTINGS, withLock } from './rules';

const storage = browser.storage.local;
const SYNC_LOCK = 'tabyard-sync';
const MAX_ATTEMPTS = 3;

export type SyncResult = 'ok' | 'skipped' | 'error';

interface LocalState {
  data: SyncData;
  modifiedAt: number;
  syncedAt: number;
}

async function readLocal(): Promise<LocalState> {
  const s = await storage.get(['settings', 'groups', 'modifiedAt', 'syncedAt', 'collect']);
  return {
    data: {
      settings: { ...DEFAULT_SETTINGS, ...((s.settings as object) || {}) },
      groups: Array.isArray(s.groups) ? s.groups : [],
      collect: collectSchema.parse(s.collect ?? emptyCollect()),
    } as SyncData,
    modifiedAt: (s.modifiedAt as number | undefined) ?? 0,
    syncedAt: (s.syncedAt as number | undefined) ?? 0,
  };
}

type Remote = { status: 'ok'; record: SyncRecord | null } | { status: 'skipped' | 'error' };

async function fetchRemote(): Promise<Remote> {
  try {
    const res = await fetch(`${API_URL}/api/sync`, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) return { status: 'skipped' };
    if (!res.ok) return { status: 'error' };
    const { record } = (await res.json()) as { record: SyncRecord | null };
    if (!record) return { status: 'ok', record: null };
    const parsed = syncDataSchema.safeParse(record.data);
    if (!parsed.success || !Number.isSafeInteger(record.modifiedAt) || record.modifiedAt <= 0) return { status: 'error' };
    return { status: 'ok', record: { data: parsed.data, modifiedAt: record.modifiedAt } };
  } catch {
    return { status: 'error' };
  }
}

type PushResult = 'ok' | 'conflict' | 'skipped' | 'error';

async function push(snapshot: { data: SyncData; modifiedAt: number }): Promise<PushResult> {
  try {
    const res = await fetch(`${API_URL}/api/sync`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    if (res.status === 401 || res.status === 403) return 'skipped';
    if (res.status === 409) return 'conflict';
    if (!res.ok) return 'error';
    await withLock(CONFIG_LOCK, async () => {
      const { syncedAt = 0 } = await storage.get('syncedAt');
      await storage.set({
        syncedAt: Math.max(syncedAt as number, snapshot.modifiedAt),
        lastSyncAt: Date.now(),
      });
    });
    return 'ok';
  } catch {
    return 'error';
  }
}

/** 同名（忽略大小写）或同 id 视为同一个分组：规则取并集，名称、颜色、开关以较新的一方为准 */
function mergeGroups(remote: Group[], local: Group[], localWins: boolean): Group[] {
  const merged = remote.map((g) => ({ ...g, patterns: [...g.patterns] }));
  const nameKey = (g: Group) => g.name.trim().toLowerCase();
  for (const l of local) {
    const hit = merged.find((m) => m.id === l.id) ?? merged.find((m) => nameKey(m) === nameKey(l));
    if (!hit) {
      merged.push({ ...l, patterns: [...l.patterns] });
      continue;
    }
    hit.patterns = [...new Set([...hit.patterns, ...l.patterns])];
    if (localWins) {
      hit.name = l.name;
      hit.color = l.color;
      hit.enabled = l.enabled;
    }
  }
  return merged.slice(0, LIMITS.maxGroups).map((g) => ({ ...g, patterns: g.patterns.slice(0, LIMITS.maxPatternsPerGroup) }));
}

/**
 * 在 CONFIG_LOCK 内对比本地与云端：能直接落地的就地写入；
 * 需要上传时返回快照（本地数据已是最终结果，版本号已分配）。
 */
function reconcile(remote: SyncRecord | null): Promise<{ data: SyncData; modifiedAt: number } | null> {
  return withLock(CONFIG_LOCK, async () => {
    // 旧版收藏没有配置版本号，首次同步必须标记为本地编辑，避免被云端覆盖。
    const legacy = await storage.get(['collect', 'collectSyncReady', 'modifiedAt', 'syncedAt']);
    if (!legacy.collectSyncReady) {
      await storage.set({
        collectSyncReady: true,
        ...(legacy.collect ? { modifiedAt: Math.max(Date.now(), Number(legacy.modifiedAt ?? 0) + 1, Number(legacy.syncedAt ?? 0) + 1) } : {}),
      });
    }
    const local = await readLocal();
    const dirty = local.modifiedAt > local.syncedAt;
    const remoteNewer = !!remote && remote.modifiedAt > local.syncedAt;

    if (remote && remoteNewer && !dirty) {
      await storage.set({
        settings: remote.data.settings,
        groups: remote.data.groups,
        collect: remote.data.collect ?? local.data.collect,
        modifiedAt: remote.modifiedAt,
        syncedAt: remote.modifiedAt,
        lastSyncAt: Date.now(),
      });
      return null;
    }

    if (remote && remoteNewer && dirty) {
      const localWins = local.modifiedAt > remote.modifiedAt;
      const data: SyncData = {
        settings: localWins ? local.data.settings : remote.data.settings,
        groups: mergeGroups(remote.data.groups, local.data.groups, localWins),
        collect: mergeCollect(remote.data.collect ?? emptyCollect(), local.data.collect ?? emptyCollect(), localWins),
      };
      const modifiedAt = Math.max(Date.now(), remote.modifiedAt + 1, local.modifiedAt + 1);
      await storage.set({ settings: data.settings, groups: data.groups, collect: data.collect, modifiedAt });
      return { data, modifiedAt };
    }

    if (dirty) return { data: local.data, modifiedAt: local.modifiedAt };

    await storage.set({ lastSyncAt: Date.now() });
    return null;
  });
}

/** 先拉后推，两边都有改动时合并 */
export function syncNow(): Promise<SyncResult> {
  return withLock(SYNC_LOCK, async () => {
    if ((await getPlan()) !== 'pro') return 'skipped';
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const remote = await fetchRemote();
        if (remote.status !== 'ok') return remote.status;
        const snapshot = await reconcile(remote.record);
        if (!snapshot) return 'ok';
        const result = await push(snapshot);
        if (result !== 'conflict') return result;
      }
      return 'error';
    } catch {
      return 'error';
    }
  });
}

/** 配置变化后自动同步：仅 Pro；与手动同步共用同一把锁，多次触发会依次执行并自然合并 */
export async function syncIfPro(): Promise<void> {
  if ((await getPlan()) === 'pro') await syncNow();
}
