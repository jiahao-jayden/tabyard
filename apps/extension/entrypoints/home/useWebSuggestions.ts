import { useEffect, useState } from 'react';
import type { SearchSource } from '@/utils/search-sources';

const DEBOUNCE_MS = 150;
const MAX_WEB = 6;

const isString = (x: unknown): x is string => typeof x === 'string';

interface BingResponse {
  AS?: { Results?: { Suggests?: { Txt?: unknown }[] }[] };
}

function parseSuggestions(data: unknown): string[] {
  if (Array.isArray(data)) return Array.isArray(data[1]) ? data[1].filter(isString) : [];
  const results = (data as BingResponse | null)?.AS?.Results ?? [];
  return results.flatMap((r) => r.Suggests ?? []).map((x) => x.Txt).filter(isString);
}

/** 向所选引擎请求联网建议；输入停顿后才发请求，旧请求会被取消，失败时静默为空 */
export function useWebSuggestions(query: string, source: SearchSource, enabled: boolean): string[] {
  const endpoint = enabled ? source.suggest : undefined;
  const [result, setResult] = useState<{ query: string; items: string[] }>({ query: '', items: [] });

  useEffect(() => {
    if (!endpoint || !query) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(endpoint.replace('%s', encodeURIComponent(query)), { signal: controller.signal })
        .then((response) => response.json() as Promise<unknown>)
        .then((data) => {
          setResult({ query, items: parseSuggestions(data).slice(0, MAX_WEB) });
        })
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, endpoint]);

  return endpoint && result.query === query ? result.items : [];
}
