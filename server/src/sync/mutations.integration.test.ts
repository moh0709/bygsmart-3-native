// Integration test for POST /api/sync/mutations against a LOCAL Supabase. Runs only
// when the local env vars are present (skips in CI). See pull.integration.test.ts.
import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Client } from 'pg';
import { createApp } from '../app';
import type { Env } from '../env';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const DB_URL = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const RUN = !!(URL && ANON && SERVICE && JWT_SECRET);

const U = '0c000000-0000-4000-8000-00000000000c';

function signJwt(sub: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}`;
  return `${data}.${createHmac('sha256', JWT_SECRET!).update(data).digest('base64url')}`;
}

async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

const env: Env = { supabaseUrl: URL ?? '', anonKey: ANON ?? '', serviceRoleKey: SERVICE ?? '', jwtSecret: JWT_SECRET ?? '', port: 0 };
const app = createApp(env);
const auth = () => `Bearer ${signJwt(U)}`;

(RUN ? describe : describe.skip)('POST /api/sync/mutations (integration)', () => {
  beforeAll(async () => {
    await withDb(async (c) => {
      await c.query('DELETE FROM auth.users WHERE id = $1', [U]);
      await c.query(
        `INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         VALUES ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated','c@bygsmart.test','x',now(),now(),now(),'{}','{"name":"C"}')`,
        [U],
      );
    });
  }, 30000);
  afterAll(async () => {
    await withDb((c) => c.query('DELETE FROM auth.users WHERE id = $1', [U]));
  });

  const post = (mutations: unknown[]) =>
    request(app).post('/api/sync/mutations').set('Authorization', auth()).send({ mutations });

  it('creates a row (upsert, no baseVersion)', async () => {
    const pid = randomUUID();
    const res = await post([{ id: randomUUID(), entity: 'projects', op: 'upsert', data: { id: pid, name: 'P1', owner_id: U } }]).expect(200);
    expect(res.body.results[0].status).toBe('applied');
    expect(res.body.results[0].row.id).toBe(pid);
  });

  it('replays idempotently — same mutation id does not double-apply', async () => {
    const mid = randomUUID();
    const pid = randomUUID();
    const body = [{ id: mid, entity: 'projects', op: 'upsert', data: { id: pid, name: 'Dup', owner_id: U } }];
    const r1 = await post(body).expect(200);
    expect(r1.body.results[0].status).toBe('applied');
    const r2 = await post(body).expect(200);
    expect(r2.body.results[0].status).toBe('duplicate');
    const count = await withDb((c) => c.query('SELECT count(*)::int n FROM projects WHERE id = $1', [pid]));
    expect(count.rows[0].n).toBe(1);
  });

  it('rejects a stale baseVersion (optimistic concurrency), applies a fresh one', async () => {
    const pid = randomUUID();
    const created = await post([{ id: randomUUID(), entity: 'projects', op: 'upsert', data: { id: pid, name: 'V', owner_id: U } }]).expect(200);
    const v1 = created.body.results[0].row.updated_at as string;

    // Stale write with a bogus baseVersion → conflict, returns the server row.
    const stale = await post([
      { id: randomUUID(), entity: 'projects', op: 'upsert', baseVersion: '2000-01-01T00:00:00Z', data: { id: pid, name: 'Stale' } },
    ]).expect(200);
    expect(stale.body.results[0].status).toBe('conflict');

    // Correct baseVersion → applied.
    const fresh = await post([
      { id: randomUUID(), entity: 'projects', op: 'upsert', baseVersion: v1, data: { id: pid, name: 'Fresh' } },
    ]).expect(200);
    expect(fresh.body.results[0].status).toBe('applied');
    expect(fresh.body.results[0].row.updated_at).not.toBe(v1);
  });

  it('orders dependsOn (parent before child) and blocks dependents of a failure', async () => {
    const pid = randomUUID();
    const tid = randomUUID();
    // child (task) declared BEFORE parent (project) in the array, dependsOn parent.
    const ok = await post([
      { id: 'child', entity: 'tasks', op: 'upsert', dependsOn: ['parent'], data: { id: tid, project_id: pid, title: 'T', owner_id: U } },
      { id: 'parent', entity: 'projects', op: 'upsert', data: { id: pid, name: 'Par', owner_id: U } },
    ]).expect(200);
    const byId = Object.fromEntries(ok.body.results.map((r: { id: string; status: string }) => [r.id, r.status]));
    expect(byId.parent).toBe('applied');
    expect(byId.child).toBe('applied');

    // A dependent of a failing mutation is blocked.
    const blocked = await post([
      { id: 'bad', entity: 'nonexistent', op: 'upsert', data: { id: randomUUID() } },
      { id: 'dep', entity: 'projects', op: 'upsert', dependsOn: ['bad'], data: { id: randomUUID(), name: 'X', owner_id: U } },
    ]).expect(200);
    const b = Object.fromEntries(blocked.body.results.map((r: { id: string; status: string }) => [r.id, r.status]));
    expect(b.bad).toBe('error');
    expect(b.dep).toBe('blocked');
  });

  it('400 on a dependsOn cycle', async () => {
    await post([
      { id: 'x', entity: 'projects', op: 'upsert', dependsOn: ['y'], data: { id: randomUUID() } },
      { id: 'y', entity: 'projects', op: 'upsert', dependsOn: ['x'], data: { id: randomUUID() } },
    ]).expect(400);
  });

  it('401 without a token', async () => {
    await request(app).post('/api/sync/mutations').send({ mutations: [] }).expect(401);
  });
});
