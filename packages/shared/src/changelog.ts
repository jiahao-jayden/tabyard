export interface ChangelogText {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  zh: ChangelogText;
  en: ChangelogText;
}

/** 更新日志，最新在前。扩展升级提示和官网 /changelog 共用；发版时在最前面加一条，版本号与扩展 package.json 一致；应用店上架状态由官网实时查询，不用在这里维护 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.7.5',
    date: '2026-11-28',
    zh: {
      title: '自动补全收藏卡片的封面',
      items: [
        '浏览新标签页或设置页的收藏卡片时，缺少封面或封面失效的旧收藏会尝试从原网页取图。图片直链可直接生成封面，无需重新收藏。',
        '滚动到卡片附近时才会补图，生成的缩略图会保存在本机，方便下次打开时直接显示。',
        '从弹窗收藏没有预览图的网页时，会尝试用当前页面的截图作封面。通过 MCP 添加收藏时也可以传入封面和网站图标。',
      ],
    },
    en: {
      title: 'Automatic covers for saved pages',
      items: [
        'Collection cards on the new tab and in settings can recover missing or broken covers from the original page. Direct image links get a thumbnail too, without having to save them again.',
        'Covers load as you scroll near a card. Generated thumbnails are cached on this device for your next visit.',
        'Saving a page without a preview image from the popup now tries to capture a screenshot. MCP imports can also include a cover image and site icon.',
      ],
    },
  },
  {
    version: '1.7.4',
    date: '2026-11-27',
    zh: {
      title: '新标签页收藏支持卡片视图',
      items: [
        '点击收藏区「查看全部」旁的图标，可在紧凑视图和卡片视图之间切换。卡片显示封面、标题、来源网站和收藏日期。',
        '切换视图时会保留当前文件夹，下次打开新标签页也会沿用上次选择的视图。',
      ],
    },
    en: {
      title: 'Card view for your new-tab collection',
      items: [
        'Use the icons next to “View all” to switch between compact and card views. Each card shows a cover, title, site, and date saved.',
        'Switching views keeps your current folder selected. The next new tab opens with your last view.',
      ],
    },
  },
  {
    version: '1.7.3',
    date: '2026-11-26',
    zh: {
      title: '修复应用商店页面的报错',
      items: ['在 Chrome 应用商店页面打开弹窗时，不再提示“抽取失败”；剪藏、录制、截图会直接显示该页面不支持。'],
    },
    en: {
      title: 'Fix error on the Chrome Web Store',
      items: ['Opening the popup on a Chrome Web Store page no longer shows "Extraction failed"; clip, record and screenshot now simply report the page as unsupported.'],
    },
  },
  {
    version: '1.7.2',
    date: '2026-11-26',
    zh: {
      title: '新标签页更新提示，官网更新日志',
      items: [
        '升级后第一次打开新标签页，搜索框下方会提示新版本，点击跳转到官网更新日志。',
        '官网新增更新日志页，列出每个版本的改动和发布状态。',
        '弹窗收藏：已收藏的页面会提示所在文件夹，同一文件夹不再重复保存，换文件夹可直接移动。',
      ],
    },
    en: {
      title: 'Update notice on the new tab, changelog on the website',
      items: [
        'The first new tab after an upgrade shows a notice under the search box; click it to open the changelog on the website.',
        'New changelog page on the website, listing the changes and release status of every version.',
        'Saving from the popup: an already-saved page shows its folder, can no longer be saved twice to the same folder, and can be moved to another one.',
      ],
    },
  },
  {
    version: '1.7.1',
    date: '2026-11-26',
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
