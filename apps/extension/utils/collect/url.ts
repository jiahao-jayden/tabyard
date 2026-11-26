// 收藏集的存储键。网址规范化在共享包里，内容脚本只引用这一小块，避免带上整包。

export { normalizeUrl } from '@tabyard/shared/url';

export const COLLECT_KEY = 'collect';
