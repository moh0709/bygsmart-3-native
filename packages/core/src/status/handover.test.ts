import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import {
  applyHandoverEvent,
  canSubmitHandover,
  canReviewHandover,
  stepperIndexFor,
  HANDOVER_STEPS,
} from './handover';

describe('applyHandoverEvent', () => {
  it('submit moves the handover pointer but leaves task status alone', () => {
    const e = applyHandoverEvent('submit');
    expect(e.handoverStatus).toBe('submitted');
    expect(e.taskStatus).toBeUndefined();
    expect(e.setsCompletedAt).toBe(false);
  });

  it('accept completes the task and stamps completed_at', () => {
    const e = applyHandoverEvent('accept');
    expect(e.handoverStatus).toBe('accepted');
    expect(e.taskStatus).toBe('Udført');
    expect(e.setsCompletedAt).toBe(true);
  });

  it('reject reverts the task to in-progress', () => {
    const e = applyHandoverEvent('reject');
    expect(e.handoverStatus).toBe('rejected');
    expect(e.taskStatus).toBe('Igangværende');
    expect(e.setsCompletedAt).toBe(false);
  });
});

describe('canSubmitHandover', () => {
  it('allows submit from none/submitted/rejected/undefined', () => {
    expect(canSubmitHandover(undefined)).toBe(true);
    expect(canSubmitHandover('none')).toBe(true);
    expect(canSubmitHandover('submitted')).toBe(true);
    expect(canSubmitHandover('rejected')).toBe(true);
  });

  it('blocks resubmitting an accepted handover', () => {
    expect(canSubmitHandover('accepted')).toBe(false);
  });
});

describe('canReviewHandover', () => {
  it('only a submitted handover awaits review', () => {
    expect(canReviewHandover('submitted')).toBe(true);
    expect(canReviewHandover('none')).toBe(false);
    expect(canReviewHandover('accepted')).toBe(false);
    expect(canReviewHandover('rejected')).toBe(false);
    expect(canReviewHandover(undefined)).toBe(false);
  });
});

describe('stepperIndexFor', () => {
  const t = (p: Partial<Task>): Task => p;

  it('step 3 for accepted or Udført', () => {
    expect(stepperIndexFor(t({ handoverStatus: 'accepted' }))).toBe(3);
    expect(stepperIndexFor(t({ status: 'Udført' }))).toBe(3);
  });

  it('step 2 for submitted', () => {
    expect(stepperIndexFor(t({ handoverStatus: 'submitted' }))).toBe(2);
  });

  it('step 1 for in-progress / overdue / rejected', () => {
    expect(stepperIndexFor(t({ status: 'Igangværende' }))).toBe(1);
    expect(stepperIndexFor(t({ status: 'Forfalden' }))).toBe(1);
    expect(stepperIndexFor(t({ handoverStatus: 'rejected' }))).toBe(1);
  });

  it('step 0 for a fresh To Do task', () => {
    expect(stepperIndexFor(t({ status: 'To Do', handoverStatus: 'none' }))).toBe(0);
    expect(stepperIndexFor(t({}))).toBe(0);
  });

  it('accepted wins over an in-progress task status', () => {
    expect(stepperIndexFor(t({ status: 'Igangværende', handoverStatus: 'accepted' }))).toBe(3);
  });

  it('has a label for every step index', () => {
    expect(HANDOVER_STEPS).toHaveLength(4);
  });
});
