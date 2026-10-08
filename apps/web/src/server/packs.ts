import { env } from 'cloudflare:workers';
import {
  CODE_ALPHABET,
  GENERATED_CODE_LENGTH,
  LIMITS,
  normalizeCode,
  validatePack,
  type GroupColor,
  type RulePack,
} from '@tabyard/shared';

export interface PackSummary {
  code: string;
  name: string;
  author: string;
  description: string;
  version: number;
  groupCount: number;
  patternCount: number;
  official: boolean;
  updatedAt: number;
}

export interface PackDetail extends PackSummary {
  md5: string;
  pack: RulePack;
}

interface PackRow {
  code: string;
  name: string;
  author: string;
  description: string;
  version: number;
  md5: string;
  content: string;
  group_count: number;
  pattern_count: number;
  edit_token_hash: string | null;
  official: number;
  updated_at: number;
}

const SUMMARY_COLUMNS =
  'code, name, author, description, version, group_count, pattern_count, official, updated_at';

function toSummary(r: PackRow): PackSummary {
  return {
    code: r.code,
    name: r.name,
    author: r.author,
    description: r.description,
    version: r.version,
    groupCount: r.group_count,
    patternCount: r.pattern_count,
    official: r.official === 1,
    updatedAt: r.updated_at,
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export async function listPacks(query: string): Promise<PackSummary[]> {
  const q = query.trim().slice(0, 60);
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const stmt = q
    ? env.DB.prepare(
        `SELECT ${SUMMARY_COLUMNS} FROM packs
         WHERE name LIKE ?1 ESCAPE '\\' OR author LIKE ?1 ESCAPE '\\' OR description LIKE ?1 ESCAPE '\\'
         ORDER BY official DESC, updated_at DESC LIMIT 60`,
      ).bind(like)
    : env.DB.prepare(
        `SELECT ${SUMMARY_COLUMNS} FROM packs ORDER BY official DESC, updated_at DESC LIMIT 60`,
      );
  const { results } = await stmt.all<PackRow>();
  return results.map(toSummary);
}

export async function getPack(input: string): Promise<PackDetail | null> {
  const code = normalizeCode(input);
  if (!code) return null;
  const row = await env.DB.prepare('SELECT * FROM packs WHERE code = ?').bind(code).first<PackRow>();
  if (!row) return null;
  return { ...toSummary(row), md5: row.md5, pack: JSON.parse(row.content) as RulePack };
}

async function digestHex(algorithm: 'MD5' | 'SHA-256', text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algorithm, new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(GENERATED_CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

function randomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface PublishResult {
  code: string;
  version: number;
  md5: string;
  editToken?: string;
}

export async function publishPack(
  rawBody: string,
  clientIp: string,
): Promise<PublishResult> {
  if (rawBody.length > LIMITS.maxPackBytes) throw new HttpError(413, 'too_large');

  const { success } = await env.PUBLISH_LIMITER.limit({ key: clientIp });
  if (!success) throw new HttpError(429, 'rate_limited');

  let body: { pack?: unknown; code?: unknown; editToken?: unknown };
  let pack: RulePack;
  try {
    body = JSON.parse(rawBody);
    pack = validatePack(body.pack);
  } catch (e) {
    throw new HttpError(400, 'invalid_pack', (e as Error).message);
  }

  const content = JSON.stringify(pack);
  const md5 = await digestHex('MD5', content);
  const groupCount = pack.groups.length;
  const patternCount = pack.groups.reduce((n, g) => n + g.patterns.length, 0);
  const now = Date.now();
  const fields = {
    name: pack.meta.name,
    author: pack.meta.author ?? '',
    description: pack.meta.description ?? '',
  };

  if (body.code !== undefined) {
    const code = typeof body.code === 'string' ? normalizeCode(body.code) : null;
    if (!code || typeof body.editToken !== 'string') throw new HttpError(400, 'invalid_request');
    const row = await env.DB.prepare('SELECT version, edit_token_hash FROM packs WHERE code = ?')
      .bind(code)
      .first<Pick<PackRow, 'version' | 'edit_token_hash'>>();
    if (!row) throw new HttpError(404, 'not_found');
    if (!row.edit_token_hash || row.edit_token_hash !== (await digestHex('SHA-256', body.editToken))) {
      throw new HttpError(403, 'forbidden');
    }
    const version = row.version + 1;
    const res = await env.DB.prepare(
      `UPDATE packs SET name=?, author=?, description=?, version=?, md5=?, content=?,
         group_count=?, pattern_count=?, updated_at=?
       WHERE code=? AND version=?`,
    )
      .bind(
        fields.name, fields.author, fields.description, version, md5, content,
        groupCount, patternCount, now, code, row.version,
      )
      .run();
    if (res.meta.changes !== 1) throw new HttpError(409, 'conflict');
    return { code, version, md5 };
  }

  const editToken = randomToken();
  const editTokenHash = await digestHex('SHA-256', editToken);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO packs
         (code, name, author, description, version, md5, content, group_count, pattern_count,
          edit_token_hash, official, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
      .bind(
        code, fields.name, fields.author, fields.description, md5, content,
        groupCount, patternCount, editTokenHash, now, now,
      )
      .run();
    if (res.meta.changes === 1) return { code, version: 1, md5, editToken };
  }
  throw new HttpError(500, 'code_generation_failed');
}

export interface OfficialPackEdit {
  code: string;
  name: string;
  color: GroupColor;
  patterns: string[];
}

/** 官方包都是单分组：包名即分组名 */
export async function listOfficialPacks(): Promise<OfficialPackEdit[]> {
  const { results } = await env.DB.prepare(
    'SELECT code, content FROM packs WHERE official = 1 ORDER BY updated_at DESC',
  ).all<Pick<PackRow, 'code' | 'content'>>();
  return results.map((r) => {
    const group = (JSON.parse(r.content) as RulePack).groups[0]!;
    return { code: r.code, name: group.name, color: group.color, patterns: group.patterns };
  });
}

export async function updateOfficialPack(edit: OfficialPackEdit): Promise<void> {
  const row = await env.DB.prepare('SELECT content, version FROM packs WHERE code = ? AND official = 1')
    .bind(edit.code)
    .first<Pick<PackRow, 'content' | 'version'>>();
  if (!row) throw new HttpError(404, 'not_found');

  const old = JSON.parse(row.content) as RulePack;
  const pack = validatePack({
    ...old,
    meta: { ...old.meta, name: edit.name },
    groups: [{ ...old.groups[0], name: edit.name, color: edit.color, patterns: edit.patterns }],
  });
  const content = JSON.stringify(pack);
  await env.DB.prepare(
    `UPDATE packs SET name=?, version=?, md5=?, content=?, pattern_count=?, updated_at=? WHERE code=?`,
  )
    .bind(
      pack.meta.name, row.version + 1, await digestHex('MD5', content), content,
      pack.groups[0]!.patterns.length, Date.now(), edit.code,
    )
    .run();
}
