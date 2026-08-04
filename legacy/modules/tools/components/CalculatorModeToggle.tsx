import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '../../../components/ui';

export type CalcMode = 'basic' | 'advanced';

export interface CalculatorModeToggleProps {
  toolId: string;
  /** Lock the Advanced segment (wiring to gating added in Foundation 4). */
  advancedLocked?: boolean;
  /** When true the toggle is not rendered (Basic-only tools). */
  hidden?: boolean;
  onChange?: (mode: CalcMode) => void;
  /** Called when the user taps the locked Advanced segment — use to open an upgrade flow. */
  onLockedClick?: () => void;
  className?: string;
}

const lsKey = (id: string) => `bygSmart-calc-mode-${id}`;

const SEGMENT_BASE =
  'flex-1 min-h-11 px-4 rounded-[calc(var(--radius-control)-2px)] text-label font-semibold ' +
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none transition-colors duration-150';

const SEGMENT_SELECTED =
  'bg-bg text-text-primary shadow-card dark:bg-bg-dark-surface dark:text-text-dark-primary';

const SEGMENT_IDLE =
  'text-text-secondary hover:text-text-primary dark:text-text-dark-secondary dark:hover:text-text-dark-primary';

/**
 * Basis/Avanceret mode toggle for calculators — styled like the kit
 * SegmentedControl, with a lockable Advanced segment and persisted choice.
 */
const CalculatorModeToggle: React.FC<CalculatorModeToggleProps> = ({
  toolId,
  advancedLocked = false,
  hidden = false,
  onChange,
  onLockedClick,
  className = '',
}) => {
  const [mode, setMode] = useState<CalcMode>(() => {
    try {
      const stored = localStorage.getItem(lsKey(toolId));
      // Never initialise into advanced when the segment is locked
      if (stored === 'advanced' && !advancedLocked) return 'advanced';
    } catch {
      // storage unavailable
    }
    return 'basic';
  });

  // Coerce to basic if the lock engages after mount (access context late-resolves)
  useEffect(() => {
    if (advancedLocked && mode === 'advanced') {
      setMode('basic');
    }
  }, [advancedLocked, mode]);

  const select = useCallback(
    (next: CalcMode) => {
      if (next === 'advanced' && advancedLocked) {
        onLockedClick?.();
        return;
      }
      setMode(next);
    },
    [advancedLocked, onLockedClick]
  );

  useEffect(() => {
    try {
      localStorage.setItem(lsKey(toolId), mode);
    } catch {
      // storage unavailable – silently continue
    }
    onChange?.(mode);
  }, [mode, toolId, onChange]);

  if (hidden) return null;

  return (
    <div
      className={cn('flex w-full rounded-control bg-bg-muted dark:bg-bg-dark-muted p-1 gap-0.5', className)}
      role="group"
      aria-label="Beregner tilstand"
    >
      <button
        type="button"
        onClick={() => select('basic')}
        aria-pressed={mode === 'basic'}
        className={cn(SEGMENT_BASE, mode === 'basic' ? SEGMENT_SELECTED : SEGMENT_IDLE)}
      >
        Basis
      </button>

      <button
        type="button"
        onClick={() => select('advanced')}
        aria-pressed={mode === 'advanced'}
        aria-disabled={advancedLocked}
        className={cn(
          SEGMENT_BASE,
          mode === 'advanced' ? SEGMENT_SELECTED : SEGMENT_IDLE,
          advancedLocked && 'cursor-not-allowed opacity-70'
        )}
      >
        Avanceret
        {advancedLocked && (
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-label="Låst" role="img">
            <path d="M18 10h-1V7A5 5 0 0 0 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-6 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm3-7H9V7a3 3 0 1 1 6 0v3Z" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default CalculatorModeToggle;
