import type { Task, TaskStatus } from '../../../types';
import type { AcceptedPartnerTask } from '../../partners';

export type TaskKind = 'project' | 'quick' | 'partner';

export interface UnifiedTaskItem {
    kind: TaskKind;
    id: string;
    title: string;
    status: TaskStatus;
    dueDate?: string;
    createdAt?: string;
    projectName?: string;
    data: Task | AcceptedPartnerTask;
}

export function buildUnifiedItems(
    projectTasks: Task[],
    quickTasks: Task[],
    partnerTasks: AcceptedPartnerTask[],
): UnifiedTaskItem[] {
    const items: UnifiedTaskItem[] = [];

    for (const t of projectTasks) {
        items.push({
            kind: 'project',
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate || undefined,
            createdAt: t.createdAt || undefined,
            projectName: t.projectName,
            data: t,
        });
    }

    for (const t of quickTasks) {
        items.push({
            kind: 'quick',
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate || undefined,
            createdAt: t.createdAt || undefined,
            projectName: t.projectName,
            data: t,
        });
    }

    for (const t of partnerTasks) {
        items.push({
            kind: 'partner',
            id: t.id,
            title: t.title,
            status: t.status,
            dueDate: t.dueDate || undefined,
            createdAt: t.createdAt || undefined,
            projectName: t.projectName,
            data: t,
        });
    }

    return items;
}

export function sortByCreatedAt(items: UnifiedTaskItem[], direction: 'asc' | 'desc'): UnifiedTaskItem[] {
    return [...items].sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return direction === 'asc' ? diff : -diff;
    });
}

export function sortByDueDate(items: UnifiedTaskItem[], direction: 'asc' | 'desc'): UnifiedTaskItem[] {
    return [...items].sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        const diff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        return direction === 'asc' ? diff : -diff;
    });
}
