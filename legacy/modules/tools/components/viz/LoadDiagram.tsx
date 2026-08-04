/**
 * Beam + moment-curve diagram.
 * Generalised from the inline Diagram in BeamLoadCalculator.tsx.
 * Single root <svg> with forwarded ref for PDF capture.
 */
import React, { forwardRef, useMemo } from 'react';

export interface LoadDiagramProps {
  loadType: 'point' | 'distributed';
  length: number;
  load: number;
  position?: number;
  className?: string;
}

const W = 200;
const PAD = 20;
const DRAW_W = W - 2 * PAD;

function mapX(x: number, L: number) {
  return PAD + (x / L) * DRAW_W;
}

const LoadDiagram = forwardRef<SVGSVGElement, LoadDiagramProps>(
  ({ loadType, length, load, position, className = 'w-full' }, ref) => {
    const L = Math.max(length, 0.01);
    const P = Math.max(load, 0);
    const a = Math.max(0, Math.min(position ?? L / 2, L));

    const { momentPath, maxMoment } = useMemo(() => {
      if (loadType === 'point') {
        const Mmax = P > 0 ? (P * a * (L - a)) / L : 0;
        return {
          momentPath: `M ${mapX(0, L)} 130 L ${mapX(a, L)} 50 L ${mapX(L, L)} 130 Z`,
          maxMoment: Mmax,
        };
      }
      // Distributed
      const Mmax = P > 0 ? (P * L * L) / 8 : 0;
      const pts = Array.from({ length: 21 }, (_, i) => {
        const x = (i / 20) * L;
        const yFrac = 4 * (x / L) * (1 - x / L);
        return `${mapX(x, L)},${130 - yFrac * 80}`;
      });
      return {
        momentPath: `M ${mapX(0, L)} 130 L ${pts.join(' ')} L ${mapX(L, L)} 130 Z`,
        maxMoment: Mmax,
      };
    }, [loadType, L, P, a]);

    const beamY = 35;
    const supportSize = 8;

    return (
      <svg ref={ref} viewBox="0 0 200 150" className={className} aria-label="Bjælkediagram">
        {/* Distributed load arrows */}
        {loadType === 'distributed' && P > 0 && (
          <>
            <rect x={PAD} y={beamY - 18} width={DRAW_W} height="8" fill="#fecaca" stroke="#ef4444" strokeWidth="0.5" opacity="0.7" />
            {Array.from({ length: 8 }, (_, i) => {
              const x = PAD + (i / 7) * DRAW_W;
              return (
                <line key={i} x1={x} y1={beamY - 10} x2={x} y2={beamY} stroke="#ef4444" strokeWidth="1" markerEnd="url(#arr)" />
              );
            })}
            <text x={W / 2} y={beamY - 22} textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight="bold">
              {P} kN/m
            </text>
          </>
        )}

        {/* Point load arrow */}
        {loadType === 'point' && P > 0 && (
          <g>
            <line x1={mapX(a, L)} y1={beamY - 16} x2={mapX(a, L)} y2={beamY} stroke="#ef4444" strokeWidth="1.5" />
            <polygon
              points={`${mapX(a, L) - 4},${beamY - 8} ${mapX(a, L) + 4},${beamY - 8} ${mapX(a, L)},${beamY}`}
              fill="#ef4444"
            />
            <text x={mapX(a, L)} y={beamY - 19} textAnchor="middle" fontSize="8" fill="#ef4444" fontWeight="bold">
              {P}kN
            </text>
          </g>
        )}

        {/* Beam */}
        <rect x={PAD} y={beamY} width={DRAW_W} height="6" fill="#9ca3af" rx="1" />

        {/* Supports (triangles) */}
        <polygon
          points={`${PAD - supportSize},${beamY + 6} ${PAD + supportSize},${beamY + 6} ${PAD},${beamY + 14}`}
          fill="#374151"
        />
        <polygon
          points={`${W - PAD - supportSize},${beamY + 6} ${W - PAD + supportSize},${beamY + 6} ${W - PAD},${beamY + 14}`}
          fill="#374151"
        />

        {/* Baseline for moment diagram */}
        <line x1={PAD} y1={130} x2={W - PAD} y2={130} stroke="#374151" strokeWidth="1" />

        {/* Moment curve */}
        <path d={momentPath} fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" opacity="0.9" />

        {/* Max moment label */}
        <text x={W / 2} y={147} textAnchor="middle" fontSize="8" fill="#374151">
          Max: {maxMoment.toFixed(2)} kNm
        </text>
      </svg>
    );
  }
);

LoadDiagram.displayName = 'LoadDiagram';

export default LoadDiagram;
