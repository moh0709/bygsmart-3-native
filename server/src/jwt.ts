import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Supabase HS256 JWT and return its `sub` (the user id), or null if the
 * signature, algorithm or expiry is invalid. Row writes are still RLS-verified by
 * PostgREST on the user client — this local check authenticates the `sub` we use
 * for the idempotency ledger without a GoTrue round-trip.
 */
export function verifyJwtSub(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headB64, payloadB64, sigB64] = parts as [string, string, string];

  try {
    const header = JSON.parse(Buffer.from(headB64, 'base64url').toString('utf8')) as { alg?: string };
    if (header.alg !== 'HS256') return null;

    const expected = createHmac('sha256', secret).update(`${headB64}.${payloadB64}`).digest();
    const given = Buffer.from(sigB64, 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
