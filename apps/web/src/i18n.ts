export type Locale = 'zh' | 'en';

export const INSTALL_URL = 'https://chromewebstore.google.com/';

const zh = {
  siteName: 'Tabyard 归处',
  docTitle: 'Tabyard 归处 · 标签自动分组',
  navPacks: '规则包',
  install: '安装扩展',
  signIn: '登录',
  signOut: '退出登录',
  loginTitle: '登录 Tabyard',
  loginDesc: '登录后可管理你发布的规则包。',
  withGithub: '使用 GitHub 继续',
  withGoogle: '使用 Google 继续',
  heroTitle: '让标签页，各归其处',
  heroDesc: '按网址自动归入 Chrome 原生标签组。规则写一次，往后打开的每个页面都会去对的地方。',
  browsePacks: '逛逛规则包',
  bentoNativeTitle: '原生标签组',
  bentoNativeDesc: '直接用 Chrome 自带的分组，不多出一块面板。',
  bentoSpecificTitle: '越具体，越优先',
  bentoSpecificDesc: '路径先于域名，域名先于关键词。',
  bentoShareTitle: '一个分享码，一套规则',
  bentoShareDesc: '发布后得到分享码，朋友粘贴就能导入。',
  matched: '命中',
  featuredTitle: '大家整理好的规则',
  viewAll: '查看全部',
  packsTitle: '规则包',
  packsDesc: '官方整理和用户发布的规则包。复制分享码，在扩展里导入。',
  searchLabel: '搜索规则包',
  searchPlaceholder: '名称、作者或描述',
  empty: '没有找到相关的规则包，换个关键词试试。',
  official: '官方',
  groups: '个分组',
  patterns: '条规则',
  version: '版本',
  anonymous: '匿名',
  code: '分享码',
  copy: '复制分享码',
  copied: '已复制',
  howToImport: '在扩展的「分组规则」里点击「导入」，粘贴分享码即可。',
  notFound: '这个规则包不存在，或者已经被移除。',
  back: '返回规则包',
  language: 'EN',
  languageLabel: 'Switch to English',
  footer: 'Tabyard 归处',
} as const;

type Dict = { [K in keyof typeof zh]: string };

const en: Dict = {
  siteName: 'Tabyard',
  docTitle: 'Tabyard · Automatic tab grouping',
  navPacks: 'Packs',
  install: 'Install',
  signIn: 'Sign in',
  signOut: 'Sign out',
  loginTitle: 'Sign in to Tabyard',
  loginDesc: 'Sign in to manage the packs you publish.',
  withGithub: 'Continue with GitHub',
  withGoogle: 'Continue with Google',
  heroTitle: 'Every tab, in its place.',
  heroDesc: 'Tabs sort themselves into native Chrome groups by URL. Write a rule once and every page lands where it belongs.',
  browsePacks: 'Browse packs',
  bentoNativeTitle: 'Native tab groups',
  bentoNativeDesc: 'Built on Chrome tab groups. No extra panel to manage.',
  bentoSpecificTitle: 'Most specific wins',
  bentoSpecificDesc: 'Paths beat domains, domains beat keywords.',
  bentoShareTitle: 'One code, one rule set',
  bentoShareDesc: 'Publish and get a share code. Friends paste it to import.',
  matched: 'Match',
  featuredTitle: 'Rules people have shared',
  viewAll: 'View all',
  packsTitle: 'Rule packs',
  packsDesc: 'Official and community packs. Copy a code and import it in the extension.',
  searchLabel: 'Search packs',
  searchPlaceholder: 'Name, author or description',
  empty: 'No packs match that search. Try another keyword.',
  official: 'Official',
  groups: 'groups',
  patterns: 'patterns',
  version: 'Version',
  anonymous: 'Anonymous',
  code: 'Code',
  copy: 'Copy code',
  copied: 'Copied',
  howToImport: 'In the extension, open Group rules, click Import and paste the code.',
  notFound: 'This pack does not exist or has been removed.',
  back: 'Back to packs',
  language: '中',
  languageLabel: '切换到中文',
  footer: 'Tabyard',
};

export type Dictionary = Dict;
export const dictionaries: Record<Locale, Dict> = { zh, en };

export function localeFromParam(param: string | undefined): Locale {
  return param === 'zh' ? 'zh' : 'en';
}

export const GROUP_HEX: Record<string, string> = {
  grey: '#8a94a3', blue: '#5b8def', red: '#e46b6b', yellow: '#e2b33c', green: '#5fb47a',
  pink: '#e27aa8', purple: '#9a7be0', cyan: '#4fb3c4', orange: '#e8925a',
};
