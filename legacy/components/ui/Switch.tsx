import React from 'react';
import { cn } from './cn';

export interface SwitchProps {
  /** On/off state. */
  checked: boolean;
  /** Fired on activation (the caller flips the underlying state). */
  onChange: () => void;
  /** Required — accessible name for the control. */
  'aria-label': string;
  /** When true the toggle is non-interactive and visually muted. */
  disabled?: boolean;
  className?: string;
}

/**
 * Accessible on/off toggle (role="switch"). Brand-primary track when on,
 * neutral track when off; dark-mode aware; DS semantic tokens throughout.
 *
 * Extracted from the local copies on the admin ModuleEntitlementsPanel and the
 * Settings page so new surfaces share one canonical control. Those existing
 * local copies are intentionally left untouched.
 */
export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
  className,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked ? 'true' : 'false'}
    aria-label={ariaLabel}
    onClick={onChange}
    disabled={disabled}
    className={cn(
      'shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center',
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      className
    )}
  >
    <span
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong'
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        )}
      />
    </span>
  </button>
);

export default Switch;
