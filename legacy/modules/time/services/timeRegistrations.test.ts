import { describe, expect, it } from 'vitest';
import {
  weekStartOf,
  weekDates,
  isoWeekNumber,
  shiftWeek,
  formatMinutes,
  validateIntervals,
  findIntervalConflicts,
  totalMinutesOf,
  payloadToTimeEntries,
  blockedRangesFor,
  clampStartMin,
  clampEndMin,
  type RegistrationTask,
} from './timeRegistrations';

const task = (overrides: Partial<RegistrationTask>): RegistrationTask => ({
  taskId: 't1',
  taskTitle: 'Gipsarbejde',
  projectId: 'p1',
  projectName: 'Byggeplads Nordhavn',
  days: {},
  ...overrides,
});

describe('week helpers', () => {
  it('anchors weekStart on Monday (local time)', () => {
    expect(weekStartOf(new Date(2026, 6, 15))).toBe('2026-07-13'); // Wed → Mon
    expect(weekStartOf(new Date(2026, 6, 13))).toBe('2026-07-13'); // Mon → itself
    expect(weekStartOf(new Date(2026, 6, 19))).toBe('2026-07-13'); // Sun → prior Mon
  });

  it('produces the 7 dates Mon–Sun, crossing month boundaries', () => {
    const days = weekDates('2026-06-29');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-06-29');
    expect(days[2]).toBe('2026-07-01');
    expect(days[6]).toBe('2026-07-05');
  });

  it('computes ISO week numbers', () => {
    expect(isoWeekNumber('2026-07-13')).toBe(29);
    expect(isoWeekNumber('2026-01-05')).toBe(2);
    // Year boundary: week containing 2026-01-01 belongs to ISO week 1.
    expect(isoWeekNumber('2025-12-29')).toBe(1);
  });

  it('shifts whole weeks', () => {
    expect(shiftWeek('2026-07-13', -1)).toBe('2026-07-06');
    expect(shiftWeek('2026-07-13', 1)).toBe('2026-07-20');
  });

  it('formats minutes as HH:MM', () => {
    expect(formatMinutes(420)).toBe('07:00');
    expect(formatMinutes(930)).toBe('15:30');
    expect(formatMinutes(0)).toBe('00:00');
  });
});

