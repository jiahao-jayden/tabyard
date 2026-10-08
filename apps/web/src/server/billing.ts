import { env } from 'cloudflare:workers';
import { auth } from './auth';

export function getUser(headers: Headers) {
  return auth.api.getSession({ headers }).then((s) => s?.user ?? null);
}

export async function isPro(userId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 FROM pro WHERE userId = ?').bind(userId).first();
  return row !== null;
}

export async function createCheckoutUrl(user: { id: string; email: string }, origin: string) {
  const res = await fetch(`${env.CREEM_API_URL}/v1/checkouts`, {
    method: 'POST',
    headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      product_id: env.CREEM_PRODUCT_ID,
      request_id: user.id,
      success_url: `${origin}/?paid=1`,
      customer: { email: user.email },
    }),
  });
  if (!res.ok) throw new Error(`creem checkout failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { checkout_url: string }).checkout_url;
}

async function verifySignature(body: string, signature: string): Promise<boolean> {
  const bytes = signature.match(/^([0-9a-f]{2})+$/i)?.[0].match(/../g);
  if (!bytes) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.CREEM_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, new Uint8Array(bytes.map((h) => parseInt(h, 16))), new TextEncoder().encode(body));
}

interface CheckoutCompleted {
  eventType: string;
  object: { request_id?: string; order?: { id: string; status: string } };
}

export async function handleWebhook(request: Request): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('creem-signature');
  if (!signature || !(await verifySignature(body, signature))) {
    return new Response('invalid signature', { status: 400 });
  }
  const event = JSON.parse(body) as CheckoutCompleted;
  const { request_id: userId, order } = event.object;
  if (event.eventType === 'checkout.completed' && userId && order?.status === 'paid') {
    await env.DB.prepare('INSERT OR IGNORE INTO pro (userId, orderId, createdAt) VALUES (?, ?, ?)')
      .bind(userId, order.id, Date.now())
      .run();
  }
  return new Response('ok');
}
