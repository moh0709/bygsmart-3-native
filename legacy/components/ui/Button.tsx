import React from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  // Rich: subtle 135° gradient fill + brand-tinted lift shadow.
  primary:
    'text-white bg-brand-primary bg-gradient-to-br from-brand-light to-brand-primary shadow-brand hover:brightness-105 active:brightness-95 disabled:from-brand-primary/40 disabled:to-brand-primary/40 disabled:shadow-none',
  secondary:
    'bg-bg-muted text-text-primary hover:bg-border dark:bg-bg-dark-muted dark:text-text-dark-primary dark:hover:bg-border-dark',
  outline:
    'border border-border-strong bg-transparent text-text-primary hover:bg-bg-muted dark:border-border-dark-strong dark:text-text-dark-primary dark:hover:bg-bg-dark-muted',
  ghost:
    'bg-transparent text-text-secondary hover:bg-bg-muted hover:text-text-primary dark:text-text-dark-secondary dark:hover:bg-bg-dark-muted dark:hover:text-text-dark-primary',
  danger:
    'text-white bg-danger bg-gradient-to-br from-[#F97066] to-danger shadow-danger hover:brightness-105 active:brightness-95 disabled:from-danger/40 disabled:to-danger/40 disabled:shadow-none',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={cn('animate-spin', className ?? 'h-4 w-4')}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

/**
 * Standard app button. 44px touch target at `md`, keyboard focus ring via
 * global :focus-visible style, accessible loading state.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, fullWidth, className, children, disabled, ...rest },
    ref
  ) => (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-control font-semibold select-none',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-70',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Spinner /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  )
);
Button.displayName = 'Button';
