import { browser } from 'wxt/browser';
import type { Group } from '@tabyard/shared';
import { API_URL } from './api';
import { loadConfig, type GroupSettings } from './rules';

export type Plan = 'free' | 'pro';

export const FREE_GROUP_LIMIT = 3;
export const FREE_FOLDER_LIMIT = 3;

/** 读取缓存的套餐；缓存由 refreshPlan 从服务端同步 */
export async function getPlan(): Promise<Plan> {
  const { plan } = await browser.storage.local.get('plan');
  return plan === 'pro' ? 'pro' : 'free';
}

/** 以网站登录态向服务端确认套餐；网络失败时沿用缓存 */
export async function refreshPlan(): Promise<Plan> {
  try {
    const res = await fetch(`${API_URL}/api/plan`, { credentials: 'include' });
    if (res.ok) {
      const { plan } = (await res.json()) as { plan: Plan };
      await browser.storage.local.set({ plan });
      return plan;
    }
  } catch {
    /* 离线时使用缓存 */
  }
  return getPlan();
}

export function groupLimit(plan: Plan): number {
  return plan === 'pro' ? Infinity : FREE_GROUP_LIMIT;
}

export function enabledCount(groups: Group[]): number {
  return groups.filter((g) => g.enabled).length;
}

export function canEnableMoreGroups(plan: Plan, groups: Group[]): boolean {
  return enabledCount(groups) < groupLimit(plan);
}

/** 实际生效的配置：免费版只取前几个启用分组 */
export async function loadActiveConfig(): Promise<{ settings: GroupSettings; groups: Group[]; allGroups: Group[] }> {
  const [{ settings, groups }, plan] = await Promise.all([loadConfig(), getPlan()]);
  if (plan === 'pro') return { settings, groups, allGroups: groups };
  let used = 0;
  const active = groups.map((g) => {
    if (!g.enabled) return g;
    return ++used <= FREE_GROUP_LIMIT ? g : { ...g, enabled: false };
  });
  return { settings, groups: active, allGroups: groups };
}
