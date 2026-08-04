import React, { useEffect, useRef, useState } from 'react';

// ─── Animated Arc Gauge ───────────────────────────────────────────────────────
// Usage: <ResultGauge value={72} max={100} label="Varmtab" unit="W/m²K" color="blue" />

interface ResultGaugeProps {
    value: number;
    max: number;
    label: string;
    unit: string;
    /** Colour theme: 'blue' | 'green' | 'orange' | 'red' | 'purple' */
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
    precision?: number;
    /** Optional thresholds for green/yellow/red colouring.
     *  E.g. { good: 0.3, warn: 0.6 } means:
     *    0–30 % → green, 30–60 % → yellow, 60–100 % → red */
    thresholds?: { good: number; warn: number };
    size?: 'sm' | 'md' | 'lg';
}

/* Semantic tone mapping (Design System 2.0). The legacy colour-name prop is
 * kept for API stability; internally each name resolves to a semantic token.
 * 'purple' has no semantic tone — it stays a fixed data-accent hex used to
 * differentiate a secondary series. */
const COLOR_MAP: Record<
    NonNullable<ResultGaugeProps['color']>,
    { stroke: string; text: string; textStyle?: React.CSSProperties }
> = {
    blue:   { stroke: 'var(--color-brand-primary)', text: 'text-brand-primary dark:text-brand-light' },
    green:  { stroke: 'var(--color-success)', text: 'text-success-strong dark:text-success' },
    orange: { stroke: 'var(--color-warning)', text: 'text-warning-strong dark:text-warning' },
    red:    { stroke: 'var(--color-danger)', text: 'text-danger-strong dark:text-danger' },
    purple: { stroke: '#8B5CF6', text: '', textStyle: { color: '#8B5CF6' } }, // data-accent (no semantic tone)
};

const SIZE_MAP = {
    sm: { r: 36, sw: 6, dim: 88 },
    md: { r: 48, sw: 8, dim: 120 },
    lg: { r: 60, sw: 10, dim: 148 },
};

export const ResultGauge: React.FC<ResultGaugeProps> = ({
    value,
    max,
    label,
    unit,
    color = 'blue',
    precision = 1,
    thresholds,
    size = 'md',
}) => {
    const { r, sw, dim } = SIZE_MAP[size];
    const cx = dim / 2;
    const cy = dim / 2;

    // Arc: 240° sweep starting from bottom-left (210°)
    const startAngle = 210;
    const sweepAngle = 240;

    const pct = Math.min(Math.max(value / (max || 1), 0), 1);
    const circumference = 2 * Math.PI * r;
    // Arc length for the full 240°
    const arcLength = (sweepAngle / 360) * circumference;

    // Animated value
    const [animPct, setAnimPct] = useState(0);
    const [displayVal, setDisplayVal] = useState(0);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        const startPct = animPct;
        const startVal = displayVal;
        const DURATION = 700;

        const step = (ts: number) => {
            if (!startRef.current) startRef.current = ts;
            const p = Math.min((ts - startRef.current) / DURATION, 1);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            setAnimPct(startPct + eased * (pct - startPct));
            setDisplayVal(startVal + eased * (value - startVal));
            if (p < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                startRef.current = null;
            }
        };

        startRef.current = null;
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);

    }, [value, pct]);

    // Determine tone based on thresholds if provided
    let tone = COLOR_MAP[color];
    if (thresholds) {
        if (pct <= thresholds.good) tone = COLOR_MAP['green'];
        else if (pct <= thresholds.warn) tone = COLOR_MAP['orange'];
        else tone = COLOR_MAP['red'];
    }

    // SVG arc path
    const polarToXY = (angleDeg: number, radius: number) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };

    const describeArc = (startDeg: number, endDeg: number, radius: number) => {
        const start = polarToXY(startDeg, radius);
        const end = polarToXY(endDeg, radius);
        const large = endDeg - startDeg > 180 ? 1 : 0;
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
    };

    const bgPath = describeArc(startAngle, startAngle + sweepAngle, r);
    const endAngle = startAngle + sweepAngle * animPct;
    const fgPath = animPct > 0.001 ? describeArc(startAngle, Math.max(startAngle + 0.01, endAngle), r) : '';

    return (
        <div className="flex flex-col items-center gap-1">
            <div style={{ width: dim, height: dim }} className="relative flex items-center justify-center">
                <svg width={dim} height={dim} className="absolute inset-0 overflow-visible">
                    {/* Background arc */}
                    <path
                        d={bgPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={sw}
                        strokeLinecap="round"
                        className="text-border dark:text-border-dark"
                    />
                    {/* Foreground arc */}
                    {fgPath && (
                        <path d={fgPath} fill="none" stroke={tone.stroke} strokeWidth={sw} strokeLinecap="round" />
                    )}
                </svg>
                {/* Centre label */}
                <div className="flex flex-col items-center leading-tight">
                    <span
                        className={`tabular-nums ${size === 'sm' ? 'text-heading' : size === 'lg' ? 'text-display' : 'text-title'} ${tone.text}`}
                        style={tone.textStyle}
                    >
                        {displayVal.toFixed(precision)}
                    </span>
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{unit}</span>
                </div>
            </div>
            <p className={`font-semibold text-center text-text-primary dark:text-text-dark-primary ${size === 'sm' ? 'text-caption' : 'text-label'}`}>{label}</p>
        </div>
    );
};

// ─── Animated Horizontal Bar ─────────────────────────────────────────────────
// Usage: <ResultBar value={3500} max={5000} label="Materialepris" unit="kr." />

interface ResultBarProps {
    value: number;
    max: number;
    label: string;
    unit: string;
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
    precision?: number;
    showPct?: boolean;
    thresholds?: { good: number; warn: number };
}

export const ResultBar: React.FC<ResultBarProps> = ({
    value,
    max,
    label,
    unit,
    color = 'blue',
    precision = 0,
    showPct = false,
    thresholds,
}) => {
    const pct = Math.min(Math.max(value / (max || 1), 0), 1);
    const [animPct, setAnimPct] = useState(0);
    const [displayVal, setDisplayVal] = useState(0);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number | null>(null);

    useEffect(() => {
        const startPct = animPct;
        const startVal = displayVal;
        const DURATION = 600;

        const step = (ts: number) => {
            if (!startRef.current) startRef.current = ts;
            const p = Math.min((ts - startRef.current) / DURATION, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setAnimPct(startPct + eased * (pct - startPct));
            setDisplayVal(startVal + eased * (value - startVal));
            if (p < 1) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                startRef.current = null;
            }
        };

        startRef.current = null;
        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);

    }, [value, pct]);

    let barColor = COLOR_MAP[color].stroke;
    if (thresholds) {
        if (pct <= thresholds.good) barColor = COLOR_MAP['green'].stroke;
        else if (pct <= thresholds.warn) barColor = COLOR_MAP['orange'].stroke;
        else barColor = COLOR_MAP['red'].stroke;
    }

    return (
        <div className="w-full space-y-1.5">
            <div className="flex justify-between items-baseline">
                <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{label}</span>
                <span className="text-label font-bold text-text-primary dark:text-text-dark-primary tabular-nums">
                    {displayVal.toFixed(precision)} {unit}
                    {showPct && <span className="text-caption text-text-secondary dark:text-text-dark-secondary ml-1">({Math.round(animPct * 100)}%)</span>}
                </span>
            </div>
            <div className="h-3 w-full bg-bg-muted dark:bg-bg-dark-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-none"
                    style={{ width: `${animPct * 100}%`, backgroundColor: barColor }}
                />
            </div>
        </div>
    );
};

export default ResultGauge;
