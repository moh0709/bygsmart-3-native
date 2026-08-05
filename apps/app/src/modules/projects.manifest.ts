import type { ModuleManifest } from '@bygsmart/core';

/** Projects module — contributes its nav item into the bottom slot (registry-driven, H-01). */
export const projectsManifest: ModuleManifest = {
  id: 'projects',
  name: 'Projekter',
  description: 'Projekt-hub, overblik og status',
  requires: [],
  entitlement: 'module.projects',
  nav: [{ to: '/projects', label: 'Projekter', icon: 'projects', surface: 'bottom', order: 20 }],
};
