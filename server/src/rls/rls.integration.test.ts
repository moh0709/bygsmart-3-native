// TEST LAYER 3 — the RLS policy suite (P2 2.8). Proves the row-level policies
// actually enforce the access model: owner / project-member / outsider, positive
// AND negative, plus the profiles-overexposure fix. Runs against a LOCAL Supabase
// (real Postgres + PostgREST); self-skips when the local env is absent, so CI stays
// green. Replaces the red-pending placeholder test-harness/layer3-rls.
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const RUN = !!(URL && ANON && JWT_SECRET);

// owner O, member M (staff/active on P), outsider X.
const O = '0d000000-0000-4000-8000-00000000000d';
const M = '0e000000-0000-4000-8000-00000000000e';
const X = '0f000000-0000-4000-8000-00000000000f';
const P = 'dd000000-0000-4000-8000-0000000000d1';
const T = 'dd000000-0000-4000-8000-0000000000d2';

function jwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`;
  return `${data}.${createHmac('sha256', JWT_SECRET!).update(data).digest('base64url')}`;
}
function db(sub: string): SupabaseClient {
  return createClient(URL!, ANON!, {
    global: { headers: { Authorization: `Bearer ${jwt(sub)}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function ids(c: SupabaseClient, table: string): Promise<string[]> {
  const { data } = await c.from(table).select('id');
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

async function seed() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    await c.query('DELETE FROM auth.users WHERE id = ANY($1)', [[O, M, X]]);
    for (const [id, email] of [[O, 'o@t.test'], [M, 'm@t.test'], [X, 'x@t.test']] as const) {
      await c.query(
        `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'x',now(),now(),now(),'{}','{"name":"U"}')`,
        [id, email],
      );
    }
    await c.query(`INSERT INTO public.projects (id,name,owner_id) VALUES ($1,'P',$2)`, [P, O]);
    await c.query(
      `INSERT INTO public.project_resources (project_id,user_id,name,kind,status,visibility) VALUES ($1,$2,'M','staff','active','standard')`,
      [P, M],
    );
    await c.query(`INSERT INTO public.tasks (id,project_id,title,owner_id) VALUES ($1,$2,'T',$3)`, [T, P, O]);
  } finally {
    await c.end();
  }
}

(RUN ? describe : describe.skip)('Layer 3 — RLS policy suite', () => {
  beforeAll(async () => {
    await seed();
  }, 30000);
  afterAll(async () => {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    await c.query('DELETE FROM auth.users WHERE id = ANY($1)', [[O, M, X]]);
    await c.end();
  });

  describe('projects', () => {
    it('owner and member can read the project; an outsider cannot', async () => {
      expect(await ids(db(O), 'projects')).toContain(P);
      expect(await ids(db(M), 'projects')).toContain(P);
      expect(await ids(db(X), 'projects')).not.toContain(P);
    });
  });

  describe('tasks', () => {
    it('owner and member see the task; an outsider does not', async () => {
      expect(await ids(db(O), 'tasks')).toContain(T);
      expect(await ids(db(M), 'tasks')).toContain(T);
      expect(await ids(db(X), 'tasks')).not.toContain(T);
    });

    it('an outsider cannot INSERT a task into the project (RLS denies)', async () => {
      const { error } = await db(X)
        .from('tasks')
        .insert({ id: 'dd000000-0000-4000-8000-0000000000d9', project_id: P, title: 'hack', owner_id: X })
        .select();
      expect(error).toBeTruthy(); // new row violates row-level security policy
    });

    it('an outsider cannot UPDATE the project (0 rows affected)', async () => {
      const { data } = await db(X).from('projects').update({ name: 'pwned' }).eq('id', P).select();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('profiles (overexposure fix — shares_project_with_caller)', () => {
    it('parties who share a project see each other; an outsider is invisible', async () => {
      const oSees = await ids(db(O), 'profiles');
      expect(oSees).toContain(O); // own
      expect(oSees).toContain(M); // shares project P
      expect(oSees).not.toContain(X); // no shared project

      const xSees = await ids(db(X), 'profiles');
      expect(xSees).toContain(X); // own
      expect(xSees).not.toContain(O); // must not see project owner
      expect(xSees).not.toContain(M);
    });
  });

  describe('organizations', () => {
    it('a user sees their own personal org but not another user\'s', async () => {
      const oOrgs = await ids(db(O), 'organizations');
      const xOrgs = await ids(db(X), 'organizations');
      expect(oOrgs.length).toBeGreaterThan(0);
      // no overlap between O's and X's visible orgs (each only sees their own)
      expect(oOrgs.filter((id) => xOrgs.includes(id))).toHaveLength(0);
    });
  });
});
