// i18next instance factory + the shared app singleton.
//
// da-DK only (D-02): language and fallback are both fixed to 'da', so there is
// no locale detection — that dependency (and the DOM it needs) never enters the
// universal bundle. Resources are inline, so init adds them synchronously and
// t() works the moment the instance is created (module scope + node tests, no
// renderer required).

import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { da } from './resources/da';

export const DEFAULT_NS = 'translation';
export const SUPPORTED_LANGUAGES = ['da'] as const;

/** Build a fresh, fully-initialised i18next instance (used by the app + tests). */
export const createI18n = (): I18nInstance => {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    lng: 'da',
    fallbackLng: 'da',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: DEFAULT_NS,
    ns: [DEFAULT_NS],
    resources: { da: { translation: da } },
    interpolation: { escapeValue: false }, // RN/RNW escape at render, not here
    returnNull: false,
  });
  return instance;
};

/** The shared instance the app's I18nProvider binds. */
export const i18n = createI18n();
