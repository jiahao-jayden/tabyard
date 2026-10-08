import i18n from 'i18next';
import { ApiError } from '@/utils/api';

export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return (e as Error).message;
  const key = i18n.exists(`errors.${e.code}`) ? e.code : 'internal';
  return i18n.t(`errors.${key}` as 'errors.internal', { msg: e.message });
}
