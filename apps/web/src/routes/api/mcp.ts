import { createFileRoute } from '@tanstack/react-router';
import { authenticateMcp, handleMcp } from '~/server/mcp';

async function handle(request: Request): Promise<Response> {
  const userId = await authenticateMcp(request);
  if (typeof userId !== 'string') return userId;
  return handleMcp(request, userId);
}

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
});
