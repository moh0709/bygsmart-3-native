import React, { useEffect, useId, useState } from 'react';
import { cn } from './cn';

export type ProgressTone = 'brand' | 'success' | 'warning' | 'danger' | 'info';

/** Animate a value 0 → target on mount (one frame later, so the CSS
 *  transition runs). The global reduced-motion CSS neutralizes the transition. */
function useGrowOnMount(target: number): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(target));
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}

// Rich: gradient fills for the bar (light → base, 90deg).
const TONES: Record<ProgressTone, string> = {
  brand: 'bg-brand-primary bg-gradient-to-r from-brand-light to-brand-primary',
  success: 'bg-success bg-gradient-to-r from-[#34D399] to-success',
  warning: 'bg-warning bg-gradient-to-r from-[#FBBF50] to-warning',
  danger: 'bg-danger bg-gradient-to-r from-[#F97066] to-danger',
  info: 'bg-info bg-gradient-to-r from-[#6BA6FF] to-info',
};

// Gradient stop colors for the ring (SVG gradient can't use Tailwind classes).
const RING_GRAD: Record<ProgressTone, [string, string]> = {
  brand: ['#5B8CFF', '#1E5FFF'],
  success: ['#34D399', '#12934B'],
  warning: ['#FBBF50', '#B76E00'],
  danger: ['#F97066', '#D92D20'],
  info: ['#6BA6FF', '#175CD3'],
};

const SHADOW_RGB: Record<ProgressTone, string> = {
  brand: '30 95 255',
  success: '18 147 75',
  warning: '183 110 0',
  danger: '217 45 32',
  info: '23 92 211',
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  tone = 'brand',
  size = 'md',
  label,
  className,
  ...rest
}) => {
  const v = clamp(value);
  const grown = useGrowOnMount(v);
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'w-full rounded-full overflow-hidden bg-bg-muted dark:bg-bg-dark-muted',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className
      )}
      {...rest}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-slow ease-standard', TONES[tone])}
        style={{ width: `${grown}%` }}
      />
    </div>
  );
};

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number;
  tone?: ProgressTone;
  /** Outer diameter in px (default 48). */
  diameter?: number;
  strokeWidth?: number;
  /** Center content; defaults to "NN%". Pass null to hide. */
  children?: React.ReactNode;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  tone = 'brand',
  diameter = 48,
  strokeWidth = 5,
  children,
  label,
  className,
  ...rest
}) => {
  const v = clamp(value);
  const grown = useGrowOnMount(v);
  const r = (diameter - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const gradId = useId();
  const [g0, g1] = RING_GRAD[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      style={{ width: diameter, height: diameter }}
      {...rest}
    >
      <svg width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={g0} />
            <stop offset="1" stopColor={g1} />
          </linearGradient>
        </defs>
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-bg-muted dark:stroke-bg-dark-muted"
        />
        <circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={r}
          strokeWidth={strokeWidth}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (grown / 100) * c}
          className="transition-[stroke-dashoffset] duration-slow ease-standard"
          style={{ filter: `drop-shadow(0 2px 4px rgb(${SHADOW_RGB[tone]} / 0.4))` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption font-extrabold text-text-primary dark:text-text-dark-primary">
        {children === undefined ? `${Math.round(v)}%` : children}
      </span>
    </div>
  );
};
