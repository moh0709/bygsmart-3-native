import React from 'react';
import { cn } from './cn';

/** Shimmering placeholder block. Compose into page-specific skeletons. */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div
    aria-hidden="true"
    className={cn(
      'rounded-control bg-[linear-gradient(90deg,var(--color-bg-muted)_25%,var(--color-border)_50%,var(--color-bg-muted)_75%)]',
      'dark:bg-[linear-gradient(90deg,var(--color-bg-dark-muted)_25%,var(--color-border-dark)_50%,var(--color-bg-dark-muted)_75%)]',
      'bg-[length:200%_100%] animate-shimmer',
      className
    )}
    {...rest}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className }) => (
  <div className={cn('space-y-2', className)} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn(
      'rounded-card border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface p-4 space-y-3',
      className
    )}
  >
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="grow space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

/** Full-region loading state with screen-reader announcement. */
export const SkeletonList: React.FC<{ count?: number; className?: string; label?: string }> = ({
  count = 3,
  className,
  label = 'Indlæser…',
}) => (
  <div role="status" aria-label={label} className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
    <span className="sr-only">{label}</span>
  </div>
);
