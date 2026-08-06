import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import type { SqlDriver } from '../sql/driver';
import { runOutboxContract } from './outboxSuite';
import { SqlOutbox } from './sqlOutbox';

const require = createRequire(import.meta.url);
// sql.js = the same wasm SQLite the web OPFS runtime uses and a faithful stand-in for
// native SQLite, so it validates SqlOutbox in CI without a native build. The native +
// OPFS drivers are thin SqlDriver adapters that run this same suite on their targets.
const SQL = await initSqlJs({ locateFile: (f: string) => require.resolve(`sql.js/dist/${f}`) });

function makeDriver(db: Database): SqlDriver {
  return {
    async run(sql, params = []) {
      db.run(sql, params as never[]);
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      stmt.bind(params as never[]);
      const out: T[] = [];
      while (stmt.step()) out.push(stmt.getAsObject() as T);
      stmt.free();
      return out;
    },
  };
}

const CLOCK = '2026-08-06T00:00:00.000Z';

// TEST LAYER 5 — the persistent SQLite outbox satisfies the same contract.
runOutboxContract('sqlite (sql.js)', () => SqlOutbox.create(makeDriver(new SQL.Database()), () => CLOCK));

describe('SqlOutbox persistence', () => {
  it('queued writes survive a new outbox instance over the same database (app restart)', async () => {
    const db = new SQL.Database();
    const driver = makeDriver(db);

    const first = await SqlOutbox.create(driver, () => CLOCK);
    await first.enqueue({ id: 'm1', entity: 'tasks', op: 'upsert', data: { id: 't1', title: 'Offline note' } });
    await first.enqueue({ id: 'm2', entity: 'tasks', op: 'delete', data: { id: 't0' }, baseVersion: '2026-08-01T00:00:00Z' });
    await first.markFailed('m2', 'was offline', '2026-08-06T00:00:05.000Z');

    // A fresh outbox over the SAME database = simulated app restart.
    const restarted = await SqlOutbox.create(driver, () => CLOCK);
    expect(await restarted.size()).toBe(2);
    const all = await restarted.all();
    expect(all.map((e) => e.id)).toEqual(['m1', 'm2']); // seq order preserved
    const m2 = await restarted.get('m2');
    expect(m2?.op).toBe('delete');
    expect(m2?.status).toBe('failed');
    expect(m2?.attempts).toBe(1);
    expect(m2?.baseVersion).toBe('2026-08-01T00:00:00Z');
    expect(m2?.nextAttemptAt).toBe('2026-08-06T00:00:05.000Z');
  });
});
