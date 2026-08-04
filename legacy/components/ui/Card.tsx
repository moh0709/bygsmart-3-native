import React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover elevation + pointer for clickable cards. */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Opt out of the rich surface gradient/depth (flat shadow-card instead). */
  flat?: boolean;
}

const PADDING = { none: '', sm: 'p-3', md: 'p-4 sm:p-5', lg: 'p-5 sm:p-6' } as const;

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, padding = 'md', flat = false, className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-card bg-bg border border-border dark:bg-bg-dark-surface dark:border-border-dark',
        // Rich surface (soft gradient + layered shadow + inner sheen) by default;
        // `flat` falls back to the plain card shadow.
        flat ? 'shadow-card' : 'rich-surface',
        PADDING[padding],
        interactive &&
          'cursor-pointer transition-all duration-150 hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong active:scale-[0.99]',
        className
      )}
      {...rest}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div className={cn('flex items-start justify-between gap-3 mb-3', className)} {...rest} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...rest }) => (
  <h3
    className={cn('text-base font-semibold text-text-primary dark:text-text-dark-primary', className)}
    {...rest}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...rest }) => (
  <p className={cn('text-sm text-text-secondary dark:text-text-dark-secondary', className)} {...rest} />
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div
    className={cn('mt-4 pt-3 border-t border-border dark:border-border-dark flex items-center gap-2', className)}
    {...rest}
  />
);
