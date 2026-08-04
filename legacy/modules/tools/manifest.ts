import type { ModuleManifest } from '../../core/registry/types';
import { CalculatorIcon } from '../../components/icons';

/**
 * Calculators & Tools — the first extracted module (PRD §15, Phase 4).
 * Contributes the whole /tools/* route subtree and its nav destination.
 */
export const manifest: ModuleManifest = {
  id: 'tools',
  name: 'Beregnere & Værktøjer',
  description: '~90 beregnere i 16 kategorier med hjælp, standarder og PDF-eksport',
  requires: [],
  entitlement: 'module.tools',
  nav: [
    {
      to: '/tools',
      label: 'Værktøj',
      icon: CalculatorIcon,
      surface: 'bottom',
      order: 40,
      match: (p) => p.startsWith('/tools') && !p.includes('/tools/geometri'),
    },
  ],
  routes: [
    {
      path: '/tools/*',
      load: () => import('./routes'),
      guard: 'auth',
      layout: 'main',
    },
  ],
};
