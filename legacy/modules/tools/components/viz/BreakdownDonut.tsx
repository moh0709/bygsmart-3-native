/**
 * SVG donut chart — prop-driven, PDF-capturable via forwarded ref.
 */
import React, { forwardRef } from 'react';

export interface BreakdownDonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface BreakdownDonutProps {
  segments: BreakdownDonutSegment[];
  centerLabel?: string;
  centerSubLabel?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

const BreakdownDonut = forwardRef<SVGSVGElement, BreakdownDonutProps>(
  (
    {
      segments,
      centerLabel,
      centerSubLabel,
      size = 120,
      strokeWidth = 22,
      className = 'w-full max-h-[140px]',
    },
    ref
  ) => {
    const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
    if (total === 0) return null;

    const cx = size / 2;
    const cy = size / 2;
    const r = (size - strokeWidth) / 2;

    let cursor = 0;
    const arcs = segments.map(seg => {
      const pct = Math.max(seg.value, 0) / total;
      const startDeg = cursor * 360;
      cursor += pct;
      const endDeg = cursor * 360;
      return { ...seg, startDeg, endDeg: endDeg - 0.5 };
    });

    return (
      <svg ref={ref} viewBox={`0 0 ${size} ${size}`} className={className} aria-label="Fordeling">
        {arcs.map((arc, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, r, arc.startDeg, arc.endDeg)}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
        ))}
        {centerLabel && (
          <text x={cx} y={cy + (centerSubLabel ? -4 : 5)} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#101828">
            {centerLabel}
          </text>
        )}
        {centerSubLabel && (
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="#475467">
            {centerSubLabel}
          </text>
        )}
      </svg>
    );
  }
);

BreakdownDonut.displayName = 'BreakdownDonut';

export default BreakdownDonut;
