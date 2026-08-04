// ─────────────────────────────────────────────────────────────────────────────
// Shared project metric helpers (Shared Foundations)
//
// Pure, deterministic, unit-testable functions consumed by BOTH Goal A
// (Projekt-sundhed / computeIntelligenceIndex) and Goal B (AI Tidsplan /
// scheduleEvaluation) so the same figure can never diverge between the two
// surfaces again — the exact trap the epic set out to avoid (two health scores).
//
// Everything here is a plain input→output function with no I/O and no reliance
// on ambient state; where "now" matters it is injectable so tests stay
// deterministic. The canonical budget figure lives in projectIntelligence.ts
// and is re-exported (not re-implemented) below.
// ─────────────────────────────────────────────────────────────────────────────

import { Task, TimeEntry, TaskQualityControl, PunchListItem, TaskHandover } from '../types';

// Re-export the single canonical budget-vs-actual figure so callers get exactly
// one implementation (do NOT duplicate this calculation).
export { computeBudgetUtilization } from '../modules/ai';
export type { BudgetUtilization } from '../modules/ai';

// ── Local helpers ──────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const parseTime = (value?: string | null): number | null => {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

// ── computeVelocity — schedule performance ──────────────────────────────────────

export interface VelocityInput {
  tasks: Pick<Task, 'status' | 'dueDate'>[];
  startDate?: string | null;
  endDate?: string | null;
  /** Fallback progress (0–100) used only when there are no tasks to count. */
  progress?: number;
  /** Injected clock (ms since epoch) for deterministic tests. */
  now?: number;
}

export interface VelocityResult {
  totalTasks: number;
  doneTasks: number;
  /** Completed share (0–1). */
  doneRatio: number;
  /** Elapsed share of the project timeframe (0–1); 0 when dates are missing. */
  elapsedRatio: number;
  /** doneRatio ÷ elapsedRatio: 1 = on schedule, >1 ahead, <1 behind; 0 = unknown. */
  schedulePerformanceIndex: number;
  overdueTasks: number;
  /** overdueTasks ÷ totalTasks (0 when there are no tasks). */
  overdueShare: number;
  status: 'ahead' | 'on-track' | 'behind' | 'unknown';
}

/**
 * Compares work done against time elapsed and surfaces the overdue share.
 * Needs both a start and end date to assess pace; without them the pace is
 * reported as `unknown` (SPI 0) rather than guessed.
 */
export const computeVelocity = (input: VelocityInput): VelocityResult => {
  const { tasks, startDate, endDate, progress = 0, now = Date.now() } = input;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'Udført').length;
  const doneRatio = totalTasks > 0 ? doneTasks / totalTasks : clamp01((progress ?? 0) / 100);

  const start = parseTime(startDate);
  const end = parseTime(endDate);
  const elapsedRatio =
    start !== null && end !== null && end > start ? clamp01((now - start) / (end - start)) : 0;

  const overdueTasks = tasks.filter(t => {
    if (t.status === 'Udført' || t.status === 'Annulleret') return false;
    if (t.status === 'Forfalden') return true;
    const due = parseTime(t.dueDate);
    return due !== null && due < now;
  }).length;
  const overdueShare = totalTasks > 0 ? overdueTasks / totalTasks : 0;

  let schedulePerformanceIndex = 0;
  let status: VelocityResult['status'] = 'unknown';
  if (elapsedRatio > 0) {
    schedulePerformanceIndex = doneRatio / elapsedRatio;
    const diff = doneRatio - elapsedRatio;
    status = diff >= 0.05 ? 'ahead' : diff <= -0.05 ? 'behind' : 'on-track';
  }

  return {
    totalTasks,
    doneTasks,
    doneRatio,
    elapsedRatio,
    schedulePerformanceIndex,
    overdueTasks,
    overdueShare,
    status,
  };
};

// ── computeTimeBurn — estimated vs logged hours ─────────────────────────────────

export interface TimeBurnResult {
  /** Σ task estimatedHours. */
  estimatedHours: number;
  /** Σ logged TimeEntry.hours. */
  loggedHours: number;
  /** max(0, estimated − logged). */
  remainingHours: number;
  /** loggedHours ÷ estimatedHours: >1 = over budget; 0 when nothing is estimated. */
  burnRatio: number;
  /** estimatedHours ÷ loggedHours: >1 = ahead of estimate; 0 when nothing is logged. */
  efficiency: number;
  overBudget: boolean;
}

