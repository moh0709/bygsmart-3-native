// The delta puller (P3a 3a.4): drains GET /api/sync/:entity page by page into the
// repository, applying upserts AND tombstones and advancing the per-entity cursor,
// then drives initial hydration across entities with visible progress. The transport
// (PullSource) is injected — api-client implements it against the real endpoint;
// tests use a fake — so this logic is pure and runtime-agnostic.
import type { Repository, Row } from './contract';

/** One page from the server pull endpoint (mirrors the server PullResult shape). */
export interface PullPage {
  rows: Row[];
  deletes: { id: string }[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PullSource {
  fetch(entity: string, cursor: string | null): Promise<PullPage>;
}

/** Safety cap so a misbehaving server (hasMore forever) can't loop unbounded. */
const MAX_PAGES = 10_000;

/** Pull one entity to completion from its current cursor. */
export async function pullEntity(repo: Repository, source: PullSource, entity: string): Promise<void> {
  let cursor = await repo.getCursor(entity);
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await source.fetch(entity, cursor);
    await repo.applyDelta(entity, { upserts: res.rows, deletes: res.deletes });

    // Stop if the page says we're done, or if the cursor can't advance (guards an
    // infinite loop when the server reports hasMore but returns no new cursor).
    if (!res.hasMore || res.nextCursor === null || res.nextCursor === cursor) {
      if (res.nextCursor !== null) await repo.setCursor(entity, res.nextCursor);
      return;
    }
    cursor = res.nextCursor;
    await repo.setCursor(entity, cursor);
  }
}

export type ProgressListener = (progress: number, entity: string) => void;

/**
 * Initial hydration: pull every entity, reporting 0..1 progress as each completes.
 * Marks the repository hydrated once all entities are drained.
 */
export async function hydrate(
  repo: Repository,
  source: PullSource,
  entities: string[],
  onProgress?: ProgressListener,
): Promise<void> {
  repo.setHydration({ ready: false, progress: 0 });
  let done = 0;
  for (const entity of entities) {
    await pullEntity(repo, source, entity);
    done += 1;
    const progress = entities.length === 0 ? 1 : done / entities.length;
    repo.setHydration({ ready: done === entities.length, progress });
    onProgress?.(progress, entity);
  }
}
