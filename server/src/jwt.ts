import { createHmac, timingSafeEqual } from 'node:crypto';
import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from 'jose';

/**
 * Verify a Supabase JWT and return its `sub` (the user id), or null if invalid.
 *
 * Modern Supabase signs session tokens with ASYMMETRIC keys (ES256/RS256) verified
 * against the project JWKS; legacy/dev tokens use the shared HS256 secret. We support
 * both: HS256 is checked locally with the secret (no round-trip — used by the tests),
 * asymmetric tokens are verified against the cached remote JWKS. Row writes are still
 * RLS-verified by PostgREST on the user client; this only authenticates the `sub` we
 * use for the idempotency ledger.
 */
export interface VerifyOptions {
  /** Shared HS256 secret (Supabase JWT secret) for legacy/dev tokens. */
  hmacSecret: string;
  /** Project JWKS URL for asymmetric tokens (…/auth/v1/.well-known/jwks.json). */
  jwksUrl?: string;
}

const jwksCache = new Map<string, JWTVerifyGetKey>();
function jwks(url: string): JWTVerifyGetKey {
  let j = jwksCache.get(url);
  if (!j) {
    j = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, j);
  }
  return j;
}

export async function verifyJwtSub(token: string, opts: VerifyOptions): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let alg: string | undefined;
  try {
    alg = (JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8')) as { alg?: string }).alg;
  } catch {
    return null;
  }

  if (alg === 'HS256') return verifyHs256(parts as [string, string, string], opts.hmacSecret);

  // Asymmetric (ES256/RS256/…) — verify against the project JWKS.
  if (!opts.jwksUrl) return null;
  try {
    const { payload } = await jwtVerify(token, jwks(opts.jwksUrl));
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}

function verifyHs256([headB64, payloadB64, sigB64]: [string, string, string], secret: string): string | null {
  try {
    const expected = createHmac('sha256', secret).update(`${headB64}.${payloadB64}`).digest();
    const given = Buffer.from(sigB64, 'base64url');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
