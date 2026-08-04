import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { CameraIcon } from '../../components/icons';

/**
 * AR & Opmaaling -- extracted in Phase 7 Wave 6. Owns the raised Scan nav
 * action (moved out of core/shell/kernelNav.ts) -- module entitlement now
 * gates it natively instead of the kernel moduleId check.
 */
export const manifest: ModuleManifest = {
  id: 'ar',
  name: MODULE_INFO['ar'].name,
  description: MODULE_INFO['ar'].description,
  requires: ['tools'],
  entitlement: 'module.ar',
  nav: [
    {
      to: '/tools/geometri/ar-opmåling',
      label: 'Scan',
      icon: CameraIcon,
      surface: 'bottom',
      order: 20,
      center: true,
      match: (p) => p.includes('/tools/geometri'),
    },
  ],
};
