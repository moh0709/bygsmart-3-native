import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../../components/ui';
import {
  clampEndMin,
  clampStartMin,
  formatMinutes,
  type BlockedRange,
} from '../services/timeRegistrations';

interface TimeRangeSliderProps {
  /** Minutes after midnight, 0–1440, step-aligned. */
  startMin: number;
  endMin: number;
  /** Commits the new range (fired on pointer release / keyboard change). */
  onChange: (next: { startMin: number; endMin: number }) => void;
  /** 30-minute steps per the design. */
  step?: number;
  /** Other tasks' occupied time — rendered as tinted segments (informational,
   *  the handles are NOT constrained by these). */
  blockedRanges?: BlockedRange[];
  className?: string;
}

const DAY_MIN = 1440;
const pct = (min: number) => (min / DAY_MIN) * 100;

/** 00 02 04 … 24 — tick labels every two hours. */
const TICKS = Array.from({ length: 13 }, (_, i) => String(i * 2).padStart(2, '0'));

type Handle = 'start' | 'end';

/**
 * Trin 3 dual-handle time range — both thumbs live on one track. Custom
 * pointer-events implementation (native <input type=range> can't do two
 * thumbs): tap/drag either handle, or tap the track to move the nearest one.
 *
 * Hard block: start ≤ end−step and end ≥ start+step (a transient red glow fires
 * on both handles when a drag attempts to cross that gap). Other tasks' time is
 * tinted on the track but never blocks movement — overlap is surfaced as a
 * conflict highlight in the parent instead.
 */
export const TimeRangeSlider: React.FC<TimeRangeSliderProps> = ({
  startMin,
  endMin,
  onChange,
  step = 30,
  blockedRanges = [],
  className,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragHandle, setDragHandle] = useState<Handle | null>(null);
  // While dragging we render from local state for a smooth live readout; the
  // committed value (props) is what conflict detection runs against on release.
  const [local, setLocal] = useState<{ s: number; e: number } | null>(null);
  const [glow, setGlow] = useState(false);
  const glowTimer = useRef<number | undefined>(undefined);
  const teardownRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      teardownRef.current?.();
      window.clearTimeout(glowTimer.current);
    },
    []
  );

  const triggerGlow = () => {
    setGlow(true);
    window.clearTimeout(glowTimer.current);
    glowTimer.current = window.setTimeout(() => setGlow(false), 500);
  };

  const minutesFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const raw = ratio * DAY_MIN;
    return Math.max(0, Math.min(DAY_MIN, Math.round(raw / step) * step));
  };

  const s = local ? local.s : startMin;
  const e = local ? local.e : endMin;

  const beginDrag = (handle: Handle, clientX: number, applyImmediately: boolean) => {
    teardownRef.current?.(); // drop any listeners from an interrupted drag
    // Fresh closure over the current committed range.
    const drag = { handle, s: startMin, e: endMin };
    setDragHandle(handle);
    setLocal({ s: drag.s, e: drag.e });

    const applyAt = (x: number) => {
      const m = minutesFromClientX(x);
      if (drag.handle === 'start') {
        if (m > drag.e - step) triggerGlow();
        drag.s = clampStartMin(m, drag.e, step);
      } else {
        if (m < drag.s + step) triggerGlow();
        drag.e = clampEndMin(m, drag.s, step);
      }
      setLocal({ s: drag.s, e: drag.e });
    };

    const onMove = (ev: PointerEvent) => applyAt(ev.clientX);
    const teardown = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      teardownRef.current = null;
    };
    const onUp = () => {
      teardown();
      setDragHandle(null);
      setLocal(null);
      onChange({ startMin: drag.s, endMin: drag.e });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    teardownRef.current = teardown;

    if (applyImmediately) applyAt(clientX);
  };

  const onThumbPointerDown = (handle: Handle) => (ev: React.PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    beginDrag(handle, ev.clientX, false);
  };

  const onTrackPointerDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    const m = minutesFromClientX(ev.clientX);
    const nearest: Handle = Math.abs(m - s) <= Math.abs(m - e) ? 'start' : 'end';
    beginDrag(nearest, ev.clientX, true);
  };

  const onThumbKeyDown = (handle: Handle) => (ev: React.KeyboardEvent) => {
    let delta = 0;
    let absolute: number | null = null;
    switch (ev.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        delta = step;
        break;
      case 'PageUp':
        delta = 60;
        break;
      case 'PageDown':
        delta = -60;
        break;
      case 'Home':
        absolute = handle === 'start' ? 0 : startMin + step;
        break;
      case 'End':
        absolute = handle === 'start' ? endMin - step : DAY_MIN;
        break;
      default:
        return;
    }
    ev.preventDefault();
    if (handle === 'start') {
      const target = absolute ?? startMin + delta;
      if (target > endMin - step) triggerGlow();
      onChange({ startMin: clampStartMin(target, endMin, step), endMin });
    } else {
      const target = absolute ?? endMin + delta;
      if (target < startMin + step) triggerGlow();
      onChange({ startMin, endMin: clampEndMin(target, startMin, step) });
    }
  };

  const handleClasses = (handle: Handle) =>
    cn(
      'block w-7 h-7 rounded-full bg-brand-primary shadow-raised transition-[transform,box-shadow,border-color] duration-150',
      dragHandle === handle && 'scale-110',
      glow
        ? 'border-[3px] border-danger ring-4 ring-danger-subtle dark:ring-danger-subtle-dark'
        : 'border-[3px] border-white dark:border-bg-dark-surface ring-1 ring-black/10'
    );

  // A plain render helper (NOT a nested component) so the thumbs are not
  // remounted on every drag frame — that would lose focus and cause jank.
  const renderThumb = (handle: Handle, value: number, label: string, zClass: string) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={DAY_MIN}
      aria-valuenow={value}
      aria-valuetext={formatMinutes(value)}
      onPointerDown={onThumbPointerDown(handle)}
      onKeyDown={onThumbKeyDown(handle)}
      style={{ left: `${pct(value)}%` }}
      className={cn(
        'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center',
        'w-11 h-11 rounded-full touch-none cursor-grab active:cursor-grabbing',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:focus-visible:ring-offset-bg-dark-surface',
        zClass
      )}
    >
      <span className={handleClasses(handle)} aria-hidden="true" />
    </div>
  );

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-label text-text-secondary dark:text-text-dark-secondary">Tidsrum</span>
        <output className="text-title font-bold text-brand-primary dark:text-brand-light tabular-nums tracking-tight">
          {formatMinutes(s)} – {formatMinutes(e)}
        </output>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        className="relative h-11 flex items-center touch-none select-none"
      >
        {/* base track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-bg-muted dark:bg-bg-dark-muted" />

        {/* other tasks' occupied time (informational tint) */}
        {blockedRanges.map((b, i) => (
          <div
            key={`${b.startMin}-${b.endMin}-${i}`}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-sm bg-danger/25 pointer-events-none"
            style={{ left: `${pct(b.startMin)}%`, width: `${pct(b.endMin - b.startMin)}%` }}
          />
        ))}

        {/* selected range fill */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-brand-primary pointer-events-none"
          style={{ left: `${pct(s)}%`, width: `${pct(e - s)}%` }}
        />

        {renderThumb('start', s, 'Starttid', 'z-10')}
        {renderThumb('end', e, 'Sluttid', 'z-20')}
      </div>

      <div
        aria-hidden="true"
        className="flex justify-between text-[10px] leading-4 text-text-tertiary dark:text-text-dark-tertiary -mt-1 tabular-nums pointer-events-none"
      >
        {TICKS.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
};
