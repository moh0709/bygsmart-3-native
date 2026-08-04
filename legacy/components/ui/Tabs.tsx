import React, { useCallback, useRef } from 'react';
import { cn } from './cn';

export interface TabItem {
  id: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** 'underline' for page-level sections, 'pills' for compact filters. */
  variant?: 'underline' | 'pills';
  className?: string;
  'aria-label'?: string;
}

/** Accessible tablist with arrow-key navigation (WAI-ARIA Tabs pattern). */
export const Tabs: React.FC<TabsProps> = ({ tabs, value, onChange, variant = 'underline', className, ...rest }) => {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const enabled = tabs.filter((t) => !t.disabled);
      const idx = enabled.findIndex((t) => t.id === value);
      let next = idx;
      if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length;
      if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = enabled.length - 1;
      const target = enabled[next];
      if (target) {
        onChange(target.id);
        listRef.current
          ?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(target.id)}"]`)
          ?.focus();
      }
    },
    [tabs, value, onChange]
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={rest['aria-label']}
      onKeyDown={onKeyDown}
      className={cn(
        'flex items-center gap-1 overflow-x-auto hide-scrollbar',
        variant === 'underline' && 'border-b border-border dark:border-border-dark',
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-colors duration-150 disabled:opacity-50',
              variant === 'underline'
                ? cn(
                    'px-3 py-2.5 border-b-2 -mb-px',
                    selected
                      ? 'border-brand-primary text-brand-primary'
                      : 'border-transparent text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
                  )
                : cn(
                    'px-3.5 h-9 rounded-full',
                    selected
                      ? 'bg-brand-primary text-white shadow-sm'
                      : 'bg-bg-muted text-text-secondary hover:text-text-primary dark:bg-bg-dark-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
                  )
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
};
