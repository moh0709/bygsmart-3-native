import React from 'react';
import { cn } from './cn';

export interface ListRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Leading element: icon bubble, Avatar, checkbox … */
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Trailing element(s): Badge, meta text, avatar … */
  trailing?: React.ReactNode;
  /** Show a chevron affordance (implied when onClick is set). */
  chevron?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  disabled?: boolean;
}

/**
 * Standard list row (≥44px). Renders as a real <button> when interactive.
 * Compose inside a <Card padding="none"> with `divide-y divide-border`.
 */
export const ListRow: React.FC<ListRowProps> = ({
  leading,
  title,
  subtitle,
  trailing,
  chevron,
  onClick,
  disabled,
  className,
  ...rest
}) => {
  const interactive = Boolean(onClick) && !disabled;
  const showChevron = chevron ?? interactive;

  const classes = cn(
    'flex w-full items-center gap-3 px-4 py-3 min-h-11 text-left',
    interactive &&
      'cursor-pointer transition-colors duration-150 hover:bg-bg-subtle active:bg-bg-muted dark:hover:bg-bg-dark-muted/50 dark:active:bg-bg-dark-muted',
    disabled && 'opacity-50',
    className
  );

  const content = (
    <>
      {leading && <span className="shrink-0 flex items-center">{leading}</span>}
      <span className="min-w-0 grow">
        <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
          {title}
        </span>
        {subtitle && (
          <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate mt-0.5">
            {subtitle}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0 flex items-center gap-2">{trailing}</span>}
      {showChevron && (
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={classes} {...rest}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} {...rest}>
      {content}
    </div>
  );
};
