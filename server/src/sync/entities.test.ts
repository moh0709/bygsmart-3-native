import { describe, it, expect } from 'vitest';
import { SYNC_ENTITIES, SYNC_ENTITY_COUNT, cursorEntity } from './entities';

describe('sync entity registry', () => {
  it('matches the 28 syncable tables in SYNCABLE_TABLES.md', () => {
    expect(SYNC_ENTITY_COUNT).toBe(28);
  });

  it('serves exactly the 23 id-PK "full" entities via the cursor endpoint', () => {
    const cursorable = Object.values(SYNC_ENTITIES).filter((e) => e.idPk);
    expect(cursorable).toHaveLength(23);
    expect(cursorable.every((e) => e.ownTombstone)).toBe(true);
  });

  it('excludes composite/derived/read-cache/local-cursor entities from the cursor endpoint', () => {
    for (const name of [
      'org_module_entitlements',
      'task_chat_reads',
      'org_time_responsibles',
      'document_visibility',
      'task_budget_rates',
    ]) {
      expect(cursorEntity(name)).toBeNull();
    }
  });

  it('resolves a known id-PK entity and rejects unknowns', () => {
    expect(cursorEntity('tasks')?.table).toBe('tasks');
    expect(cursorEntity('projects')?.table).toBe('projects');
    expect(cursorEntity('nonexistent')).toBeNull();
    expect(cursorEntity('sync_tombstones')).toBeNull(); // infra, never pullable
  });
});
