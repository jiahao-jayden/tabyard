import { HttpError } from './packs';

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.code, message: e.message }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: 'internal' }, { status: 500 });
}
