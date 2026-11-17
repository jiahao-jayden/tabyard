// 新标签页搜索框可用的搜索源：搜索引擎（可设为默认）和站内搜索（仅本次页面内生效）
export interface SearchSource {
  id: string;
  label: string;
  group: 'engine' | 'site';
  /** 搜索网址模板，%s 为查询词 */
  url: string;
  /** 联网建议接口；多数返回 OpenSearch JSON，Bing 见 useWebSuggestions */
  suggest?: string;
}

export const SEARCH_SOURCES = [
  {
    id: 'baidu', label: '百度', group: 'engine',
    url: 'https://www.baidu.com/s?wd=%s',
    suggest: 'https://suggestion.baidu.com/su?action=opensearch&ie=utf-8&wd=%s',
  },
  {
    id: 'bing', label: 'Bing', group: 'engine',
    url: 'https://www.bing.com/search?q=%s',
    suggest: 'https://api.bing.com/qsonhs.aspx?type=json&q=%s',
  },
  {
    id: 'google', label: 'Google', group: 'engine',
    url: 'https://www.google.com/search?q=%s',
    suggest: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s',
  },
  {
    id: 'duckduckgo', label: 'DuckDuckGo', group: 'engine',
    url: 'https://duckduckgo.com/?q=%s',
    suggest: 'https://duckduckgo.com/ac/?type=list&q=%s',
  },
  { id: 'brave', label: 'Brave Search', group: 'engine', url: 'https://search.brave.com/search?q=%s' },
  { id: 'ecosia', label: 'Ecosia', group: 'engine', url: 'https://www.ecosia.org/search?q=%s' },
  { id: 'sogou', label: '搜狗', group: 'engine', url: 'https://www.sogou.com/web?query=%s' },
  { id: 'youtube', label: 'YouTube', group: 'site', url: 'https://www.youtube.com/results?search_query=%s' },
  { id: 'bilibili', label: 'Bilibili', group: 'site', url: 'https://search.bilibili.com/all?keyword=%s' },
  { id: 'github', label: 'GitHub', group: 'site', url: 'https://github.com/search?q=%s' },
  { id: 'stackoverflow', label: 'Stack Overflow', group: 'site', url: 'https://stackoverflow.com/search?q=%s' },
  { id: 'mdn', label: 'MDN', group: 'site', url: 'https://developer.mozilla.org/en-US/search?q=%s' },
  { id: 'npm', label: 'npm', group: 'site', url: 'https://www.npmjs.com/search?q=%s' },
  { id: 'huggingface', label: 'Hugging Face', group: 'site', url: 'https://huggingface.co/models?search=%s' },
  { id: 'wikipedia', label: 'Wikipedia', group: 'site', url: 'https://en.wikipedia.org/w/index.php?search=%s' },
  { id: 'reddit', label: 'Reddit', group: 'site', url: 'https://www.reddit.com/search/?q=%s' },
  { id: 'zhihu', label: '知乎', group: 'site', url: 'https://www.zhihu.com/search?q=%s' },
  { id: 'x', label: 'X', group: 'site', url: 'https://x.com/search?q=%s' },
] as const satisfies readonly SearchSource[];

export type SearchSourceId = (typeof SEARCH_SOURCES)[number]['id'];

export const SOURCE_IDS = SEARCH_SOURCES.map((s) => s.id) as [SearchSourceId, ...SearchSourceId[]];

export function getSource(id: string): SearchSource {
  return SEARCH_SOURCES.find((s) => s.id === id) ?? SEARCH_SOURCES[2];
}

export function buildSearchUrl(source: SearchSource, query: string): string {
  return source.url.replace('%s', encodeURIComponent(query));
}
