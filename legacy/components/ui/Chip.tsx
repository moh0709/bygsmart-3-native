import React from 'react';
import { cn } from './cn';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected/active state (filter chips). */
  selected?: boolean;
  /** Optional count badge shown after the label. */
  count?: number;
  /** Optional leading icon. */
  icon?: React.ReactNode;
}

/**
 * Interactive filter chip (44px-friendly). For static status pills use `Badge`.
 */
export const Chip: React.FC<ChipProps> = ({ selected = false, count, icon, className, children, ...rest }) => (
  <button
    type="button"
    aria-pressed={selected}
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3.5 min-h-9 text-label font-semibold whitespace-nowrap',
      'transition-colors duration-150 select-none',
      selected
        ? 'bg-brand-primary text-white shadow-sm'
        : 'bg-bg text-text-secondary border border-border hover:border-border-strong hover:text-text-primary dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:border-border-dark dark:hover:text-text-dark-primary',
      className
    )}
    {...rest}
  >
    {icon}
    {children}
    {typeof count === 'number' && (
      <span
        className={cn(
          'rounded-full px-1.5 py-px text-caption font-bold',
          selected ? 'bg-white/20' : 'bg-bg-muted dark:bg-bg-dark-muted'
        )}
      >
        {count}
      </span>
    )}
  </button>
);
