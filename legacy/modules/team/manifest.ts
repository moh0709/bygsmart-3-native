import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { UsersIcon } from '../../components/icons';

/**
 * Team & Adgang — extracted in Phase 7 Wave 2 (PRD §9.10).
 * Contributes the rail-nav entry and the /team + /team-invite routes.
 */
export const manifest: ModuleManifest = {
  id: 'team',
  name: MODULE_INFO['team'].name,
  description: MODULE_INFO['team'].description,
  requires: [],
  entitlement: 'module.team',
  homeWidgets: [
    { id: 'team-invite-banner', context: 'both', section: 'action', order: 30, load: () => import('./components/home/TeamInviteWidget').then((m) => ({ default: m.TeamInviteWidget })) },
  ],
  nav: [
    {
      to: '/team',
      label: 'Team',
      icon: UsersIcon,
      surface: 'rail',
      order: 100,
      match: (p) => p.startsWith('/team'),
    },
  ],
  routes: [
    {
      path: '/team',
      load: () => import('./pages/TeamManagementPage'),
      guard: 'auth',
      layout: 'main',
    },
    {
      path: '/team-invite',
      load: () => import('./pages/TeamInvitePage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
};
