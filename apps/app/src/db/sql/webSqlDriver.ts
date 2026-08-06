// Native stub — Metro resolves webSqlDriver.web.ts on web. Native uses expo-sqlite,
// so this is never called; it exists only so the import resolves on native without
// pulling sql.js into the native bundle.
import type { SqlDriver } from './driver';

export async function openWebSqlDriver(_name = 'bygsmart.sqlite'): Promise<SqlDriver> {
  throw new Error('web SQL driver is web-only; native uses expo-sqlite');
}
