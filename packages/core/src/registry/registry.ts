// Module registry — assembles the active manifest set from entitlements.
// Harvested from legacy/core/registry/registry.ts. Decoupled from the app's ALL_MANIFESTS:
// callers pass their manifest list (the app owns the static-import manifest file, per the
// Metro/boundaries guardrail). The requires-closure + slot collection logic is unchanged.

import type { ModuleId, ModuleManifest, SlotContributions, SlotKey } from './types';

/**
 * Filter manifests to the enabled set, then iteratively drop any manifest whose declared
 * dependencies aren't all still present (handles transitive chains, e.g. ar → tools).
 * Preserves the input declaration order for stable slot rendering.
 */
export const resolveActiveManifests = (
  enabled: ReadonlySet<ModuleId>,
  manifests: ModuleManifest[],
): ModuleManifest[] => {
  const active = new Map<ModuleId, ModuleManifest>();
  for (const manifest of manifests) {
    if (enabled.has(manifest.id)) active.set(manifest.id, manifest);
  }

  let dropped = true;
  while (dropped) {
    dropped = false;
    for (const manifest of active.values()) {
      if (manifest.requires.some((dep) => !active.has(dep))) {
        active.delete(manifest.id);
        dropped = true;
      }
    }
  }

  return manifests.filter((m) => active.has(m.id));
};

export const EMPTY_SLOTS: SlotContributions = {
  nav: [],
  routes: [],
  projectTabs: [],
  homeWidgets: [],
  settingsSections: [],
  searchSources: [],
  quickActions: [],
};

/** Collect one slot's contributions across the active manifests, sorted by `order`. */
export const collectSlot = <K extends SlotKey>(
  manifests: ModuleManifest[],
  slot: K,
): SlotContributions[K] => {
  const contributions = manifests.flatMap((m) => (m[slot] ?? []) as unknown[]);
  const sorted = [...contributions].sort((a, b) => {
    const orderA = (a as { order?: number }).order ?? 0;
    const orderB = (b as { order?: number }).order ?? 0;
    return orderA - orderB;
  });
  return sorted as SlotContributions[K];
};
