import { createFileRoute } from '@tanstack/react-router';
import { errorResponse } from '~/server/http';
import { createMcpKey, getMcpKeyStatus, revokeMcpKey } from '~/server/mcp';
import { requireProUser } from '~/server/sync';

export const Route = createFileRoute('/api/mcp-key')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return Response.json(await getMcpKeyStatus(await requireProUser(request.headers)));
        } catch (e) {
          return errorResponse(e);
        }
      },
      POST: async ({ request }) => {
        try {
          return Response.json(await createMcpKey(await requireProUser(request.headers)));
        } catch (e) {
          return errorResponse(e);
        }
      },
      DELETE: async ({ request }) => {
        try {
          await revokeMcpKey(await requireProUser(request.headers));
          return Response.json({ ok: true });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
