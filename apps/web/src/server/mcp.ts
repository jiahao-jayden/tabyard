// Pro 用户的 MCP。读写的是云端同步副本（收藏和分组规则），不是浏览器里正打开的标签。
import { env } from 'cloudflare:workers';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import {
  emptyCollect,
  GROUP_COLORS,
  LIMITS,
  normalizeUrl,
  stampCollect,
  SYNC_MAX_BYTES,
  syncDataSchema,
  type Bookmark,
  type CollectData,
  type Group,
  type SyncData,
} from '@tabyard/shared';
import { z } from 'zod';
import { isPro } from './billing';
import { getSync } from './sync';

export const MCP_MONTHLY_LIMIT = 1000;

const KEY_BYTES = 32;

export interface McpKeyStatus {
  prefix: string | null;
  createdAt: number | null;
  used: number;
  limit: number;
}

class ToolFailure extends Error {}

function monthOf(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 7);
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getMcpKeyStatus(userId: string): Promise<McpKeyStatus> {
  const [key, usage] = await Promise.all([
    env.DB.prepare('SELECT prefix, createdAt FROM mcp_key WHERE userId = ?')
      .bind(userId)
      .first<{ prefix: string; createdAt: number }>(),
    env.DB.prepare('SELECT count FROM mcp_usage WHERE userId = ? AND month = ?')
      .bind(userId, monthOf())
      .first<{ count: number }>(),
  ]);
  return {
    prefix: key?.prefix ?? null,
    createdAt: key?.createdAt ?? null,
    used: usage?.count ?? 0,
    limit: MCP_MONTHLY_LIMIT,
  };
}

/** 每人一把。再次生成会作废旧密钥。明文只在这次响应里返回。 */
export async function createMcpKey(userId: string): Promise<McpKeyStatus & { key: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  const key = `ty_${base64url(bytes)}`;
  const prefix = key.slice(0, 11);
  const createdAt = Date.now();
  await env.DB.prepare(
    `INSERT INTO mcp_key (userId, hash, prefix, createdAt) VALUES (?, ?, ?, ?)
     ON CONFLICT (userId) DO UPDATE SET hash = excluded.hash, prefix = excluded.prefix, createdAt = excluded.createdAt`,
  )
    .bind(userId, await hashKey(key), prefix, createdAt)
    .run();
  const status = await getMcpKeyStatus(userId);
  return { ...status, prefix, createdAt, key };
}

export async function revokeMcpKey(userId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM mcp_key WHERE userId = ?').bind(userId).run();
}

/** 密钥无效返回 401；密钥仍在但已不是 Pro 返回 403。 */
export async function authenticateMcp(request: Request): Promise<string | Response> {
  const key = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)\s*$/)?.[1];
  if (!key || key.length !== 46 || !key.startsWith('ty_')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const row = await env.DB.prepare('SELECT userId FROM mcp_key WHERE hash = ?')
    .bind(await hashKey(key))
    .first<{ userId: string }>();
  if (!row) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await isPro(row.userId))) return Response.json({ error: 'pro_required' }, { status: 403 });
  return row.userId;
}

/** 只计工具调用。条件更新失败表示本月已到上限。 */
async function takeQuota(userId: string): Promise<boolean> {
  const res = await env.DB.prepare(
    `INSERT INTO mcp_usage (userId, month, count) VALUES (?, ?, 1)
     ON CONFLICT (userId, month) DO UPDATE SET count = count + 1
     WHERE mcp_usage.count < ?`,
  )
    .bind(userId, monthOf(), MCP_MONTHLY_LIMIT)
    .run();
  return res.meta.changes === 1;
}

function ensureCollect(data: SyncData): CollectData {
  const collect = data.collect ?? emptyCollect();
  collect.deletedBookmarks ??= {};
  collect.deletedFolders ??= {};
  data.collect = collect;
  return collect;
}

