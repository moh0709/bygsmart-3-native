// Open the app's ONE local database (repo + outbox + media queue share it), picking the
// durable runtime for the platform: native device SQLite (expo-sqlite), wasm-SQLite over
// OPFS on web, or an in-memory fallback where OPFS is unavailable. Screens never see it —
// they get a Repository. The raw driver is exposed so the media queue can persist too.
import { Platform } from 'react-native';
import { InMemoryRepository } from '../memory';
import { SqlRepository } from '../sql/sqlRepository';
import { InMemoryOutbox } from '../outbox/memoryOutbox';
import { SqlOutbox } from '../outbox/sqlOutbox';
import type { Repository } from '../contract';
import type { Outbox } from '../outbox/contract';
import type { SqlDriver } from '../sql/driver';
import { SqlMediaQueue } from '../media/sqlMediaQueue';
import { InMemoryMediaQueue } from '../media/memoryMediaQueue';
import type { MediaQueue } from '../media/contract';

export interface OpenedDatabase {
  repo: Repository;
  outbox: Outbox;
  media: MediaQueue;
  /** Human label of the chosen runtime (shown in dev/diagnostics). */
  label: string;
}

async function fromDriver(driver: SqlDriver, label: string): Promise<OpenedDatabase> {
  return {
    repo: await SqlRepository.create(driver),
    outbox: await SqlOutbox.create(driver),
    media: await SqlMediaQueue.create(driver),
    label,
  };
}

export async function openDatabase(name = 'bygsmart-app'): Promise<OpenedDatabase> {
  if (Platform.OS !== 'web') {
    const { openExpoSqliteDriver } = await import('../sql/expoSqliteDriver');
    return fromDriver(await openExpoSqliteDriver(`${name}.db`), 'enhed (SQLite)');
  }
  const { opfsAvailable } = await import('../opfs/opfs');
  if (opfsAvailable()) {
    const { openWebSqlDriver } = await import('../sql/webSqlDriver');
    return fromDriver(await openWebSqlDriver(`${name}.sqlite`), 'browser (OPFS SQLite)');
  }
  return { repo: new InMemoryRepository(), outbox: new InMemoryOutbox(), media: new InMemoryMediaQueue(), label: 'hukommelse (web)' };
}
