// A dev seed served through the SAME PullSource contract the real GET /api/sync/:entity
// uses, so screens hydrate from a realistic dataset until the app is pointed at the
// live backend. Swapping this for the HTTP pull source (api-client) changes nothing
// above it. Projects + tasks only for now — the first screens.
import type { Row } from '../contract';
import type { PullPage, PullSource } from '../puller';

const iso = (d: number): string => `2026-08-0${d}T08:00:00.000Z`;

const PROJECTS: Row[] = [
  { id: 'p1', updated_at: iso(1), name: 'Villa Nord', address: 'Nordvej 12, 8200 Aarhus', status: 'active' },
  { id: 'p2', updated_at: iso(1), name: 'Villa Syd', address: 'Søndergade 4, 8000 Aarhus', status: 'active' },
  { id: 'p3', updated_at: iso(2), name: 'Tilbygning Vest', address: 'Vestparken 8, 8210 Aarhus', status: 'planning' },
];

const TASKS: Row[] = [
  { id: 't1', updated_at: iso(3), title: 'Støbe fundament', project_id: 'p1', status: 'open' },
  { id: 't2', updated_at: iso(3), title: 'Rejse spær', project_id: 'p1', status: 'open' },
  { id: 't3', updated_at: iso(3), title: 'Montér vinduer', project_id: 'p1', status: 'done' },
  { id: 't4', updated_at: iso(4), title: 'Grave ud til terrasse', project_id: 'p2', status: 'open' },
  { id: 't5', updated_at: iso(4), title: 'Støbe sokkel', project_id: 'p2', status: 'done' },
];

const DATA: Record<string, Row[]> = { projects: PROJECTS, tasks: TASKS };

/** Entities the seed (and the first screens) hydrate. */
export const SEED_ENTITIES = ['projects', 'tasks'];

/** One page per entity, then done — mirrors the server's PullPage shape. */
export function makeSeedSource(): PullSource {
  const served: Record<string, boolean> = {};
  return {
    async fetch(entity): Promise<PullPage> {
      if (served[entity]) return { rows: [], deletes: [], nextCursor: `seed-${entity}`, hasMore: false };
      served[entity] = true;
      await new Promise((r) => setTimeout(r, 300));
      return { rows: DATA[entity] ?? [], deletes: [], nextCursor: `seed-${entity}`, hasMore: false };
    },
  };
}
