// Id + clock helpers for the write path. Ids double as row primary keys, which are
// `uuid` columns server-side, so they MUST be valid UUIDs — prefer crypto.randomUUID
// (browsers + modern Hermes) and fall back to an RFC-4122 v4 shape where it is absent
// (dev-grade randomness; still a valid uuid the DB accepts).
export function newMutationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}
