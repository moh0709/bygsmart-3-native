// A SqlDriver over expo-sqlite — the NATIVE on-device runtime (iOS + Android). It is
// a thin adapter: SqlRepository holds the logic, this just runs statements against a
// real device SQLite file, so data persists across app restarts. Deliberately NOT
// exported from db/index (it pulls the native module in); the composition root /
// demo imports it directly on native only, keeping the web bundle clean.
import * as SQLite from 'expo-sqlite';
import type { SqlDriver } from './driver';

export async function openExpoSqliteDriver(name = 'bygsmart.db'): Promise<SqlDriver> {
  const db = await SQLite.openDatabaseAsync(name);
  return {
    async run(sql, params = []) {
      await db.runAsync(sql, params as SQLite.SQLiteBindValue[]);
    },
    async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return (await db.getAllAsync(sql, params as SQLite.SQLiteBindValue[])) as T[];
    },
  };
}
