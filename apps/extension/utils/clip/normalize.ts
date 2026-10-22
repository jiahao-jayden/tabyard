import { normalizeTags } from './tags';

export interface RawCapture {
  source_platform: string;
  source_id: string;
  canonical_url: string;
  title: string;
  author: string;
  captured_at: string;
  raw_text: string;
  outbound_urls: string[];
  user_note: string;
  tags: string[];
  og_image: string;
}

/** JSON 字符串是合法的 YAML 双引号字符串，可安全承载引号和换行 */
const q = JSON.stringify;

export function toMarkdown(c: RawCapture): string {
  const tags = normalizeTags(['status/captured', `source/${c.source_platform}`, ...c.tags]);

  return `---
source_platform: ${c.source_platform}
source_id: ${q(c.source_id)}
canonical_url: ${c.canonical_url}
title: ${q(c.title)}
author: ${q(c.author)}
captured_at: ${c.captured_at}
outbound_urls: ${q(c.outbound_urls)}
user_note: ${q(c.user_note)}
tags: ${q(tags)}${c.og_image ? `\nog_image: ${c.og_image}` : ''}
---

${c.raw_text}
`;
}

export function slug(str: string): string {
  return str
    .replace(/https?:\/\/[^/]+\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}
