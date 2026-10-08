import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '~/server/http';
import { getSync, putSync, requireProUser } from '~/server/sync';

export const Route = createFileRoute('/api/sync')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const userId = await requireProUser(request.headers);
          return Response.json({ record: await getSync(userId) });
        } catch (e) {
          return errorResponse(e);
        }
      },
      PUT: async ({ request }) => {
        try {
          const userId = await requireProUser(request.headers);
          const { conflict } = await putSync(userId, await request.text());
          return conflict
            ? Response.json({ error: 'conflict', record: conflict }, { status: 409 })
            : Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
