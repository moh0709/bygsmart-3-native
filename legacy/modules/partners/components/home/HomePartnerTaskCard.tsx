import React from 'react';
import { CalendarIcon } from '../../../../components/icons';
import { formatOre } from '../../services/partners';
import type { AcceptedPartnerTask } from '../../services/partners';
import { Badge } from '../../../../components/ui';
import { PARTNER_STATUS_VARIANT, formatDueShort } from '../../../../components/dashboard/homeHelpers';

// --- Partner Task Card (Design System 2.0 restyle of GlobalTasksPage PartnerTaskCard) ---

export const HomePartnerTaskCard: React.FC<{ task: AcceptedPartnerTask; onClick: () => void }> = ({ task, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={`Åbn partneropgave: ${task.title}`}
        className="w-full min-h-11 text-left rounded-card border border-brand-primary/30 bg-bg p-4 shadow-card transition-all duration-150 hover:shadow-card-hover active:scale-[0.99] dark:border-brand-primary/20 dark:bg-bg-dark-surface"
    >
        <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate flex-1 min-w-0">
                {task.title}
            </p>
            <span className="flex items-center gap-1.5 shrink-0">
                {task.handoverStatus === 'accepted' && (
                    <Badge variant="success" dot>Afleveret</Badge>
                )}
                <Badge variant={PARTNER_STATUS_VARIANT[task.status] ?? 'neutral'}>{task.status}</Badge>
            </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {task.projectName && (
                <Badge variant="brand" className="max-w-[160px]">
                    <span className="truncate">{task.projectName}</span>
                </Badge>
            )}
            {task.agreedPriceOre !== null && (
                <span className="text-caption font-semibold text-success-strong dark:text-success">
                    {formatOre(task.agreedPriceOre)}
                </span>
            )}
            {task.dueDate && (
                <span className="flex items-center gap-1 text-caption text-text-secondary dark:text-text-dark-secondary">
                    <CalendarIcon className="w-3 h-3" />
                    {formatDueShort(task.dueDate)}
                </span>
            )}
        </div>
    </button>
);
