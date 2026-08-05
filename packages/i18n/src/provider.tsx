// I18nProvider — binds the shared instance so every useTranslation() below it
// resolves against the da-DK catalog. Universal: I18nextProvider is renderer-
// agnostic (RN, RNW, DOM).
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { i18n } from './config';

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
