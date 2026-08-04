import React from 'react';
import { cn } from './cn';

export interface SegmentedOption<T extends string = string> {
  label: React.ReactNode;
  value: T;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

/**
 * iOS-style segmented control for switching views/modes.
 * Radiogroup semantics with arrow-key navigation.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth = true,
  className,
}: SegmentedControlProps<T>) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    for (let step = 1; step <= options.length; step++) {
      const next = options[(idx + dir * step + options.length * step) % options.length];
      if (!next.disabled) {
        onChange(next.value);
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex rounded-control bg-bg-muted p-1 gap-0.5 dark:bg-bg-dark-muted',
        fullWidth && 'flex w-full',
        className
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] font-semibold',
              'transition-colors duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed',
              size === 'sm' ? 'min-h-8 px-2.5 text-caption' : 'min-h-9 px-3 text-label',
              fullWidth && 'flex-1',
              selected
                ? 'bg-bg text-text-primary shadow-card dark:bg-bg-dark-surface dark:text-text-dark-primary'
                : 'text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
