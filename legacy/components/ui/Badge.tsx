import React from 'react';
import { cn } from './cn';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

/* Light mode uses the AA text-safe `*-strong` tokens (≥4.5:1 on subtle bg);
   dark mode uses the base status colour on the dark-subtle bg. */
const VARIANTS: Record<BadgeVariant, string> = {
  neutral:
    'bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary',
  brand: 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light',
  success: 'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success',
  warning: 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning',
  danger: 'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger',
  info: 'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Adds a small status dot before the text. */
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', dot, className, children, ...rest }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
      VARIANTS[variant],
      className
    )}
    {...rest}
  >
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
    {children}
  </span>
);
