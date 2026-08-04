// ─────────────────────────────────────────────────────────────────────────────
// Kernel-owned navigation entries (Phase 5 slot takeover).
//
// Everything module-owned contributes via manifests' `nav` slot; the Kernel
// keeps only Hjem, the raised Scan action and Indstillinger. `moduleId` on a
// kernel entry is a VISIBILITY gate (Scan hides when the AR module is off)
// without moving ownership — the AR module proper extracts in Phase 7.
// ─────────────────────────────────────────────────────────────────────────────

import type { NavContribution, ModuleId } from '../registry/types';
import { HomeIcon, CameraIcon, SettingsIcon } from '../../components/icons';

export interface KernelNavEntry extends NavContribution {
  /** Optional module visibility gate for kernel-placed entries. */
  moduleId?: ModuleId;
}

export const KERNEL_NAV: KernelNavEntry[] = [
  {
    to: '/home',
    label: 'Hjem',
    icon: HomeIcon,
    surface: 'bottom',
    order: 0,
    match: (p) => p === '/' || p.startsWith('/home'),
  },
  {
    to: '/settings',
    label: 'Indstil.',
    icon: SettingsIcon,
    surface: 'rail',
    order: 110,
    match: (p) => p.startsWith('/settings'),
  },
];
