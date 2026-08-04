import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Tilbud & Salg — extracted in Phase 7 Wave 4 (PRD §9.14).
 * Quotations tab + service behind index.ts. ProjectDetailPage owns the tab's
 * prop-wiring until W7 (no load() yet).
 *
 * requires:['reporting'] — sending a client-facing quotation PDF is
 * quotations' core deliverable, and that PDF/Excel generation lives entirely
 * in the reporting module. Mirrored server-side in server/moduleCatalog.js's
 * MODULE_REQUIRES — keep both in sync.
 */
export const manifest: ModuleManifest = {
  id: 'quotations',
  name: MODULE_INFO['quotations'].name,
  description: MODULE_INFO['quotations'].description,
  requires: ['reporting'],
  entitlement: 'module.quotations',
  projectTabs: [
    {
      key: 'tilbud',
      destination: 'okonomi',
      label: 'Tilbud & Rapport',
      order: 115,
      isAllowed: allowedIn('owner-manager'),
    },
  ],
};
