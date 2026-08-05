import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from './env';

/**
 * A request-scoped client bound to the caller's JWT. Every query runs THROUGH
 * PostgREST under the caller's RLS — the server never invents authorisation
 * (the boundary is RLS). DEFINER RPCs called on this client see auth.uid().
 */
export function userClient(env: Env, accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client for server-mediated writes (idempotency store, purge). Bypasses RLS. */
export function serviceClient(env: Env): SupabaseClient {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
