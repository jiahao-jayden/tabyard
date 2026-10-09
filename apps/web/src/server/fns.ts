import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from './auth';
import { z } from 'zod';
import {
  createDiscount,
  createGift,
  deleteDiscount,
  deleteGift,
  getPrice,
  isAdmin,
  isPro,
  listDiscounts,
  listGifts,
  listOrders,
  redeemGift,
} from './billing';
import { normalizeCode } from '@tabyard/shared';
import { GROUP_COLORS } from '@tabyard/shared';
import { getPack, listOfficialPacks, listPacks, updateOfficialPack } from './packs';

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

/** Creem 不可用时返回 null，价格页照常渲染，结账页仍会展示价格 */
export const fetchPrice = createServerFn({ method: 'GET' }).handler(() =>
  getPrice().catch((e) => {
    console.error(e);
    return null;
  }),
);

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user || !isAdmin(session.user.email)) throw new Error('forbidden');
}

export const fetchAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session?.user || !isAdmin(session.user.email)) return null;
  const [orders, discounts, packs, gifts] = await Promise.all([
    listOrders(),
    listDiscounts(),
    listOfficialPacks(),
    listGifts(),
  ]);
  return { orders, discounts, packs, gifts };
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

export const addGift = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAdmin();
  return createGift();
});

export const removeGift = createServerFn({ method: 'POST' })
  .validator((id: string) => z.string().min(1).parse(id))
  .handler(async ({ data }) => {
    await requireAdmin();
    await deleteGift(data);
  });

export const redeemGiftCode = createServerFn({ method: 'POST' })
  .validator((code: string): string => {
    const c = normalizeCode(code);
    if (!c) throw new Error('invalid code');
    return c;
  })
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() });
    if (!session?.user) throw new Error('unauthorized');
    return redeemGift(session.user.id, data);
  });

const officialPackSchema = z.object({
  code: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim(),
  groups: z.array(z.object({
    name: z.string().trim().min(1),
    color: z.enum(GROUP_COLORS),
    patterns: z.array(z.string()),
  })).min(1),
});

export const saveOfficialPack = createServerFn({ method: 'POST' })
  .validator((d: unknown) => officialPackSchema.parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    await updateOfficialPack(data);
  });
