import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { REGULATION_SEARCH_SOURCES } from './searchSources';

/**
 * Viden & Reglement — extracted in Phase 7 Wave 1 (PRD §9.4).
 * Contributes the regulation/guide detail routes and the regulation search
 * sources rendered by the kernel-hosted SearchPage (searchSources slot).
 */
export const manifest: ModuleManifest = {
  id: 'knowledge',
  name: MODULE_INFO['knowledge'].name,
  description: MODULE_INFO['knowledge'].description,
  requires: [],
  entitlement: 'module.knowledge',
  routes: [
    {
      path: '/regulation/:id',
      load: () => import('./pages/RegulationDetailPage'),
      guard: 'auth',
      layout: 'main',
    },
    {
      path: '/guide/:guideId',
      load: () => import('./pages/BuildingGuidePage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
  searchSources: REGULATION_SEARCH_SOURCES,
};
