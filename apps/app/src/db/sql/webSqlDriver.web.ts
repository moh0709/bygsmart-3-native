// The WEB runtime: wasm SQLite (sql.js) with the database file persisted to OPFS —
// the same SqlRepository the native runtime uses, just a different driver. On open we
// restore the .sqlite bytes from OPFS; after each write we debounce an export back to
// OPFS, so data survives a page reload. The wasm binary is served from /sql-wasm.wasm
// (apps/app/public/). Metro resolves this file on web only (webSqlDriver.ts is a native stub).
import initSqlJs, { type Database } from 'sql.js';
import type { SqlDriver } from './driver';
import { opfsReadBytes, opfsWriteBytes } from '../opfs/opfs';

export async function openWebSqlDriver(name = 'bygsmart.sqlite'): Promise<SqlDriver> {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const existing = await opfsReadBytes(name);
  const db: Database = existing ? new SQL.Database(existing) : new SQL.Database();

  return {
    // Persist to OPFS synchronously with the write: run() only resolves once the
    // database file is durable, so a follower notified afterwards reads fresh data
    // (no debounce race). Fine for this store's low write volume; production would
    // batch exports behind a flush-then-broadcast barrier.
    async run(sql, params = []) {
      db.run(sql, params as never[]);
      await opfsWriteBytes(name, db.export());
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
