// Web session storage — localStorage (persists across reloads/tabs). Kept out of the
// native bundle by the .ts/.web.ts split. Guarded so SSR/non-DOM contexts don't throw.
import type { AuthStorage } from '@bygsmart/api-client';

const ls = (): Storage | null => (typeof localStorage !== 'undefined' ? localStorage : null);

export const sessionStorage: AuthStorage = {
  getItem: (key) => ls()?.getItem(key) ?? null,
  setItem: (key, value) => {
    ls()?.setItem(key, value);
  },
  removeItem: (key) => {
    ls()?.removeItem(key);
  },
};
