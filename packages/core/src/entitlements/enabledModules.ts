// Client fail-open reducer — harvested from legacy/core/entitlements/EntitlementsProvider.tsx
// (the useMemo at lines 169-180). Turns the resolved entitlement map + the owner's hidden set
// into the enabled ModuleId set that feeds the registry's resolveActiveManifests.

import { MODULE_IDS, type ModuleId } from '../registry/types';

/**
 * `modules === null` means still-loading or errored → fail fully OPEN (all modules on): an
 * entitlement outage must never hide capability (principle: never lie about state, and a newer
 * server may know modules this build doesn't gate yet, so unknown ids also fail open).
 * The owner's `hiddenModules` set is a presentation-layer subtraction.
 */
export const computeEnabledModules = (
  modules: Partial<Record<ModuleId, { enabled: boolean }>> | null,
  hiddenModules: ReadonlySet<ModuleId> = new Set(),
): ReadonlySet<ModuleId> => {
  const enabled = new Set<ModuleId>();
  for (const id of MODULE_IDS) {
    const entitled = modules ? modules[id]?.enabled !== false : true;
    if (entitled && !hiddenModules.has(id)) enabled.add(id);
  }
  return enabled;
};
