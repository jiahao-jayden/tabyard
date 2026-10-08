import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '~/server/http';
import { publishPack } from '~/server/packs';

export const Route = createFileRoute('/api/publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
          return Response.json(await publishPack(await request.text(), ip));
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
