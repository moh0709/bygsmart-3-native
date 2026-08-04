import { describe, expect, test } from 'vitest';
import {
    startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayInRange, defaultFocusDate, shiftFocusDate, isSameDay,
    effectiveEndDate, clampDate,
} from './dateRange';

describe('week boundaries (Monday-start)', () => {
    test('a Wednesday resolves to the Monday..Sunday containing it', () => {
        const wed = new Date('2026-07-08T12:00:00'); // Wednesday
        expect(startOfWeek(wed).getDay()).toBe(1); // Monday
        expect(endOfWeek(wed).getDay()).toBe(0); // Sunday
        expect(startOfWeek(wed).getDate()).toBe(6);
        expect(endOfWeek(wed).getDate()).toBe(12);
    });

    test('a Sunday belongs to the week that started the preceding Monday', () => {
        const sun = new Date('2026-07-12T08:00:00');
        expect(startOfWeek(sun).getDate()).toBe(6);
    });
});

describe('month boundaries', () => {
    test('spans the full calendar month regardless of focus day', () => {
        const midMonth = new Date('2026-02-15T00:00:00');
        expect(startOfMonth(midMonth).getDate()).toBe(1);
        expect(endOfMonth(midMonth).getDate()).toBe(28); // 2026 is not a leap year
    });
});

describe('eachDayInRange', () => {
    test('is inclusive of both endpoints', () => {
        const days = eachDayInRange(new Date('2026-07-06'), new Date('2026-07-08'));
        expect(days).toHaveLength(3);
        expect(isSameDay(days[0], new Date('2026-07-06'))).toBe(true);
        expect(isSameDay(days[2], new Date('2026-07-08'))).toBe(true);
    });
});

describe('defaultFocusDate', () => {
    test('clamps to project start when today is before the project window', () => {
        const focus = defaultFocusDate({ startDate: '2030-01-01', endDate: '2030-06-01' });
        expect(isSameDay(focus, new Date('2030-01-01'))).toBe(true);
    });

    test('focuses on today (not the stale end date) when the project is overdue', () => {
        const focus = defaultFocusDate({ startDate: '2000-01-01', endDate: '2000-06-01' });
        expect(isSameDay(focus, new Date())).toBe(true);
    });
});

describe('effectiveEndDate', () => {
    test('is the project end date when the project has not finished yet', () => {
        const end = effectiveEndDate({ endDate: '2099-06-01' });
        expect(isSameDay(end, new Date('2099-06-01'))).toBe(true);
    });

    test('extends to today when the project has run past its deadline', () => {
        const end = effectiveEndDate({ endDate: '2000-06-01' });
        expect(isSameDay(end, new Date())).toBe(true);
    });
});

describe('clampDate', () => {
    test('leaves dates inside the range untouched', () => {
        const d = new Date('2026-07-15');
        expect(clampDate(d, new Date('2026-07-01'), new Date('2026-07-31'))).toEqual(d);
    });

    test('clamps below-range dates up to min and above-range dates down to max', () => {
        const min = new Date('2026-07-01');
        const max = new Date('2026-07-31');
        expect(isSameDay(clampDate(new Date('2026-06-01'), min, max), min)).toBe(true);
        expect(isSameDay(clampDate(new Date('2026-08-15'), min, max), max)).toBe(true);
    });
});

describe('shiftFocusDate', () => {
    test('steps by month/week/day depending on the zoom level', () => {
        const base = new Date('2026-07-15T00:00:00');
        expect(shiftFocusDate(base, 'month', 1).getMonth()).toBe(7); // August
        expect(shiftFocusDate(base, 'week', 1).getDate()).toBe(22);
        expect(shiftFocusDate(base, 'day', -1).getDate()).toBe(14);
    });
});
