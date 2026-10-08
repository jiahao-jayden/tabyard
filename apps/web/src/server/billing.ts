import { env } from 'cloudflare:workers';
import { auth } from './auth';

export function getUser(headers: Headers) {
  return auth.api.getSession({ headers }).then((s) => s?.user ?? null);
}

export async function isPro(userId: string): Promise<boolean> {
  const row = await env.DB.prepare('SELECT 1 FROM pro WHERE userId = ?').bind(userId).first();
  return row !== null;
}

export async function createCheckoutUrl(user: { id: string; email: string }, origin: string, discountCode?: string) {
  const res = await fetch(`${env.CREEM_API_URL}/v1/checkouts`, {
    method: 'POST',
    headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      product_id: env.CREEM_PRODUCT_ID,
      request_id: user.id,
      discount_code: discountCode,
      success_url: `${origin}/?paid=1`,
      customer: { email: user.email },
    }),
  });
  if (!res.ok) throw new Error(`creem checkout failed: ${res.status} ${await res.text()}`);
  const { id, checkout_url } = (await res.json()) as { id: string; checkout_url: string };
  await env.DB.prepare('INSERT INTO checkout (id, userId, createdAt) VALUES (?, ?, ?)')
    .bind(id, user.id, Date.now())
    .run();
  return checkout_url;
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

export interface OrderRow {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  paid: boolean;
}

export function isAdmin(email: string): boolean {
  return env.ADMIN_EMAILS.split(',').some((e) => e.trim().toLowerCase() === email.toLowerCase());
}

export async function listOrders(): Promise<OrderRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, u.name, u.email, c.createdAt, EXISTS (SELECT 1 FROM pro p WHERE p.userId = c.userId) AS paid
     FROM checkout c JOIN user u ON u.id = c.userId
     ORDER BY c.createdAt DESC LIMIT 500`,
  ).all<Omit<OrderRow, 'paid'> & { paid: number }>();
  return results.map((r) => ({ ...r, paid: r.paid === 1 }));
}

export interface Discount {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  percentage?: number;
  amount?: number;
  maxRedemptions?: number;
  redeemCount: number;
  expiryDate?: string;
}

async function creem<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.CREEM_API_URL}${path}`, {
    ...init,
    headers: { 'x-api-key': env.CREEM_API_KEY, 'content-type': 'application/json' },
  });
  if (!res.ok) throw new Error(`creem ${path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function listDiscounts(): Promise<Discount[]> {
  const { items } = await creem<{ items: Record<string, any>[] }>('/v1/discounts/search?page_size=100');
  return items
    .filter((d) => d.status === 'active')
    .map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      type: d.type,
      percentage: d.percentage ?? undefined,
      amount: d.amount ?? undefined,
      maxRedemptions: d.max_redemptions ?? undefined,
      redeemCount: d.redeem_count ?? 0,
      expiryDate: d.expiry_date ?? undefined,
    }));
}

export interface NewDiscount {
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxRedemptions?: number;
  expiryDate?: string;
}

export async function createDiscount(d: NewDiscount): Promise<void> {
  await creem('/v1/discounts', {
    method: 'POST',
    body: JSON.stringify({
      name: d.name,
      code: d.code,
      type: d.type,
      ...(d.type === 'percentage' ? { percentage: d.value } : { amount: Math.round(d.value * 100), currency: 'USD' }),
      duration: 'once',
      applies_to_products: [env.CREEM_PRODUCT_ID],
      max_redemptions: d.maxRedemptions,
      expiry_date: d.expiryDate,
    }),
  });
}

export async function deleteDiscount(id: string): Promise<void> {
  await creem(`/v1/discounts/${encodeURIComponent(id)}/delete`, { method: 'DELETE' });
}
