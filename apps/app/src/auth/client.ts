// The app's Supabase auth client — created once from env, with the platform session
// store injected. Null when Supabase isn't configured (offline-first dev), which the
// app-shell treats as "no login required".
import { createAuthClient } from '@bygsmart/api-client';
import { sessionStorage } from './sessionStorage';

function readSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

const cfg = readSupabaseConfig();

/** The auth client, or null when no Supabase backend is configured. */
export const authClient = cfg ? createAuthClient({ ...cfg, storage: sessionStorage }) : null;
