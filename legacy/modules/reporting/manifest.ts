import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';

/**
 * Rapporter & Eksport — extracted in Phase 7 Wave 1 (PRD §9.16).
 *
 * No shell contributions yet: reporting's surfaces (PDF/Excel actions and the
 * report-branding panel) render embedded in other modules' pages and are
 * imported via this module's index.ts. Entitlement-gating of those embedded
 * actions lands when their host pages convert in later waves (W4/W7).
 */
export const manifest: ModuleManifest = {
  id: 'reporting',
  name: MODULE_INFO['reporting'].name,
  description: MODULE_INFO['reporting'].description,
  requires: [],
  entitlement: 'module.reporting',
};
