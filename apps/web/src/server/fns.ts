import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from './auth';
import { getPack, listPacks } from './packs';

export const fetchPacks = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(({ data }) => listPacks(data));

export const fetchPack = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(({ data }) => getPack(data));

export const fetchSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session?.user ? { name: session.user.name, image: session.user.image ?? null } : null;
});
