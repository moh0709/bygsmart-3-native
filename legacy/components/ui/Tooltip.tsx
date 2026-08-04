import React, { cloneElement, isValidElement, useState } from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { cn } from './cn';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing on hover (ms). */
  delay?: number;
  className?: string;
}

/**
 * Accessible tooltip on @floating-ui/react: shows on hover AND keyboard
 * focus, dismisses on Escape, auto-flips at viewport edges.
 * Replaces the hand-positioned StandardTooltip.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, placement = 'top', delay = 300, className }) => {
  const [open, setOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { delay: { open: delay, close: 0 }, move: false }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: 'tooltip' }),
  ]);

  if (!isValidElement(children)) return children;

  return (
    <>
      {cloneElement(children, getReferenceProps({ ref: refs.setReference, ...(children.props as object) }))}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={cn(
              'z-[120] max-w-64 rounded-control px-3 py-2 text-caption font-semibold shadow-raised animate-fade-in',
              'bg-text-primary text-white dark:bg-bg-dark-muted dark:text-text-dark-primary',
              className
            )}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
};
