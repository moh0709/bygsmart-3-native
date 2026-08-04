// ─────────────────────────────────────────────────────────────────────────────
// Registry hooks — how the shell consumes module contributions.
//
//   useActiveManifests() → manifests of entitled modules (requires-closure
//                          satisfied), in declaration order
//   useSlot('nav')       → that slot's contributions across active modules,
//                          sorted by order
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import { useEntitlements } from '../entitlements/EntitlementsProvider';
import { collectSlot, resolveActiveManifests } from './registry';
import type { ModuleManifest, SlotContributions, SlotKey } from './types';

export const useActiveManifests = (): ModuleManifest[] => {
  const { enabledModules } = useEntitlements();
  return useMemo(() => resolveActiveManifests(enabledModules), [enabledModules]);
};

export const useSlot = <K extends SlotKey>(slot: K): SlotContributions[K] => {
  const manifests = useActiveManifests();
  return useMemo(() => collectSlot(manifests, slot), [manifests, slot]);
};
