export interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  /** Supabase project JWT secret — verifies the caller's token to read its `sub`. */
  jwtSecret: string;
  port: number;
}

/** Load config from the environment. Throws if the Supabase wiring is missing. */
export function loadEnv(): Env {
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';
  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }
  return { supabaseUrl, anonKey, serviceRoleKey, jwtSecret, port: Number(process.env.PORT ?? 3100) };
}
