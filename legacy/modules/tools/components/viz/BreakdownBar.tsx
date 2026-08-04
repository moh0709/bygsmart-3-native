/**
 * Horizontal stacked-bar chart — prop-driven, inline SVG, PDF-capturable.
 */
import React, { forwardRef } from 'react';

export interface BreakdownBarSegment {
  label: string;
  value: number;
  color: string;
}

export interface BreakdownBarProps {
  segments: BreakdownBarSegment[];
  title?: string;
  showLegend?: boolean;
  unit?: string;
  className?: string;
}

const BreakdownBar = forwardRef<SVGSVGElement, BreakdownBarProps>(
  ({ segments, title, showLegend = true, unit = '', className = 'w-full' }, ref) => {
    const total = segments.reduce((s, seg) => s + Math.max(seg.value, 0), 0);
    if (total === 0) return null;

    const BAR_H = 28;
    const LEGEND_ROW = 18;
    const legendRows = showLegend ? segments.length : 0;
    const svgH = BAR_H + (legendRows > 0 ? 10 + legendRows * LEGEND_ROW : 0) + (title ? 18 : 0);
    const titleOffset = title ? 14 : 0;

    let cursor = 0;
    const bars = segments.map(seg => {
      const pct = Math.max(seg.value, 0) / total;
      const x = cursor;
      cursor += pct;
      return { ...seg, x, pct };
    });

    return (
      <svg ref={ref} viewBox={`0 0 200 ${svgH}`} className={className} aria-label={title ?? 'Breakdown'}>
        {title && (
          <text x="100" y="12" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">
            {title}
          </text>
        )}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x * 200}
            y={titleOffset}
            width={Math.max(b.pct * 200 - 0.5, 0)}
            height={BAR_H}
            fill={b.color}
            rx={i === 0 ? 4 : 0}
            // last segment
            style={i === bars.length - 1 ? { borderRadius: '0 4px 4px 0' } : undefined}
          />
        ))}
        {showLegend &&
          segments.map((seg, i) => {
            const y = titleOffset + BAR_H + 10 + i * LEGEND_ROW + 10;
            return (
              <g key={i}>
                <rect x="0" y={y - 8} width="10" height="10" fill={seg.color} rx="2" />
                <text x="14" y={y} fontSize="8" fill="#475467">
                  {seg.label}
                </text>
                <text x="200" y={y} textAnchor="end" fontSize="8" fill="#101828" fontWeight="bold">
                  {seg.value.toLocaleString('da-DK', { maximumFractionDigits: 2 })}
                  {unit ? ` ${unit}` : ''}
                </text>
              </g>
            );
          })}
      </svg>
    );
  }
);

BreakdownBar.displayName = 'BreakdownBar';

export default BreakdownBar;
