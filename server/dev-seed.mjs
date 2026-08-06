// DEV ONLY — seed a demo user + project + tasks into the LOCAL Supabase and mint a
// short-lived JWT for that user, then print the EXPO_PUBLIC_SYNC_* env the app reads.
// No secrets are committed: the JWT is signed at runtime from the local JWT secret you
// pass in the environment. Real auth (login screens) replaces this in a later phase.
//
//   Env (defaults are the standard local Supabase):
//     SUPABASE_DB_URL      postgresql://postgres:postgres@127.0.0.1:54322/postgres
//     SUPABASE_JWT_SECRET  super-secret-jwt-token-with-at-least-32-characters-long
//     SYNC_API_URL         http://127.0.0.1:3100/api
import { createHmac } from 'node:crypto';
import { Client } from 'pg';

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
const API_URL = process.env.SYNC_API_URL ?? 'http://127.0.0.1:3100/api';

const U = 'dd000000-0000-4000-8000-00000000d001';
const P = 'dd000000-0000-4000-8000-00000000d0a1';
const T1 = 'dd000000-0000-4000-8000-00000000d0b1';
const T2 = 'dd000000-0000-4000-8000-00000000d0b2';
const T3 = 'dd000000-0000-4000-8000-00000000d0b3';

function signJwt(sub) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 86400 })}`;
  return `${data}.${createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}

const c = new Client({ connectionString: DB_URL });
await c.connect();

// Idempotent reset (children first; owner_id is ON DELETE SET NULL so rows survive a
// user delete — remove them explicitly).
await c.query('DELETE FROM public.tasks WHERE id = ANY($1)', [[T1, T2, T3]]);
await c.query('DELETE FROM public.projects WHERE id = ANY($1)', [[P]]);
await c.query('DELETE FROM auth.users WHERE id = $1', [U]);

// Insert the auth user → the on_auth_user_created trigger creates its profile row.
await c.query(
  `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'x',now(),now(),now(),'{}','{"name":"Demo Bruger"}')`,
  [U, 'demo@bygsmart.test'],
);

await c.query(
  `INSERT INTO public.projects (id, name, owner_id, status, address) VALUES ($1,'Villa Nord',$2,'I gang','Nordvej 12, 8200 Aarhus')`,
  [P, U],
);
await c.query(
  `INSERT INTO public.tasks (id, project_id, owner_id, scope, title, status) VALUES
     ($1,$4,$5,'project','Støbe fundament','open'),
     ($2,$4,$5,'project','Rejse spær','open'),
     ($3,$4,$5,'project','Montér vinduer','done')`,
  [T1, T2, T3, P, U],
);

// The hard DELETEs above fire emit_tombstone triggers, so a RE-seed would leave
// tombstones that (correctly) make clients drop these re-inserted rows on pull. Purge
// the demo ids' tombstones so a fresh hydrate sees the rows. (Dev seed only.)
await c.query('DELETE FROM public.sync_tombstones WHERE entity_id = ANY($1)', [[U, P, T1, T2, T3]]);

await c.end();

const token = signJwt(U);
console.log('# Local Supabase seeded. Start Metro with these env vars:');
console.log(`EXPO_PUBLIC_SYNC_URL=${API_URL}`);
console.log(`EXPO_PUBLIC_SYNC_USER_ID=${U}`);
console.log(`EXPO_PUBLIC_SYNC_TOKEN=${token}`);
