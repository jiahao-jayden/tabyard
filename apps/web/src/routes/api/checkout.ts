import { createFileRoute } from '@tanstack/react-router';
import { createCheckoutUrl, getUser } from '~/server/billing';

export const Route = createFileRoute('/api/checkout')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { origin, pathname, search, searchParams } = new URL(request.url);
        const user = await getUser(request.headers);
        if (!user) return Response.redirect(`${origin}/login?redirect=${encodeURIComponent(pathname + search)}`, 302);
        return Response.redirect(await createCheckoutUrl(user, origin, searchParams.get('code') ?? undefined), 303);
      },
    },
  },
});
