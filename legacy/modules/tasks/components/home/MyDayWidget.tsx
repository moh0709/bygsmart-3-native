import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../../../types';
import { getAllTasksForActiveProjects } from '../../services/tasks';
import { getMyQuickTasks } from '../../services/quickTasks';
import { useAuth } from '../../../../contexts/AuthProvider';
import { Badge, Button, Card, EmptyState, ListRow, SkeletonList } from '../../../../components/ui';
import { SectionHeader } from '../../../../components/dashboard/SectionHeader';
import { DueBadge } from '../../../../components/dashboard/DueBadge';
import { startOfToday, isTaskOverdue, isTaskDueToday, taskSubtitle } from '../../../../components/dashboard/homeHelpers';
import { CheckSquareIcon, CalendarIcon } from '../../../../components/icons';

/**
 * Worker view "Min Arbejdsdag" task buckets: Overskredne, current/next hero
 * task, Dagens rute, Kommende and Udført i dag (formerly inline in HomePage).
 * My project tasks (as assignee) unioned with my personal quick tasks.
 */
export const MyDayWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [workerTasks, setWorkerTasks] = useState<Task[]>([]);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        (async () => {
            setIsLoading(true);
            try {
                const [allTasks, quickTasks] = await Promise.all([
                    getAllTasksForActiveProjects(user.id),
                    getMyQuickTasks(),
                ]);
                if (!alive) return;
                const myTaskMap = new Map<string, Task>();
                allTasks
                    .filter(t => t.assignees.some(a => a.id === user.id))
                    .forEach(t => myTaskMap.set(t.id, t));
                quickTasks.forEach(t => {
                    if (!myTaskMap.has(t.id)) myTaskMap.set(t.id, t);
                });
                // Sort by date: overdue first, then today, then future; no due date last
                setWorkerTasks([...myTaskMap.values()].sort((a, b) => {
                    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    return aTime - bTime;
                }));
            } catch (e) {
                console.error('MyDayWidget fetch failed:', e);
            } finally {
                if (alive) setIsLoading(false);
            }
        })();
        return () => { alive = false; };
    }, [user]);

    // Derived buckets — memoized; todayStart only changes at midnight.
    const todayStart = startOfToday().getTime();
    const myTasksOverdue = useMemo(() => workerTasks.filter(isTaskOverdue), [workerTasks, todayStart]);
    const myTasksToday = useMemo(
        () => workerTasks.filter(t => isTaskDueToday(t) && t.status !== 'Udført'),
        [workerTasks, todayStart]
    );
    const myTasksUpcoming = useMemo(
        () => workerTasks.filter(t => {
            if (!t.dueDate || t.status === 'Udført') return false;
            const due = new Date(t.dueDate).getTime();
            const now = Date.now();
            return due > now && due <= now + 24 * 60 * 60 * 1000;
        }),
        [workerTasks, todayStart]
    );
    const myTasksCompletedToday = useMemo(
        () => workerTasks.filter(t => {
            if (t.status !== 'Udført') return false;
            const stamp = t.completedAt ?? t.dueDate;
            if (!stamp) return false;
            const time = new Date(stamp).getTime();
            return time >= todayStart && time < todayStart + 24 * 60 * 60 * 1000;
        }),
        [workerTasks, todayStart]
    );

    // Hero: current in-progress task, else first task due today (presentation only)
    const heroTask = useMemo(
        () => workerTasks.find(t => t.status === 'Igangværende') ?? myTasksToday[0] ?? null,
        [workerTasks, myTasksToday]
    );
    const myTasksTodayRest = useMemo(
        () => (heroTask ? myTasksToday.filter(t => t.id !== heroTask.id) : myTasksToday),
        [heroTask, myTasksToday]
    );

    if (isLoading) {
        return <div className="mt-6"><SkeletonList count={3} label="Indlæser dine opgaver…" /></div>;
    }

    return (
        <>
            {myTasksOverdue.length > 0 && (
                <>
                    <SectionHeader
                        title="Overskredne"
                        badge={<Badge variant="danger">{myTasksOverdue.length}</Badge>}
                    />
                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden border-danger/30 dark:border-danger/30">
                        {myTasksOverdue.map(task => (
                            <ListRow
                                key={task.id}
                                title={task.title}
                                subtitle={taskSubtitle(task)}
                                trailing={<DueBadge task={task} />}
                                onClick={() => navigate(`/task/${task.id}`)}
                            />
                        ))}
                    </Card>
                </>
            )}

            {/* Current / next task as hero card */}
            {heroTask && (
                <section className="mt-6" aria-label="Aktuel opgave">
                    <Card padding="md" className="border-brand-primary/30 dark:border-brand-primary/30">
                        <div className="flex items-center justify-between gap-2">
                            <Badge variant={heroTask.status === 'Igangværende' ? 'info' : 'brand'} dot>
                                {heroTask.status === 'Igangværende' ? 'Igangværende' : 'Næste opgave'}
                            </Badge>
                            <DueBadge task={heroTask} />
                        </div>
                        <h2 className="text-title text-text-primary dark:text-text-dark-primary mt-2">{heroTask.title}</h2>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">{taskSubtitle(heroTask)}</p>
                        <Button fullWidth className="mt-4" onClick={() => navigate(`/task/${heroTask.id}`)}>
                            Åbn opgave
                        </Button>
                    </Card>
                </section>
            )}

            <SectionHeader
                title="Dagens rute"
                badge={myTasksToday.length > 0 ? <Badge variant="brand">{myTasksToday.length}</Badge> : undefined}
            />
            {myTasksTodayRest.length > 0 ? (
                <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                    {myTasksTodayRest.map(task => (
                        <ListRow
                            key={task.id}
                            title={task.title}
                            subtitle={taskSubtitle(task)}
                            trailing={<DueBadge task={task} />}
                            onClick={() => navigate(`/task/${task.id}`)}
                        />
                    ))}
                </Card>
            ) : myTasksToday.length === 0 ? (
                <Card padding="none">
                    <EmptyState
                        icon={<CheckSquareIcon />}
                        title="Ingen opgaver i dag"
                        description="Nyd fridagen eller tjek kommende opgaver."
                        className="py-8"
                    />
                </Card>
            ) : null}

            <SectionHeader title="Kommende" />
            {myTasksUpcoming.length > 0 ? (
                <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                    {myTasksUpcoming.map(task => (
                        <ListRow
                            key={task.id}
                            title={task.title}
                            subtitle={taskSubtitle(task)}
                            trailing={<DueBadge task={task} />}
                            onClick={() => navigate(`/task/${task.id}`)}
                        />
                    ))}
                </Card>
            ) : (
                <Card padding="none">
                    <EmptyState
                        icon={<CalendarIcon />}
                        title="Ingen kommende opgaver"
                        description="Du har ingen planlagte opgaver det næste døgn."
                        className="py-8"
                    />
                </Card>
            )}

            {myTasksCompletedToday.length > 0 && (
                <>
                    <SectionHeader
                        title="Udført i dag"
                        badge={<Badge variant="success">{myTasksCompletedToday.length}</Badge>}
                    />
                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                        {myTasksCompletedToday.map(task => (
                            <ListRow
                                key={task.id}
                                title={task.title}
                                subtitle={taskSubtitle(task)}
                                trailing={<Badge variant="success" dot>Udført</Badge>}
                                onClick={() => navigate(`/task/${task.id}`)}
                            />
                        ))}
                    </Card>
                </>
            )}
        </>
    );
};
