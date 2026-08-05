// Pure mutation-batch logic for POST /api/sync/mutations: dependency ordering and
// per-entity conflict adjudication. The IO (idempotency store, baseVersion apply)
// lives in apply.ts; this file is fully unit-tested.

export type MutationOp = 'upsert' | 'delete';

export interface Mutation {
  /** Client-generated idempotency key AND the in-batch handle for dependsOn. */
  id: string;
  entity: string;
  op: MutationOp;
  /** Row payload for upsert (must include the row's `id`); {id} for delete. */
  data: Record<string, unknown>;
  /** The updated_at the client last saw — optimistic-concurrency guard. Absent = create. */
  baseVersion?: string;
  /** Other mutations (by `id`) in this batch that must be applied first. */
  dependsOn?: string[];
}

export type MutationStatus = 'applied' | 'duplicate' | 'conflict' | 'blocked' | 'forbidden' | 'error';

export interface MutationResult {
  id: string;
  status: MutationStatus;
  /** The resulting/current server row (applied or conflict). */
  row?: Record<string, unknown>;
  error?: string;
}

/**
 * Topologically order a batch by dependsOn (dependencies first), preserving input
 * order among independents (stable). Throws on an unknown dependency or a cycle —
 * the whole batch is rejected rather than partially applied in a wrong order.
 */
export function topoSort(mutations: Mutation[]): Mutation[] {
  const byId = new Map(mutations.map((m) => [m.id, m]));
  const state = new Map<string, 'visiting' | 'done'>();
  const out: Mutation[] = [];

  const visit = (m: Mutation, stack: string[]): void => {
    const s = state.get(m.id);
    if (s === 'done') return;
    if (s === 'visiting') {
      throw new Error(`dependsOn cycle: ${[...stack, m.id].join(' -> ')}`);
    }
    state.set(m.id, 'visiting');
    for (const dep of m.dependsOn ?? []) {
      const depM = byId.get(dep);
      if (!depM) throw new Error(`mutation ${m.id} dependsOn unknown ${dep}`);
      visit(depM, [...stack, m.id]);
    }
    state.set(m.id, 'done');
    out.push(m);
  };

  for (const m of mutations) visit(m, []);
  return out;
}

export type ConflictPolicy = 'reject' | 'lww';

// Per-entity adjudication on a baseVersion mismatch. Default is the safe REJECT
// (client must rebase on the server row and retry). A few high-churn, low-stakes
// entities take last-write-wins so a stale-but-harmless write still lands.
const POLICY: Record<string, ConflictPolicy> = {
  task_check_ins: 'lww',
  activity_log: 'lww',
};

export function conflictPolicy(entity: string): ConflictPolicy {
  return POLICY[entity] ?? 'reject';
}
