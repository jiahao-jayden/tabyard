export interface ChangelogText {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  /** Chrome 应用店状态：提交审核后先写 review，通过后改成 live */
  chrome: 'live' | 'review';
  zh: ChangelogText;
  en: ChangelogText;
}

/** 更新日志，最新在前。扩展升级提示和官网 /changelog 共用；发版时在最前面加一条，版本号与扩展 package.json 一致 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.7.1',
    date: '2026-11-26',
    chrome: 'live',
    zh: {
      title: '网站上管理 MCP API Key',
      items: ['Pro 用户可以在官网生成、重置和删除 MCP API Key。'],
    },
    en: {
      title: 'Manage MCP API keys on the website',
      items: ['Pro users can create, reset and remove MCP API keys on the website.'],
    },
  },
  {
    version: '1.7.0',
    date: '2026-11-26',
    chrome: 'live',
    zh: {
      title: 'MCP：让 AI 助手读取你的收藏和规则',
      items: ['新增 MCP 端点，Pro 用户用 API Key 即可让支持 MCP 的 AI 助手读取已同步的收藏和分组规则。'],
    },
    en: {
      title: 'MCP: let your AI assistant read your collection and rules',
      items: ['New MCP endpoint. Pro users can connect MCP-capable AI assistants with an API key to read the synced collection and group rules.'],
    },
  },
  {
    version: '1.6.0',
    date: '2026-11-25',
    chrome: 'live',
    zh: {
      title: '截图和录屏水印，弹窗记住上次的标签',
      items: ['截图和录屏可以添加水印。', '弹窗会记住上次停留的标签页。', '整理了设置页。'],
    },
    en: {
      title: 'Watermarks for screenshots and recordings',
      items: ['Add a watermark to screenshots and recordings.', 'The popup remembers the last tab you used.', 'Tidied up the settings page.'],
    },
  },
];
