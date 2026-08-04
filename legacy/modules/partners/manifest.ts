import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';

/**
 * Partnere & Underentreprenører — extracted in Phase 7 Wave 5 (PRD §9.15).
 * Contributes the partner tab and the scoped partner project view route.
 */
export const manifest: ModuleManifest = {
  id: 'partners',
  name: MODULE_INFO['partners'].name,
  description: MODULE_INFO['partners'].description,
  requires: [],
  entitlement: 'module.partners',
  homeWidgets: [
    { id: 'partners-invites', context: 'both', section: 'action', order: 40, load: () => import('./components/home/PartnerInvitesWidget').then((m) => ({ default: m.PartnerInvitesWidget })) },
    { id: 'partners-my-tasks', context: 'worker', section: 'main', order: 30, load: () => import('./components/home/PartnerTasksWidget').then((m) => ({ default: m.PartnerTasksWidget })) },
  ],
  projectTabs: [
    {
      key: 'partnere',
      destination: 'mere',
      label: 'Partnere',
      order: 50,
      isAllowed: allowedIn('owner-manager'),
    },
  ],
  routes: [
    {
      path: '/partner-project/:projectId',
      load: () => import('./components/PartnerProjectPage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
};
