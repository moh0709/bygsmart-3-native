import type { ModuleManifest } from '@bygsmart/core';

/** Tasks module — contributes its nav item into the bottom slot. */
export const tasksManifest: ModuleManifest = {
  id: 'tasks',
  name: 'Opgaver',
  description: 'Opret, tildel og følg opgaver',
  requires: [],
  entitlement: 'module.tasks',
  nav: [{ to: '/tasks', label: 'Opgaver', icon: 'tasks', surface: 'bottom', order: 10 }],
};
