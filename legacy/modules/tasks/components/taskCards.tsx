import React, { useState, useEffect, useRef } from 'react';
import type { Task, TaskStatus, TaskPriority } from '../../../types';
import type { AcceptedPartnerTask } from '../../partners';
import { formatOre } from '../../partners';
import {
    CheckCircleIcon, CheckSquareIcon, MoreVerticalIcon, TrashIcon, UsersIcon,
} from '../../../components/icons';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { AvatarGroup, Badge, cn } from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';
import { STATUS_VARIANT, statusLabel } from './taskMeta';

export { STATUS_VARIANT, statusLabel };

/** Priority → kit Badge variant, and sort rank (lower = shown first). */
export const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = {
    'Høj': 'danger',
    'Mellem': 'warning',
    'Lav': 'neutral',
};

const PRIORITY_ORDER: Record<TaskPriority, number> = { 'Høj': 0, 'Mellem': 1, 'Lav': 2 };
export const priorityRank = (p?: TaskPriority): number => PRIORITY_ORDER[p ?? 'Mellem'];

export const QUICK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'To Do', label: 'Ikke startet' },
    { value: 'Igangværende', label: 'Igangværende' },
    { value: 'Udført', label: 'Udført' },
    { value: 'Annulleret', label: 'Annulleret' },
];

export const quickTaskId = (id: string) =>
    `#QT-${id.replace(/-/g, '').substring(0, 8).toUpperCase()}`;

export const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });

export const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    d.setHours(23, 59, 59, 999);
    return d < new Date() && task.status !== 'Udført';
};

export const isPartnerTaskOverdue = (task: AcceptedPartnerTask): boolean => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    d.setHours(23, 59, 59, 999);
    return d < new Date() && task.status !== 'Udført';
};

const isDueToday = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
};

/** Due-date badge: danger when overdue, "I dag" when due today, neutral date otherwise. */
const DueBadge: React.FC<{ dueDate: string; overdue: boolean }> = ({ dueDate, overdue }) => {
    if (overdue) return <Badge variant="danger" dot>{formatDate(dueDate)}</Badge>;
    if (isDueToday(dueDate)) return <Badge variant="info">I dag</Badge>;
    return <Badge>{formatDate(dueDate)}</Badge>;
};

/** Shared card shell (matches kit Card + interactive states). */
const CARD_BASE =
    'w-full min-h-11 text-left rounded-card border border-border bg-bg p-4 shadow-card ' +
    'transition-all duration-150 hover:shadow-card-hover active:scale-[0.99] ' +
    'dark:border-border-dark dark:bg-bg-dark-surface';

/** Status accent: left border — danger for overdue, info for in-progress/review. */
const accentClass = (overdue: boolean, status: TaskStatus): string =>
    overdue
        ? 'border-l-4 border-l-danger'
        : status === 'Igangværende'
            ? 'border-l-4 border-l-info'
            : '';

const AssigneeAvatars: React.FC<{ assignees: Task['assignees'] }> = ({ assignees }) => {
    if (assignees.length === 0) return null;
    return (
        <AvatarGroup
            people={assignees.map(a => ({ name: a.name }))}
            size="sm"
            max={3}
            className="ml-auto"
        />
    );
};

