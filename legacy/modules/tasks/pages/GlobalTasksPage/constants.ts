import type { Task } from '../../../../types';
import type { AcceptedPartnerTask } from '../../../partners';
import { cn } from '../../../../components/ui';

export type FilterTab = 'Alle' | 'I dag' | 'Forfaldne' | 'Igangværende' | 'Udført' | 'Partner Opgaver' | 'Quick Tasks';
export type TaskView = 'List' | 'Group' | 'Split' | 'Kanban';
export type SortField = 'createdAt' | 'dueDate';
export type SortDir = 'desc' | 'asc';
export type GroupBy = 'project' | 'createdMonth' | 'dueMonth';

export const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
};

export const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    d.setHours(23, 59, 59, 999);
    return d < new Date() && task.status !== 'Udført';
};

export const isPartnerTaskOverdue = (task: AcceptedPartnerTask): boolean => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    d.setHours(23, 59, 59, 999);
    return d < new Date() && task.status !== 'Udført';
};

export const filterPartnerTasks = (tasks: AcceptedPartnerTask[], tab: FilterTab): AcceptedPartnerTask[] => {
    switch (tab) {
        case 'Partner Opgaver':
            return tasks;
        case 'I dag':
            return tasks.filter(t => t.dueDate && isToday(t.dueDate) && t.status !== 'Udført');
        case 'Forfaldne':
            return tasks.filter(isPartnerTaskOverdue);
        case 'Igangværende':
            return tasks.filter(t => t.status === 'Igangværende');
        case 'Udført':
            return tasks.filter(t => t.status === 'Udført');
        case 'Quick Tasks':
            return [];
        default:
            return tasks;
    }
};

// ─── Create Quick Task Modal ──────────────────────────────────────────────────

export const ACCEPTED_FILE_TYPES = 'image/*,application/pdf';

// ─── Main Page ────────────────────────────────────────────────────────────────

export type QuickStatusTab = 'Alle' | 'To Do' | 'Igangværende' | 'Udført' | 'Annulleret';
export const QUICK_STATUS_TABS: QuickStatusTab[] = ['Alle', 'To Do', 'Igangværende', 'Udført', 'Annulleret'];

export const TABS: FilterTab[] = ['Alle', 'I dag', 'Forfaldne', 'Igangværende', 'Udført', 'Partner Opgaver', 'Quick Tasks'];

export const VIEW_LABELS: Record<TaskView, string> = {
    List: 'Liste',
    Group: 'Gruppe',
    Split: 'Opdelt',
    Kanban: 'Kanban',
};

export const SORT_LABELS: Record<SortField, string> = {
    createdAt: 'Oprettelsesdato',
    dueDate: 'Slutdato',
};

export const GROUP_BY_LABELS: Record<GroupBy, string> = {
    project: 'By projekt',
    createdMonth: 'Oprettelsesmåned',
    dueMonth: 'Slutmåned',
};

/** Toolbar dropdown trigger + menu (sort / group-by). */
export const menuTriggerClass =
    'inline-flex items-center gap-1.5 min-h-9 px-3 rounded-control border border-border bg-bg text-label font-semibold ' +
    'text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors duration-150 ' +
    'dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary';

export const menuPanelClass =
    'absolute left-0 top-10 z-20 min-w-[180px] overflow-hidden rounded-card border border-border bg-bg shadow-raised ' +
    'dark:border-border-dark dark:bg-bg-dark-surface';

export const menuItemClass = (selected: boolean) =>
    cn(
        'w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-left transition-colors duration-150',
        selected
            ? 'font-bold text-brand-primary bg-brand-subtle dark:text-brand-light dark:bg-brand-subtle-dark'
            : 'text-text-primary hover:bg-bg-muted dark:text-text-dark-primary dark:hover:bg-bg-dark-muted',
    );
