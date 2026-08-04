import React from 'react';
import { cn } from './cn';
import { Skeleton } from './Skeleton';
import { useCountUp } from './useCountUp';

export type StatTone = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/* Rich gradient icon bubbles with tinted lift shadow (see .rich-bubble-* in index.css).
   `default` stays subtle/flat — it's the neutral tone. */
const ICON_TONES: Record<StatTone, string> = {
  default: 'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary',
  brand: 'rich-bubble-brand',
  success: 'rich-bubble-success',
  warning: 'rich-bubble-warning',
  danger: 'rich-bubble-danger',
  info: 'rich-bubble-info',
};

const VALUE_TONES: Record<StatTone, string> = {
  default: 'text-text-primary dark:text-text-dark-primary',
  brand: 'text-text-primary dark:text-text-dark-primary',
  success: 'text-success-strong dark:text-success',
  warning: 'text-warning-strong dark:text-warning',
  danger: 'text-danger-strong dark:text-danger',
  info: 'text-text-primary dark:text-text-dark-primary',
};

const nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

export interface StatCardProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** Numbers are formatted as da-DK integers (never "6.00"). */
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  tone?: StatTone;
  loading?: boolean;
}

/**
 * Compact KPI tile. Renders as a real <button> when onClick is given
 * (drill-down), otherwise as a static card.
 */
export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  icon,
  tone = 'default',
  loading = false,
  className,
  onClick,
  ...rest
}) => {
  // Animate numeric values counting up on mount (reduced-motion safe).
  const isNumeric = typeof value === 'number';
  const animated = useCountUp(isNumeric ? (value as number) : 0);
  const display = isNumeric ? nf.format(Math.round(animated)) : value;

  const classes = cn(
    'flex items-center gap-3 rounded-card border border-border bg-bg rich-surface p-3.5 text-left',
    'dark:border-border-dark dark:bg-bg-dark-surface',
    onClick &&
      'cursor-pointer transition-all duration-150 hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong active:scale-[0.98]',
    tone === 'danger' && 'border-danger-border dark:border-danger/30',
    tone === 'warning' && 'border-warning-border dark:border-warning/30',
    className
  );

  const content = (
    <>
      {icon && (
        <span
          className={cn('flex w-10 h-10 items-center justify-center rounded-control shrink-0', ICON_TONES[tone])}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0">
        {loading ? (
          <Skeleton className="h-6 w-10 mb-1" />
        ) : (
          <span className={cn('block text-title tabular-nums truncate', VALUE_TONES[tone])}>{display}</span>
        )}
        <span className="block text-caption font-semibold text-text-secondary dark:text-text-dark-secondary truncate">
          {label}
        </span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} {...rest}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
};
