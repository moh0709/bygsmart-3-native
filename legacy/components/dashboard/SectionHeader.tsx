import React from 'react';

/** Consistent section header: h2 + optional count badge + optional trailing action. */
export const SectionHeader: React.FC<{ title: string; badge?: React.ReactNode; action?: React.ReactNode }> = ({ title, badge, action }) => (
    <div className="flex items-baseline justify-between mt-6 mb-2.5 px-1">
        <h2 className="text-heading text-text-primary dark:text-text-dark-primary flex items-center gap-2 min-w-0">
            <span className="truncate">{title}</span>
            {badge}
        </h2>
        {action}
    </div>
);