/** mutate 可能因版本冲突重跑，结果只取成功写入的那一次。 */
async function writeSnapshot<T>(userId: string, touchCollect: boolean, mutate: (data: SyncData) => T): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = await getSync(userId);
    if (!record) throw new ToolFailure('No cloud copy yet. Open Tabyard settings and sync once.');
    const data = structuredClone(record.data);
    const beforeCollect = touchCollect ? structuredClone(ensureCollect(data)) : null;
    const result = mutate(data);
    const modifiedAt = Math.max(Date.now(), record.modifiedAt + 1);
    if (beforeCollect && data.collect) stampCollect(beforeCollect, data.collect, modifiedAt);
    const parsed = syncDataSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ToolFailure(issue ? `${issue.path.join('.')}: ${issue.message}` : 'invalid');
    }
    const body = JSON.stringify(parsed.data);
    if (new TextEncoder().encode(body).byteLength > SYNC_MAX_BYTES) {
      throw new ToolFailure('The cloud copy would exceed the size limit.');
    }
    const res = await env.DB.prepare(
      'UPDATE sync SET data = ?, modifiedAt = ? WHERE userId = ? AND modifiedAt = ?',
    )
      .bind(body, modifiedAt, userId, record.modifiedAt)
      .run();
    if (res.meta.changes === 1) return result;
  }
  throw new ToolFailure('The cloud copy changed while saving. Retry the call.');
}

function viewBookmark(bookmark: Bookmark) {
  const description = bookmark.description.slice(0, 500);
  return {
    id: bookmark.id,
    url: bookmark.url,
    title: bookmark.title,
    description,
    descriptionTruncated: bookmark.description.length > description.length,
    folderId: bookmark.folderId,
    source: bookmark.source,
  };
}

const folderFilter = z.string().min(1).max(128).nullable().optional();
const imageUrl = z.url({ protocol: /^https?$/ }).max(16_384);

const bookmarkInput = z.object({
  url: z.string().min(1).max(16_384),
  title: z.string().max(16_384).optional(),
  description: z.string().max(100_000).optional(),
  image: imageUrl.optional().describe('Page preview image URL, when known.'),
  favicon: imageUrl.optional().describe('Site icon URL, when known.'),
  folderId: z.string().min(1).max(128).nullable().optional(),
});

const organizeGroup = z.object({
  name: z.string().max(16_384).optional(),
  folderId: z.string().min(1).max(128).nullable(),
  ids: z.array(z.string().min(1).max(128)).max(50_000),
});

const groupInput = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(LIMITS.maxNameLength),
  color: z.enum(GROUP_COLORS),
  enabled: z.boolean(),
  patterns: z.array(z.string().max(LIMITS.maxPatternLength)).max(LIMITS.maxPatternsPerGroup),
});

function cleanPatterns(patterns: string[]): string[] {
  return [...new Set(patterns.map((pattern) => pattern.trim()).filter(Boolean))];
}

function requireFolder(collect: CollectData, folderId: string | null | undefined): void {
  if (folderId && !collect.folders.some((folder) => folder.id === folderId)) {
    throw new ToolFailure(`Unknown folder ${folderId}.`);
  }
}

type ToolResult = {
  content: [{ type: 'text'; text: string }];
  isError?: boolean;
};

