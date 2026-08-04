/**
 * Prop-driven SVG infographic for concrete shapes (slab, footing, column).
 * Generalised from the inline ShapeDiagram in ConcreteCalculator.tsx.
 * Single root <svg> node with a forwarded ref so the element can be
 * captured for PDF export.
 */
import React, { forwardRef } from 'react';

export type ShapeType = 'slab' | 'footing' | 'column';

export interface DimensionedShapeProps {
  shape: ShapeType;
  length?: number;
  width?: number;
  depth?: number;
  diameter?: number;
  showRebar?: boolean;
  className?: string;
}

const DimensionedShape = forwardRef<SVGSVGElement, DimensionedShapeProps>(
  (
    {
      shape,
      length = 5,
      width = 4,
      depth = 0.1,
      diameter = 0.3,
      showRebar = true,
      className = 'w-full max-h-[140px]',
    },
    ref
  ) => {
    const l = Math.max(length, 0.1);
    const w = Math.max(width, 0.1);
    const d = Math.max(depth, 0.01);
    const dia = Math.max(diameter, 0.05);

    if (shape === 'column') {
      const cx = 100;
      const cy = 80;
      const rx = 38;
      const ry = 11;
      const h = Math.min(d * 30, 100);
      const eRx = Math.min(rx * Math.sqrt(dia / 0.3), 58);

      return (
        <svg ref={ref} viewBox="0 0 200 160" className={className} aria-hidden="true">
          {/* Cylinder side */}
          <rect x={cx - eRx} y={cy - h} width={eRx * 2} height={h} fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
          {/* Rebar */}
          {showRebar &&
            [0.3, 0.5, 0.7].map((t, i) => (
              <line
                key={i}
                x1={cx - eRx + t * eRx * 2}
                y1={cy - h + 4}
                x2={cx - eRx + t * eRx * 2}
                y2={cy - 4}
                stroke="#ef4444"
                strokeWidth="1"
                strokeDasharray="3,3"
                opacity="0.7"
              />
            ))}
          {/* Bottom ellipse */}
          <ellipse cx={cx} cy={cy} rx={eRx} ry={ry} fill="#93c5fd" stroke="#3b82f6" strokeWidth="1.5" />
          {/* Top ellipse */}
          <ellipse cx={cx} cy={cy - h} rx={eRx} ry={ry} fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
          {/* Height annotation */}
          <line x1={cx + eRx + 6} y1={cy - h} x2={cx + eRx + 6} y2={cy} stroke="#6b7280" strokeWidth="1" />
          <text x={cx + eRx + 14} y={cy - h / 2 + 4} fontSize="9" fill="#6b7280" textAnchor="start">
            {d}m
          </text>
          {/* Diameter annotation */}
          <text x={cx} y={cy + ry + 14} fontSize="9" fill="#6b7280" textAnchor="middle">
            Ø{dia}m
          </text>
        </svg>
      );
    }

    // Slab / footing — isometric box
    const maxSide = Math.max(l, w);
    const scale = 68 / maxSide;
    const bw = l * scale;
    const bd = w * scale * 0.5;
    const bh = Math.min(d * 300, 32);
    const ox = 96;
    const oy = 108;

    const pts = {
      fl: [ox, oy],
      fr: [ox + bw, oy],
      frT: [ox + bw, oy - bh],
      flT: [ox, oy - bh],
      brT: [ox + bw + bd, oy - bh - bd * 0.5],
      br: [ox + bw + bd, oy - bd * 0.5],
      blT: [ox + bd, oy - bh - bd * 0.5],
    };
    const poly = (ps: number[][]) => ps.map(p => p.join(',')).join(' ');

    const rebarLines: React.ReactNode[] = [];
    if (showRebar) {
      for (let i = 1; i <= 3; i++) {
        const t = i / 4;
        rebarLines.push(
          <line
            key={`h${i}`}
            x1={pts.flT[0] + (pts.frT[0] - pts.flT[0]) * t}
            y1={pts.flT[1] + (pts.frT[1] - pts.flT[1]) * t}
            x2={pts.blT[0] + (pts.brT[0] - pts.blT[0]) * t}
            y2={pts.blT[1] + (pts.brT[1] - pts.blT[1]) * t}
            stroke="#ef4444"
            strokeWidth="0.8"
            opacity="0.6"
          />,
          <line
            key={`v${i}`}
            x1={pts.flT[0] + (pts.blT[0] - pts.flT[0]) * t}
            y1={pts.flT[1] + (pts.blT[1] - pts.flT[1]) * t}
            x2={pts.frT[0] + (pts.brT[0] - pts.frT[0]) * t}
            y2={pts.frT[1] + (pts.brT[1] - pts.frT[1]) * t}
            stroke="#ef4444"
            strokeWidth="0.8"
            opacity="0.6"
          />
        );
      }
    }

    return (
      <svg ref={ref} viewBox="0 0 200 148" className={className} aria-hidden="true">
        {/* Bottom face */}
        <polygon
          points={poly([pts.fl, pts.fr, pts.br, [pts.fl[0] + bd, pts.fl[1] - bd * 0.5]])}
          fill="#dbeafe"
          stroke="#3b82f6"
          strokeWidth="1"
        />
        {/* Front face */}
        <polygon
          points={poly([pts.fl, pts.fr, pts.frT, pts.flT])}
          fill="#93c5fd"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        {/* Right face */}
        <polygon
          points={poly([pts.fr, pts.br, pts.brT, pts.frT])}
          fill="#bfdbfe"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        {/* Top face */}
        <polygon
          points={poly([pts.flT, pts.frT, pts.brT, pts.blT])}
          fill="#eff6ff"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        {/* Rebar grid overlay */}
        {rebarLines}
        {/* Dimension labels */}
        <text x={(pts.fl[0] + pts.fr[0]) / 2} y={oy + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
          {l}m
        </text>
        <text
          x={(pts.fr[0] + pts.br[0]) / 2 + 6}
          y={(pts.fr[1] + pts.br[1]) / 2 + 4}
          textAnchor="start"
          fontSize="9"
          fill="#6b7280"
        >
          {w}m
        </text>
        <text
          x={pts.flT[0] - 4}
          y={(pts.flT[1] + pts.fl[1]) / 2 + 4}
          textAnchor="end"
          fontSize="9"
          fill="#6b7280"
        >
          {d}m
        </text>
      </svg>
    );
  }
);

DimensionedShape.displayName = 'DimensionedShape';

export default DimensionedShape;
