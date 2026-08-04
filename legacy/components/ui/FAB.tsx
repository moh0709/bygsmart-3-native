import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

export interface FABProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name (icon-only button). */
  'aria-label': string;
  /** Optional text label rendered next to the icon (extended FAB). */
  label?: string;
  icon: React.ReactNode;
  /** Fixed-position above the bottom nav (default true). Set false to place manually. */
  fixed?: boolean;
  /** Allow the user to drag the button around the screen (hold + move). */
  draggable?: boolean;
}

const DRAG_THRESHOLD = 5;

/**
 * Floating action button for the screen's single primary action.
 * Positioned above the floating bottom nav, safe-area aware. Optionally
 * draggable — a real drag suppresses the click so it never fires accidentally.
 */
export const FAB: React.FC<FABProps> = ({ label, icon, fixed = true, draggable = false, className, onClick, ...rest }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, offX: 0, offY: 0 });
  const movedRef = useRef(false);

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!draggable) return;
    movedRef.current = false;
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const r = btnRef.current?.getBoundingClientRect();
    start.current = { x: cx, y: cy, offX: r ? cx - r.left : 0, offY: r ? cy - r.top : 0 };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent | TouchEvent) => {
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY;
      if ('touches' in e) e.preventDefault();
      if (Math.abs(cx - start.current.x) > DRAG_THRESHOLD || Math.abs(cy - start.current.y) > DRAG_THRESHOLD) {
        movedRef.current = true;
      }
      const w = btnRef.current?.offsetWidth ?? 56;
      const h = btnRef.current?.offsetHeight ?? 56;
      const x = Math.max(8, Math.min(cx - start.current.offX, window.innerWidth - w - 8));
      const y = Math.max(8, Math.min(cy - start.current.offY, window.innerHeight - h - 8));
      setPos({ x, y });
    };
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
    };
  }, [dragging]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Swallow the click that ends a drag so the primary action doesn't fire.
    if (movedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      movedRef.current = false;
      return;
    }
    onClick?.(e);
  };

  const button = (
    <button
      ref={btnRef}
      type="button"
      onMouseDown={onDown}
      onTouchStart={onDown}
      onClick={handleClick}
      style={draggable && pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', touchAction: 'none' } : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary text-white font-bold shadow-raised scale-95',
        'transition-all duration-150 hover:bg-brand-strong active:scale-95',
        label ? 'h-14 px-5 text-label' : 'w-14 h-14',
        fixed && 'fixed right-4 z-[80] bottom-[calc(96px+env(safe-area-inset-bottom,0px))]',
        draggable && 'cursor-grab active:cursor-grabbing touch-none select-none',
        className
      )}
      {...rest}
    >
      <span aria-hidden="true" className="flex items-center justify-center">{icon}</span>
      {label}
    </button>
  );

  // When fixed, render into document.body so an ancestor with a `transform`/
  // `filter`/`will-change` (which turns `position: fixed` into a scrolling
  // containing block) can't drag the FAB out of the viewport. Manually-placed
  // (fixed={false}) FABs stay inline where the caller positions them.
  if (fixed && typeof document !== 'undefined') {
    return createPortal(button, document.body);
  }
  return button;
};
