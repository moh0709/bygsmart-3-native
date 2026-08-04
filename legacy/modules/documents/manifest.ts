import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Dokumenter & Tegninger — extracted in Phase 7 Wave 2 (PRD §9.9).
 * Contributes the Dokumenter project tab; the tab component and the document
 * service live behind index.ts. ProjectDetailPage still owns the tab's
 * prop-wiring (heterogeneous tab props) until the projects wave (W7), so the
 * contribution carries no load() yet.
 */
export const manifest: ModuleManifest = {
  id: 'documents',
  name: MODULE_INFO['documents'].name,
  description: MODULE_INFO['documents'].description,
  requires: [],
  entitlement: 'module.documents',
  projectTabs: [
    {
      key: 'dokumenter',
      destination: 'mere',
      label: 'Dokumenter',
      order: 100,
      isAllowed: allowedIn('client', 'owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'fallback'),
    },
  ],
};
