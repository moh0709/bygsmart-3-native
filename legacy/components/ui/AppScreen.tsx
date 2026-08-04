import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from './cn';

export interface AppHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Show a back button. `true` = history back, string = navigate to path. */
  back?: boolean | string;
  /** Trailing header actions (icon buttons, primary button …). */
  actions?: React.ReactNode;
  /** Leading element before the title (e.g. an Avatar on top-level screens). */
  leading?: React.ReactNode;
  className?: string;
}

/**
 * Unified screen header: back affordance, truncating title/subtitle, actions.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({ title, subtitle, back, actions, leading, className }) => {
  const navigate = useNavigate();
  return (
    <header className={cn('flex items-center gap-3 py-2', className)}>
      {back && (
        <button
          type="button"
          aria-label="Tilbage"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="shrink-0 flex w-10 h-10 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors duration-150 dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      )}
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 grow">
        <h1 className="text-heading text-text-primary dark:text-text-dark-primary truncate">{title}</h1>
        {subtitle && (
          <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
};

export interface AppScreenProps {
  children: React.ReactNode;
  /** Rendered via AppHeader when given. */
  header?: AppHeaderProps;
  /** Reserve clearance for the floating bottom nav (default true). */
  hasBottomNav?: boolean;
  /** Max content width — 'reading' for article-like pages, 'wide' for data-table/dashboard pages. */
  width?: 'default' | 'reading' | 'wide' | 'full';
  className?: string;
}

const WIDTHS = {
  default: 'max-w-3xl',
  reading: 'max-w-xl',
  wide: 'max-w-6xl',
  full: 'max-w-none',
} as const;

/**
 * Standard screen scaffold: responsive gutters, centered max-width, and
 * bottom-nav clearance — replaces the 29 hand-rolled `pb-16…pb-32` paddings
 * across screens. No top safe-area padding here: every route using this
 * renders inside the authenticated `<main>` layout (App.tsx), whose
 * `pt-topbar` already clears the fixed GlobalTopBar including the notch/
 * Dynamic Island safe area — adding it again here would double the gap.
 */
export const AppScreen: React.FC<AppScreenProps> = ({
  children,
  header,
  hasBottomNav = true,
  width = 'default',
  className,
}) => (
  <div className={cn('px-4 md:px-6', hasBottomNav ? 'pb-nav' : 'pb-8', className)}>
    <div className={cn('mx-auto w-full', WIDTHS[width])}>
      {header && <AppHeader {...header} />}
      {children}
    </div>
  </div>
);
