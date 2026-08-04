import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Task, TaskStatus } from '../../../types';
import type { AcceptedPartnerTask } from '../../partners';
import type { UnifiedTaskItem } from './taskViewModel';
import { updateTask } from '../services/tasks';
import {
    STATUS_VARIANT, QUICK_STATUS_OPTIONS, isOverdue, isPartnerTaskOverdue,
    TaskCard, QuickTaskCard, PartnerTaskCard,
} from './taskCards';
import { AlertTriangleIcon } from '../../../components/icons';
import { Badge } from '../../../components/ui';

interface TaskKanbanViewProps {
    items: UnifiedTaskItem[];
    userId: string | undefined;
    onNavigate: (id: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onDelegate: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
    onStatusChangeFailed: (message: string) => void;
    onKanbanDrop: (id: string, status: string, kind: UnifiedTaskItem['kind']) => void;
}

type TaskStatus4 = 'To Do' | 'Igangværende' | 'Udført' | 'Annulleret';

const COLUMNS: Array<{ key: TaskStatus4; label: string }> = QUICK_STATUS_OPTIONS.map(o => ({
    key: o.value as TaskStatus4,
    label: o.label,
}));

function buildColumns(items: UnifiedTaskItem[]): Record<TaskStatus4, UnifiedTaskItem[]> {
    const cols: Record<TaskStatus4, UnifiedTaskItem[]> = {
        'To Do': [],
        'Igangværende': [],
        'Udført': [],
        'Annulleret': [],
    };
    for (const item of items) {
        const key = item.status as TaskStatus4;
        if (key in cols) {
            cols[key].push(item);
        } else {
            cols['To Do'].push(item);
        }
    }
    return cols;
}

function moveItem(
    cols: Record<TaskStatus4, UnifiedTaskItem[]>,
    item: UnifiedTaskItem,
    newStatus: TaskStatus4,
): Record<TaskStatus4, UnifiedTaskItem[]> {
    const next: Record<TaskStatus4, UnifiedTaskItem[]> = {
        'To Do': [...cols['To Do']],
        'Igangværende': [...cols['Igangværende']],
        'Udført': [...cols['Udført']],
        'Annulleret': [...cols['Annulleret']],
    };
    for (const k of Object.keys(next) as TaskStatus4[]) {
        next[k] = next[k].filter(i => i.id !== item.id);
    }
    next[newStatus] = [...next[newStatus], { ...item, status: newStatus }];
    return next;
}

const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({
    items,
    userId,
    onNavigate,
    onArchive,
    onDelete,
    onDelegate,
    onStatusChange,
    onStatusChangeFailed,
    onKanbanDrop,
}) => {
    const [columns, setColumns] = useState<Record<TaskStatus4, UnifiedTaskItem[]>>(() => buildColumns(items));
    const columnRefs = useRef<Record<TaskStatus4, HTMLDivElement | null>>({
        'To Do': null,
        'Igangværende': null,
        'Udført': null,
        'Annulleret': null,
    });

    useEffect(() => {
        setColumns(buildColumns(items));
    }, [items]);

    const handleDrop = async (item: UnifiedTaskItem, targetStatus: TaskStatus4) => {
        if (targetStatus === (item.status as TaskStatus4)) return;

        const originalStatus = item.status as TaskStatus4;

        setColumns(prev => moveItem(prev, item, targetStatus));

        const taskData = item.data as Task;
        const updated = { ...taskData, status: targetStatus as TaskStatus };
        const success = await updateTask(updated);

        if (success) {
            onKanbanDrop(item.id, targetStatus, item.kind);
        } else {
            setColumns(prev => moveItem(prev, { ...item, status: targetStatus }, originalStatus));
            onStatusChangeFailed('Du har ikke rettigheder til at ændre denne opgave');
        }
    };

    return (
        <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 pb-4" style={{ minWidth: `${COLUMNS.length * 236}px` }}>
                {COLUMNS.map(col => {
                    const colItems = columns[col.key];
                    return (
                        <div
                            key={col.key}
                            ref={el => { columnRefs.current[col.key] = el; }}
                            className="min-w-[220px] flex-shrink-0 flex flex-col gap-2"
                        >
                            {/* Column header */}
                            <div className="flex items-center justify-between px-1 mb-1">
                                <Badge variant={STATUS_VARIANT[col.key as TaskStatus]} dot>
                                    {col.label}
                                </Badge>
                                <Badge>{colItems.length}</Badge>
                            </div>

                            {/* Drop zone background */}
                            <div className="flex-1 min-h-[120px] rounded-card bg-bg-muted dark:bg-bg-dark-muted p-1.5 flex flex-col gap-2">
                                {colItems.map(item => (
                                    <DraggableCard
                                        key={item.id}
                                        item={item}
                                        userId={userId}
                                        columnRefs={columnRefs}
                                        onDrop={handleDrop}
                                        onNavigate={onNavigate}
                                        onArchive={onArchive}
                                        onDelete={onDelete}
                                        onDelegate={onDelegate}
                                        onStatusChange={onStatusChange}
                                    />
                                ))}

                                {colItems.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center py-6">
                                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                                            Ingen opgaver
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const DraggableCard: React.FC<{
    item: UnifiedTaskItem;
    userId: string | undefined;
    columnRefs: React.MutableRefObject<Record<TaskStatus4, HTMLDivElement | null>>;
    onDrop: (item: UnifiedTaskItem, targetStatus: TaskStatus4) => void;
    onNavigate: (id: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onDelegate: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
}> = ({ item, userId, columnRefs, onDrop, onNavigate, onArchive, onDelete, onDelegate, onStatusChange }) => {
    const overdue = item.kind === 'partner'
        ? isPartnerTaskOverdue(item.data as AcceptedPartnerTask)
        : isOverdue(item.data as Task);

    const canDrag = item.kind !== 'quick' || (item.data as Task).ownerId === userId;

    return (
        <div className="relative">
            {overdue && (
                <div className="absolute -top-1 -right-1 z-10 pointer-events-none">
                    <AlertTriangleIcon className="w-4 h-4 text-danger" />
                </div>
            )}
            <motion.div
                drag={canDrag}
                dragMomentum={false}
                dragElastic={0.1}
                whileDrag={{ scale: 1.03, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                onDragEnd={canDrag ? ((_e, info) => {
                    if (Math.abs(info.offset.x) + Math.abs(info.offset.y) < 5) {
                        onNavigate(item.id);
                        return;
                    }

                    const { x, y } = info.point;
                    let target: TaskStatus4 | null = null;
                    for (const [key, el] of Object.entries(columnRefs.current) as [TaskStatus4, HTMLDivElement | null][]) {
                        if (!el) continue;
                        const rect = el.getBoundingClientRect();
                        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                            target = key;
                            break;
                        }
                    }

                    if (target && target !== (item.status as TaskStatus4)) {
                        onDrop(item, target);
                    }
                }) : undefined}
                className={canDrag ? "cursor-grab active:cursor-grabbing touch-none" : "touch-none"}
            >
                {item.kind === 'quick' && (
                    <QuickTaskCard
                        task={item.data as Task}
                        onClick={() => onNavigate(item.id)}
                        onArchive={() => onArchive(item.id)}
                        onDelete={() => onDelete(item.id)}
                        isOwner={(item.data as Task).ownerId === userId}
                        onDelegate={() => onDelegate(item.id)}
                        onStatusChange={s => onStatusChange(item.id, s)}
                    />
                )}
                {item.kind === 'project' && (
                    <TaskCard
                        task={item.data as Task}
                        onClick={() => onNavigate(item.id)}
                    />
                )}
                {item.kind === 'partner' && (
                    <PartnerTaskCard
                        task={item.data as any}
                        onClick={() => onNavigate(item.id)}
                    />
                )}
            </motion.div>
        </div>
    );
};

export default TaskKanbanView;
