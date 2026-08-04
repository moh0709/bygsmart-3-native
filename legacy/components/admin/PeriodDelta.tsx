import React from 'react';
import { cn } from '../ui';
import type { AdminPeriodDelta } from '../../types';

const nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/**
 * Small inline trend indicator for a period-scoped stat, e.g. "+12 (+18%)".
 * `goodDirection` controls color semantics: for most counters more is better
 * ('up'), but for things like cancellations more is worse ('down').
 */
export const PeriodDelta: React.FC<{ delta: AdminPeriodDelta; goodDirection?: 'up' | 'down'; suffix?: string }> = ({
    delta,
    goodDirection = 'up',
    suffix,
}) => {
    const diff = delta.current - delta.previous;
    const isFlat = diff === 0;
    const isGood = isFlat ? null : goodDirection === 'up' ? diff > 0 : diff < 0;

    const tone = isFlat
        ? 'text-text-secondary dark:text-text-dark-secondary'
        : isGood
        ? 'text-success-strong dark:text-success'
        : 'text-danger-strong dark:text-danger';

    const arrow = isFlat ? '·' : diff > 0 ? '↑' : '↓';
    const pct = delta.changePct == null ? 'ny' : `${delta.changePct > 0 ? '+' : ''}${delta.changePct}%`;

    return (
        <span className={cn('inline-flex items-center gap-1 text-caption font-semibold tabular-nums', tone)}>
            <span aria-hidden="true">{arrow}</span>
            <span>
                {diff > 0 ? '+' : ''}
                {nf.format(diff)}
                {suffix ? ` ${suffix}` : ''} ({pct})
            </span>
        </span>
    );
};

export default PeriodDelta;
