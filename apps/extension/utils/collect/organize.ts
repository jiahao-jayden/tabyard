// AI 整理：把未分类的收藏归入文件夹。只生成方案，是否应用由用户确认
import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { Bookmark, Folder, OrganizeGroup } from './store';

const BATCH_SIZE = 80;
const MAX_FOLDER_NAME = 40;
/** 控制「新建文件夹」的度：一次最多建议这么多个 */
const MAX_NEW_FOLDERS = 5;

/** 用序号代替 id 传给模型，省 token，也避免模型编造 id */
const proposalSchema = z.object({
  folders: z.array(z.object({ name: z.string(), items: z.array(z.number().int()) })),
});

function systemPrompt(language: string): string {
  return [
    'You file a user\'s unsorted saved web pages into their existing folders.',
    'You get the list of existing folder names and a numbered list of pages (title, domain, description).',
    'Rules:',
    '- Strongly prefer existing folders. Put a page into one only if it clearly belongs there.',
    `- When no existing folder fits, suggest a new folder. Put similar pages into the same new folder instead of one folder per page, and suggest at most ${MAX_NEW_FOLDERS} new folders in total, with short, specific names.`,
    '- Assign each page to at most one folder. If you are not sure, leave the page out.',
    `- Write new folder names in ${language}.`,
    'Respond with JSON only, in this shape: {"folders":[{"name":string,"items":number[]}]} where items are the page numbers.',
  ].join('\n');
}

function describe(b: Bookmark, n: number) {
  let host = '';
  try {
    host = new URL(b.url).hostname;
  } catch {
    /* 保持为空 */
  }
  // 推文的信息都在正文里，多给一些长度；作者放进 title
  return { n, title: b.title.slice(0, 120), domain: host, description: b.description.slice(0, b.source ? 280 : 120) };
}

export async function proposeOrganization({
  model, bookmarks, folders, language, signal, onProgress,
}: {
  model: LanguageModel;
  bookmarks: Bookmark[];
  folders: Folder[];
  language: string;
  signal: AbortSignal;
  onProgress: (done: number, total: number) => void;
}): Promise<OrganizeGroup[]> {
  /** 文件夹名（小写）→ 分组；已有文件夹先放进去，后续批次也能复用新提出的名字 */
  const groups = new Map<string, OrganizeGroup>();
  for (const f of folders) groups.set(f.name.toLowerCase(), { name: f.name, folderId: f.id, ids: [] });

  onProgress(0, bookmarks.length);
  for (let start = 0; start < bookmarks.length; start += BATCH_SIZE) {
    const batch = bookmarks.slice(start, start + BATCH_SIZE);
    const { output } = await generateText({
      model,
      output: Output.object({ schema: proposalSchema }),
      system: systemPrompt(language),
      prompt: JSON.stringify({
        existingFolders: [...groups.values()].map((g) => g.name),
        pages: batch.map((b, i) => describe(b, i)),
      }),
      abortSignal: signal,
    });

    if (!output) throw new Error('The model returned no structured output');
    const used = new Set<number>();
    for (const proposed of output.folders) {
      const name = proposed.name.trim().slice(0, MAX_FOLDER_NAME);
      if (!name) continue;
      const key = name.toLowerCase();
      const group = groups.get(key) ?? { name, folderId: null, ids: [] };
      for (const n of proposed.items) {
        const target = batch[n];
        if (!target || used.has(n)) continue;
        used.add(n);
        group.ids.push(target.id);
      }
      if (group.ids.length > 0) groups.set(key, group);
    }
    onProgress(Math.min(start + BATCH_SIZE, bookmarks.length), bookmarks.length);
  }

  // 已有文件夹在前；新建建议按页面数从多到少，最多保留几个
  const all = [...groups.values()].filter((g) => g.ids.length > 0);
  const fresh = all
    .filter((g) => g.folderId === null)
    .sort((a, b) => b.ids.length - a.ids.length)
    .slice(0, MAX_NEW_FOLDERS);
  return [...all.filter((g) => g.folderId !== null), ...fresh];
}
