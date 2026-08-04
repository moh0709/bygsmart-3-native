import type { Project } from '../types';

export type TimelineZoomLevel = 'range' | 'month' | 'week' | 'day';
export const TIMELINE_ZOOM_LEVELS: TimelineZoomLevel[] = ['range', 'month', 'week', 'day'];

export const startOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

export const endOfDay = (d: Date): Date => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

export const startOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), 1);

export const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

/** Monday-start week. */
export const startOfWeek = (d: Date): Date => {
    const s = startOfDay(d);
    const dow = (s.getDay() + 6) % 7;
    s.setDate(s.getDate() - dow);
    return s;
};

export const endOfWeek = (d: Date): Date => {
    const s = startOfWeek(d);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
};

export const eachDayInRange = (start: Date, end: Date): Date[] => {
    const days: Date[] = [];
    const cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor.getTime() <= last.getTime()) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
};

export const isSameDay = (a: Date, b: Date): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();

/** The upper bound for viewing/navigating a project's timeline: the planned
    end date, extended to today when the project has run past its deadline
    (so an overdue project still shows its in-flight days instead of hiding
    behind a stale end date). */
export const effectiveEndDate = (project: Pick<Project, 'endDate'>): Date => {
    const end = new Date(project.endDate);
    const today = new Date();
    if (isNaN(end.getTime()) || today.getTime() > end.getTime()) return today;
    return end;
};

export const clampDate = (d: Date, min: Date, max: Date): Date => {
    if (d.getTime() < min.getTime()) return new Date(min);
    if (d.getTime() > max.getTime()) return new Date(max);
    return d;
};

/** Picks a sensible initial focus date: the project's start date if it
    hasn't started yet, otherwise today (which is always within the
    navigable range — see effectiveEndDate). */
export const defaultFocusDate = (project: Pick<Project, 'startDate' | 'endDate'>): Date => {
    const today = new Date();
    const start = new Date(project.startDate);
    if (!isNaN(start.getTime()) && today < start) return start;
    return today;
};

export const shiftFocusDate = (date: Date, level: TimelineZoomLevel, dir: 1 | -1): Date => {
    const d = new Date(date);
    if (level === 'month') d.setMonth(d.getMonth() + dir);
    else if (level === 'week') d.setDate(d.getDate() + dir * 7);
    else if (level === 'day') d.setDate(d.getDate() + dir);
    return d;
};
