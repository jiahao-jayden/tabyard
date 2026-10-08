// 模式语法：由写法自动识别类型，不需要用户选择匹配类型

export interface TabLike {
  url?: string;
  title?: string;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export type PatternKind = 'path' | 'domain' | 'keyword' | 'regex';

export interface ParsedPattern {
  kind: PatternKind;
  /** 规范化后的值，同时作为去重的 key */
  value: string;
  /** 路径模式的主机部分 */
  host?: string;
  regex?: RegExp;
  error?: string;
}

const HOST_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/;
const cache = new Map<string, ParsedPattern>();

export function parsePattern(raw: string): ParsedPattern {
  const hit = cache.get(raw);
  if (hit) return hit;
  const parsed = parseUncached(raw);
  cache.set(raw, parsed);
  return parsed;
}

function parseUncached(raw: string): ParsedPattern {
  const text = raw.trim();
  if (text.length > 2 && text.startsWith('/') && text.endsWith('/')) {
    try {
      return { kind: 'regex', value: text, regex: new RegExp(text.slice(1, -1), 'i') };
    } catch (e) {
      return { kind: 'regex', value: text, error: (e as Error).message };
    }
  }

  const value = text
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
  const slash = value.indexOf('/');
  if (slash > 0 && HOST_RE.test(value.slice(0, slash))) {
    return { kind: 'path', value, host: value.slice(0, slash) };
  }
  if (HOST_RE.test(value)) return { kind: 'domain', value };
  return { kind: 'keyword', value };
}

function hostMatches(host: string, target: string): boolean {
  return host === target || host.endsWith('.' + target);
}

export function matchPattern(p: ParsedPattern, tab: TabLike): boolean {
  if (!p.value || p.error) return false;
  const url = tab.url || '';
  switch (p.kind) {
    case 'domain':
      return hostMatches(hostnameOf(url).toLowerCase(), p.value);
    case 'path': {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return false;
      }
      if (!hostMatches(parsed.hostname.toLowerCase(), p.host!)) return false;
      const path = p.value.slice(p.host!.length);
      return parsed.pathname.toLowerCase().startsWith(path);
    }
    case 'keyword':
      return url.toLowerCase().includes(p.value) || (tab.title || '').toLowerCase().includes(p.value);
    case 'regex':
      return p.regex!.test(url) || p.regex!.test(tab.title || '');
  }
}

const KIND_RANK: Record<PatternKind, number> = { path: 3, domain: 2, keyword: 1, regex: 0 };

/** 数值越大越具体：先比类型，再比同类型内的具体程度 */
export function specificity(p: ParsedPattern): number {
  let score = 0;
  switch (p.kind) {
    case 'path':
    case 'keyword':
      score = p.value.length;
      break;
    case 'domain':
      score = p.value.split('.').length * 1000 + p.value.length;
      break;
  }
  return KIND_RANK[p.kind] * 1e6 + score;
}
