// @bygsmart/core — graded offline storage tier (pure). The S-13 / PRD §6.1 offline
// contract's decision core, harvested from the D-11 spike (spikes/src/web-capability.ts).
//
// Capabilities → tier → behaviour, all pure. The Web-API probe that produces the
// capabilities lives in the app (it touches navigator.storage / OPFS and must be
// Platform-aware — native runtimes are always durable). Principle P3 lives here:
// an online-only runtime MUST refuse to queue mutations rather than lie about
// durability.

export type StorageTier = 'full' | 'session-durable' | 'online-only';

export interface StorageCapabilities {
  /** Durable local store present (OPFS on web; always true on native). */
  opfsAvailable: boolean;
  /** Storage granted persistence — far less likely to be evicted. */
  persistent: boolean;
  /** Bytes remaining, if estimable. */
  quotaBytes: number | null;
}

/** Pure: capabilities → tier (plan §3.4 R8, PRD §6.1). */
export function resolveTier(c: Pick<StorageCapabilities, 'opfsAvailable' | 'persistent'>): StorageTier {
  if (!c.opfsAvailable) return 'online-only';
  return c.persistent ? 'full' : 'session-durable';
}

export interface TierBehaviour {
  /** Online-only MUST refuse to queue — never lie about durability (principle P3). */
  canQueueMutations: boolean;
  warnsEvictable: boolean;
  promptInstall: boolean;
}

/** Pure: tier → behaviour. */
export function tierBehaviour(tier: StorageTier): TierBehaviour {
  switch (tier) {
    case 'full':
      return { canQueueMutations: true, warnsEvictable: false, promptInstall: false };
    case 'session-durable':
      return { canQueueMutations: true, warnsEvictable: true, promptInstall: true };
    case 'online-only':
      return { canQueueMutations: false, warnsEvictable: true, promptInstall: true };
  }
}