async function runTool(userId: string, fn: () => Promise<unknown>): Promise<ToolResult> {
  if (!(await takeQuota(userId))) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Monthly limit of ${MCP_MONTHLY_LIMIT} tool calls reached. It resets at the start of the next UTC month.`,
      }],
    };
  }
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await fn()) }] };
  } catch (error) {
    if (!(error instanceof ToolFailure)) console.error(error);
    return {
      isError: true,
      content: [{ type: 'text', text: error instanceof ToolFailure ? error.message : 'internal' }],
    };
  }
}

function buildServer(userId: string): McpServer {
  const server = new McpServer({ name: 'tabyard', version: '1.0.0' });
  const synced = 'Reads and writes the Tabyard cloud copy. The extension picks it up on its next sync, within 30 minutes or when settings is opened. This cannot see or move tabs that are already open.';

  server.registerTool(
    'get_collection',
    {
      title: 'Get collection',
      description: `List saved pages and folders. ${synced} Omit folderId for everything; pass null for pages that are not in a folder. Descriptions are truncated to 500 characters.`,
      inputSchema: z.object({
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        folderId: folderFilter,
      }),
      annotations: { readOnlyHint: true },
    },
    (args) => runTool(userId, async () => {
      const record = await getSync(userId);
      const collect = record?.data.collect ?? emptyCollect();
      const offset = args.offset ?? 0;
      const limit = args.limit ?? 50;
      const matched = collect.bookmarks.filter((bookmark) => args.folderId === undefined || bookmark.folderId === args.folderId);
      return {
        synced: record !== null,
        folders: collect.folders.map((folder) => ({ id: folder.id, name: folder.name })),
        bookmarks: matched.slice(offset, offset + limit).map(viewBookmark),
        total: matched.length,
        offset,
        limit,
      };
    }),
  );

  server.registerTool(
    'add_bookmarks',
    {
      title: 'Add bookmarks',
      description: `Add up to 100 saved pages in one call. ${synced} The same URL updates the existing item instead of creating a duplicate. folderId is optional.`,
      inputSchema: z.object({ items: z.array(bookmarkInput).min(1).max(100) }),
    },
    ({ items }) => runTool(userId, () => writeSnapshot(userId, true, (data) => {
      const collect = ensureCollect(data);
      let added = 0;
      let updated = 0;
      const bookmarks: { id: string; url: string; folderId: string | null }[] = [];
      for (const item of items) {
        const url = normalizeUrl(item.url);
        requireFolder(collect, item.folderId);
        const existing = collect.bookmarks.find((bookmark) => bookmark.url === url);
        if (existing) {
          if (item.title !== undefined) existing.title = item.title;
          if (item.description !== undefined) existing.description = item.description;
          if (item.image !== undefined) existing.image = item.image;
          if (item.favicon !== undefined) existing.favicon = item.favicon;
          if (item.folderId !== undefined) existing.folderId = item.folderId;
          updated++;
          bookmarks.push({ id: existing.id, url, folderId: existing.folderId });
          continue;
        }
        const bookmark: Bookmark = {
          id: crypto.randomUUID(),
          url,
          title: item.title?.trim() || url,
          description: item.description ?? '',
          image: item.image ?? '',
          favicon: item.favicon ?? '',
          folderId: item.folderId ?? null,
          createdAt: Date.now(),
        };
        collect.bookmarks.unshift(bookmark);
        added++;
        bookmarks.push({ id: bookmark.id, url, folderId: bookmark.folderId });
      }
      return { added, updated, bookmarks };
    })),
  );

  server.registerTool(
    'organize_collection',
    {
      title: 'Organize collection',
      description: `File bookmarks into folders. ${synced} You decide the grouping; this only applies it. Set folderId to an existing folder, or null to create a folder named name. A bookmark listed twice is rejected. Unknown ids are skipped.`,
      inputSchema: z.object({ groups: z.array(organizeGroup).min(1).max(200) }),
    },
    ({ groups }) => runTool(userId, () => {
      const seen = new Set<string>();
      for (const group of groups) {
        for (const id of group.ids) {
          if (seen.has(id)) throw new ToolFailure(`Bookmark ${id} is listed in more than one group.`);
          seen.add(id);
        }
        if (!group.folderId && !group.name?.trim()) throw new ToolFailure('A new folder needs a name.');
      }
      return writeSnapshot(userId, true, (data) => {
        const collect = ensureCollect(data);
        const unknownIds: string[] = [];
        const folders: { id: string; name: string; created: boolean }[] = [];
        let moved = 0;
        for (const group of groups) {
          let folderId = group.folderId;
          if (!folderId) {
            const name = group.name!.trim();
            const existing = collect.folders.find((folder) => folder.name.toLowerCase() === name.toLowerCase());
            if (existing) {
              folderId = existing.id;
              folders.push({ id: existing.id, name: existing.name, created: false });
            } else {
              const folder = { id: crypto.randomUUID(), name };
              collect.folders.push(folder);
              folderId = folder.id;
              folders.push({ id: folder.id, name, created: true });
            }
          } else if (!collect.folders.some((folder) => folder.id === folderId)) {
            throw new ToolFailure(`Unknown folder ${folderId}.`);
          }
          const ids = new Set(group.ids);
          for (const bookmark of collect.bookmarks) {
            if (!ids.has(bookmark.id)) continue;
            ids.delete(bookmark.id);
            if (bookmark.folderId !== folderId) {
              bookmark.folderId = folderId;
              moved++;
            }
          }
          unknownIds.push(...ids);
        }
        return { moved, unknownIds, folders };
      });
    }),
  );

  server.registerTool(
    'list_tab_groups',
    {
      title: 'List tab group rules',
      description: `List the rules that tell the extension which Chrome tab group a page belongs in. ${synced} These are not the groups currently open in the browser.`,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () => runTool(userId, async () => {
      const record = await getSync(userId);
      return { synced: record !== null, groups: record?.data.groups ?? [] };
    }),
  );

  server.registerTool(
    'upsert_tab_groups',
    {
      title: 'Create or update tab group rules',
      description: `Create or update grouping rules. ${synced} Pass id to update that rule. Omit id to update a rule with the same name, or create one. A pattern is a domain (example.com, including subdomains), a host and path (example.com/docs), a keyword, or a /regex/. At most ${LIMITS.maxGroups} rules.`,
      inputSchema: z.object({ groups: z.array(groupInput).min(1).max(20) }),
    },
    ({ groups }) => runTool(userId, () => writeSnapshot(userId, false, (data) => {
      const saved: Group[] = [];
      for (const input of groups) {
        const name = input.name.trim();
        const patterns = cleanPatterns(input.patterns);
        const byName = data.groups.find((group) => group.name.trim().toLowerCase() === name.toLowerCase());
        const byId = input.id ? data.groups.find((group) => group.id === input.id) : undefined;
        if (byName && byName.id !== (input.id ?? byName.id)) throw new ToolFailure(`Another rule is already named ${name}.`);
        const target = byId ?? byName;
        if (!target && data.groups.length >= LIMITS.maxGroups) throw new ToolFailure(`At most ${LIMITS.maxGroups} rules.`);
        const group: Group = target ?? { id: input.id ?? crypto.randomUUID(), name, color: input.color, enabled: input.enabled, patterns };
        group.name = name;
        group.color = input.color;
        group.enabled = input.enabled;
        group.patterns = patterns;
        if (!target) data.groups.push(group);
        saved.push({ ...group, patterns: [...group.patterns] });
      }
      return { groups: saved };
    })),
  );

  server.registerTool(
    'delete_tab_groups',
    {
      title: 'Delete tab group rules',
      description: `Delete grouping rules by id. ${synced} Open Chrome tab groups stay where they are; the extension stops applying the deleted rules after it syncs.`,
      inputSchema: z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(50) }),
      annotations: { destructiveHint: true },
    },
    ({ ids }) => runTool(userId, () => {
      const remove = new Set(ids);
      return writeSnapshot(userId, false, (data) => {
        const before = new Set(data.groups.map((group) => group.id));
        data.groups = data.groups.filter((group) => !remove.has(group.id));
        const removed = ids.filter((id) => before.has(id));
        return { removed, missing: ids.filter((id) => !before.has(id)) };
      });
    }),
  );

  return server;
}

export function handleMcp(request: Request, userId: string): Promise<Response> {
  const handler = createMcpHandler(() => buildServer(userId), { responseMode: 'json' });
  return handler.fetch(request).finally(() => handler.close());
}
