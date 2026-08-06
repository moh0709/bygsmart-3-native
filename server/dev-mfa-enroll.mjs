// DEV ONLY — enroll + verify a TOTP factor for the demo user, so the login flow exercises
// the second factor. Run AFTER dev-seed.mjs (which recreates the user, clearing factors).
// Prints the TOTP secret so you can compute codes at the challenge screen.
//   node server/dev-mfa-enroll.mjs
import { createClient } from '@supabase/supabase-js';
import { totp } from './totp.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? '';
const EMAIL = 'demo@bygsmart.test';
const PASSWORD = 'demo1234';

const c = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

const { error: signErr } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signErr) throw signErr;

// Remove any pre-existing factors (best effort — a fresh seed has none).
const { data: existing } = await c.auth.mfa.listFactors();
for (const f of existing?.all ?? []) {
  await c.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
}

const { data: enroll, error: enrollErr } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Demo TOTP' });
if (enrollErr) throw enrollErr;
const factorId = enroll.id;
const secret = enroll.totp.secret;

const { data: challenge, error: chErr } = await c.auth.mfa.challenge({ factorId });
if (chErr) throw chErr;

const { error: verifyErr } = await c.auth.mfa.verify({ factorId, challengeId: challenge.id, code: totp(secret) });
if (verifyErr) throw verifyErr;

console.log(`# MFA TOTP factor enrolled + verified for ${EMAIL} — login now requires a code.`);
console.log(`TOTP_SECRET=${secret}`);
console.log(`# current code: ${totp(secret)}   (fresh one: node server/totp.mjs ${secret})`);
