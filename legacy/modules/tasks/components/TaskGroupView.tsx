import React, { useState, useEffect, useMemo } from 'react';
import type { Task } from '../../../types';
import type { AcceptedPartnerTask } from '../../partners';
import type { UnifiedTaskItem } from './taskViewModel';
import { sortByCreatedAt } from './taskViewModel';
import { TaskCard, QuickTaskCard, PartnerTaskCard } from './taskCards';
import { ChevronDownIcon, ChevronRightIcon } from '../../../components/icons';
import { Badge } from '../../../components/ui';

export type GroupBy = 'project' | 'createdMonth' | 'dueMonth';

interface TaskGroupViewProps {
    items: UnifiedTaskItem[];
    groupBy: GroupBy;
    userId: string | undefined;
    onNavigate: (id: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onDelegate: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
}

function getGroupKey(item: UnifiedTaskItem, groupBy: GroupBy): string {
    if (groupBy === 'project') {
        if (item.kind === 'quick') return item.projectName ?? 'Hurtigopgaver';
        return item.projectName ?? 'Ukendt projekt';
    }
    if (groupBy === 'createdMonth') {
        return item.createdAt ? item.createdAt.substring(0, 7) : 'Ukendt';
    }
    return item.dueDate ? item.dueDate.substring(0, 7) : '__none__';
}

function formatMonthLabel(key: string): string {
    if (key === '__none__') return 'Ingen slutdato';
    if (key === 'Ukendt') return 'Ukendt';
    const raw = new Date(key + '-01').toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildGroups(
    items: UnifiedTaskItem[],
    groupBy: GroupBy,
): Array<{ key: string; label: string; items: UnifiedTaskItem[] }> {
    const map = new Map<string, UnifiedTaskItem[]>();
    for (const item of items) {
        const key = getGroupKey(item, groupBy);
        const existing = map.get(key);
        if (existing) {
            existing.push(item);
        } else {
            map.set(key, [item]);
        }
    }

    const keys = Array.from(map.keys());

    if (groupBy === 'project') {
        keys.sort((a, b) => a.localeCompare(b, 'da'));
    } else if (groupBy === 'createdMonth') {
        keys.sort((a, b) => {
            if (a === 'Ukendt') return 1;
            if (b === 'Ukendt') return -1;
            return b.localeCompare(a);
        });
    } else {
        keys.sort((a, b) => {
            if (a === '__none__') return 1;
            if (b === '__none__') return -1;
            return a.localeCompare(b);
        });
    }

    return keys.map(key => ({
        key,
        label: groupBy === 'project' ? key : formatMonthLabel(key),
        items: sortByCreatedAt(map.get(key)!, 'desc'),
    }));
}

const TaskGroupView: React.FC<TaskGroupViewProps> = ({
    items,
    groupBy,
    userId,
    onNavigate,
    onArchive,
    onDelete,
    onDelegate,
    onStatusChange,
}) => {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    useEffect(() => {
        setCollapsed(new Set());
    }, [groupBy]);

    const groups = useMemo(() => buildGroups(items, groupBy), [items, groupBy]);

    const toggle = (key: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    if (groups.length === 0) return null;

    return (
        <div className="space-y-1">
            {groups.map(({ key, label, items: groupItems }) => (
                <section key={key}>
                    <button
                        type="button"
                        onClick={() => toggle(key)}
                        className="flex items-center gap-2 w-full min-h-11 py-2 px-1 rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150 text-left"
                    >
                        {collapsed.has(key)
                            ? <ChevronRightIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary flex-shrink-0" />
                            : <ChevronDownIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary flex-shrink-0" />
                        }
                        <span className="text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary truncate">{label}</span>
                        <Badge>{groupItems.length}</Badge>
                    </button>
                    {!collapsed.has(key) && (
                        <div className="space-y-2 mb-4">
                            {groupItems.map(item => {
                                if (item.kind === 'project') {
                                    return (
                                        <TaskCard
                                            key={item.id}
                                            task={item.data as Task}
                                            onClick={() => onNavigate(item.id)}
                                        />
                                    );
                                }
                                if (item.kind === 'quick') {
                                    const task = item.data as Task;
                                    return (
                                        <QuickTaskCard
                                            key={item.id}
                                            task={task}
                                            onClick={() => onNavigate(item.id)}
                                            onArchive={() => onArchive(item.id)}
                                            onDelete={() => onDelete(item.id)}
                                            isOwner={task.ownerId === userId}
                                            onDelegate={() => onDelegate(item.id)}
                                            onStatusChange={newStatus => onStatusChange(item.id, newStatus)}
                                        />
                                    );
                                }
                                if (item.kind === 'partner') {
                                    return (
                                        <PartnerTaskCard
                                            key={`${(item.data as AcceptedPartnerTask).inviteId}-${item.id}`}
                                            task={item.data as AcceptedPartnerTask}
                                            onClick={() => onNavigate(item.id)}
                                        />
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </section>
            ))}
        </div>
    );
};

export default TaskGroupView;
