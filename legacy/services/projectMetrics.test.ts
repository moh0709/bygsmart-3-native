// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PunchListItem, Task, TaskHandover, TaskQualityControl, TimeEntry } from '../types';
import {
  computeBudgetUtilization,
  computeHandoverCompletion,
  computeQualitySignal,
  computeTimeBurn,
  computeVelocity,
} from './projectMetrics';

const DAY = 86_400_000;

// Minimal factories — only the fields the helpers read are required.
const task = (t: Partial<Task>): Task => ({
  id: 't', title: '', status: 'To Do', dueDate: '', assignees: [], ...t,
}) as Task;
const time = (hours: number): TimeEntry => ({ hours } as TimeEntry);
const qc = (q: Partial<TaskQualityControl>): TaskQualityControl =>
  ({ hasDeviation: false, deviationPhotos: [], ...q } as TaskQualityControl);
const punch = (status: PunchListItem['status']): PunchListItem => ({ status } as PunchListItem);
const handover = (status: TaskHandover['status']): TaskHandover => ({ status } as TaskHandover);

// ── computeVelocity ──────────────────────────────────────────────────────────

describe('computeVelocity', () => {
  const NOW = Date.UTC(2026, 0, 15); // midway
  const start = new Date(Date.UTC(2026, 0, 1)).toISOString();
  const end = new Date(Date.UTC(2026, 0, 29)).toISOString(); // 28-day span, now = 50% elapsed

  it('reports unknown pace and 0 SPI without a task list or dates', () => {
    const r = computeVelocity({ tasks: [] });
    expect(r.totalTasks).toBe(0);
    expect(r.doneRatio).toBe(0);
    expect(r.elapsedRatio).toBe(0);
    expect(r.schedulePerformanceIndex).toBe(0);
    expect(r.status).toBe('unknown');
  });

  it('falls back to progress when there are no tasks', () => {
    const r = computeVelocity({ tasks: [], progress: 40 });
    expect(r.doneRatio).toBeCloseTo(0.4, 5);
  });

  it('is on-track when work done matches time elapsed', () => {
    const r = computeVelocity({
      tasks: [task({ status: 'Udført' }), task({ status: 'To Do' })],
      startDate: start, endDate: end, now: NOW,
    });
    expect(r.doneRatio).toBeCloseTo(0.5, 5);
    expect(r.elapsedRatio).toBeCloseTo(0.5, 5);
    expect(r.schedulePerformanceIndex).toBeCloseTo(1, 5);
    expect(r.status).toBe('on-track');
  });

  it('is ahead when more work is done than time elapsed', () => {
    const r = computeVelocity({
      tasks: [task({ status: 'Udført' }), task({ status: 'Udført' }), task({ status: 'Udført' }), task({ status: 'To Do' })],
      startDate: start, endDate: end, now: NOW,
    });
    expect(r.doneRatio).toBeCloseTo(0.75, 5);
    expect(r.status).toBe('ahead');
    expect(r.schedulePerformanceIndex).toBeGreaterThan(1);
  });

  it('is behind when work lags time elapsed', () => {
    const r = computeVelocity({
      tasks: [task({ status: 'Udført' }), task({ status: 'To Do' }), task({ status: 'To Do' }), task({ status: 'To Do' })],
      startDate: start, endDate: end, now: NOW,
    });
    expect(r.doneRatio).toBeCloseTo(0.25, 5);
    expect(r.status).toBe('behind');
    expect(r.schedulePerformanceIndex).toBeLessThan(1);
  });

  it('counts Forfalden and past-due open tasks as overdue but not done/cancelled ones', () => {
    const past = new Date(NOW - DAY).toISOString();
    const future = new Date(NOW + DAY).toISOString();
    const r = computeVelocity({
      tasks: [
        task({ status: 'Forfalden' }),
        task({ status: 'Igangværende', dueDate: past }),
        task({ status: 'Udført', dueDate: past }),      // done → not overdue
        task({ status: 'Annulleret', dueDate: past }),  // cancelled → not overdue
        task({ status: 'To Do', dueDate: future }),     // future → not overdue
      ],
      startDate: start, endDate: end, now: NOW,
    });
    expect(r.overdueTasks).toBe(2);
    expect(r.overdueShare).toBeCloseTo(2 / 5, 5);
  });

  it('clamps elapsedRatio to [0,1] once the end date has passed', () => {
    const r = computeVelocity({
      tasks: [task({ status: 'To Do' })],
      startDate: start, endDate: end, now: NOW + 100 * DAY,
    });
    expect(r.elapsedRatio).toBe(1);
  });
});

// ── computeTimeBurn ──────────────────────────────────────────────────────────

