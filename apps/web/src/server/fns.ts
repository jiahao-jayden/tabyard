import { createServerFn } from '@tanstack/react-start';
import { getPack, listPacks } from './packs';

export const fetchPacks = createServerFn({ method: 'GET' })
  .validator((q: string) => q)
  .handler(({ data }) => listPacks(data));

export const fetchPack = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(({ data }) => getPack(data));
