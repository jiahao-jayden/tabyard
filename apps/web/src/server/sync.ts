import { env } from 'cloudflare:workers';
import { SYNC_MAX_BYTES, syncPutSchema, type SyncRecord } from '@tabyard/shared';
import { getUser, isPro } from './billing';
import { HttpError } from './packs';

export async function requireProUser(headers: Headers): Promise<string> {
  const user = await getUser(headers);
  if (!user) throw new HttpError(401, 'unauthorized');
  if (!(await isPro(user.id))) throw new HttpError(403, 'pro_required');
  return user.id;
}

export async function getSync(userId: string): Promise<SyncRecord | null> {
  const row = await env.DB.prepare('SELECT data, modifiedAt FROM sync WHERE userId = ?')
    .bind(userId)
    .first<{ data: string; modifiedAt: number }>();
  return row ? { data: JSON.parse(row.data), modifiedAt: row.modifiedAt } : null;
}

/** 仅当传入的 modifiedAt 比已存的新才写入；否则返回当前云端记录 */
export async function putSync(userId: string, rawBody: string): Promise<{ conflict: SyncRecord | null }> {
  if (new TextEncoder().encode(rawBody).byteLength > SYNC_MAX_BYTES) throw new HttpError(413, 'too_large');
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, 'invalid_request');
  }
  const parsed = syncPutSchema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, 'invalid_request');

  const { data, modifiedAt } = parsed.data;
  const res = await env.DB.prepare(
    `INSERT INTO sync (userId, data, modifiedAt) VALUES (?, ?, ?)
     ON CONFLICT (userId) DO UPDATE SET
       data = CASE
         WHEN json_type(excluded.data, '$.collect') IS NULL AND json_type(sync.data, '$.collect') IS NOT NULL
         THEN json_set(excluded.data, '$.collect', json_extract(sync.data, '$.collect'))
         ELSE excluded.data
       END,
       modifiedAt = excluded.modifiedAt
     WHERE sync.modifiedAt < excluded.modifiedAt`,
  )
    .bind(userId, JSON.stringify(data), modifiedAt)
    .run();
  return { conflict: res.meta.changes === 0 ? await getSync(userId) : null };
}
