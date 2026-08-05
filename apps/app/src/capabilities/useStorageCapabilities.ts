import { useEffect, useState } from 'react';
import {
  resolveTier,
  tierBehaviour,
  type StorageCapabilities,
  type StorageTier,
  type TierBehaviour,
} from '@bygsmart/core';
import { detectStorageCapabilities } from './probe';

export interface StorageCapabilityState {
  loading: boolean;
  caps: StorageCapabilities | null;
  tier: StorageTier | null;
  behaviour: TierBehaviour | null;
}

/**
 * Runs the platform-aware capability probe once and reports the graded tier + its
 * behaviour. Consumers gate offline affordances on `behaviour.canQueueMutations`
 * (never queue on an online-only runtime — P3).
 */
export function useStorageCapabilities(): StorageCapabilityState {
  const [state, setState] = useState<StorageCapabilityState>({
    loading: true,
    caps: null,
    tier: null,
    behaviour: null,
  });

  useEffect(() => {
    let cancelled = false;
    detectStorageCapabilities().then((caps) => {
      if (cancelled) return;
      const tier = resolveTier(caps);
      setState({ loading: false, caps, tier, behaviour: tierBehaviour(tier) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
