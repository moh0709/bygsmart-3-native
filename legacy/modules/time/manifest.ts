import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';
import { allowedIn } from '../../core/shell/projectTabAccess';
import { ClockIcon } from '../../components/icons';

/**
 * Time module: weekly time-registration page (staff wizard + CEO/manager
 * overview) at /tidsregistrering, plus the in-project Tid & Plan tab and
 * the worker home widget.
 *
 * Nav: Tid claims the raised CENTER slot on phones (order 19 beats ar's
 * Scan at 20 — BottomNavBar keeps only the lowest-order center item, so
 * Scan yields when time is active and returns when it isn't; Scan stays
 * on the Værktøjer page + desktop rail either way). On the rail this
 * renders as a normal item.
 */
export const manifest: ModuleManifest = {
  id: 'time',
  name: MODULE_INFO['time'].name,
  description: MODULE_INFO['time'].description,
  requires: [],
  entitlement: 'module.time',
  nav: [
    {
      to: '/tidsregistrering',
      label: 'Tid',
      icon: ClockIcon,
      surface: 'bottom',
      order: 19,
      center: true,
    },
  ],
  routes: [
    {
      path: '/tidsregistrering',
      load: () => import('./pages/TidsregistreringPage'),
      guard: 'auth',
      layout: 'main',
    },
  ],
  homeWidgets: [
    { id: 'time-today-hours', context: 'worker', section: 'main', order: 10, load: () => import('./components/home/TodayHoursWidget').then((m) => ({ default: m.TodayHoursWidget })) },
  ],
  projectTabs: [
    {
      key: 'tid-plan',
      destination: 'plan',
      label: 'Tid & Plan',
      order: 20,
      isAllowed: allowedIn('owner-manager', 'vis-all', 'vis-some', 'vis-standard', 'external', 'fallback'),
    },
  ],
};
