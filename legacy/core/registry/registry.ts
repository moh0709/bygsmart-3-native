// ─────────────────────────────────────────────────────────────────────────────
// Module registry — assembles the active manifest set from entitlements.
//
// resolveActiveManifests() filters ALL_MANIFESTS down to modules that are
// (a) entitled and (b) have their whole `requires` closure entitled — a
// module whose dependency is off does not render (PRD §10.6 Q2: capability
// detection / graceful degradation).
// ─────────────────────────────────────────────────────────────────────────────

import { ALL_MANIFESTS } from './manifests';
import type { ModuleId, ModuleManifest, SlotContributions, SlotKey } from './types';

/**
 * Filter manifests to the enabled set, then iteratively drop any manifest
 * whose declared dependencies aren't all still present (handles transitive
 * chains, e.g. ar → tools).
 */
export const resolveActiveManifests = (
  enabled: ReadonlySet<ModuleId>,
  manifests: ModuleManifest[] = ALL_MANIFESTS
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

  // Preserve ALL_MANIFESTS declaration order for stable slot rendering.
  return manifests.filter((m) => active.has(m.id));
};

const EMPTY_SLOTS: SlotContributions = {
  nav: [],
  routes: [],
  projectTabs: [],
  homeWidgets: [],
  settingsSections: [],
  searchSources: [],
  quickActions: [],
};

/** Collect one slot's contributions across the active manifests, sorted by `order` where present. */
export const collectSlot = <K extends SlotKey>(
  manifests: ModuleManifest[],
  slot: K
): SlotContributions[K] => {
  const contributions = manifests.flatMap((m) => (m[slot] ?? []) as unknown[]);
  const sorted = [...contributions].sort((a, b) => {
    const orderA = (a as { order?: number }).order ?? 0;
    const orderB = (b as { order?: number }).order ?? 0;
    return orderA - orderB;
  });
  return sorted as SlotContributions[K];
};

export { EMPTY_SLOTS };
