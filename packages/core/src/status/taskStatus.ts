// @bygsmart/core — task status presentation metadata (pure).
//
// Harvested from legacy/modules/tasks/components/taskMeta.ts (STATUS_VARIANT +
// statusLabel). Tones map onto the framework-agnostic StatusTone; 2.1's 'info'
// (Igangværende) → 'primary' since the 3.0 UI kit has no 'info' tone.

import type { StatusTone, TaskStatus } from '../types';

/** Status → pill tone. */
export const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  'To Do': 'neutral',
  'Igangværende': 'primary',
  'Udført': 'success',
  'Forfalden': 'danger',
  'Annulleret': 'neutral',
};

/** Human label; the raw 'To Do' reads as "Ikke startet". */
export const statusLabel = (status: TaskStatus): string =>
  status === 'To Do' ? 'Ikke startet' : status;
