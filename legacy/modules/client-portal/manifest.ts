import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';

/**
 * Kunde-portal — registered in Phase 7 Wave 5 (PRD §9.17). No shell
 * contributions yet: CLIENT access is currently the role-scoped project tabs;
 * dedicated portal surfaces are future work (post-W7).
 */
export const manifest: ModuleManifest = {
  id: 'client-portal',
  name: MODULE_INFO['client-portal'].name,
  description: MODULE_INFO['client-portal'].description,
  requires: ['projects'],
  entitlement: 'module.client-portal',
};
