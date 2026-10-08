import { createFileRoute } from '@tanstack/react-router';
import { getUser, isPro } from '~/server/billing';

export const Route = createFileRoute('/api/plan')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getUser(request.headers);
        return Response.json({ plan: user && (await isPro(user.id)) ? 'pro' : 'free' });
      },
    },
  },
});
