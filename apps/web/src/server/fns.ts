import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from './auth';
import { isPro } from './billing';
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
