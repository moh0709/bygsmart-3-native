import React, { useState, useMemo } from 'react';
import type { Task } from '../../../types';
import type { AcceptedPartnerTask } from '../../partners';
import type { UnifiedTaskItem } from './taskViewModel';
import { sortByCreatedAt } from './taskViewModel';
import { TaskCard, QuickTaskCard, PartnerTaskCard } from './taskCards';
import { ZapIcon } from '../../../components/icons';
import { Badge, cn } from '../../../components/ui';

interface TaskSplitViewProps {
    items: UnifiedTaskItem[];
    userId: string | undefined;
    onNavigate: (id: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onDelegate: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
}

const SCALES = [1, 0.85, 0.70];
const ZOOM_LABELS = ['100%', '85%', '70%'];

const TaskSplitView: React.FC<TaskSplitViewProps> = ({
    items,
    userId,
    onNavigate,
    onArchive,
    onDelete,
    onDelegate,
    onStatusChange,
}) => {
    const [zoom, setZoom] = useState<0 | 1 | 2>(0);

    const { leftItems, rightItems } = useMemo(() => {
        const left = sortByCreatedAt(
            items.filter(i => i.kind === 'project' || i.kind === 'partner'),
            'desc',
        );
        const right = sortByCreatedAt(
            items.filter(i => i.kind === 'quick'),
            'desc',
        );
        return { leftItems: left, rightItems: right };
    }, [items]);

    const scale = SCALES[zoom];

    return (
        <div>
            {/* Zoom control */}
            <div role="group" aria-label="Zoomniveau" className="flex justify-end gap-1 mb-2">
                {([0, 1, 2] as const).map(level => (
                    <button
                        type="button"
                        key={level}
                        onClick={() => setZoom(level)}
                        className={cn(
                            'min-h-9 px-2.5 rounded-control text-caption font-bold border transition-colors duration-150',
                            zoom === level
                                ? 'bg-brand-primary text-white border-brand-primary'
                                : 'bg-bg text-text-secondary border-border hover:bg-bg-muted hover:text-text-primary dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:border-border-dark dark:hover:bg-bg-dark-muted dark:hover:text-text-dark-primary'
                        )}
                    >
                        {ZOOM_LABELS[level]}
                    </button>
                ))}
            </div>

            {/* Two-column grid */}
            <div
                style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: `${(100 / scale).toFixed(2)}%`,
                }}
            >
                <div className="grid grid-cols-2 gap-2 items-start">
                    {/* Left: project + partner tasks */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">Projektopgaver</span>
                            <Badge>{leftItems.length}</Badge>
                        </div>
                        <div className="space-y-2">
                            {leftItems.map(item => {
                                if (item.kind === 'project') {
                                    return (
                                        <TaskCard
                                            key={item.id}
                                            task={item.data as Task}
                                            onClick={() => onNavigate(item.id)}
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
                    </div>

                    {/* Right: quick tasks */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <ZapIcon className="w-3 h-3 text-warning" />
                            <span className="text-caption font-semibold uppercase tracking-wide text-warning-strong dark:text-warning">Hurtigopgaver</span>
                            <Badge variant="warning">{rightItems.length}</Badge>
                        </div>
                        <div className="space-y-2">
                            {rightItems.map(item => {
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
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskSplitView;
