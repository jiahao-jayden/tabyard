import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from './auth';
import { z } from 'zod';
import { createDiscount, deleteDiscount, isAdmin, isPro, listDiscounts, listOrders } from './billing';
import { getPack, listPacks } from './packs';

export const fetchPacks = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(({ data }) => listPacks(data));

export const fetchPack = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(({ data }) => getPack(data));

export const fetchSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user) return null;
  const { name, image, id } = session.user;
  return { name, image: image ?? null, pro: await isPro(id) };
});

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user || !isAdmin(session.user.email)) throw new Error('forbidden');
}

export const fetchAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user || !isAdmin(session.user.email)) return null;
  const [orders, discounts] = await Promise.all([listOrders(), listDiscounts()]);
  return { orders, discounts };
});

const newDiscountSchema = z.object({
  name: z.string().trim().min(1).max(60),
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  maxRedemptions: z.number().int().positive().optional(),
  expiryDate: z.string().datetime().optional(),
});

export const addDiscount = createServerFn({ method: 'POST' })
  .validator((d: unknown) => newDiscountSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await createDiscount(data);
  });

export const removeDiscount = createServerFn({ method: 'POST' })
  .validator((id: string) => z.string().min(1).parse(id))
  .handler(async ({ data }) => {
    await requireAdmin();
    await deleteDiscount(data);
  });
