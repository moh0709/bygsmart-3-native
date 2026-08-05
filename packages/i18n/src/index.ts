// @bygsmart/i18n — the app's i18n layer. da-DK only (D-02).
//
// Importing this module registers the type augmentation (./types) so t() keys are
// checked everywhere the package is used.
import './types';

export { i18n, createI18n, DEFAULT_NS, SUPPORTED_LANGUAGES } from './config';
export { da } from './resources/da';
export type { DaResources } from './resources/da';
export { I18nProvider } from './provider';

// Re-export the React bindings so consumers depend on one package, not on
// react-i18next directly (keeps the i18n stack swappable behind this barrel).
export { useTranslation, Trans } from 'react-i18next';
