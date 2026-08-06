// DEV ONLY — seed a demo user (via GoTrue's admin API, so the identity + token rows are
// set up correctly and real login works), a project, and tasks into the LOCAL Supabase.
// Prints the EXPO_PUBLIC_* env the app reads and the demo credentials. No secrets are
// committed. Real auth (this login) replaces the earlier dev-token plumbing.
//
//   Env (defaults are the standard local Supabase):
//     SUPABASE_DB_URL             postgresql://postgres:postgres@127.0.0.1:54322/postgres
//     SUPABASE_URL                http://127.0.0.1:54321
//     SUPABASE_ANON_KEY           (from `supabase status -o env`)
//     SUPABASE_SERVICE_ROLE_KEY   (from `supabase status -o env`)
//     SYNC_API_URL                http://127.0.0.1:3100/api
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const API_URL = process.env.SYNC_API_URL ?? 'http://127.0.0.1:3100/api';

const EMAIL = 'demo@bygsmart.test';
const PASSWORD = 'demo1234';

const P = 'dd000000-0000-4000-8000-00000000d0a1';
const T1 = 'dd000000-0000-4000-8000-00000000d0b1';
const T2 = 'dd000000-0000-4000-8000-00000000d0b2';
const T3 = 'dd000000-0000-4000-8000-00000000d0b3';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const c = new Client({ connectionString: DB_URL });
await c.connect();

// Clean prior demo rows, then the prior demo user (removes its identity + profile too).
await c.query('DELETE FROM public.tasks WHERE id = ANY($1)', [[T1, T2, T3]]);
await c.query('DELETE FROM public.projects WHERE id = ANY($1)', [[P]]);
await c.query('DELETE FROM auth.users WHERE email = $1', [EMAIL]);

// Create the user through GoTrue → proper identity + confirmed email; the
// on_auth_user_created trigger creates the profile.
const { data: created, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { name: 'Demo Bruger' },
});
if (error) throw error;
const U = created.user.id;

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

// The hard DELETEs above fire emit_tombstone triggers; purge the demo ids' tombstones
// so a fresh hydrate sees the re-inserted rows. (Dev seed only.)
await c.query('DELETE FROM public.sync_tombstones WHERE entity_id = ANY($1)', [[U, P, T1, T2, T3]]);

await c.end();

console.log('# Local Supabase seeded. Start Metro with these env vars:');
console.log(`EXPO_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`);
console.log(`EXPO_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`);
console.log(`EXPO_PUBLIC_SYNC_URL=${API_URL}`);
console.log('#');
console.log(`# Log in with:  ${EMAIL}  /  ${PASSWORD}   (user ${U})`);