describe('computeTimeBurn', () => {
  it('returns all-zero, non-over-budget results for empty inputs', () => {
    const r = computeTimeBurn([], []);
    expect(r).toEqual({
      estimatedHours: 0, loggedHours: 0, remainingHours: 0,
      burnRatio: 0, efficiency: 0, overBudget: false,
    });
  });

  it('sums estimates and logged hours and computes remaining/ratios', () => {
    const r = computeTimeBurn(
      [task({ estimatedHours: 6 }), task({ estimatedHours: 4 })],
      [time(3), time(2)]
    );
    expect(r.estimatedHours).toBe(10);
    expect(r.loggedHours).toBe(5);
    expect(r.remainingHours).toBe(5);
    expect(r.burnRatio).toBeCloseTo(0.5, 5);
    expect(r.efficiency).toBeCloseTo(2, 5);
    expect(r.overBudget).toBe(false);
  });

  it('flags over-budget and clamps remaining at 0 when logged exceeds estimate', () => {
    const r = computeTimeBurn([task({ estimatedHours: 4 })], [time(6)]);
    expect(r.remainingHours).toBe(0);
    expect(r.burnRatio).toBeCloseTo(1.5, 5);
    expect(r.overBudget).toBe(true);
  });

  it('never divides by zero (logged hours but no estimate)', () => {
    const r = computeTimeBurn([task({ estimatedHours: 0 })], [time(5)]);
    expect(r.burnRatio).toBe(0);
    expect(r.efficiency).toBe(0);
    expect(r.overBudget).toBe(false);
  });
});

// ── computeQualitySignal ─────────────────────────────────────────────────────

describe('computeQualitySignal', () => {
  it('returns zeros for empty inputs without dividing by zero', () => {
    const r = computeQualitySignal([], []);
    expect(r.passRate).toBe(0);
    expect(r.punchResolutionRate).toBe(0);
    expect(r.totalControls).toBe(0);
    expect(r.totalPunch).toBe(0);
  });

  it('computes pass rate only over rated controls', () => {
    const r = computeQualitySignal(
      [
        qc({ result: 'godkendt' }),
        qc({ result: 'godkendt' }),
        qc({ result: 'ikke_godkendt' }),
        qc({ result: undefined }), // unrated → excluded from denominator
      ],
      []
    );
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.passRate).toBeCloseTo(2 / 3, 5);
  });

  it('counts deviations and treats missing corrective actions as open', () => {
    const r = computeQualitySignal(
      [
        qc({ hasDeviation: true, correctiveAction: 'Udbedret' }),
        qc({ hasDeviation: true, correctiveAction: '   ' }), // blank → still open
        qc({ hasDeviation: true }),                          // none → open
        qc({ hasDeviation: false }),
      ],
      []
    );
    expect(r.deviations).toBe(3);
    expect(r.openDeviations).toBe(2);
  });

  it('splits punch items into open vs resolved', () => {
    const r = computeQualitySignal([], [
      punch('Åben'), punch('I gang'), punch('Kræver Supervisor'), punch('Løst'), punch('Løst'),
    ]);
    expect(r.totalPunch).toBe(5);
    expect(r.resolvedPunch).toBe(2);
    expect(r.openPunch).toBe(3);
    expect(r.punchResolutionRate).toBeCloseTo(2 / 5, 5);
  });
});

// ── computeHandoverCompletion ────────────────────────────────────────────────

describe('computeHandoverCompletion', () => {
  it('returns zeros for no handovers', () => {
    const r = computeHandoverCompletion([]);
    expect(r).toEqual({
      total: 0, submitted: 0, accepted: 0, rejected: 0, acceptedShare: 0, submittedShare: 0,
    });
  });

  it('computes accepted and reached-handover shares', () => {
    const r = computeHandoverCompletion([
      handover('accepted'), handover('accepted'), handover('submitted'), handover('rejected'),
    ]);
    expect(r.total).toBe(4);
    expect(r.accepted).toBe(2);
    expect(r.submitted).toBe(1);
    expect(r.rejected).toBe(1);
    expect(r.acceptedShare).toBeCloseTo(0.5, 5);
    expect(r.submittedShare).toBeCloseTo(0.75, 5); // (submitted + accepted) / total
  });
});

// ── computeBudgetUtilization re-export ────────────────────────────────────────

describe('computeBudgetUtilization (re-exported)', () => {
  it('is the single canonical implementation from projectIntelligence', async () => {
    const fromMetrics = computeBudgetUtilization;
    const fromIntelligence = (await import('../modules/ai')).computeBudgetUtilization;
    expect(fromMetrics).toBe(fromIntelligence);
  });

  it('falls back to project.budget vs purchases when no baseline summary is present', () => {
    const project = { budget: { total: 1000, used: 0 } } as any;
    const purchases = [{ quantity: 2, price: 100 } as any];
    const r = computeBudgetUtilization(project, purchases, null);
    expect(r.totalKr).toBe(1000);
    expect(r.committedKr).toBe(200);
    expect(r.ratio).toBeCloseTo(0.2, 5);
  });
});