/**
 * Sums estimated task hours against logged time entries and reports the
 * remaining budget, burn ratio and efficiency.
 */
export const computeTimeBurn = (
  tasks: Pick<Task, 'estimatedHours'>[],
  timeEntries: Pick<TimeEntry, 'hours'>[]
): TimeBurnResult => {
  const estimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const loggedHours = timeEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const remainingHours = Math.max(0, estimatedHours - loggedHours);

  return {
    estimatedHours,
    loggedHours,
    remainingHours,
    burnRatio: estimatedHours > 0 ? loggedHours / estimatedHours : 0,
    efficiency: loggedHours > 0 ? estimatedHours / loggedHours : 0,
    overBudget: estimatedHours > 0 && loggedHours > estimatedHours,
  };
};

// ── computeQualitySignal — KS + punch quality ───────────────────────────────────

export interface QualitySignalResult {
  totalControls: number;
  /** result === 'godkendt'. */
  passed: number;
  /** result === 'ikke_godkendt'. */
  failed: number;
  /** passed ÷ (passed + failed): 0 when no controls have a result. */
  passRate: number;
  /** Controls flagged with a deviation. */
  deviations: number;
  /** Deviations without a corrective action recorded yet (i.e. still open). */
  openDeviations: number;
  totalPunch: number;
  /** Punch items whose status is not 'Løst'. */
  openPunch: number;
  /** Punch items whose status is 'Løst'. */
  resolvedPunch: number;
  /** resolvedPunch ÷ totalPunch (0 when there are no punch items). */
  punchResolutionRate: number;
}

/**
 * Derives a quality signal from KS controls (pass rate + open deviations) and
 * the punch list (open vs resolved).
 */
export const computeQualitySignal = (
  qualityControls: Pick<TaskQualityControl, 'result' | 'hasDeviation' | 'correctiveAction'>[],
  punchItems: Pick<PunchListItem, 'status'>[]
): QualitySignalResult => {
  const passed = qualityControls.filter(c => c.result === 'godkendt').length;
  const failed = qualityControls.filter(c => c.result === 'ikke_godkendt').length;
  const rated = passed + failed;

  const deviations = qualityControls.filter(c => c.hasDeviation).length;
  const openDeviations = qualityControls.filter(
    c => c.hasDeviation && !(c.correctiveAction && c.correctiveAction.trim())
  ).length;

  const resolvedPunch = punchItems.filter(p => p.status === 'Løst').length;
  const openPunch = punchItems.length - resolvedPunch;

  return {
    totalControls: qualityControls.length,
    passed,
    failed,
    passRate: rated > 0 ? passed / rated : 0,
    deviations,
    openDeviations,
    totalPunch: punchItems.length,
    openPunch,
    resolvedPunch,
    punchResolutionRate: punchItems.length > 0 ? resolvedPunch / punchItems.length : 0,
  };
};

// ── computeHandoverCompletion — sign-off progress ───────────────────────────────

export interface HandoverCompletionResult {
  /** Number of task handover rows. */
  total: number;
  submitted: number;
  accepted: number;
  rejected: number;
  /** accepted ÷ total: fully signed-off share. */
  acceptedShare: number;
  /** (submitted + accepted) ÷ total: reached-handover (not rejected) share. */
  submittedShare: number;
}

/**
 * Reports how far the project's task handovers have progressed through the
 * submitted → accepted workflow.
 */
export const computeHandoverCompletion = (
  handovers: Pick<TaskHandover, 'status'>[]
): HandoverCompletionResult => {
  const total = handovers.length;
  const submitted = handovers.filter(h => h.status === 'submitted').length;
  const accepted = handovers.filter(h => h.status === 'accepted').length;
  const rejected = handovers.filter(h => h.status === 'rejected').length;

  return {
    total,
    submitted,
    accepted,
    rejected,
    acceptedShare: total > 0 ? accepted / total : 0,
    submittedShare: total > 0 ? (submitted + accepted) / total : 0,
  };
};
