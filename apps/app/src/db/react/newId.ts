// Id + clock helpers for the write path. Mutation ids are idempotency keys, so they
// must be unique per intent; prefer a real UUID (Hermes and browsers expose
// crypto.randomUUID) and fall back to time+random where it is absent.
export function newMutationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
