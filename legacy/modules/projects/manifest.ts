import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';
import { FolderIcon } from '../../components/icons';

/**
 * Projekter — extracted in Phase 7 Wave 7c (PRD §9.1). The base module:
 * contributes /projects + /project-detail/:id + /projects/new, the Projekter
 * nav item and the Overblik/Detaljer project tabs. ProjectDetailPage (inside
 * this module) hosts the projectTabs slot for every other module.
 */
export const manifest: ModuleManifest = {
  id: 'projects',
  name: MODULE_INFO['projects'].name,
  description: MODULE_INFO['projects'].description,
  requires: [],
  entitlement: 'module.projects',
  homeWidgets: [
    { id: 'projects-kpis', context: 'management', section: 'main', order: 10, load: () => import('./components/home/OverviewKpisWidget').then((m) => ({ default: m.OverviewKpisWidget })) },
    { id: 'projects-pulse', context: 'management', section: 'main', order: 40, load: () => import('./components/home/ProjectPulseWidget').then((m) => ({ default: m.ProjectPulseWidget })) },
    { id: 'projects-pending-invites', context: 'worker', section: 'action', order: 50, load: () => import('./components/home/ProjectInvitesActionWidget').then((m) => ({ default: m.ProjectInvitesActionWidget })) },
  ],
  routes: [
    {
      path: '/projects',
      load: () => import('./pages/ProjectsPage'),
      guard: 'auth',
      layout: 'main',
    },
    {
      path: '/projects/new',
      // v3 wizard directly — the v2 wizard (?wizard=v2 escape hatch) was
      // retired 2026-07-11 after v3 parity was confirmed in production.
      load: () => import('./pages/NytProjektWizardPage'),
      guard: 'auth',
      layout: 'main',
    },
    {
      path: '/project-detail/:id',
      load: () => import('./pages/ProjectDetailPage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
  nav: [
    {
      to: '/projects',
      label: 'Projekter',
      icon: FolderIcon,
      surface: 'bottom',
      order: 10,
      match: (p) => p.startsWith('/projects') || p.startsWith('/project-detail'),
    },
  ],
  projectTabs: [
    {
      key: 'overblik',
      destination: 'overblik',
      label: 'Overblik',
      order: 0,
      isAllowed: allowedIn('client', 'owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'external', 'fallback'),
    },
    {
      key: 'detaljer',
      destination: 'mere',
      label: 'Detaljer',
      order: 110,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'fallback'),
    },
  ],
};
