import type { SupabaseClient } from '@supabase/supabase-js';
import { cursorEntity } from './entities';
import {
  conflictPolicy,
  topoSort,
  type Mutation,
  type MutationResult,
  type MutationStatus,
} from './mutations';

/**
 * Apply a mutation batch for one caller. Row writes go through the USER client so
 * RLS authorises them; the idempotency ledger is written with the SERVICE client
 * (its table denies client writes). Order is dependsOn-topological; a mutation
 * whose dependency did not land is 'blocked' and skipped.
 */
export async function applyMutations(
  userDb: SupabaseClient,
  serviceDb: SupabaseClient,
  userId: string,
  mutations: Mutation[],
): Promise<MutationResult[]> {
  const ordered = topoSort(mutations); // throws on cycle/unknown dep → 400 upstream
  const results = new Map<string, MutationResult>();

  for (const m of ordered) {
    results.set(m.id, await applyOne(userDb, serviceDb, userId, m, results));
  }
  // Return in the caller's original order.
  return mutations.map((m) => results.get(m.id)!);
}

function landed(s: MutationStatus): boolean {
  return s === 'applied' || s === 'duplicate';
}

async function applyOne(
  userDb: SupabaseClient,
  serviceDb: SupabaseClient,
  userId: string,
  m: Mutation,
  results: Map<string, MutationResult>,
): Promise<MutationResult> {
  // 1) Gate on dependencies.
  for (const dep of m.dependsOn ?? []) {
    const r = results.get(dep);
    if (!r || !landed(r.status)) {
      return { id: m.id, status: 'blocked', error: `dependency ${dep} did not land` };
    }
  }

  // 2) Validate entity.
  const entity = cursorEntity(m.entity);
  if (!entity) return { id: m.id, status: 'error', error: `unknown entity ${m.entity}` };
  const rowId = typeof m.data.id === 'string' ? m.data.id : null;
  if (!rowId) return { id: m.id, status: 'error', error: 'mutation.data.id required' };

  // 3) Idempotency replay.
  const prior = await serviceDb
    .from('sync_idempotency_keys')
    .select('response')
    .eq('idempotency_key', m.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (prior.data?.response) {
    const resp = prior.data.response as { row?: Record<string, unknown> };
    return { id: m.id, status: 'duplicate', row: resp.row };
  }

  // 4) Apply.
  const result = await runMutation(userDb, entity.table, m, rowId);

  // 5) Record idempotency (best-effort; ignore races/dupes).
  if (result.status === 'applied' || result.status === 'conflict') {
    await serviceDb
      .from('sync_idempotency_keys')
      .insert({
        idempotency_key: m.id,
        user_id: userId,
        status: result.status === 'applied' ? 'completed' : 'failed',
        response: { row: result.row ?? null },
      })
      .then(undefined, () => undefined);
  }
  return result;
}

async function runMutation(
  userDb: SupabaseClient,
  table: string,
  m: Mutation,
  rowId: string,
): Promise<MutationResult> {
  const isDelete = m.op === 'delete';
  const patch = isDelete ? { deleted_at: new Date().toISOString() } : { ...m.data };

  // Create: no baseVersion → INSERT (RLS gates it).
  if (!isDelete && !m.baseVersion) {
    const ins = await userDb.from(table).insert(m.data).select().maybeSingle();
    if (ins.error) {
      // Unique-violation ⇒ the row already exists (a create racing an existing row).
      if (ins.error.code === '23505') return conflictFor(userDb, table, rowId, m.id);
      return { id: m.id, status: 'error', error: ins.error.message };
    }
    return { id: m.id, status: 'applied', row: ins.data ?? undefined };
  }

  // Update/soft-delete with optimistic concurrency on updated_at.
  let q = userDb.from(table).update(patch).eq('id', rowId);
  if (m.baseVersion) q = q.eq('updated_at', m.baseVersion);
  const upd = await q.select().maybeSingle();
  if (upd.error) return { id: m.id, status: 'error', error: upd.error.message };
  if (upd.data) return { id: m.id, status: 'applied', row: upd.data };

  // 0 rows: version mismatch, not found, or not visible → adjudicate.
  return conflictFor(userDb, table, rowId, m.id, m.op, patch);
}

/** Resolve a 0-row write: reject with the current row, or last-write-wins per policy. */
async function conflictFor(
  userDb: SupabaseClient,
  table: string,
  rowId: string,
  mutationId: string,
  op?: Mutation['op'],
  patch?: Record<string, unknown>,
): Promise<MutationResult> {
  const cur = await userDb.from(table).select('*').eq('id', rowId).maybeSingle();
  if (!cur.data) return { id: mutationId, status: 'error', error: 'row not found or not permitted' };

  if (op && patch && conflictPolicy(table) === 'lww') {
    const forced = await userDb.from(table).update(patch).eq('id', rowId).select().maybeSingle();
    if (forced.data) return { id: mutationId, status: 'applied', row: forced.data };
  }
  return { id: mutationId, status: 'conflict', row: cur.data };
}
