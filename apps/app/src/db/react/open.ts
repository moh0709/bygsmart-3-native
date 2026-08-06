// Open the app's ONE local database (repo + outbox share it), picking the durable
// runtime for the platform: native device SQLite (expo-sqlite), wasm-SQLite over OPFS
// on web, or an in-memory fallback where OPFS is unavailable. This is the same runtime
// selection the offline demo proved; screens never see it — they get a Repository.
import { Platform } from 'react-native';
import { InMemoryRepository } from '../memory';
import { SqlRepository } from '../sql/sqlRepository';
import { InMemoryOutbox } from '../outbox/memoryOutbox';
import { SqlOutbox } from '../outbox/sqlOutbox';
import type { Repository } from '../contract';
import type { Outbox } from '../outbox/contract';

export interface OpenedDatabase {
  repo: Repository;
  outbox: Outbox;
  /** Human label of the chosen runtime (shown in dev/diagnostics). */
  label: string;
}

export async function openDatabase(name = 'bygsmart-app'): Promise<OpenedDatabase> {
  if (Platform.OS !== 'web') {
    const { openExpoSqliteDriver } = await import('../sql/expoSqliteDriver');
    const driver = await openExpoSqliteDriver(`${name}.db`);
    return { repo: await SqlRepository.create(driver), outbox: await SqlOutbox.create(driver), label: 'enhed (SQLite)' };
  }
  const { opfsAvailable } = await import('../opfs/opfs');
  if (opfsAvailable()) {
    const { openWebSqlDriver } = await import('../sql/webSqlDriver');
    const driver = await openWebSqlDriver(`${name}.sqlite`);
    return { repo: await SqlRepository.create(driver), outbox: await SqlOutbox.create(driver), label: 'browser (OPFS SQLite)' };
  }
  return { repo: new InMemoryRepository(), outbox: new InMemoryOutbox(), label: 'hukommelse (web)' };
}
