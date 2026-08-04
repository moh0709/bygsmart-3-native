/**
 * HouseExteriorSVG.tsx
 * Interactive inline SVG of a 2-storey Danish house with 15 named hotspot zones.
 * BUG_002 fix: tooltip positioning anchors to the clicked zone SVG bbox via
 * @floating-ui/react refs.setPositionReference (virtual element pattern).
 */

import React, { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { getZoneById } from '../../data/wizardCatalog';

interface HotspotDef {
  id: string;
  d: string;
  label: string;
  highlightColor: string;
  cx: number;
  cy: number;
  icon: string;
}

interface HouseExteriorSVGProps {
  selectedZoneIds: string[];
  onToggle: (zoneId: string) => void;
  className?: string;
}

const HOTSPOTS: HotspotDef[] = [
  {
    id: 'tag_og_skorsten',
    highlightColor: '#DC2626',
    label: 'Tag & Skorsten',
    icon: '🏠',
    cx: 200, cy: 55,
    d: 'M200 10 L340 120 L60 120 Z M270 120 L270 95 L285 95 L285 120 Z',
  },
  {
    id: 'loft_tagetage',
    highlightColor: '#7C3AED',
    label: 'Loft & Tagetage',
    icon: '📐',
    cx: 200, cy: 100,
    d: 'M75 120 L325 120 L325 130 L75 130 Z',
  },
  {
    id: 'solceller_energi',
    highlightColor: '#F59E0B',
    label: 'Solceller & Energi',
    icon: '☀️',
    cx: 275, cy: 80,
    d: 'M230 70 L320 110 L315 120 L220 78 Z',
  },
  {
    id: 'facade_overetage',
    highlightColor: '#2563EB',
    label: 'Facade 1. Sal',
    icon: '🧱',
    cx: 155, cy: 162,
    d: 'M75 130 L75 195 L220 195 L220 130 Z',
  },
  {
    id: 'vinduer_overetage',
    highlightColor: '#0EA5E9',
    label: 'Vinduer 1. Sal',
    icon: '🪟',
    cx: 295, cy: 160,
    d: 'M225 135 L325 135 L325 190 L225 190 Z',
  },
  {
    id: 'altan_balkon',
    highlightColor: '#10B981',
    label: 'Altan & Balkon',
    icon: '🏗️',
    cx: 350, cy: 160,
    d: 'M325 135 L360 135 L360 195 L325 195 Z',
  },
  {
    id: 'facade_stueetage',
    highlightColor: '#2563EB',
    label: 'Facade Stueetage',
    icon: '🧱',
    cx: 110, cy: 230,
    d: 'M75 195 L75 270 L155 270 L155 195 Z',
  },
  {
    id: 'vinduer_doere_stueetage',
    highlightColor: '#0EA5E9',
    label: 'Vinduer & Døre',
    icon: '🚪',
    cx: 230, cy: 230,
    d: 'M160 195 L325 195 L325 270 L160 270 Z',
  },
  {
    id: 'garage_carport',
    highlightColor: '#6B7280',
    label: 'Garage & Carport',
    icon: '🚗',
    cx: 355, cy: 235,
    d: 'M328 195 L390 195 L390 270 L328 270 Z',
  },
  {
    id: 'terrasse_udendoers',
    highlightColor: '#D97706',
    label: 'Terrasse & Udendørs',
    icon: '🪴',
    cx: 200, cy: 285,
    d: 'M75 270 L325 270 L325 295 L75 295 Z',
  },
  {
    id: 'indkoersel_belaegning',
    highlightColor: '#92400E',
    label: 'Indkørsel & Belægning',
    icon: '🛣️',
    cx: 355, cy: 285,
    d: 'M328 270 L390 270 L390 310 L328 310 Z',
  },
  {
    // The 3D model splits the old `have_hegn` zone into hegn/beplantning/græs —
    // the fallback hotspot maps onto the fence, the rest sit in the chip list.
    id: 'hegn_laage',
    highlightColor: '#a3e635',
    label: 'Hegn & Låge',
    icon: '🌳',
    cx: 35, cy: 250,
    d: 'M10 195 L72 195 L72 310 L10 310 Z',
  },
  {
    id: 'fundament_sokkel',
    highlightColor: '#78350F',
    label: 'Fundament & Sokkel',
    icon: '🏛️',
    cx: 200, cy: 307,
    d: 'M75 295 L325 295 L325 315 L75 315 Z',
  },
  {
    id: 'kaelder_udvendig',
    highlightColor: '#4C1D95',
    label: 'Kælder (udvendig)',
    icon: '⬇️',
    cx: 200, cy: 333,
    d: 'M85 315 L315 315 L315 350 L85 350 Z',
  },
  {
    id: 'kloak_forsyning',
    highlightColor: '#1E40AF',
    label: 'Kloak & Forsyning',
    icon: '🔌',
    cx: 200, cy: 358,
    d: 'M85 350 L315 350 L315 365 L85 365 Z',
  },
];

// ─── Tooltip (BUG_002 fix) ────────────────────────────────────────────────────

interface ZoneTooltipProps {
  zoneId: string;
  anchorEl: SVGPathElement | null;
}

const ZoneTooltip: React.FC<ZoneTooltipProps> = ({ zoneId, anchorEl }) => {
  const zone = getZoneById(zoneId);

  const { refs, floatingStyles } = useFloating({
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    if (anchorEl) {
      refs.setPositionReference({
        getBoundingClientRect: () => anchorEl.getBoundingClientRect(),
      });
    }
  }, [anchorEl, refs]);

  if (!zone) return null;

  return (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, zIndex: 50, pointerEvents: 'none' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 2 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-xl shadow-xl px-3 py-2 max-w-[180px]"
      >
        <div className="font-semibold">{zone.label}</div>
        {zone.sublabel && (
          <div className="opacity-75 mt-0.5 leading-tight">{zone.sublabel}</div>
        )}
      </motion.div>
    </div>
  );
};

// ─── HouseExteriorSVG ─────────────────────────────────────────────────────────

export const HouseExteriorSVG: React.FC<HouseExteriorSVGProps> = ({
  selectedZoneIds,
  onToggle,
  className,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<SVGPathElement | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseEnter = useCallback((id: string, el: SVGPathElement) => {
    setHoveredId(id);
    setTooltipAnchor(el);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setTooltipAnchor(null);
  }, []);

  const handleClick = useCallback((id: string) => {
    onToggle(id);
  }, [onToggle]);

  return (
    <>
      <svg
        ref={svgRef}
        viewBox="0 0 400 375"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Interaktiv bygningsoversigt"
        role="img"
      >
        <line x1="0" y1="295" x2="400" y2="295" stroke="#e5e7eb" strokeWidth="1" />
        <rect x="75" y="120" width="250" height="175" fill="#f9fafb" rx="2" />
        <rect x="328" y="195" width="62" height="100" fill="#f3f4f6" rx="2" />

        {HOTSPOTS.map((hotspot) => {
          const isSelected = selectedZoneIds.includes(hotspot.id);
          const isHovered = hoveredId === hotspot.id;
          const fillOpacity = isSelected ? 0.35 : isHovered ? 0.18 : 0;
          const strokeOpacity = isSelected ? 1 : isHovered ? 0.7 : 0.25;
          const strokeWidth = isSelected ? 2.5 : isHovered ? 2 : 1;

          return (
            <g
              key={hotspot.id}
              onClick={() => handleClick(hotspot.id)}
              onMouseEnter={(e) => {
                const path = e.currentTarget.querySelector('path') as SVGPathElement;
                handleMouseEnter(hotspot.id, path);
              }}
              onMouseLeave={handleMouseLeave}
              onTouchStart={(e) => {
                e.preventDefault();
                handleClick(hotspot.id);
              }}
              style={{ cursor: 'pointer' }}
              aria-label={hotspot.label}
              role="button"
              aria-pressed={isSelected ? 'true' : 'false'}
            >
              <path
                d={hotspot.d}
                fill={hotspot.highlightColor}
                fillOpacity={fillOpacity}
                stroke={hotspot.highlightColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                style={{ transition: 'fill-opacity 0.15s, stroke-opacity 0.15s, stroke-width 0.15s' }}
              />
              {isSelected && (
                <path
                  d={hotspot.d}
                  fill="none"
                  stroke={hotspot.highlightColor}
                  strokeWidth={4}
                  strokeOpacity={0.3}
                  strokeLinejoin="round"
                />
              )}
              <text
                x={hotspot.cx}
                y={hotspot.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isSelected ? 14 : 12}
                style={{ transition: 'font-size 0.15s', userSelect: 'none' }}
                opacity={isHovered || isSelected ? 1 : 0.6}
              >
                {isSelected ? '✓' : hotspot.icon}
              </text>
            </g>
          );
        })}

        <path d="M75 270 L75 120 M325 120 L325 270" stroke="#d1d5db" strokeWidth="1" fill="none" />
        <line x1="75" y1="195" x2="325" y2="195" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="4 3" />
      </svg>

      <AnimatePresence>
        {hoveredId && tooltipAnchor && (
          <ZoneTooltip key={hoveredId} zoneId={hoveredId} anchorEl={tooltipAnchor} />
        )}
      </AnimatePresence>
    </>
  );
};

export default HouseExteriorSVG;