export const TaskCard: React.FC<{ task: Task; onClick: () => void }> = ({ task, onClick }) => {
    const overdue = isOverdue(task);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Åbn opgave: ${task.title}`}
            className={cn(CARD_BASE, accentClass(overdue, task.status))}
        >
            <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate flex-1 min-w-0">
                    {task.title}
                </p>
                <Badge variant={STATUS_VARIANT[task.status]} className="shrink-0">
                    {statusLabel(task.status)}
                </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                {task.projectName && (
                    <Badge className="max-w-[160px]">
                        <span className="truncate">{task.projectName}</span>
                    </Badge>
                )}
                {task.dueDate && <DueBadge dueDate={task.dueDate} overdue={overdue} />}
                <AssigneeAvatars assignees={task.assignees} />
            </div>
        </button>
    );
};

export const QuickTaskCard: React.FC<{
    task: Task;
    onClick: () => void;
    onArchive: () => void;
    onDelete: () => void;
    isOwner: boolean;
    onDelegate: () => void;
    onStatusChange: (newStatus: string) => void;
}> = ({ task, onClick, onArchive, onDelete, isOwner, onDelegate, onStatusChange }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [showStatusPicker, setShowStatusPicker] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const overdue = isOverdue(task);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
                setShowStatusPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div
            className={cn(
                'relative w-full rounded-card border border-warning-border bg-bg p-4 shadow-card dark:border-warning/30 dark:bg-bg-dark-surface',
                accentClass(overdue, task.status),
            )}
        >
            <button type="button" onClick={onClick} className={cn('w-full min-h-11 text-left', isOwner && 'pr-9')}>
                <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex-1 min-w-0">
                        <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                            {task.title}
                        </p>
                        <p className="text-caption font-mono text-warning-strong dark:text-warning mt-0.5">
                            {quickTaskId(task.id)} · ikke tilknyttet projekt
                        </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[task.status]} className="shrink-0">
                        {statusLabel(task.status)}
                    </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                    {task.dueDate && <DueBadge dueDate={task.dueDate} overdue={overdue} />}
                    <AssigneeAvatars assignees={task.assignees} />
                </div>
            </button>

            {isOwner && (
                <div ref={menuRef} className="absolute top-2.5 right-2.5">
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); if (menuOpen) setShowStatusPicker(false); }}
                        className="inline-flex w-9 h-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150"
                        aria-label="Muligheder"
                        aria-haspopup="true"
                        aria-expanded={menuOpen ? 'true' : 'false'}
                    >
                        <MoreVerticalIcon className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-10 z-20 min-w-[180px] overflow-hidden rounded-card border border-border bg-bg shadow-raised dark:border-border-dark dark:bg-bg-dark-surface">
                            {showStatusPicker ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setShowStatusPicker(false); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-text-secondary dark:text-text-dark-secondary hover:bg-bg-muted dark:hover:bg-bg-dark-muted border-b border-border dark:border-border-dark transition-colors duration-150"
                                    >
                                        ← Tilbage
                                    </button>
                                    {QUICK_STATUS_OPTIONS.map(opt => (
                                        <button
                                            type="button"
                                            key={opt.value}
                                            onClick={e => {
                                                e.stopPropagation();
                                                setMenuOpen(false);
                                                setShowStatusPicker(false);
                                                onStatusChange(opt.value);
                                            }}
                                            className={cn(
                                                'w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150',
                                                task.status === opt.value
                                                    ? 'font-bold text-warning-strong dark:text-warning'
                                                    : 'text-text-primary dark:text-text-dark-primary',
                                            )}
                                        >
                                            {task.status === opt.value && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                            {opt.label}
                                        </button>
                                    ))}
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setShowStatusPicker(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-text-primary dark:text-text-dark-primary hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                                    >
                                        <CheckCircleIcon className="w-4 h-4 text-info" />
                                        Skift status
                                    </button>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelegate(); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-warning-strong dark:text-warning hover:bg-warning-subtle dark:hover:bg-warning-subtle-dark transition-colors duration-150"
                                    >
                                        <UsersIcon className="w-4 h-4" />
                                        Deleger
                                    </button>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setMenuOpen(false); onArchive(); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-text-primary dark:text-text-dark-primary hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                                    >
                                        <CheckSquareIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary" />
                                        Luk opgave
                                    </button>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setMenuOpen(false); setConfirmDelete(true); }}
                                        className="w-full flex items-center gap-2 px-4 py-3 min-h-11 text-label text-danger-strong dark:text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        Slet permanent
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmDelete}
                title="Slet permanent"
                message="Er du sikker på, at du vil slette denne opgave? Handlingen kan ikke fortrydes."
                confirmLabel="Slet"
                onConfirm={() => { setConfirmDelete(false); onDelete(); }}
                onCancel={() => setConfirmDelete(false)}
                danger
            />
        </div>
    );
};

export const QuickTaskGridCard: React.FC<{
    task: Task;
    onClick: () => void;
}> = ({ task, onClick }) => {
    const overdue = isOverdue(task);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Åbn hurtigopgave: ${task.title}`}
            className={cn(
                'w-full min-h-11 text-left rounded-card border border-warning-border bg-bg p-3 shadow-card',
                'transition-all duration-150 hover:shadow-card-hover active:scale-[0.99]',
                'dark:border-warning/30 dark:bg-bg-dark-surface',
                accentClass(overdue, task.status),
            )}
        >
            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary line-clamp-2 mb-2 min-h-[2.5rem]">
                {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={STATUS_VARIANT[task.status]}>{statusLabel(task.status)}</Badge>
                {task.dueDate && <DueBadge dueDate={task.dueDate} overdue={overdue} />}
            </div>
            <p className="text-caption font-mono text-warning-strong dark:text-warning mt-1.5">
                {quickTaskId(task.id)}
            </p>
        </button>
    );
};

export const PartnerTaskCard: React.FC<{ task: AcceptedPartnerTask; onClick: () => void }> = ({ task, onClick }) => {
    const overdue = isPartnerTaskOverdue(task);
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Åbn partneropgave: ${task.title}`}
            className={cn(
                'w-full min-h-11 text-left rounded-card border border-brand-primary/30 bg-bg p-4 shadow-card',
                'transition-all duration-150 hover:shadow-card-hover active:scale-[0.99]',
                'dark:border-brand-primary/20 dark:bg-bg-dark-surface',
                accentClass(overdue, task.status),
            )}
        >
            <div className="flex items-start justify-between gap-2 min-w-0">
                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate flex-1 min-w-0">
                    {task.title}
                </p>
                <span className="flex items-center gap-1.5 shrink-0">
                    {task.handoverStatus === 'accepted' && (
                        <Badge variant="success" dot>Afleveret</Badge>
                    )}
                    <Badge variant={STATUS_VARIANT[task.status]}>{statusLabel(task.status)}</Badge>
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                {task.projectName && (
                    <Badge className="max-w-[160px]">
                        <span className="truncate">{task.projectName}</span>
                    </Badge>
                )}
                {task.agreedPriceOre !== null ? (
                    <span className="text-caption font-semibold text-success-strong dark:text-success">
                        {formatOre(task.agreedPriceOre)}
                    </span>
                ) : (
                    <Badge variant="warning">Forhandling</Badge>
                )}
                {task.dueDate && <DueBadge dueDate={task.dueDate} overdue={overdue} />}
                <AssigneeAvatars assignees={task.assignees} />
            </div>
        </button>
    );
};
