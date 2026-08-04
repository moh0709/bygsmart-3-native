import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';
import { CheckSquareIcon } from '../../components/icons';

/**
 * Opgaver — extracted in Phase 7 Wave 7b (PRD §9.2). Contributes the /tasks
 * page, the Opgaver nav item and the Opgaver project tab; task/quick-task/
 * task-access services live behind the module barrel.
 */
export const manifest: ModuleManifest = {
  id: 'tasks',
  name: MODULE_INFO['tasks'].name,
  description: MODULE_INFO['tasks'].description,
  requires: [],
  entitlement: 'module.tasks',
  homeWidgets: [
    { id: 'tasks-overdue-alert', context: 'management', section: 'action', order: 10, load: () => import('./components/home/OverdueAlertWidget').then((m) => ({ default: m.OverdueAlertWidget })) },
    { id: 'tasks-invites', context: 'both', section: 'action', order: 20, load: () => import('./components/home/TaskInvitesWidget').then((m) => ({ default: m.TaskInvitesWidget })) },
    { id: 'tasks-focus-today', context: 'management', section: 'main', order: 20, load: () => import('./components/home/FocusTodayWidget').then((m) => ({ default: m.FocusTodayWidget })) },
    { id: 'tasks-my-day', context: 'worker', section: 'main', order: 20, load: () => import('./components/home/MyDayWidget').then((m) => ({ default: m.MyDayWidget })) },
  ],
  routes: [
    {
      path: '/tasks',
      load: () => import('./pages/GlobalTasksPage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
  nav: [
    {
      to: '/tasks',
      label: 'Opgaver',
      icon: CheckSquareIcon,
      surface: 'bottom',
      order: 30,
      match: (p) => p.startsWith('/tasks') || p.startsWith('/task/'),
    },
  ],
  projectTabs: [
    {
      key: 'opgaver',
      destination: 'opgaver',
      label: 'Opgaver',
      order: 10,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'vis-none', 'external', 'fallback'),
    },
  ],
};
