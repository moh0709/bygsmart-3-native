import React from 'react';
import { cn } from './cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

const VARIANTS: Record<AlertVariant, { box: string; icon: string; title: string }> = {
  info: {
    box: 'bg-info-subtle border-info-border dark:bg-info-subtle-dark dark:border-info/30',
    icon: 'text-info-strong dark:text-info',
    title: 'text-info-strong dark:text-info',
  },
  success: {
    box: 'bg-success-subtle border-success-border dark:bg-success-subtle-dark dark:border-success/30',
    icon: 'text-success-strong dark:text-success',
    title: 'text-success-strong dark:text-success',
  },
  warning: {
    box: 'bg-warning-subtle border-warning-border dark:bg-warning-subtle-dark dark:border-warning/30',
    icon: 'text-warning-strong dark:text-warning',
    title: 'text-warning-strong dark:text-warning',
  },
  danger: {
    box: 'bg-danger-subtle border-danger-border dark:bg-danger-subtle-dark dark:border-danger/30',
    icon: 'text-danger-strong dark:text-danger',
    title: 'text-danger-strong dark:text-danger',
  },
};

const DEFAULT_ICONS: Record<AlertVariant, React.ReactNode> = {
  info: <path d="M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />,
  success: <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" />,
  warning: <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
  danger: <path d="M12 8v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />,
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  /** Custom leading icon; pass null to hide the icon entirely. */
  icon?: React.ReactNode | null;
  /** Optional action rendered to the right (e.g. a small Button). */
  action?: React.ReactNode;
}

/**
 * Inline callout for status messaging. Replaces ad-hoc
 * `bg-red-50 border-red-200 …` divs. AA-contrast text via *-strong tokens.
 */
export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  icon,
  action,
  className,
  children,
  ...rest
}) => {
  const v = VARIANTS[variant];
  const role = variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div role={role} className={cn('flex gap-3 rounded-card border p-4', v.box, className)} {...rest}>
      {icon !== null && (
        <span className={cn('shrink-0 mt-0.5', v.icon)} aria-hidden="true">
          {icon ?? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {DEFAULT_ICONS[variant]}
            </svg>
          )}
        </span>
      )}
      <div className="min-w-0 grow">
        {title && <p className={cn('text-label font-bold', v.title)}>{title}</p>}
        {children && (
          <div className={cn('text-label text-text-secondary dark:text-text-dark-secondary', title && 'mt-0.5')}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
};
