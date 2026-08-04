import React from 'react';

// --- Quick action tile (inline — icon bubble + caption label) ---

export const QuickAction: React.FC<{
    icon: React.FC<{ className?: string }>;
    label: string;
    onClick: () => void;
}> = ({ icon: Icon, label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-card border border-border bg-bg p-2 text-center shadow-card transition-all duration-150 hover:shadow-card-hover hover:border-border-strong active:scale-[0.98] dark:border-border-dark dark:bg-bg-dark-surface dark:hover:border-border-dark-strong"
    >
        <span className="flex w-10 h-10 items-center justify-center rounded-control bg-brand-subtle dark:bg-brand-subtle-dark" aria-hidden="true">
            <Icon className="w-5 h-5 text-brand-primary dark:text-brand-light" />
        </span>
        <span className="text-caption font-semibold leading-tight text-text-primary dark:text-text-dark-primary">
            {label}
        </span>
    </button>
);
