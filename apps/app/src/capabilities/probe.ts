// Platform-aware storage-capability probe (P1 1.8, migrated from spikes/src/web-capability.ts).
//
// Native runtimes (iOS/Android) always have a durable on-device store (SQLite) → full
// tier, no probing. Only the WEB runtime is graded: OPFS presence + persistence grant
// decide full / session-durable / online-only. The pure tier/behaviour logic lives in
// @bygsmart/core; this file is the Web-API binding the composition root wires in.

import { Platform } from 'react-native';
import type { StorageCapabilities } from '@bygsmart/core';

/** Real web probe — guarded so it is safe to call anywhere (returns online-only-shaped caps when APIs are absent). */
async function probeWebStorage(): Promise<StorageCapabilities> {
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
      opfsAvailable = false; // present but unusable (e.g. Safari private browsing)
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

/** Detect this runtime's durable-storage capabilities. Native = always full; web = graded. */
export async function detectStorageCapabilities(): Promise<StorageCapabilities> {
  if (Platform.OS !== 'web') {
    // Native has durable SQLite — the graded web probe does not apply.
    return { opfsAvailable: true, persistent: true, quotaBytes: null };
  }
  return probeWebStorage();
}

/** Request persistent storage (web only; native is already durable). Surface the result in the Sync Centre. */
export async function requestPersistence(): Promise<boolean> {
  if (Platform.OS !== 'web') return true;
  const g = globalThis as unknown as { navigator?: { storage?: { persist?: () => Promise<boolean> } } };
  const persist = g.navigator?.storage?.persist;
  if (typeof persist !== 'function') return false;
  try {
    return await persist();
  } catch {
    return false;
  }
}
