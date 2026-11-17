import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

export interface HistoryEntry {
  title: string;
  url: string;
}

const MAX_RESULTS = 5;
const DEBOUNCE_MS = 120;

/** 在浏览历史里查输入的文字，结果按最近访问排序；只在本机查询，不联网 */
export function useHistorySuggestions(query: string, enabled: boolean): HistoryEntry[] {
  const [found, setFound] = useState<{ query: string; entries: HistoryEntry[] }>({ query: '', entries: [] });

  useEffect(() => {
    if (!enabled || !query) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      // startTime 默认只查最近 24 小时，0 表示全部历史
      const items = await browser.history.search({ text: query, startTime: 0, maxResults: 20 }).catch(() => []);
      if (cancelled) return;
      const entries = items
        .flatMap((item) => (item.url && /^https?:\/\//i.test(item.url) ? [{ title: item.title || item.url, url: item.url }] : []))
        .slice(0, MAX_RESULTS);
      setFound({ query, entries });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  // 只返回和当前输入对应的结果，输入变化的瞬间不显示上一次的
  return enabled && found.query === query ? found.entries : [];
}
