// Integration test for GET /api/sync/:entity against a LOCAL Supabase (real
// Postgres + PostgREST + RLS). Runs only when the local env vars are present
// (set them from `supabase status -o env`); skips in CI where there is no DB.
//
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET   (required)
//   SUPABASE_DB_URL   (optional, default local)
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import { createApp } from '../app';
import type { Env } from '../env';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const RUN = !!(URL && ANON && JWT_SECRET);

const A = '0a000000-0000-4000-8000-00000000000a';
const B = '0b000000-0000-4000-8000-00000000000b';
const PA = 'aa000000-0000-4000-8000-0000000000a1';
const PB = 'bb000000-0000-4000-8000-0000000000b1';
const TA1 = 'aa000000-0000-4000-8000-0000000000a2';
const TA2 = 'aa000000-0000-4000-8000-0000000000a3';
const TB1 = 'bb000000-0000-4000-8000-0000000000b2';

function signJwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`;
  return `${data}.${createHmac('sha256', JWT_SECRET!).update(data).digest('base64url')}`;
}

async function seed() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  // Clean prior run (auth.users cascade → profiles/orgs/projects/tasks).
  await c.query('DELETE FROM auth.users WHERE id = ANY($1)', [[A, B]]);
  for (const [id, email] of [[A, 'a@bygsmart.test'], [B, 'b@bygsmart.test']] as const) {
    await c.query(
      `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
       VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,'x',now(),now(),now(),'{}','{"name":"T"}')`,
      [id, email],
    );
  }
  await c.query(`INSERT INTO public.projects (id,name,owner_id) VALUES ($1,'PA',$2),($3,'PB',$4)`, [PA, A, PB, B]);
  await c.query(
    `INSERT INTO public.tasks (id,project_id,title,owner_id) VALUES ($1,$2,'TA1',$3),($4,$2,'TA2',$3),($5,$6,'TB1',$7)`,
    [TA1, PA, A, TA2, TB1, PB, B],
  );
  // A soft-deletes TA2 → emits a tombstone scoped to A.
  await c.query(`UPDATE public.tasks SET deleted_at = now() WHERE id = $1`, [TA2]);
  await c.end();
}

const env: Env = { supabaseUrl: URL ?? '', anonKey: ANON ?? '', serviceRoleKey: '', port: 0 };
const app = createApp(env);
const bearer = (sub: string) => `Bearer ${signJwt(sub)}`;

(RUN ? describe : describe.skip)('GET /api/sync/:entity (integration)', () => {
  beforeAll(async () => {
    await seed();
  }, 30000);
  afterAll(async () => {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    await c.query('DELETE FROM auth.users WHERE id = ANY($1)', [[A, B]]);
    await c.end();
  });

  it('401 without a bearer token', async () => {
    await request(app).get('/api/sync/tasks').expect(401);
  });

  it('404 for an unknown / non-cursor entity', async () => {
    await request(app).get('/api/sync/nope').set('Authorization', bearer(A)).expect(404);
    await request(app).get('/api/sync/task_chat_reads').set('Authorization', bearer(A)).expect(404);
  });

  it('applies RLS: A sees only A\'s tasks, never B\'s', async () => {
    const res = await request(app).get('/api/sync/tasks').set('Authorization', bearer(A)).expect(200);
    const ids = res.body.rows.map((r: { id: string }) => r.id);
    expect(ids).toContain(TA1);
    expect(ids).not.toContain(TB1);
  });

  it('serves the scoped tombstone for A\'s soft-deleted task', async () => {
    const res = await request(app).get('/api/sync/tasks').set('Authorization', bearer(A)).expect(200);
    const deletedIds = res.body.deletes.map((d: { id: string }) => d.id);
    expect(deletedIds).toContain(TA2);
  });

  it('does NOT leak A\'s tombstone to B', async () => {
    const res = await request(app).get('/api/sync/tasks').set('Authorization', bearer(B)).expect(200);
    const deletedIds = res.body.deletes.map((d: { id: string }) => d.id);
    expect(deletedIds).not.toContain(TA2);
    expect(res.body.rows.map((r: { id: string }) => r.id)).not.toContain(TA1);
  });

  it('pages with the (updated_at, id) cursor', async () => {
    const p1 = await request(app).get('/api/sync/tasks').query({ limit: 1 }).set('Authorization', bearer(A)).expect(200);
    expect(p1.body.rows).toHaveLength(1);
    expect(p1.body.hasMore).toBe(true);
    expect(p1.body.nextCursor).toBeTruthy();

    const p2 = await request(app)
      .get('/api/sync/tasks')
      .query({ limit: 1, cursor: p1.body.nextCursor })
      .set('Authorization', bearer(A))
      .expect(200);
    expect(p2.body.rows).toHaveLength(1);
    // page 2's row differs from page 1's
    expect(p2.body.rows[0].id).not.toBe(p1.body.rows[0].id);
  });
});
