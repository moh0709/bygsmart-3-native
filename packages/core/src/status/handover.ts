// @bygsmart/core — task handover state machine (pure transition graph).
//
// Harvested as the pure core of legacy/modules/field/services/taskWorkspace/handover.ts
// (submit/accept/reject) + the derived stepper from that page's helpers.ts. The
// Supabase writes, signatures, notifications and report pinning stay in the app's
// service layer — this module owns ONLY the state rules, so they are testable and
// shared by every runtime.

import type { Task, TaskHandoverStatus, TaskStatus } from '../types';

/** Review actions available on a handover. */
export type HandoverEvent = 'submit' | 'accept' | 'reject';

/**
 * The state change a handover event produces.
 * `taskStatus === undefined` means the event leaves the task's own status alone
 * (submit only moves the handover pointer; the worker keeps working until review).
 */
export interface HandoverEffect {
  handoverStatus: TaskHandoverStatus;
  taskStatus?: TaskStatus;
  /** Whether the task's `completed_at` should be stamped (accept only). */
  setsCompletedAt: boolean;
}

/**
 * Resolve the effect of a handover event. Mirrors the 2.1 service writes:
 * - submit → handover 'submitted' (task status untouched)
 * - accept → handover 'accepted', task 'Udført', stamp completed_at
 * - reject → handover 'rejected', task reverts to 'Igangværende'
 */
export const applyHandoverEvent = (event: HandoverEvent): HandoverEffect => {
  switch (event) {
    case 'submit':
      return { handoverStatus: 'submitted', setsCompletedAt: false };
    case 'accept':
      return { handoverStatus: 'accepted', taskStatus: 'Udført', setsCompletedAt: true };
    case 'reject':
      return { handoverStatus: 'rejected', taskStatus: 'Igangværende', setsCompletedAt: false };
  }
};

/**
 * Can a worker (re)submit? Everything except an already-accepted task —
 * a rejected task reverts to in-progress and may be resubmitted.
 */
export const canSubmitHandover = (current: TaskHandoverStatus | undefined): boolean =>
  current !== 'accepted';

/**
 * Can a reviewer accept/reject? Only a submitted handover awaits review
 * (mirrors the service's `.eq('status', 'submitted')` fetch).
 */
export const canReviewHandover = (current: TaskHandoverStatus | undefined): boolean =>
  current === 'submitted';

/** Ordered stages the handover stepper walks through. */
export const HANDOVER_STEPS = ['Ikke startet', 'I gang', 'Afventer godkendelse', 'Afsluttet'] as const;

/**
 * Derived stepper position (0..3) for the handover UI (from helpers.ts).
 * accepted/Udført → 3, submitted → 2, in-progress/overdue/rejected → 1, else 0.
 */
export const stepperIndexFor = (task: Pick<Task, 'status' | 'handoverStatus'>): number => {
  if (task.handoverStatus === 'accepted' || task.status === 'Udført') return 3;
  if (task.handoverStatus === 'submitted') return 2;
  if (
    task.status === 'Igangværende' ||
    task.status === 'Forfalden' ||
    task.handoverStatus === 'rejected'
  ) {
    return 1;
  }
  return 0;
};
