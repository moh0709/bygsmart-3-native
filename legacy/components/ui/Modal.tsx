import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra header content (e.g. a settings icon) rendered before the close button. */
  headerExtra?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** On small screens render as a bottom sheet (default true). */
  sheetOnMobile?: boolean;
  /** Render as a bottom sheet on ALL viewports (with grabber handle). */
  sheet?: boolean;
  /** Allow closing by clicking the backdrop / pressing Escape (default true). */
  dismissable?: boolean;
  className?: string;
  /** Ref id for the app's introspection/highlight system (utils/introspection.ts). */
  'data-ref-id'?: string;
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  full: 'sm:max-w-[min(96vw,1280px)]',
} as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The single modal implementation for the app.
 * Accessible by default: focus trap, focus restore, Escape to close,
 * aria-modal + labelledby/describedby, body scroll lock, bottom-sheet on mobile.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  headerExtra,
  size = 'md',
  sheetOnMobile = true,
  sheet = false,
  dismissable = true,
  className,
  'data-ref-id': dataRefId,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Scroll lock + focus management
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = original;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Focus trap
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [dismissable, onClose]
  );

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex justify-center',
        sheet ? 'items-end' : sheetOnMobile ? 'items-end sm:items-center' : 'items-center'
      )}
      role="presentation"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        data-ref-id={dataRefId}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full max-h-[92dvh] flex flex-col bg-bg dark:bg-bg-dark-surface shadow-modal',
          sheet
            ? 'rounded-t-modal animate-slide-up'
            : sheetOnMobile
              ? 'rounded-t-modal sm:rounded-modal animate-slide-up sm:animate-scale-in'
              : 'rounded-modal animate-scale-in mx-4',
          !sheet && sheetOnMobile && 'sm:mx-4',
          SIZES[size],
          className
        )}
      >
        {sheet && (
          <div className="w-9 h-1 rounded-full bg-border-strong dark:bg-border-dark-strong mx-auto mt-2.5 -mb-1 shrink-0" aria-hidden="true" />
        )}
        {(title || dismissable || headerExtra) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-text-secondary dark:text-text-dark-secondary">
                  {description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerExtra}
              {dismissable && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Luk"
                  className="shrink-0 -m-1 p-2 rounded-control text-text-tertiary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-tertiary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto grow">{children}</div>
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-border dark:border-border-dark flex items-center justify-end gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
