// D-11 spike — graded web-offline capability detection (the R-arm, and PRD S-13).
// ENGINE-AGNOSTIC and runnable now: this is real Web-API code. The pure decision logic
// (capabilities -> tier -> behaviour) is unit-tested with a mocked navigator; the async
// probe runs against a real browser in the spike and migrates into the app in P1.

export type StorageTier = 'full' | 'session-durable' | 'online-only';

export interface StorageCapabilities {
  /** OPFS present (absent in Safari private browsing). */
  opfsAvailable: boolean;
  /** navigator.storage.persist() granted — far less likely to be evicted. */
  persistent: boolean;
  /** Bytes remaining, if estimable. */
  quotaBytes: number | null;
}

/** Pure: capabilities -> tier (plan §3.4 R8, PRD §6.1). */
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

/** Pure: tier -> behaviour. */
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

/** Real probe — runs in a browser. Guarded so it is safe to import anywhere. */
export async function probeStorageCapabilities(): Promise<StorageCapabilities> {
  const g = globalThis as unknown as {
    navigator?: {
      storage?: {
        getDirectory?: () => Promise<unknown>;
        persisted?: () => Promise<boolean>;
        estimate?: () => Promise<{ quota?: number; usage?: number }>;
      };
    };
  };
  const storage = g.navigator?.storage;

  let opfsAvailable = false;
  if (typeof storage?.getDirectory === 'function') {
    try {
      await storage.getDirectory();
      opfsAvailable = true;
    } catch {
      opfsAvailable = false; // present but unusable (e.g. private browsing)
    }
  }

  let persistent = false;
  if (typeof storage?.persisted === 'function') {
    try {
      persistent = await storage.persisted();
    } catch {
      persistent = false;
    }
  }

  let quotaBytes: number | null = null;
  if (typeof storage?.estimate === 'function') {
    try {
      const est = await storage.estimate();
      quotaBytes = typeof est.quota === 'number' ? est.quota - (est.usage ?? 0) : null;
    } catch {
      quotaBytes = null;
    }
  }

  return { opfsAvailable, persistent, quotaBytes };
}

/** Request persistent storage at first meaningful use (surface result in the Sync Centre). */
export async function requestPersistence(): Promise<boolean> {
  const g = globalThis as unknown as {
    navigator?: { storage?: { persist?: () => Promise<boolean> } };
  };
  const persist = g.navigator?.storage?.persist;
  if (typeof persist !== 'function') return false;
  try {
    return await persist();
  } catch {
    return false;
  }
}
