import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { runRepositoryContract } from '../contractSuite';
import { SqlRepository } from './sqlRepository';
import type { SqlDriver } from './driver';

const require = createRequire(import.meta.url);
// sql.js is pure-wasm SQLite — the SAME engine the web OPFS runtime uses and a
// faithful stand-in for native SQLite, so it validates SqlRepository in CI without
// a native build. The native (op-sqlite) + OPFS drivers are thin adapters over the
// same SqlDriver interface and run this same contract suite on their targets.
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

// TEST LAYER 4 — the persistent SQLite runtime satisfies the same contract.
runRepositoryContract('sqlite (sql.js)', () => SqlRepository.create(makeDriver(new SQL.Database())));

describe('SqlRepository persistence', () => {
  it('data survives a new repository instance over the same database (restart)', async () => {
    const db = new SQL.Database();
    const driver = makeDriver(db);

    const first = await SqlRepository.create(driver);
    await first.upsert('tasks', { id: 't1', updated_at: '2026-01-01T00:00:00Z', title: 'Persisted' });
    await first.setCursor('tasks', 'cur-9');

    // A fresh repository over the SAME database = simulated app restart.
    const restarted = await SqlRepository.create(driver);
    expect((await restarted.get('tasks', 't1'))?.title).toBe('Persisted');
    expect(await restarted.getCursor('tasks')).toBe('cur-9');
  });
});
