import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../../../types';
import { getAllTasksForActiveProjects } from '../../services/tasks';
import { useAuth } from '../../../../contexts/AuthProvider';
import { Button, Card, EmptyState, ListRow, SkeletonList } from '../../../../components/ui';
import { SectionHeader } from '../../../../components/dashboard/SectionHeader';
import { DueBadge } from '../../../../components/dashboard/DueBadge';
import { CheckSquareIcon, ChevronRightIcon } from '../../../../components/icons';

/** "Fokus i dag" — overdue + due-today tasks, top 4 (formerly HomePage section 5). */
export const FocusTodayWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [focusTasks, setFocusTasks] = useState<Task[]>([]);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        getAllTasksForActiveProjects(user.id)
            .then((allTasks) => {
                if (!alive) return;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const overdue = allTasks.filter(t => new Date(t.dueDate) < today && t.status !== 'Udført');
                const dueToday = allTasks.filter(t => {
                    const dueDate = new Date(t.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate.getTime() === today.getTime() && t.status !== 'Udført';
                });
                setFocusTasks([...overdue, ...dueToday].slice(0, 4));
            })
            .catch((e) => console.error('FocusTodayWidget fetch failed:', e))
            .finally(() => { if (alive) setIsLoading(false); });
        return () => { alive = false; };
    }, [user]);

    return (
        <>
            <SectionHeader
                title="Fokus i dag"
                action={
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-my-1 -mr-1"
                        onClick={() => navigate('/tasks')}
                        iconRight={<ChevronRightIcon className="w-4 h-4" />}
                        aria-label="Se alle opgaver"
                    >
                        Se alle
                    </Button>
                }
            />
            {isLoading ? (
                <SkeletonList count={3} label="Indlæser opgaver…" />
            ) : focusTasks.length > 0 ? (
                <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                    {focusTasks.map(task => (
                        <ListRow
                            key={task.id}
                            title={task.title}
                            subtitle={task.projectName || 'Ukendt projekt'}
                            trailing={<DueBadge task={task} />}
                            onClick={() => navigate(`/task/${task.id}`)}
                        />
                    ))}
                </Card>
            ) : (
                <Card padding="none">
                    <EmptyState
                        icon={<CheckSquareIcon />}
                        title="Godt gået!"
                        description="Ingen forfaldne opgaver eller opgaver for i dag."
                        className="py-8"
                    />
                </Card>
            )}
        </>
    );
};
