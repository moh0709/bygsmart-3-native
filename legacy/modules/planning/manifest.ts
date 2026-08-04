import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Skeleton manifest (Phase 5 slot takeover): declares the module's nav /
 * project-tab contributions. The domain code itself is still in the legacy
 * folders and moves behind this boundary in a Phase 7 wave.
 */
export const manifest: ModuleManifest = {
  id: 'planning',
  name: MODULE_INFO['planning'].name,
  description: MODULE_INFO['planning'].description,
  requires: [],
  entitlement: 'module.planning',
  projectTabs: [
    {
      key: 'pamindelser',
      destination: 'plan',
      label: 'Påmindelser',
      order: 80,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'external', 'fallback'),
    },
    {
      key: 'opfølgning',
      destination: 'mere',
      label: 'Opfølgning',
      order: 60,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'external', 'fallback'),
    },
  ],
};
