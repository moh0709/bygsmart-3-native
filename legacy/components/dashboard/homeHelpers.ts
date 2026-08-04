import type { Task } from '../../types';
import type { BadgeVariant } from '../../components/ui';

// --- Caching Logic ---
export const getSlot = (date: Date): number => {
    const hour = date.getHours();
    if (hour < 12) return 1; // Morning slot
    if (hour < 16) return 2; // Afternoon slot
    return 3; // Evening slot
};

export const isCacheStale = (timestamp: number): boolean => {
    if (!timestamp) return true;
    const now = new Date();
    const lastUpdate = new Date(timestamp);

    // Different day is always stale
    if (now.toDateString() !== lastUpdate.toDateString()) {
        return true;
    }
    // Same day, but a new time slot has been entered
    if (getSlot(now) > getSlot(lastUpdate)) {
        return true;
    }

    return false;
};

// --- Presentation helpers ---

export const startOfToday = (): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

export const isTaskOverdue = (task: Task): boolean =>
    task.status !== 'Udført' && new Date(task.dueDate) < startOfToday();

export const isTaskDueToday = (task: Task): boolean => {
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() === startOfToday().getTime();
};

export const formatDueShort = (iso: string): string =>
    new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });

export const nfHours = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmtKr = (n: number) => `${Math.round(n).toLocaleString('da-DK')} kr.`;

/** Subtitle for worker task rows: quick tasks are personal, project tasks show project name. */
export const taskSubtitle = (task: Task): string =>
    task.scope === 'quick' ? 'Personlig opgave' : (task.projectName || 'Ukendt projekt');

export const PARTNER_STATUS_VARIANT: Record<string, BadgeVariant> = {
    'To Do': 'neutral',
    'Igangværende': 'info',
    'Udført': 'success',
    'Forfalden': 'danger',
};
