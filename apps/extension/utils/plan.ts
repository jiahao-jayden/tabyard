import { browser } from 'wxt/browser';
import { API_URL } from './api';

export type Plan = 'free' | 'pro';

/** 只有云同步需要 Pro，其余功能不看套餐。读取缓存的套餐；缓存由 refreshPlan 从服务端同步 */
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
