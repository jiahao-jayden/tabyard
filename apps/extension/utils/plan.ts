import { browser } from 'wxt/browser';
import type { Group } from '@tabyard/shared';
import { loadConfig, type GroupSettings } from './rules';

export type Plan = 'free' | 'pro';

export const FREE_GROUP_LIMIT = 3;

/** 目前只读本地标记，后续接入服务端校验 */
export async function getPlan(): Promise<Plan> {
  const { plan } = await browser.storage.local.get('plan');
  return plan === 'pro' ? 'pro' : 'free';
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

/** 实际生效的配置：免费版只取前几个启用分组，且不能按域名兜底 */
export async function loadActiveConfig(): Promise<{ settings: GroupSettings; groups: Group[]; allGroups: Group[] }> {
  const [{ settings, groups }, plan] = await Promise.all([loadConfig(), getPlan()]);
  if (plan === 'pro') return { settings, groups, allGroups: groups };
  let used = 0;
  const active = groups.map((g) => {
    if (!g.enabled) return g;
    return ++used <= FREE_GROUP_LIMIT ? g : { ...g, enabled: false };
  });
  return {
    settings: settings.fallback === 'domain' ? { ...settings, fallback: 'none' } : settings,
    groups: active,
    allGroups: groups,
  };
}
