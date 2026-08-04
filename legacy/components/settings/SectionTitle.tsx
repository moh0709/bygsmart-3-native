import React from 'react';
import { cn } from '../ui';

/** Section label above each grouped settings card (§C9 grouping). */
export const SectionTitle: React.FC<{ children: React.ReactNode; danger?: boolean }> = ({ children, danger }) => (
    <h3
        className={cn(
            'text-label font-semibold ml-1',
            danger ? 'text-danger' : 'text-text-secondary dark:text-text-dark-secondary'
        )}
    >
        {children}
    </h3>
);
