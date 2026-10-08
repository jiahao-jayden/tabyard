import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '~/server/http';
import { listPacks } from '~/server/packs';

export const Route = createFileRoute('/api/packs')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const official = (await listPacks('')).filter((p) => p.official);
          return Response.json(official.map(({ code, name, patternCount }) => ({ code, name, patternCount })));
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
