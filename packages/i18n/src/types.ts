// Type-safe keys: augment i18next's CustomTypeOptions so t('nav.home')
// autocompletes and a typo like t('nav.hom') is a compile error across every
// consumer (react-i18next reads i18next's CustomTypeOptions, so this covers both
// the instance's t() and the useTranslation() hook).
import 'i18next';
import type { DaResources } from './resources/da';
import type { DEFAULT_NS } from './config';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NS;
    resources: { translation: DaResources };
    returnNull: false;
  }
}
