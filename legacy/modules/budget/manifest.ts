import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Budget & Økonomistyring — extracted in Phase 7 Wave 4 (PRD §9.11).
 * Budget tab + baseline/revision service behind index.ts. ProjectDetailPage
 * owns the tab's prop-wiring until W7 (no load() yet).
 */
export const manifest: ModuleManifest = {
  id: 'budget',
  name: MODULE_INFO['budget'].name,
  description: MODULE_INFO['budget'].description,
  requires: [],
  entitlement: 'module.budget',
  projectTabs: [
    {
      key: 'budget',
      destination: 'okonomi',
      label: 'Budget',
      order: 30,
      isAllowed: allowedIn('owner-manager', 'vis-all'),
    },
  ],
};
