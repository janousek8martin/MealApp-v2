import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import cs from './locales/cs.json';
import en from './locales/en.json';

export const resources = {
  cs: { translation: cs },
  en: { translation: en },
} as const;

export type AppLanguage = keyof typeof resources;

const deviceLanguage = getLocales()[0]?.languageCode;

i18n.use(initReactI18next).init({
  resources,
  // Czech-first app; English only when the device explicitly prefers it.
  lng: deviceLanguage === 'en' ? 'en' : 'cs',
  fallbackLng: 'cs',
  interpolation: { escapeValue: false },
});

export default i18n;
