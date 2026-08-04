const PRODUCTION_REQUIRED_ENV = [
  'ALLOWED_ORIGIN',
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

// Stripe runs in dual test/live mode: the server needs at least ONE valid secret
// key among STRIPE_SECRET_KEY (legacy) / STRIPE_SECRET_KEY_TEST / _LIVE. The
// webhook now lives on a Supabase edge function, so STRIPE_WEBHOOK_SECRET is no
// longer required on the Node server.
const isValidStripeSecret = (value = '') => {
  const trimmed = String(value || '').trim();
  return (trimmed.startsWith('sk_live_') || trimmed.startsWith('sk_test_')) && trimmed.length >= 20;
};

const hasValidStripeSecret = (env = process.env) =>
  isValidStripeSecret(env.STRIPE_SECRET_KEY) ||
  isValidStripeSecret(env.STRIPE_SECRET_KEY_TEST) ||
  isValidStripeSecret(env.STRIPE_SECRET_KEY_LIVE);

const PLACEHOLDER_PATTERNS = [/^your-/i, /placeholder/i, /^changeme$/i, /^todo$/i];

export const getServerEnvOptions = (env = process.env) => ({
  path: ['.env', '.env.local'],
  override: env.NODE_ENV !== 'production',
});

const hasPlaceholderValue = (value = '') =>
  PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));

const decodeJwtPayload = (token = '') => {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const isInvalidProductionValue = (key, value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed || hasPlaceholderValue(trimmed)) return true;

  if (key === 'ALLOWED_ORIGIN') {
    const origins = parseAllowedOrigins(trimmed);
    if (origins.length === 0) return true;

    return origins.some((origin) => {
      try {
        return new URL(origin).protocol !== 'https:';
      } catch {
        return true;
      }
    });
  }

  if (key === 'GEMINI_API_KEY') return trimmed.length < 30;
  if (key === 'SUPABASE_SERVICE_ROLE_KEY') return trimmed.length < 100 || !trimmed.includes('.');
  if (key === 'STRIPE_SECRET_KEY') return (!trimmed.startsWith('sk_live_') && !trimmed.startsWith('sk_test_')) || trimmed.length < 20;
  if (key === 'STRIPE_WEBHOOK_SECRET') return !trimmed.startsWith('whsec_') || trimmed.length < 20;
  if (key === 'VAPID_PUBLIC_KEY') return trimmed.length < 40;
  if (key === 'VAPID_PRIVATE_KEY') return trimmed.length < 40;

  return false;
};

export const parseAllowedOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export const hasUsableSupabaseServiceConfig = (env = process.env) => {
  const url = String(env.SUPABASE_URL || '').trim();
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !key || hasPlaceholderValue(key)) return false;

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
    const projectRef = parsedUrl.hostname.split('.')[0];
    const payload = decodeJwtPayload(key);
    if (payload?.ref && payload.ref !== projectRef) return false;
  } catch {
    return false;
  }

  return key.length >= 100 && key.includes('.');
};

export const getMissingRequiredEnv = (env = process.env) => {
  if (env.NODE_ENV !== 'production') return [];
  const missing = PRODUCTION_REQUIRED_ENV.filter((key) => isInvalidProductionValue(key, env[key]));
  if (!hasValidStripeSecret(env)) missing.push('STRIPE_SECRET_KEY');
  return missing;
};

export const assertRequiredEnv = (env = process.env) => {
  const missing = getMissingRequiredEnv(env);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
};
