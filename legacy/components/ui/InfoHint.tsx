import React, { useState } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { QuestionCircleIcon, XIcon } from '../icons';
import { cn } from './cn';

export interface InfoHintProps {
  /** Metric name shown in the popover header. */
  title: string;
  /** "Hvad viser den?" — what the metric shows. */
  description: string;
  /** Optional "Hvordan måles det?" — how it is computed. */
  calculation?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Accessible label for the trigger button. */
  label?: string;
  className?: string;
}

/**
 * Click-to-toggle info popover for KPIs, indices, charts and parameters.
 *
 * Behaviour mirrors the proven tap-to-toggle logic in
 * components/calculators/InfoTooltip.tsx (opens on click, closes on a second
 * click — works on touch), upgraded to @floating-ui/react for auto-flip
 * positioning (same library/usage as components/ui/Tooltip.tsx). The visual
 * content model matches StandardTooltip (Hvad viser den? / Hvordan måles det?).
 *
 * Closes on outside-click and Escape (useDismiss); the trigger is a real
 * `<button>` carrying aria-expanded and the popover has tooltip role semantics,
 * so it is fully keyboard accessible.
 */
export const InfoHint: React.FC<InfoHintProps> = ({
  title,
  description,
  calculation,
  placement = 'top',
  label = 'Mere info',
  className,
}) => {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ]);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          type: 'button',
          'aria-label': label,
          'aria-expanded': open,
        })}
        className={cn(
          'rounded-full text-text-secondary transition-colors hover:text-brand-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 dark:text-text-dark-secondary',
          open && 'text-brand-primary'
        )}
      >
        <QuestionCircleIcon className="h-4 w-4" />
      </button>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[120] w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-border bg-bg shadow-xl animate-fade-in dark:border-border-dark dark:bg-bg-dark-surface"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-bg-subtle px-4 py-3 dark:border-border-dark dark:bg-bg-dark">
              <h4 className="text-sm font-bold text-text-primary dark:text-text-dark-primary">{title}</h4>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Luk"
                className="-my-3 -mr-3 flex min-h-11 min-w-11 items-center justify-center text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {/* Description Section */}
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">
                  Hvad viser den?
                </p>
                <p className="text-sm leading-relaxed text-text-primary dark:text-text-dark-primary">
                  {description}
                </p>
              </div>

              {/* Calculation Section (optional) */}
              {calculation && (
                <div className="rounded-control border border-info-border bg-info-subtle p-3 dark:border-info/30 dark:bg-info-subtle-dark">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wider text-info-strong dark:text-info">
                    Hvordan måles det?
                  </p>
                  <p className="font-mono text-xs leading-relaxed text-info-strong dark:text-info">
                    {calculation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </span>
  );
};
