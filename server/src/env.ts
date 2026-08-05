export interface Env {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  /** Supabase project JWT secret — verifies the caller's token to read its `sub`. */
  jwtSecret: string;
  /** Web push (VAPID). Web push is enabled only when the key pair is present. */
  vapidSubject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  /** Optional Expo push access token (for native APNs/FCM via Expo). */
  expoAccessToken: string;
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
  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    jwtSecret,
    vapidSubject: process.env.VAPID_SUBJECT ?? '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
    port: Number(process.env.PORT ?? 3100),
  };
}
