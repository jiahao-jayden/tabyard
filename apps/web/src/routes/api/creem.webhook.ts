import { createFileRoute } from '@tanstack/react-router';
import { handleWebhook } from '~/server/billing';

export const Route = createFileRoute('/api/creem/webhook')({
  server: { handlers: { POST: ({ request }) => handleWebhook(request) } },
});
