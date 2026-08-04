import React from 'react';
import type { Task } from '../../types';
import { Badge } from '../../components/ui';
import { isTaskOverdue, isTaskDueToday, formatDueShort } from './homeHelpers';

/** Due-date badge: danger when overdue, "I dag" when due today, neutral otherwise. */
export const DueBadge: React.FC<{ task: Task }> = ({ task }) => {
    if (isTaskOverdue(task)) return <Badge variant="danger" dot>{formatDueShort(task.dueDate)}</Badge>;
    if (isTaskDueToday(task)) return <Badge variant="info">I dag</Badge>;
    return <Badge>{formatDueShort(task.dueDate)}</Badge>;
};
