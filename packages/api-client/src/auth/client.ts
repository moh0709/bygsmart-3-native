// The Supabase auth client factory. Universal: the STORAGE adapter is injected by the
// caller (the Metro app supplies AsyncStorage on native / localStorage on web; the Vite
// admin supplies localStorage) so this package never imports a platform-native module
// and stays buildable under both bundlers. RLS remains the sole authorisation boundary;
// this client only proves identity — it never invents authorisation.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Minimal async key-value store Supabase persists the session in. */
export interface AuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface AuthClientConfig {
  /** Supabase project URL (local dev: http://127.0.0.1:54321). */
  url: string;
  anonKey: string;
  /** Where to persist the session. Omit → in-memory (session lost on restart). */
  storage?: AuthStorage;
}

export function createAuthClient(config: AuthClientConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Password login only — no magic-link/OAuth URL parsing (and safe on native).
      detectSessionInUrl: false,
      ...(config.storage ? { storage: config.storage } : {}),
    },
  });
}
