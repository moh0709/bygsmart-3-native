import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';

/**
 * Udførelse & Kommunikation — extracted in Phase 7 Wave 3 (PRD §9.5).
 * Contributes the /task/:taskId workspace route. The workspace's own tabs are
 * DB-driven (per-task disabled tabs) and render inside TaskWorkspaceContent,
 * not via shell slots.
 */
export const manifest: ModuleManifest = {
  id: 'field',
  name: MODULE_INFO['field'].name,
  description: MODULE_INFO['field'].description,
  requires: ['tasks'],
  entitlement: 'module.field',
  routes: [
    {
      path: '/task/:taskId',
      load: () => import('./pages/TaskDetailPage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
};