describe('validateIntervals', () => {
  it('accepts non-overlapping intervals across tasks and days', () => {
    const tasks = [
      task({ taskId: 'a', days: { '2026-07-13': [{ startMin: 420, endMin: 600, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-13': [{ startMin: 600, endMin: 780, note: '' }] } }),
    ];
    expect(validateIntervals(tasks)).toEqual([]);
  });

  it('rejects end before/equal to start', () => {
    const tasks = [task({ days: { '2026-07-13': [{ startMin: 600, endMin: 600, note: '' }] } })];
    const conflicts = validateIntervals(tasks);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].message).toContain('sluttid skal være efter starttid');
  });

  it('rejects overlap across two different tasks the same day (never two tasks at once)', () => {
    const tasks = [
      task({ taskId: 'a', days: { '2026-07-13': [{ startMin: 420, endMin: 720, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-13': [{ startMin: 600, endMin: 780, note: '' }] } }),
    ];
    const conflicts = validateIntervals(tasks);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].message).toContain('overlapper');
  });

  it('rejects overlap within the same task, allows split shifts (9-10 + 13-14)', () => {
    const split = [task({ days: { '2026-07-13': [
      { startMin: 540, endMin: 600, note: '' },
      { startMin: 780, endMin: 840, note: '' },
    ] } })];
    expect(validateIntervals(split)).toEqual([]);

    const overlapping = [task({ days: { '2026-07-13': [
      { startMin: 540, endMin: 660, note: '' },
      { startMin: 600, endMin: 720, note: '' },
    ] } })];
    expect(validateIntervals(overlapping)).toHaveLength(1);
  });

  it('allows the same clock times on different days', () => {
    const tasks = [
      task({ taskId: 'a', days: { '2026-07-13': [{ startMin: 420, endMin: 960, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-14': [{ startMin: 420, endMin: 960, note: '' }] } }),
    ];
    expect(validateIntervals(tasks)).toEqual([]);
  });
});

describe('findIntervalConflicts (cross-task overlap details)', () => {
  it('flags both sides of a cross-task overlap and names the other task', () => {
    const tasks = [
      task({ taskId: 'a', taskTitle: 'Gipsarbejde', days: { '2026-07-13': [{ startMin: 420, endMin: 720, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-13': [{ startMin: 600, endMin: 780, note: '' }] } }),
    ];
    const conflicts = findIntervalConflicts(tasks);
    expect(conflicts).toHaveLength(2);
    expect(conflicts).toEqual(
      expect.arrayContaining([
        { taskId: 'a', date: '2026-07-13', intervalIndex: 0, otherTaskId: 'b', otherTaskTitle: 'Maling' },
        { taskId: 'b', date: '2026-07-13', intervalIndex: 0, otherTaskId: 'a', otherTaskTitle: 'Gipsarbejde' },
      ])
    );
  });

  it('returns nothing for touching, non-overlapping, or different-day intervals', () => {
    const touching = [
      task({ taskId: 'a', days: { '2026-07-13': [{ startMin: 420, endMin: 600, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-13': [{ startMin: 600, endMin: 780, note: '' }] } }),
    ];
    expect(findIntervalConflicts(touching)).toEqual([]);

    const otherDay = [
      task({ taskId: 'a', days: { '2026-07-13': [{ startMin: 420, endMin: 960, note: '' }] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-14': [{ startMin: 420, endMin: 960, note: '' }] } }),
    ];
    expect(findIntervalConflicts(otherDay)).toEqual([]);
  });

  it('does NOT report same-task split-shift overlaps (those are a data error, not a clash)', () => {
    const sameTask = [task({ days: { '2026-07-13': [
      { startMin: 540, endMin: 660, note: '' },
      { startMin: 600, endMin: 720, note: '' },
    ] } })];
    expect(findIntervalConflicts(sameTask)).toEqual([]);
  });

  it('identifies the exact interval index within a day', () => {
    const tasks = [
      task({ taskId: 'a', taskTitle: 'Gipsarbejde', days: { '2026-07-13': [
        { startMin: 420, endMin: 540, note: '' }, // 07:00–09:00 — no clash
        { startMin: 600, endMin: 780, note: '' }, // 10:00–13:00 — clashes with b
      ] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: { '2026-07-13': [{ startMin: 660, endMin: 840, note: '' }] } }),
    ];
    const conflicts = findIntervalConflicts(tasks);
    expect(conflicts).toEqual(
      expect.arrayContaining([
        { taskId: 'a', date: '2026-07-13', intervalIndex: 1, otherTaskId: 'b', otherTaskTitle: 'Maling' },
      ])
    );
    expect(conflicts.some((c) => c.taskId === 'a' && c.intervalIndex === 0)).toBe(false);
  });
});

describe('mutual-gap clamping', () => {
  it('sluttid can never precede starttid (min one 30-min step)', () => {
    expect(clampEndMin(400, 420)).toBe(450);   // dragged below start → start+30
    expect(clampStartMin(1000, 960)).toBe(930); // dragged above end → end−30
  });

  it('leaves valid positions untouched', () => {
    expect(clampStartMin(480, 960)).toBe(480);
    expect(clampEndMin(900, 420)).toBe(900);
  });

  it('stays inside 0–1440', () => {
    expect(clampStartMin(-30, 60)).toBe(0);
    expect(clampEndMin(2000, 1410)).toBe(1440);
  });

  it('blockedRangesFor collects every OTHER interval on the same day, across tasks (track tint)', () => {
    const tasks = [
      task({ taskId: 'a', days: { '2026-07-13': [
        { startMin: 420, endMin: 600, note: '' },
        { startMin: 780, endMin: 840, note: '' },
      ] } }),
      task({ taskId: 'b', taskTitle: 'Maling', days: {
        '2026-07-13': [{ startMin: 600, endMin: 720, note: '' }],
        '2026-07-14': [{ startMin: 420, endMin: 960, note: '' }], // other day — excluded
      } }),
    ];
    const blocked = blockedRangesFor(tasks, 'a', '2026-07-13', 0);
    expect(blocked).toEqual([
      { startMin: 600, endMin: 720 }, // task b same day
      { startMin: 780, endMin: 840 }, // task a's OTHER interval
    ]);
  });
});

describe('totals + export mapping', () => {
  const tasks = [
    task({ days: {
      '2026-07-13': [{ startMin: 420, endMin: 960, note: 'Grov' }], // 9h
      '2026-07-14': [{ startMin: 450, endMin: 900, note: '' }],     // 7.5h
    } }),
    task({ taskId: 'q1', taskTitle: 'Materielkørsel', projectId: null, projectName: null,
      days: { '2026-07-15': [{ startMin: 480, endMin: 540, note: '' }] } }), // 1h
  ];

  it('sums total minutes across tasks/days/intervals', () => {
    expect(totalMinutesOf(tasks)).toBe(9 * 60 + 7.5 * 60 + 60);
  });

  it('maps a payload to TimeEntry rows for export', () => {
    const entries = payloadToTimeEntries(
      { id: 'reg1', userId: 'u1', payload: { version: 1, step: 4, tasks } },
      'Erik Jensen'
    );
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({
      projectId: 'p1', taskId: 't1', userId: 'u1', userName: 'Erik Jensen',
      hours: 9, date: '2026-07-13',
    });
    expect(entries[0].description).toContain('07:00–16:00');
    expect(entries[0].description).toContain('Grov');
    // Quick task → empty projectId, still exported.
    expect(entries[2]).toMatchObject({ projectId: '', hours: 1, date: '2026-07-15' });
  });
});
