import { describe, expect, test } from 'vitest';
import {
  getMissingRequiredEnv,
  getServerEnvOptions,
  hasUsableSupabaseServiceConfig,
  parseAllowedOrigins,
} from './env.js';

describe('server environment helpers', () => {
  test('parses comma separated CORS origins', () => {
    expect(parseAllowedOrigins(' https://bygsmart.dk,https://www.bygsmart.dk ')).toEqual([
      'https://bygsmart.dk',
      'https://www.bygsmart.dk',
    ]);
  });

  test('requires production secrets for privileged services', () => {
    const missing = getMissingRequiredEnv({
      NODE_ENV: 'production',
      ALLOWED_ORIGIN: 'https://bygsmart.dk',
      GEMINI_API_KEY: '',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: `${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`,
      STRIPE_SECRET_KEY: `sk_live_${'a'.repeat(32)}`,
      STRIPE_WEBHOOK_SECRET: `whsec_${'b'.repeat(32)}`,
      VAPID_PUBLIC_KEY: 'B'.repeat(88),
      VAPID_PRIVATE_KEY: 'c'.repeat(43),
    });

    expect(missing).toContain('GEMINI_API_KEY');
    expect(missing).not.toContain('ALLOWED_ORIGIN');
  });

  test('rejects placeholder and test credentials in production', () => {
    const missing = getMissingRequiredEnv({
      NODE_ENV: 'production',
      ALLOWED_ORIGIN: 'https://bygsmart.com,http://bygsmart.com',
      GEMINI_API_KEY: 'your-gemini-api-key-here',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
    });

    expect(missing).toEqual(
      expect.arrayContaining([
        'ALLOWED_ORIGIN',
        'GEMINI_API_KEY',
        'STRIPE_SECRET_KEY',
      ])
    );
  });

  test('does not treat placeholder Supabase service role as usable admin config', () => {
    expect(
      hasUsableSupabaseServiceConfig({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
      })
    ).toBe(false);
  });

  test('accepts JWT-like Supabase service role config', () => {
    expect(
      hasUsableSupabaseServiceConfig({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: `${'a'.repeat(40)}.${'b'.repeat(40)}.${'c'.repeat(40)}`,
      })
    ).toBe(true);
  });

  test('rejects service role JWTs from another Supabase project', () => {
    const payload = Buffer.from(
      JSON.stringify({ role: 'service_role', ref: 'other-project' }),
      'utf8'
    ).toString('base64url');

    expect(
      hasUsableSupabaseServiceConfig({
        SUPABASE_URL: 'https://current-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: `${'a'.repeat(40)}.${payload}.${'c'.repeat(40)}`,
      })
    ).toBe(false);
  });

  test('loads local server secrets from .env.local after .env in development', () => {
    expect(getServerEnvOptions({ NODE_ENV: 'development' })).toEqual({
      path: ['.env', '.env.local'],
      override: true,
    });
  });

  test('does not override deployment-provided environment variables in production', () => {
    expect(getServerEnvOptions({ NODE_ENV: 'production' })).toEqual({
      path: ['.env', '.env.local'],
      override: false,
    });
  });
});
