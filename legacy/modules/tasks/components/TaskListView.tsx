import React from 'react';
import type { UnifiedTaskItem } from './taskViewModel';
import { TaskCard, QuickTaskCard, PartnerTaskCard } from './taskCards';

interface TaskListViewProps {
    items: UnifiedTaskItem[];
    userId: string | undefined;
    onNavigate: (taskId: string) => void;
    onArchive: (taskId: string) => void;
    onDelete: (taskId: string) => void;
    onDelegate: (taskId: string) => void;
    onStatusChange: (taskId: string, newStatus: string) => void;
}

const TaskListView: React.FC<TaskListViewProps> = ({
    items,
    userId,
    onNavigate,
    onArchive,
    onDelete,
    onDelegate,
    onStatusChange,
}) => {
    return (
        <div className="space-y-3">
            {/* All task items */}
            {items.map(item => {
                if (item.kind === 'project') {
                    return (
                        <TaskCard
                            key={item.id}
                            task={item.data as import('../../../types').Task}
                            onClick={() => onNavigate(item.id)}
                        />
                    );
                }
                if (item.kind === 'quick') {
                    const task = item.data as import('../../../types').Task;
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
                            key={`${(item.data as import('../../partners').AcceptedPartnerTask).inviteId}-${item.id}`}
                            task={item.data as import('../../partners').AcceptedPartnerTask}
                            onClick={() => onNavigate(item.id)}
                        />
                    );
                }
                return null;
            })}

        </div>
    );
};

export default TaskListView;
