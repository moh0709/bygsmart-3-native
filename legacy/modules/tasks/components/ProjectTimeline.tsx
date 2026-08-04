import React, { useMemo, useState } from 'react';
import { Project, Task } from '../../../types';
import {
    TimelineZoomLevel, TIMELINE_ZOOM_LEVELS,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay,
    eachDayInRange, isSameDay, defaultFocusDate, shiftFocusDate, effectiveEndDate, clampDate,
} from '../../../utils/dateRange';
import { ZoomInIcon, ZoomOutIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '../../../components/icons';
import { Badge, Button, EmptyState, cn } from '../../../components/ui';
import { TaskCard, PRIORITY_VARIANT, priorityRank } from './taskCards';

const ZOOM_LABEL: Record<TimelineZoomLevel, string> = {
    range: 'Hele projektet', month: 'Måned', week: 'Uge', day: 'Dag',
};

const formatZoomLabel = (level: TimelineZoomLevel, focusDate: Date): string => {
    if (level === 'range') return ZOOM_LABEL.range;
    if (level === 'month') return focusDate.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
    if (level === 'week') {
        const s = startOfWeek(focusDate);
        const e = endOfWeek(focusDate);
        return `${s.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}`;
    }
    return focusDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'short' });
};

export interface ProjectTimelineProps {
    project: Project;
    tasks: Task[];
    onNavigate: (tab: string) => void;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ project, tasks, onNavigate }) => {
    const [zoomLevel, setZoomLevel] = useState<TimelineZoomLevel>('range');
    const [focusDate, setFocusDate] = useState<Date>(() => defaultFocusDate(project));

    // Navigation is bounded to the project's own life span: from its start date up to
    // its deadline — extended to today if the project has overrun that deadline, so an
    // overdue project still shows its in-flight days instead of hiding behind a stale end date.
    const navMin = useMemo(() => new Date(project.startDate), [project.startDate]);
    const navMax = useMemo(() => effectiveEndDate(project), [project.endDate]);

    const handleZoomIn = () => {
        const i = TIMELINE_ZOOM_LEVELS.indexOf(zoomLevel);
        if (i >= TIMELINE_ZOOM_LEVELS.length - 1) return;
        if (zoomLevel === 'range') setFocusDate(defaultFocusDate(project));
        setZoomLevel(TIMELINE_ZOOM_LEVELS[i + 1]);
    };
    const handleZoomOut = () => {
        const i = TIMELINE_ZOOM_LEVELS.indexOf(zoomLevel);
        if (i <= 0) return;
        setZoomLevel(TIMELINE_ZOOM_LEVELS[i - 1]);
    };
    const handlePrev = () => setFocusDate(d => clampDate(shiftFocusDate(d, zoomLevel, -1), navMin, navMax));
    const handleNext = () => setFocusDate(d => clampDate(shiftFocusDate(d, zoomLevel, 1), navMin, navMax));
    const handleToday = () => setFocusDate(clampDate(defaultFocusDate(project), navMin, navMax));
    const jumpToDay = (day: Date) => { setZoomLevel('day'); setFocusDate(clampDate(day, navMin, navMax)); };

    const visibleWindow = useMemo(() => {
        if (zoomLevel === 'month') return { start: startOfMonth(focusDate), end: endOfMonth(focusDate) };
        if (zoomLevel === 'week') return { start: startOfWeek(focusDate), end: endOfWeek(focusDate) };
        if (zoomLevel === 'day') return { start: startOfDay(focusDate), end: endOfDay(focusDate) };
        return { start: new Date(project.startDate), end: new Date(project.endDate) };
    }, [zoomLevel, focusDate, project.startDate, project.endDate]);

    const canGoPrev = zoomLevel !== 'range' && visibleWindow.start.getTime() > startOfDay(navMin).getTime();
    const canGoNext = zoomLevel !== 'range' && visibleWindow.end.getTime() < endOfDay(navMax).getTime();

    const tasksInWindow = useMemo(() => tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate).getTime();
        return due >= visibleWindow.start.getTime() && due <= visibleWindow.end.getTime();
    }), [tasks, visibleWindow]);

    const milestones = useMemo(
        () => tasks.filter(t => t.isMilestone).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        [tasks]
    );

    const dayTasks = useMemo(
        () => [...tasksInWindow].sort((a, b) =>
            priorityRank(a.priority) - priorityRank(b.priority)
            || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            || a.title.localeCompare(b.title, 'da')
        ),
        [tasksInWindow]
    );

    if (zoomLevel === 'range') {
        return (
            <RangeTimeline
                project={project}
                milestones={milestones}
                onZoomIn={handleZoomIn}
                onSelectMilestone={jumpToDay}
            />
        );
    }

    return (
        <div className="mt-6 mb-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-1">
                    <button
                        onClick={handleZoomOut}
                        aria-label="Zoom ud"
                        className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted"
                    >
                        <ZoomOutIcon className="w-5 h-5" />
                    </button>
                    <span className="text-label font-semibold min-w-[9rem] text-center capitalize text-text-primary dark:text-text-dark-primary">
                        {formatZoomLabel(zoomLevel, focusDate)}
                    </span>
                    <button
                        onClick={handleZoomIn}
                        disabled={zoomLevel === 'day'}
                        aria-label="Zoom ind"
                        className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted disabled:opacity-40"
                    >
                        <ZoomInIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePrev}
                        disabled={!canGoPrev}
                        aria-label="Forrige"
                        className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted disabled:opacity-40"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <Button variant="ghost" size="sm" onClick={handleToday}>I dag</Button>
                    <button
                        onClick={handleNext}
                        disabled={!canGoNext}
                        aria-label="Næste"
                        className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted disabled:opacity-40"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {(zoomLevel === 'month' || zoomLevel === 'week') && (
                <WindowTimeline
                    windowStart={visibleWindow.start}
                    windowEnd={visibleWindow.end}
                    tasksInWindow={tasksInWindow}
                    variant={zoomLevel}
                    onSelectDay={jumpToDay}
                />
            )}

            {zoomLevel === 'day' && (
                dayTasks.length === 0 ? (
                    <EmptyState
                        icon={<CalendarIcon className="w-7 h-7" />}
                        title="Ingen opgaver denne dag"
                        description="Der er ikke registreret opgaver eller deadlines på den valgte dag."
                    />
                ) : (
                    <div className="flex flex-col gap-2">
                        {dayTasks.map(task => (
                            <div key={task.id} className="flex items-start gap-2">
                                <Badge variant={PRIORITY_VARIANT[task.priority ?? 'Mellem']} className="mt-3 shrink-0">
                                    {task.priority ?? 'Mellem'}
                                </Badge>
                                <div className="flex-1 min-w-0">
                                    <TaskCard task={task} onClick={() => onNavigate('opgaver')} />
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

const WindowTimeline: React.FC<{
    windowStart: Date;
    windowEnd: Date;
    tasksInWindow: Task[];
    variant: 'month' | 'week';
    onSelectDay: (day: Date) => void;
}> = ({ windowStart, windowEnd, tasksInWindow, variant, onSelectDay }) => {
    const days = useMemo(() => eachDayInRange(windowStart, windowEnd), [windowStart, windowEnd]);

    const dayIndexOf = useMemo(() => {
        const map = new Map<number, number>();
        days.forEach((d, i) => map.set(startOfDay(d).getTime(), i));
        return map;
    }, [days]);
    const posForIndex = (i: number) => ((i + 0.5) / days.length) * 100;

    const milestones = useMemo(
        () => tasksInWindow
            .filter(t => t.isMilestone)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
        [tasksInWindow]
    );

    const regularByDayIndex = useMemo(() => {
        const map = new Map<number, Task[]>();
        tasksInWindow.filter(t => !t.isMilestone).forEach(t => {
            const idx = dayIndexOf.get(startOfDay(new Date(t.dueDate)).getTime());
            if (idx === undefined) return;
            const bucket = map.get(idx) ?? [];
            bucket.push(t);
            map.set(idx, bucket);
        });
        return map;
    }, [tasksInWindow, dayIndexOf]);

    const today = new Date();
    const todayIndex = days.findIndex(d => isSameDay(d, today));
    const todayPos = todayIndex >= 0 ? posForIndex(todayIndex) : null;

    const dayHasTasks = (i: number) => regularByDayIndex.has(i) || milestones.some(m => dayIndexOf.get(startOfDay(new Date(m.dueDate)).getTime()) === i);

    return (
        <div className="mt-10 mb-6 relative select-none">
            <div className="h-14 relative w-full pointer-events-none">
                {milestones.map((m, idx) => {
                    const dIdx = dayIndexOf.get(startOfDay(new Date(m.dueDate)).getTime());
                    if (dIdx === undefined) return null;
                    const pos = posForIndex(dIdx);
                    const stagger = idx % 2 === 0 ? 0 : 20;
                    return (
                        <div key={m.id} className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2 transition-all duration-500 z-10" style={{ left: `${pos}%` }}>
                            <div className="mb-1 whitespace-nowrap text-caption font-bold text-text-secondary dark:text-text-dark-secondary bg-bg/90 dark:bg-bg-dark-surface/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border dark:border-border-dark shadow-card" style={{ marginBottom: `${stagger}px` }}>
                                {m.title}
                            </div>
                            <div className="w-px border-l border-dotted border-border-strong dark:border-border-dark-strong" style={{ height: `${16 + stagger}px` }}></div>
                        </div>
                    );
                })}
                {todayPos !== null && (
                    <div className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2 z-20" style={{ left: `${todayPos}%` }}>
                        <div className="mb-1 whitespace-nowrap text-caption font-bold text-text-secondary dark:text-text-dark-secondary bg-bg-muted dark:bg-bg-dark-muted px-2 py-1 rounded border border-border-strong dark:border-border-dark-strong shadow-card">
                            I dag
                        </div>
                        <div className="w-px border-l border-dashed border-border-strong dark:border-border-dark-strong h-6 absolute bottom-0"></div>
                    </div>
                )}
            </div>

            <div className="relative h-2 bg-bg-muted dark:bg-bg-dark-muted rounded-full w-full mt-1">
                {todayPos !== null && (
                    <div className="absolute top-[-6px] bottom-[-6px] w-0.5 bg-text-primary dark:bg-text-dark-primary z-20" style={{ left: `${todayPos}%` }}></div>
                )}
                {milestones.map((m) => {
                    const dIdx = dayIndexOf.get(startOfDay(new Date(m.dueDate)).getTime());
                    if (dIdx === undefined) return null;
                    const pos = posForIndex(dIdx);
                    const isDone = m.status === 'Udført';
                    const isOverdue = m.status === 'Forfalden' || (new Date(m.dueDate).getTime() < today.getTime() && !isDone);
                    return (
                        <button
                            type="button"
                            key={m.id}
                            onClick={() => onSelectDay(new Date(m.dueDate))}
                            className={cn(
                                'absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 transform -translate-y-1/2 -translate-x-1/2 z-10 bg-bg dark:bg-bg-dark-surface pointer-events-auto',
                                isDone ? 'border-success bg-success' : isOverdue ? 'border-danger' : 'border-border-strong dark:border-border-dark-strong'
                            )}
                            style={{ left: `${pos}%` }}
                            title={`${m.title} (${new Date(m.dueDate).toLocaleDateString('da-DK')})`}
                        ></button>
                    );
                })}
            </div>

            <div className="relative h-7 w-full mt-0.5">
                {Array.from(regularByDayIndex.entries()).map(([dIdx, dayTasks]) => (
                    <button
                        type="button"
                        key={dIdx}
                        onClick={() => onSelectDay(days[dIdx])}
                        className="absolute top-0 flex flex-col items-center transform -translate-x-1/2 group"
                        style={{ left: `${posForIndex(dIdx)}%` }}
                        title={`${dayTasks.length} opgave${dayTasks.length === 1 ? '' : 'r'}: ${dayTasks.map(t => t.title).join(', ')}`}
                    >
                        <span className="w-px h-2 bg-info" />
                        <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-info text-white text-[11px] font-bold flex items-center justify-center shadow-card group-hover:brightness-110">
                            {dayTasks.length}
                        </span>
                    </button>
                ))}
            </div>

            <div className="relative w-full mt-2 h-8">
                {days.map((day, i) => {
                    const isToday = i === todayIndex;
                    const hasTasks = dayHasTasks(i);
                    const label = variant === 'week'
                        ? (
                            <span className="flex flex-col items-center leading-tight">
                                <span className="text-[10px] text-text-tertiary dark:text-text-dark-tertiary capitalize">
                                    {day.toLocaleDateString('da-DK', { weekday: 'short' })}
                                </span>
                                <span className={cn('text-label font-semibold', isToday ? 'text-brand-primary' : 'text-text-primary dark:text-text-dark-primary')}>
                                    {day.getDate()}
                                </span>
                            </span>
                        ) : (
                            <span className={cn('text-caption', isToday ? 'font-bold text-brand-primary' : 'text-text-secondary dark:text-text-dark-secondary')}>
                                {day.getDate()}
                            </span>
                        );
                    return hasTasks ? (
                        <button
                            type="button"
                            key={day.toISOString()}
                            onClick={() => onSelectDay(day)}
                            className={cn(
                                'absolute top-0 transform -translate-x-1/2 rounded hover:bg-bg-muted dark:hover:bg-bg-dark-muted px-1',
                                isToday && 'ring-1 ring-brand-primary',
                            )}
                            style={{ left: `${posForIndex(i)}%` }}
                        >
                            {label}
                        </button>
                    ) : (
                        <span
                            key={day.toISOString()}
                            className={cn('absolute top-0 transform -translate-x-1/2 px-1', isToday && 'ring-1 ring-brand-primary rounded')}
                            style={{ left: `${posForIndex(i)}%` }}
                        >
                            {label}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

const RangeTimeline: React.FC<{
    project: Project;
    milestones: Task[];
    onZoomIn: () => void;
    onSelectMilestone: (day: Date) => void;
}> = ({ project, milestones, onZoomIn, onSelectMilestone }) => {
    const startDate = new Date(project.startDate).getTime();
    const endDate = new Date(project.endDate).getTime();
    const totalDuration = endDate - startDate;

    const today = new Date();
    const todayTime = today.getTime();
    const durationSafe = totalDuration > 0 ? totalDuration : 1;
    const todayPos = Math.min(100, Math.max(0, ((todayTime - startDate) / durationSafe) * 100));
    const daysLeft = Math.ceil((endDate - todayTime) / (1000 * 60 * 60 * 24));

    return (
        <div className="mt-6 mb-2">
            <div className="flex items-center justify-end mb-2">
                <button
                    onClick={onZoomIn}
                    aria-label="Zoom ind"
                    className="min-w-11 min-h-11 flex items-center justify-center rounded-md hover:bg-bg-muted dark:hover:bg-bg-dark-muted"
                >
                    <ZoomInIcon className="w-5 h-5" />
                </button>
            </div>
            <div className="mt-10 mb-6 relative select-none">
                <div className="h-16 relative w-full pointer-events-none">
                    {milestones.map((m, idx) => {
                        const date = new Date(m.dueDate).getTime();
                        const pos = Math.min(100, Math.max(0, ((date - startDate) / durationSafe) * 100));
                        const stagger = idx % 2 === 0 ? 0 : 20;
                        return (
                            <div key={m.id} className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2 transition-all duration-500 z-10" style={{ left: `${pos}%` }}>
                                <div className="mb-1 whitespace-nowrap text-caption font-bold text-text-secondary dark:text-text-dark-secondary bg-bg/90 dark:bg-bg-dark-surface/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border dark:border-border-dark shadow-card" style={{ marginBottom: `${stagger}px` }}>
                                    {m.title}
                                </div>
                                <div className="w-px border-l border-dotted border-border-strong dark:border-border-dark-strong" style={{ height: `${16 + stagger}px` }}></div>
                            </div>
                        );
                    })}
                    <div className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2 z-30 transition-all duration-1000 ease-out" style={{ left: `${project.progress}%` }}>
                        <div className="mb-1 whitespace-nowrap text-caption font-bold text-white bg-brand-primary px-2 py-1 rounded-full shadow-card" style={{ marginBottom: '35px' }}>
                            {project.progress}%
                        </div>
                        <div className="w-px border-l-2 border-dotted border-brand-primary h-10 absolute bottom-0"></div>
                    </div>
                    <div className="absolute bottom-0 flex flex-col items-center transform -translate-x-1/2 z-20" style={{ left: `${todayPos}%` }}>
                        <div className="mb-1 whitespace-nowrap text-caption font-bold text-text-secondary dark:text-text-dark-secondary bg-bg-muted dark:bg-bg-dark-muted px-2 py-1 rounded border border-border-strong dark:border-border-dark-strong shadow-card" style={{ marginBottom: '55px' }}>
                            {today.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} | {Math.max(0, daysLeft)} dage
                        </div>
                        <div className="w-px border-l border-dashed border-border-strong dark:border-border-dark-strong h-14 absolute bottom-0"></div>
                    </div>
                </div>
                <div className="relative h-2 bg-bg-muted dark:bg-bg-dark-muted rounded-full w-full mt-1">
                    <div className="absolute top-0 left-0 h-full bg-brand-primary rounded-l-full transition-all duration-1000 ease-out" style={{ width: `${project.progress}%` }}></div>
                    <div className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-danger z-30 transition-all duration-1000 ease-out" style={{ left: `${project.progress}%` }}></div>
                    <div className="absolute top-[-6px] bottom-[-6px] w-0.5 bg-text-primary dark:bg-text-dark-primary z-20" style={{ left: `${todayPos}%` }}></div>
                    {milestones.map((m) => {
                        const date = new Date(m.dueDate).getTime();
                        const pos = Math.min(100, Math.max(0, ((date - startDate) / durationSafe) * 100));
                        const isDone = m.status === 'Udført';
                        const isOverdue = m.status === 'Forfalden' || (date < todayTime && !isDone);
                        return (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => onSelectMilestone(new Date(m.dueDate))}
                                className={cn(
                                    'absolute top-1/2 w-2.5 h-2.5 rounded-full border-2 transform -translate-y-1/2 -translate-x-1/2 z-10 bg-bg dark:bg-bg-dark-surface pointer-events-auto',
                                    isDone ? 'border-success bg-success' : isOverdue ? 'border-danger' : 'border-border-strong dark:border-border-dark-strong'
                                )}
                                style={{ left: `${pos}%` }}
                                title={`${m.title} (${new Date(m.dueDate).toLocaleDateString()})`}
                            ></button>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-caption font-medium text-text-secondary dark:text-text-dark-secondary">
                    <div><span className="block text-text-primary dark:text-text-dark-primary font-bold">Start</span>{new Date(project.startDate).toLocaleDateString('da-DK')}</div>
                    <div className="text-right"><span className="block text-text-primary dark:text-text-dark-primary font-bold">Slut</span>{new Date(project.endDate).toLocaleDateString('da-DK')}</div>
                </div>
            </div>
        </div>
    );
};
