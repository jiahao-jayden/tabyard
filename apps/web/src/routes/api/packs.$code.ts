import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '~/server/http';
import { getPack } from '~/server/packs';

export const Route = createFileRoute('/api/packs/$code')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const detail = await getPack(params.code);
          if (!detail) return Response.json({ error: 'not_found' }, { status: 404 });
          return Response.json(detail);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
