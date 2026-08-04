import React from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Designed empty state: icon, explanation and a clear next step. */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12', className)}>
    {icon && (
      <div
        className="w-14 h-14 mb-4 rounded-2xl bg-brand-subtle dark:bg-brand-subtle-dark text-brand-primary dark:text-brand-light flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7"
        aria-hidden="true"
      >
        {icon}
      </div>
    )}
    <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">{title}</h3>
    {description && (
      <p className="mt-1.5 text-sm text-text-secondary dark:text-text-dark-secondary max-w-sm">{description}</p>
    )}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
