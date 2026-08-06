// The data hooks screens use — the ONLY data surface above the repository (AR-05).
// useLiveList/useLiveRow give reactive reads (re-render on any change to the entity);
// useWrite gives optimistic create/update/delete that also enqueue to the outbox.
import { useEffect, useMemo, useState } from 'react';
import type { Row } from '../contract';
import { removeRow, upsertRow } from '../outbox/writes';
import { useData } from './provider';
import { newMutationId, nowIso } from './newId';

/** All live rows for an entity, kept in sync with the store. */
export function useLiveList(entity: string): Row[] {
  const { repo } = useData();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    const refresh = (): void => void repo.list(entity).then((r) => alive && setRows(r));
    const off = repo.subscribe(entity, refresh);
    refresh();
    return () => {
      alive = false;
      off();
    };
  }, [repo, entity]);
  return rows;
}

/** One live row by id (null while loading, absent, or soft-deleted). */
export function useLiveRow(entity: string, id: string | null): Row | null {
  const { repo } = useData();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    if (!repo || !id) {
      setRow(null);
      return;
    }
    let alive = true;
    const refresh = (): void => void repo.get(entity, id).then((r) => alive && setRow(r));
    const off = repo.subscribe(entity, refresh);
    refresh();
    return () => {
      alive = false;
      off();
    };
  }, [repo, entity, id]);
  return row;
}

export interface WriteApi {
  upsert(entity: string, row: Row): Promise<unknown>;
  remove(entity: string, id: string): Promise<unknown>;
}

/** Optimistic writes bound to the current repo + outbox (no-ops until the db is open). */
export function useWrite(): WriteApi {
  const { repo, outbox } = useData();
  return useMemo<WriteApi>(() => {
    const ctx = repo && outbox ? { repo, outbox, newId: newMutationId, now: nowIso } : null;
    return {
      upsert: (entity, row) => (ctx ? upsertRow(ctx, entity, row) : Promise.resolve(null)),
      remove: (entity, id) => (ctx ? removeRow(ctx, entity, id) : Promise.resolve(null)),
    };
  }, [repo, outbox]);
}
