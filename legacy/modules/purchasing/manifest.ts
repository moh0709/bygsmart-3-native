import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Indkøb & Leverandører — extracted in Phase 7 Wave 4 (PRD §9.12).
 * Purchasing tab, purchase/supplier services and PurchaseFormModal behind
 * index.ts. Receipts upload to the bucket as of W4 (legacy rows dual-read).
 */
export const manifest: ModuleManifest = {
  id: 'purchasing',
  name: MODULE_INFO['purchasing'].name,
  description: MODULE_INFO['purchasing'].description,
  requires: [],
  entitlement: 'module.purchasing',
  projectTabs: [
    {
      key: 'indkob',
      destination: 'okonomi',
      label: 'Indkøb',
      order: 40,
      isAllowed: allowedIn('owner-manager', 'vis-all'),
    },
  ],
};
