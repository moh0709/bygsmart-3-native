// @bygsmart/core — project lifecycle state machine (pure).
//
// Harvested as the pure rules behind legacy/modules/projects/services/projectLifecycle.ts
// (close/archive/cancel/reopen). The Supabase writes stay in the app service; the
// reversibility rule — reopen only from Afsluttet/ARCHIVED, CANCELLED terminal —
// lives here where it can be tested and reused.

import type { ProjectStatus } from '../types';

export type LifecycleEvent = 'close' | 'archive' | 'cancel' | 'reopen';

/** Statuses a project can be reopened from (CANCELLED is terminal). */
export const REOPENABLE_FROM: ProjectStatus[] = ['Afsluttet', 'ARCHIVED'];

export const canReopen = (status: ProjectStatus): boolean => REOPENABLE_FROM.includes(status);

/**
 * Resolve the next status for a lifecycle event, or `null` if the transition is
 * illegal (only reopen is guarded — you cannot reopen an active or cancelled project).
 */
export const applyLifecycleEvent = (
  current: ProjectStatus,
  event: LifecycleEvent,
): ProjectStatus | null => {
  switch (event) {
    case 'close':
      return 'Afsluttet';
    case 'archive':
      return 'ARCHIVED';
    case 'cancel':
      return 'CANCELLED';
    case 'reopen':
      return canReopen(current) ? 'I gang' : null;
  }
};
