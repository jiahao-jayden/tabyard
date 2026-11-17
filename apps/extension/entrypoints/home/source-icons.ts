// 搜索源图标：打包进扩展，不依赖浏览器的 favicon 缓存（没访问过的站点取不到）。
// 有彩色版的用 @lobehub/icons-static-svg（MIT），其余用 simple-icons（CC0）的品牌色单色图标。
import {
  siDuckduckgo, siEcosia, siGithub, siMdnwebdocs, siNpm, siReddit, siSogou, siStackoverflow,
  siWikipedia, siX, siYoutube, siZhihu, type SimpleIcon,
} from 'simple-icons';
import baidu from '@lobehub/icons-static-svg/icons/baidu-color.svg';
import bilibili from '@lobehub/icons-static-svg/icons/bilibili-color.svg';
import bing from '@lobehub/icons-static-svg/icons/bing-color.svg';
import brave from '@lobehub/icons-static-svg/icons/brave-color.svg';
import google from '@lobehub/icons-static-svg/icons/google-color.svg';
import huggingface from '@lobehub/icons-static-svg/icons/huggingface-color.svg';
import type { SearchSourceId } from '@/utils/search-sources';

const mono = (icon: SimpleIcon): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`,
  )}`;

export const SOURCE_ICONS: Record<SearchSourceId, string> = {
  baidu,
  bing,
  google,
  duckduckgo: mono(siDuckduckgo),
  brave,
  ecosia: mono(siEcosia),
  sogou: mono(siSogou),
  youtube: mono(siYoutube),
  bilibili,
  github: mono(siGithub),
  stackoverflow: mono(siStackoverflow),
  mdn: mono(siMdnwebdocs),
  npm: mono(siNpm),
  huggingface,
  wikipedia: mono(siWikipedia),
  reddit: mono(siReddit),
  zhihu: mono(siZhihu),
  x: mono(siX),
};
