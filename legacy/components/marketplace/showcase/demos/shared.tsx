import React from 'react';
import { cn } from '../../../ui';
import { RefreshCwIcon } from '../../../icons';

// ─────────────────────────────────────────────────────────────────────────────
// Shared chrome + primitives for the interactive module demos.
//
// Rules every demo follows:
//  • Local state only. A demo NEVER calls the server or mutates real data.
//  • It looks like the real module (same DS tokens, same radii, same type
//    scale) so the preview is honest about what you get.
//  • Tap targets are ≥44px and every control is a real <button>.
// ─────────────────────────────────────────────────────────────────────────────

/** Phone-ish frame the demo UI lives inside. */
export const DemoStage: React.FC<{
    children: React.ReactNode;
    /** Small label in the fake title bar. */
    title: string;
    onReset?: () => void;
    className?: string;
}> = ({ children, title, onReset, className }) => (
    <div className="rounded-card border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted p-3 sm:p-4">
        <div className="rounded-card overflow-hidden border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface shadow-card">
            <div className="flex items-center gap-2 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted px-3 py-2">
                <span className="flex gap-1" aria-hidden="true">
                    {['bg-danger/60', 'bg-warning/60', 'bg-success/60'].map((c) => (
                        <span key={c} className={cn('block w-2 h-2 rounded-full', c)} />
                    ))}
                </span>
                <span className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary truncate flex-1">
                    {title}
                </span>
                {onReset && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-1 rounded-control px-2 py-1 text-caption font-semibold text-text-secondary dark:text-text-dark-secondary hover:bg-bg-muted dark:hover:bg-bg-dark-surface transition-colors"
                    >
                        <RefreshCwIcon className="w-3 h-3" />
                        Nulstil
                    </button>
                )}
            </div>
            <div className={cn('p-3.5', className)}>{children}</div>
        </div>
    </div>
);

/** Primary action inside a demo — accent-filled, ≥44px. */
export const DemoAction: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    tone?: 'accent' | 'neutral' | 'success' | 'danger';
    full?: boolean;
    disabled?: boolean;
    className?: string;
}> = ({ onClick, children, tone = 'accent', full, disabled, className }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={tone === 'accent' && !disabled
            ? { backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' }
            : undefined}
        className={cn(
            'inline-flex items-center justify-center gap-2 rounded-control px-4 min-h-[44px]',
            'text-label font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
            tone === 'accent' && 'text-white shadow-card',
            tone === 'neutral' && 'bg-bg-muted text-text-primary dark:bg-bg-dark-muted dark:text-text-dark-primary',
            tone === 'success' && 'bg-success text-white',
            tone === 'danger' && 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger',
            full && 'w-full',
            className
        )}
    >
        {children}
    </button>
);

/** Small selectable chip — used for demo option rows. */
export const DemoChip: React.FC<{
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        style={active ? { backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' } : undefined}
        className={cn(
            'rounded-full px-3 py-2 text-caption font-semibold transition-all duration-150 active:scale-[0.97] min-h-[36px]',
            active
                ? 'text-white shadow-card'
                : 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary'
        )}
    >
        {children}
    </button>
);

/** The "tap here" nudge shown until the user interacts. */
export const TapHint: React.FC<{ show: boolean; children: React.ReactNode }> = ({ show, children }) =>
    show ? (
        <p className="flex items-center justify-center gap-1.5 text-caption font-semibold text-brand-primary dark:text-brand-light mt-2.5">
            <span className="relative flex w-2 h-2" aria-hidden="true">
                <span className="absolute inline-flex w-full h-full rounded-full bg-brand-primary opacity-70 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-brand-primary" />
            </span>
            {children}
        </p>
    ) : null;

/** Status pill matching the app's Badge look, but accent-aware. */
export const DemoPill: React.FC<{
    /** Mirrors the kit Badge variants the real screens use, plus `accent`. */
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
    children: React.ReactNode;
}> = ({ tone = 'neutral', children }) => (
    <span
        style={tone === 'accent' ? { backgroundImage: 'linear-gradient(135deg, var(--sc-a), var(--sc-b))' } : undefined}
        className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-bold whitespace-nowrap',
            tone === 'neutral' && 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary',
            tone === 'accent' && 'text-white',
            tone === 'success' && 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success',
            tone === 'warning' && 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning',
            tone === 'danger' && 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger',
            tone === 'info' && 'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info'
        )}
    >
        {children}
    </span>
);

/** A row in a demo list — mirrors the app's ListRow proportions. */
export const DemoRow: React.FC<{
    onClick?: () => void;
    leading?: React.ReactNode;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
    muted?: boolean;
}> = ({ onClick, leading, title, subtitle, trailing, muted }) => {
    const inner = (
        <>
            {leading}
            <span className="min-w-0 flex-1 text-left">
                <span className={cn('block text-label font-semibold truncate', muted
                    ? 'text-text-tertiary dark:text-text-dark-tertiary line-through'
                    : 'text-text-primary dark:text-text-dark-primary')}
                >
                    {title}
                </span>
                {subtitle && (
                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                        {subtitle}
                    </span>
                )}
            </span>
            {trailing}
        </>
    );
    const cls = 'flex w-full items-center gap-3 rounded-control border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface px-3 py-2.5 min-h-[44px]';
    return onClick ? (
        <button type="button" onClick={onClick} className={cn(cls, 'transition-all duration-150 active:scale-[0.99] hover:border-border-strong dark:hover:border-border-dark-strong')}>
            {inner}
        </button>
    ) : (
        <div className={cls}>{inner}</div>
    );
};

/** Accent-filled progress meter with a grow-in transition. */
export const DemoMeter: React.FC<{
    /** 0–1. Values > 1 clamp visually but flip the tone to danger. */
    value: number;
    tone?: 'accent' | 'success' | 'warning' | 'danger';
    className?: string;
}> = ({ value, tone = 'accent', className }) => {
    const pct = Math.max(0, Math.min(1, value)) * 100;
    return (
        <div className={cn('h-2 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden', className)}>
            <div
                className={cn(
                    'h-full rounded-full transition-[width] duration-500 ease-out',
                    tone === 'success' && 'bg-success',
                    tone === 'warning' && 'bg-warning',
                    tone === 'danger' && 'bg-danger'
                )}
                style={{
                    width: `${pct}%`,
                    ...(tone === 'accent' ? { backgroundImage: 'linear-gradient(90deg, var(--sc-a), var(--sc-b))' } : {}),
                }}
            />
        </div>
    );
};

/** Formats an elapsed-seconds count as H:MM:SS. */
export const formatClock = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Danish kroner, no decimals — matches the app's money formatting. */
export const kr = (n: number): string => `${Math.round(n).toLocaleString('da-DK')} kr`;
