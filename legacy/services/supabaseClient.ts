import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Read from Vite's import.meta.env (VITE_ prefix required)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[SupabaseClient] Missing environment variables!\n' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.\n' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  );
}

// Provide safe fallbacks so the app doesn't crash on misconfiguration.
// It will fail gracefully on API calls instead of throwing a URL construction error.
const validUrl =
  supabaseUrl && supabaseUrl.startsWith('https://') ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-key';

export const isSupabaseConfigured =
  !!supabaseUrl && supabaseUrl.startsWith('https://') &&
  !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key';

// Warn whenever either placeholder fallback is actually in use — covers both
// missing variables and a URL that is present but not a valid https:// address.
if (validUrl === 'https://placeholder.supabase.co' || validKey === 'placeholder-key') {
  console.warn(
    '[SupabaseClient] Running with placeholder fallback credentials — all Supabase API calls will fail.\n' +
    'Copy .env.example to .env and supply real VITE_SUPABASE_URL (must start with https://) ' +
    'and VITE_SUPABASE_ANON_KEY values.'
  );
}

export const supabase = createClient<Database>(validUrl, validKey, {
  auth: {
    // Persist the session in localStorage so the user stays logged in across page refreshes
    persistSession: true,
    // Auto-refresh the JWT token before it expires
    autoRefreshToken: true,
    // Detect the session from the URL (for magic links and OAuth callbacks)
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'x-application-name': 'bygsmart-2.0',
    },
  },
});

export default supabase;
