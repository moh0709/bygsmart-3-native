import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getRemindersForProject, createReminderForProject, updateReminder, deleteReminder } from '../services/reminders';
import { Reminder, ResourceVisibility } from '../../../types';
import { BellIcon, PlusIcon, CheckCircleIcon, TrashIcon } from '../../../components/icons';
import { ReminderFormModal } from './ReminderFormModal';
import { Button, Card, EmptyState, ListRow, SkeletonList, cn } from '../../../components/ui';

type ReminderGroup = {
    key: string;
    label: string;
    tone: 'danger' | 'default' | 'success';
    items: Reminder[];
};

const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

export const ProjectRemindersTab: React.FC<{ projectId: string; userId?: string; resourceVisibility?: ResourceVisibility }> = ({ projectId, userId: _userId, resourceVisibility: _resourceVisibility }) => {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalState, setModalState] = useState<{ type: 'add' | 'edit' | null; reminder?: Reminder }>({ type: null });

    const fetchReminders = useCallback(async () => {
        setLoading(true);
        const data = await getRemindersForProject(projectId);
        setReminders(data);
        setLoading(false);
    }, [projectId]);

    useEffect(() => {
        fetchReminders();
    }, [fetchReminders]);

    const handleSave = async (data: { title: string; dateTime: string; context: string }, id?: string) => {
        if (id) {
            const existing = reminders.find(r => r.id === id);
            if (existing) await updateReminder({ ...existing, ...data });
        } else {
            await createReminderForProject(projectId, data);
        }
        await fetchReminders();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Slet påmindelse?')) {
            await deleteReminder(id);
            await fetchReminders();
        }
    };

    const toggleComplete = async (reminder: Reminder, e: React.MouseEvent) => {
        e.stopPropagation();
        await updateReminder({ ...reminder, isCompleted: !reminder.isCompleted });
        await fetchReminders();
    };

    // Date-based grouping: Forfalden → I dag → I morgen → da-DK dates → Udført
    const groupedReminders = useMemo<ReminderGroup[]>(() => {
        const now = new Date();
        const today = startOfDay(now);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const overdue: Reminder[] = [];
        const done: Reminder[] = [];
        const byDay = new Map<number, Reminder[]>();

        [...reminders]
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
            .forEach(r => {
                if (r.isCompleted) {
                    done.push(r);
                    return;
                }
                const date = new Date(r.dateTime);
                if (date < now) {
                    overdue.push(r);
                    return;
                }
                const dayKey = startOfDay(date).getTime();
                if (!byDay.has(dayKey)) byDay.set(dayKey, []);
                byDay.get(dayKey)!.push(r);
            });

        const groups: ReminderGroup[] = [];
        if (overdue.length > 0) groups.push({ key: 'overdue', label: 'Forfalden', tone: 'danger', items: overdue });
        [...byDay.keys()].sort((a, b) => a - b).forEach(dayKey => {
            let label: string;
            if (dayKey === today.getTime()) label = 'I dag';
            else if (dayKey === tomorrow.getTime()) label = 'I morgen';
            else label = new Date(dayKey).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
            groups.push({ key: String(dayKey), label, tone: 'default', items: byDay.get(dayKey)! });
        });
        if (done.length > 0) groups.push({ key: 'done', label: 'Udført', tone: 'success', items: done });
        return groups;
    }, [reminders]);

    return (
        <div className="p-4 space-y-5 pb-24 relative min-h-[calc(100vh-200px)] animate-fade-in">
            {/* Header + add */}
            <div className="flex items-center justify-between">
                <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Påmindelser</h2>
                <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setModalState({ type: 'add' })}>
                    Ny påmindelse
                </Button>
            </div>

            {loading && <SkeletonList count={3} label="Indlæser påmindelser…" />}

            {!loading && groupedReminders.map(group => (
                <section key={group.key} aria-label={group.label} className="space-y-2">
                    <h3 className={cn(
                        'text-caption font-bold uppercase tracking-wider px-1',
                        group.tone === 'danger'
                            ? 'text-danger-strong dark:text-danger'
                            : 'text-text-secondary dark:text-text-dark-secondary'
                    )}>
                        {group.label}
                    </h3>
                    <Card
                        padding="none"
                        className={cn(
                            'overflow-hidden divide-y divide-border dark:divide-border-dark',
                            group.tone === 'danger' && 'border-l-4 border-l-danger'
                        )}
                    >
                        {group.items.map(r => {
                            const isOverdue = group.tone === 'danger';
                            const dateLabel = new Date(r.dateTime).toLocaleDateString('da-DK');
                            const timeLabel = new Date(r.dateTime).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={r.id} className={cn('flex items-center', r.isCompleted && 'opacity-60')}>
                                    <ListRow
                                        className="flex-1 min-w-0"
                                        chevron={false}
                                        onClick={() => setModalState({ type: 'edit', reminder: r })}
                                        aria-label={`Rediger påmindelse: ${r.title}`}
                                        leading={
                                            <span
                                                className={cn(
                                                    'flex w-10 h-10 items-center justify-center rounded-control shrink-0',
                                                    isOverdue
                                                        ? 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger'
                                                        : r.isCompleted
                                                            ? 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success'
                                                            : 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
                                                )}
                                                aria-hidden="true"
                                            >
                                                <BellIcon className="w-5 h-5" />
                                            </span>
                                        }
                                        title={<span className={cn(r.isCompleted && 'line-through')}>{r.title}</span>}
                                        subtitle={
                                            <span className={cn(isOverdue && 'text-danger-strong dark:text-danger font-semibold')}>
                                                {dateLabel} · kl. {timeLabel}
                                                {r.context && ` · ${r.context}`}
                                            </span>
                                        }
                                    />
                                    <div className="flex items-center shrink-0 pr-2">
                                        <button
                                            type="button"
                                            onClick={(e) => toggleComplete(r, e)}
                                            aria-label={r.isCompleted ? `Markér "${r.title}" som ikke udført` : `Markér "${r.title}" som udført`}
                                            className="flex w-11 h-11 items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                                        >
                                            <span className={cn(
                                                'flex w-6 h-6 items-center justify-center rounded-full border-2 transition-colors duration-150',
                                                r.isCompleted
                                                    ? 'bg-success border-success text-white'
                                                    : 'border-border-strong dark:border-border-dark-strong'
                                            )}>
                                                {r.isCompleted && <CheckCircleIcon className="w-4 h-4" aria-hidden="true" />}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(r.id, e)}
                                            aria-label={`Slet påmindelse: ${r.title}`}
                                            className="flex w-11 h-11 items-center justify-center rounded-full text-text-tertiary hover:text-danger-strong hover:bg-danger-subtle dark:text-text-dark-tertiary dark:hover:text-danger dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                                        >
                                            <TrashIcon className="w-5 h-5" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </Card>
                </section>
            ))}

            {!loading && reminders.length === 0 && (
                <Card padding="none">
                    <EmptyState
                        icon={<BellIcon className="w-8 h-8" />}
                        title="Ingen påmindelser"
                        description="Opret en påmindelse, så du ikke glemmer vigtige aftaler og frister."
                        action={
                            <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setModalState({ type: 'add' })}>
                                Ny påmindelse
                            </Button>
                        }
                    />
                </Card>
            )}

            {(modalState.type === 'add' || modalState.type === 'edit') && (
                <ReminderFormModal
                    reminder={modalState.reminder}
                    onClose={() => setModalState({ type: null })}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};
