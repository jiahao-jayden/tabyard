import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import zhCN from '@/locales/zh-CN.json';
import { loadLanguagePref, resolveLanguage, saveLanguagePref, type LanguagePref } from './rules';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof zhCN };
  }
}

export async function initI18n(): Promise<void> {
  await i18n.use(initReactI18next).init({
    resources: { 'zh-CN': { translation: zhCN }, en: { translation: en } },
    lng: resolveLanguage(await loadLanguagePref()),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export async function setLanguagePref(pref: LanguagePref): Promise<void> {
  await saveLanguagePref(pref);
  await i18n.changeLanguage(resolveLanguage(pref));
}
