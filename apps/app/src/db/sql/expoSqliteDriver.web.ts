// Web override — Metro resolves this instead of expoSqliteDriver.ts on web, so the
// expo-sqlite native module never enters the web bundle. The demo only imports the
// native driver when Platform.OS !== 'web', so this is never called on web; it exists
// purely to keep the web build clean. Web persistence (wasm-SQLite over OPFS) is a
// later step and gets its own driver.
import type { SqlDriver } from './driver';

export async function openExpoSqliteDriver(_name = 'bygsmart.db'): Promise<SqlDriver> {
  throw new Error('expo-sqlite driver is native-only; web uses the in-memory / OPFS runtime');
}
