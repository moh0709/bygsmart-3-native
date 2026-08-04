/**
 * Horizontal gauge bar showing a value against a compliance limit.
 * Generalised from the voltage-drop gauge in CableSizingCalculator.tsx.
 * Pure CSS/HTML (no SVG needed) but structurally compatible with PDF capture.
 */
import React, { forwardRef } from 'react';

export interface ComplianceMeterProps {
  value: number;
  limit: number;
  min?: number;
  max?: number;
  label?: string;
  unit?: string;
  decimalPlaces?: number;
  className?: string;
}

const ComplianceMeter = forwardRef<SVGSVGElement, ComplianceMeterProps>(
  (
    {
      value,
      limit,
      min = 0,
      max,
      label = 'Spændingsfald',
      unit = '%',
      decimalPlaces = 2,
      className = 'w-full',
    },
    ref
  ) => {
    const scale = max ?? Math.max(limit * 2, value * 1.2, 10);
    const isOk = value <= limit;

    const clamp = (v: number) => Math.min(Math.max(v, min), scale);
    const pct = (v: number) => ((clamp(v) - min) / (scale - min)) * 100;

    const barPct = pct(value);
    const limitPct = pct(limit);

    const svgH = 64;

    return (
      <svg ref={ref} viewBox={`0 0 200 ${svgH}`} className={className} aria-label={label}>
        {/* Scale labels */}
        <text x="0" y="10" fontSize="7" fill="#94a3b8">
          {min}
          {unit}
        </text>
        <text x="100" y="10" textAnchor="middle" fontSize="7" fill="#475467" fontWeight="bold">
          {label}
        </text>
        <text x="200" y="10" textAnchor="end" fontSize="7" fill="#94a3b8">
          {scale}
          {unit}
        </text>

        {/* Track */}
        <rect x="0" y="14" width="200" height="18" rx="9" fill="#e2e8f0" />
        {/* Green zone (0 → limit) */}
        <rect x="0" y="14" width={`${limitPct}%`} height="18" rx="9" fill="#34d399" />
        {/* Red zone (limit → end) */}
        <rect x={`${limitPct}%`} y="14" width={`${100 - limitPct}%`} height="18" fill="#f87171" />
        {/* Round right cap over red zone */}
        <rect x="191" y="14" width="9" height="18" rx="0" fill="#f87171" />
        <rect x="195" y="14" width="5" height="18" rx="0 9 9 0" fill="#f87171" />

        {/* Value needle */}
        <rect
          x={`${Math.max(barPct - 0.75, 0)}%`}
          y="12"
          width="3"
          height="22"
          rx="1.5"
          fill="white"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
        />

        {/* Value text */}
        <text
          x="100"
          y={svgH - 4}
          textAnchor="middle"
          fontSize="13"
          fontWeight="bold"
          fill={isOk ? '#059669' : '#dc2626'}
        >
          {value.toFixed(decimalPlaces)} {unit}
        </text>
        <text x="200" y={svgH - 4} textAnchor="end" fontSize="8" fill="#64748b">
          Max: {limit}
          {unit}
        </text>
      </svg>
    );
  }
);

ComplianceMeter.displayName = 'ComplianceMeter';

export default ComplianceMeter;
