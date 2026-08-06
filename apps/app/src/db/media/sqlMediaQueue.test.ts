import { createRequire } from 'node:module';
import initSqlJs, { type Database } from 'sql.js';
import type { SqlDriver } from '../sql/driver';
import { runMediaQueueContract } from './mediaSuite';
import { SqlMediaQueue } from './sqlMediaQueue';

const require = createRequire(import.meta.url);
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

runMediaQueueContract('sqlite (sql.js)', () => SqlMediaQueue.create(makeDriver(new SQL.Database()), () => '2026-08-06T00:00:00.000Z'));
