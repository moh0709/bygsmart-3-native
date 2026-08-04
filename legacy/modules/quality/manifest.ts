import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * KS & Aflevering — extracted in Phase 7 Wave 3 (PRD §9.6).
 * Punch-list tab + KS/punch services live behind index.ts. ProjectDetailPage
 * still owns the tab's prop-wiring (heterogeneous tab props) until W7, so the
 * contribution carries no load() yet. Note: the task-handover service stays
 * with modules/field's task workspace (operationally workspace code), a
 * deliberate deviation from the PRD's file grouping.
 *
 * requires:['field'] — QC photo/signature uploads route through field's
 * storage functions (TaskQualityControlTab), so quality is functionally
 * broken without field active. Mirrored server-side in
 * server/moduleCatalog.js's MODULE_REQUIRES — keep both in sync.
 */
export const manifest: ModuleManifest = {
  id: 'quality',
  name: MODULE_INFO['quality'].name,
  description: MODULE_INFO['quality'].description,
  requires: ['field'],
  entitlement: 'module.quality',
  projectTabs: [
    {
      key: 'punch-list',
      destination: 'opgaver',
      label: 'Punch',
      order: 70,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'vis-none', 'external', 'fallback'),
    },
  ],
};
