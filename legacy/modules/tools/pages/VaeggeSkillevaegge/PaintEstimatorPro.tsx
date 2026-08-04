import React, { useState, useMemo, useCallback, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ResultBar } from '../../components/ResultGauge';
import { PlusIcon, TrashIcon, CheckIcon } from '../../../../components/icons';
import { getCalculator, catalogHelpToContent } from '../../catalog';

const TOOL_ID = 'vaegge-skillevaegge-maling-pro';
const meta = getCalculator(TOOL_ID);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Room {
    id: string;
    name: string;
    length: string;     // m
    width: string;      // m
    height: string;     // m
    windows: string;    // count
    windowArea: string; // m² per window (editable, default 1.5)
    doors: string;      // count
    doorArea: string;   // m² per door (editable, default 2.0)
    ceiling: boolean;
    coats: string;      // paint coats
}

const DEFAULT_ROOMS: Room[] = [
    { id: 'r1', name: 'Stue', length: '5', width: '4', height: '2.5', windows: '2', windowArea: '1.5', doors: '1', doorArea: '2.0', ceiling: true, coats: '2' },
];

// Paint product options
const PAINT_PRODUCTS = [
    { label: 'Standard vægmaling (10 m²/L)', coverage: 10, pricePerLiter: 90 },
    { label: 'Premium vægmaling (9 m²/L)', coverage: 9, pricePerLiter: 130 },
    { label: 'Loftsmaling (12 m²/L)', coverage: 12, pricePerLiter: 85 },
    { label: 'Grundmaling / primer (8 m²/L)', coverage: 8, pricePerLiter: 70 },
] as const;

const BUCKET_SIZES = [10, 5, 2.7, 1] as const; // Liters

function bucketBreakdown(liters: number): { size: number; count: number }[] {
    let remaining = liters;
    const result: { size: number; count: number }[] = [];
    for (const size of BUCKET_SIZES) {
        const count = Math.floor(remaining / size);
        if (count > 0) { result.push({ size, count }); remaining -= count * size; }
    }
    // Always add at least 1 of smallest bucket if still something left
    if (remaining > 0.1) result.push({ size: BUCKET_SIZES[BUCKET_SIZES.length - 1], count: 1 });
    return result;
}

// ── Room Row ──────────────────────────────────────────────────────────────────
interface RoomRowProps {
    room: Room;
    index: number;
    onUpdate: (id: string, field: keyof Room, value: string | boolean) => void;
    onDelete: (id: string) => void;
    wallArea: number;
    ceilArea: number;
    totalArea: number;
}

const inp = 'w-full border border-border dark:border-border-dark-strong rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 text-center';

const RoomRow: React.FC<RoomRowProps> = ({ room, index, onUpdate, onDelete, wallArea, ceilArea, totalArea }) => {
    const [expanded, setExpanded] = useState(index === 0);

    return (
        <div className="bg-white dark:bg-bg-dark-surface rounded-xl border border-border dark:border-border-dark overflow-hidden shadow-sm">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-subtle dark:hover:bg-bg-dark-muted transition-colors"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-brand-primary">{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                        <input
                            value={room.name}
                            onChange={(e) => { e.stopPropagation(); onUpdate(room.id, 'name', e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-sm text-text-primary dark:text-text-dark-primary bg-transparent border-none focus:outline-none focus:ring-0 w-28"
                        />
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                            {totalArea.toFixed(1)} m² samlet
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                        {totalArea.toFixed(1)} m²
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(room.id); }}
                        className="p-1 rounded-full hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark text-text-tertiary hover:text-danger transition-colors"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </button>

            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border dark:border-border-dark pt-3">
                    {/* Dimensions row */}
                    <div className="grid grid-cols-3 gap-2">
                        {(['length', 'width', 'height'] as const).map((field) => (
                            <div key={field}>
                                <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">
                                    {field === 'length' ? 'Længde m' : field === 'width' ? 'Bredde m' : 'Højde m'}
                                </label>
                                <input inputMode="decimal" value={room[field] as string} onChange={(e) => onUpdate(room.id, field, e.target.value)} className={inp} />
                            </div>
                        ))}
                    </div>

                    {/* Openings + coats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">Vinduer</label>
                            <input inputMode="numeric" value={room.windows} onChange={(e) => onUpdate(room.id, 'windows', e.target.value)} className={inp} />
                        </div>
                        <div>
                            <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">Døre</label>
                            <input inputMode="numeric" value={room.doors} onChange={(e) => onUpdate(room.id, 'doors', e.target.value)} className={inp} />
                        </div>
                        <div>
                            <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">Lag</label>
                            <input inputMode="numeric" value={room.coats} onChange={(e) => onUpdate(room.id, 'coats', e.target.value)} className={inp} />
                        </div>
                    </div>

                    {/* Opening sizes (editable, so large windows/patio doors aren't under-estimated) */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">
                                m² pr. vindue
                            </label>
                            <input inputMode="decimal" value={room.windowArea} onChange={(e) => onUpdate(room.id, 'windowArea', e.target.value)} className={inp} />
                        </div>
                        <div>
                            <label className="block text-caption font-bold text-text-secondary dark:text-text-dark-secondary mb-1 uppercase tracking-wide text-center">
                                m² pr. dør
                            </label>
                            <input inputMode="decimal" value={room.doorArea} onChange={(e) => onUpdate(room.id, 'doorArea', e.target.value)} className={inp} />
                        </div>
                    </div>

                    {/* Ceiling toggle */}
                    <button
                        type="button"
                        onClick={() => onUpdate(room.id, 'ceiling', !room.ceiling)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all ${
                            room.ceiling ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-border dark:border-border-dark-strong text-text-secondary dark:text-text-dark-secondary'
                        }`}
                    >
                        <span className="text-sm font-medium">Inkludér loft</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${room.ceiling ? 'bg-brand-primary border-brand-primary' : 'border-border-strong dark:border-border-dark-strong'}`}>
                            {room.ceiling && <CheckIcon className="w-3 h-3 text-white" />}
                        </div>
                    </button>

                    {/* Area breakdown */}
                    <div className="bg-bg-subtle dark:bg-bg-dark-muted rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-text-secondary dark:text-text-dark-secondary">Vægge:</span>
                            <span className="font-bold text-text-primary dark:text-text-dark-primary ml-1">{wallArea.toFixed(1)} m²</span>
                        </div>
                        <div>
                            <span className="text-text-secondary dark:text-text-dark-secondary">Loft:</span>
                            <span className="font-bold text-text-primary dark:text-text-dark-primary ml-1">{room.ceiling ? ceilArea.toFixed(1) : '—'} m²</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── RoomAreaChart ─────────────────────────────────────────────────────────────
const RoomAreaChart: React.FC<{ rooms: { name: string; area: number }[] }> = ({ rooms }) => {
    const max = Math.max(...rooms.map((r) => r.area), 1);
    return (
        <div className="space-y-2">
            {rooms.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary dark:text-text-dark-secondary w-24 truncate flex-shrink-0">{r.name}</span>
                    <div className="flex-1 bg-bg-muted dark:bg-bg-dark-muted rounded-full h-4 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-brand-primary to-brand-light rounded-full transition-all duration-700"
                            style={{ width: `${(r.area / max) * 100}%` }}
                        />
                    </div>
                    <span className="text-xs font-bold text-text-primary dark:text-text-dark-primary w-14 text-right flex-shrink-0">{r.area.toFixed(1)} m²</span>
                </div>
            ))}
        </div>
    );
};

// ── BucketVisual ──────────────────────────────────────────────────────────────
const BucketVisual: React.FC<{ liters: number; color: string; label: string; pricePerL: number }> = ({ liters, color, label, pricePerL }) => {
    const breakdown = useMemo(() => bucketBreakdown(liters), [liters]);
    const totalPrice = liters * pricePerL;

    return (
        <div className="bg-bg-subtle dark:bg-bg-dark-muted/60 rounded-xl p-3 border border-border dark:border-border-dark">
            <div className="flex justify-between items-start mb-3">
                <p className="text-sm font-bold text-text-primary dark:text-text-dark-primary">{label}</p>
                <div className="text-right">
                    <p className="text-lg font-extrabold text-brand-primary"><AnimatedNumber value={liters} precision={1} /> L</p>
                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">≈ {totalPrice.toFixed(0)} kr.</p>
                </div>
            </div>
            {/* Bucket icons */}
            <div className="flex flex-wrap gap-2">
                {breakdown.map((b, i) =>
                    Array.from({ length: b.count }).map((_, j) => (
                        <div key={`${i}-${j}`} className="flex flex-col items-center gap-0.5">
                            <svg width="28" height="34" viewBox="0 0 28 34" fill="none">
                                <path d="M4 8 L2 30 Q2 32 4 32 L24 32 Q26 32 26 30 L24 8 Z" className={color} strokeWidth="1.5" stroke="#9ca3af" />
                                <rect x="2" y="5" width="24" height="4" rx="2" fill="#d1d5db" />
                                <path d="M8 5 Q14 2 20 5" stroke="#9ca3af" strokeWidth="1.5" fill="none" />
                                <rect x="7" y="14" width="14" height="4" rx="1" fill="white" fillOpacity="0.3" />
                            </svg>
                            <span className="text-caption text-text-secondary dark:text-text-dark-secondary font-medium">{b.size}L</span>
                        </div>
                    ))
                )}
            </div>
            {breakdown.length === 0 && <p className="text-xs text-text-tertiary italic">Ingen maling nødvendig</p>}
        </div>
    );
};

// ── Main calculator ───────────────────────────────────────────────────────────
const PaintEstimatorPro: React.FC = () => {
    const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
    const [productIdx, setProductIdx] = useState(0);
    const [wastePct, setWastePct] = useState('10'); // waste %
    const nextId = useRef(2);
    const vizRef = useRef<HTMLDivElement>(null);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const product = PAINT_PRODUCTS[productIdx];

    const addRoom = () => {
        const id = `r${nextId.current++}`;
        setRooms((prev) => [...prev, {
            id, name: `Rum ${nextId.current - 1}`,
            length: '4', width: '3', height: '2.5',
            windows: '1', windowArea: '1.5', doors: '1', doorArea: '2.0', ceiling: false, coats: '2',
        }]);
    };

    const updateRoom = useCallback((id: string, field: keyof Room, value: string | boolean) => {
        setRooms((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    const deleteRoom = useCallback((id: string) => {
        setRooms((prev) => prev.filter((r) => r.id !== id));
    }, []);

    const roomData = useMemo(() => rooms.map((r) => {
        const l = parseFloat(r.length) || 0;
        const w = parseFloat(r.width) || 0;
        const h = parseFloat(r.height) || 0;
        const wins = parseInt(r.windows) || 0;
        const drs = parseInt(r.doors) || 0;
        const coats = parseInt(r.coats) || 2;
        const winArea = parseFloat(r.windowArea) || 1.5;
        const doorArea = parseFloat(r.doorArea) || 2.0;

        const perimeter = 2 * (l + w);
        const wallGross = perimeter * h;
        const openings = wins * winArea + drs * doorArea;
        const wallNet = Math.max(0, wallGross - openings) * coats;
        const ceilArea = l * w;
        const totalArea = wallNet + (r.ceiling ? ceilArea * coats : 0);

        return { room: r, wallArea: Math.max(0, wallGross - openings), ceilArea, totalArea };
    }), [rooms]);

    const results = useMemo(() => {
        const waste = 1 + (parseFloat(wastePct) || 0) / 100;
        const totalPaintArea = roomData.reduce((s, r) => s + r.totalArea, 0);
        const litersNet = totalPaintArea / product.coverage;
        const litersWithWaste = litersNet * waste;
        const totalCost = litersWithWaste * product.pricePerLiter;
        return { totalPaintArea, litersNet, litersWithWaste, totalCost };
    }, [roomData, product, wastePct]);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: meta?.name ?? 'Malingsestimering Pro',
        category: meta?.category ?? 'Vægge & Skillevægge',
        inputs: [
            { label: 'Malingstype', value: product.label },
            { label: 'Dækningsgrad', value: String(product.coverage), unit: 'm²/L' },
            { label: 'Spild', value: wastePct, unit: '%' },
            { label: 'Antal rum', value: String(rooms.length), unit: 'rum' },
        ],
        results: [
            { label: 'Maling i alt (inkl. spild)', value: results.litersWithWaste.toFixed(1), unit: 'L', highlight: true },
            { label: 'Samlet areal', value: results.totalPaintArea.toFixed(1), unit: 'm²' },
            { label: 'Estimeret pris', value: results.totalCost.toFixed(0), unit: 'kr.' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: vizRef,
    }), [product, wastePct, rooms.length, results]);

    const shareText = results.litersWithWaste > 0
        ? `${results.litersWithWaste.toFixed(1)} L ${product.label} — ${results.totalCost.toFixed(0)} kr.`
        : undefined;

    return (
        <CalculatorPage
            title={meta?.name ?? 'Malingsestimering Pro'}
            reportData={reportData}
            helpContent={helpContent}
            stickyResultLabel="Maling i alt"
            stickyResult={results.litersWithWaste > 0 ? <><AnimatedNumber value={results.litersWithWaste} precision={1} /> L</> : null}
            shareValue={shareText}
        >
            <div className="space-y-5 p-3">
                {/* Paint product selector */}
                <div>
                    <label className="block text-xs font-bold text-text-secondary dark:text-text-dark-secondary mb-2 uppercase tracking-wide">Malingstype</label>
                    <div className="grid grid-cols-1 gap-2">
                        {PAINT_PRODUCTS.map((p, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setProductIdx(i)}
                                className={`text-left px-3 py-2.5 rounded-xl border-2 transition-all text-sm ${
                                    productIdx === i
                                        ? 'border-brand-primary bg-brand-primary/5 text-brand-primary font-semibold'
                                        : 'border-border dark:border-border-dark-strong text-text-secondary dark:text-text-dark-secondary hover:border-border-strong dark:hover:border-border-dark-strong'
                                }`}
                            >
                                <span className="flex items-center justify-between">
                                    <span>{p.label}</span>
                                    <span className="text-[11px] opacity-70 font-normal">{p.pricePerLiter} kr/L</span>
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Waste */}
                <div>
                    <label className="block text-xs font-bold text-text-secondary dark:text-text-dark-secondary mb-1.5 uppercase tracking-wide">Spild % (anbefalet 10–15%)</label>
                    <div className="flex items-center gap-3">
                        <input
                            inputMode="numeric"
                            value={wastePct}
                            onChange={(e) => setWastePct(e.target.value)}
                            className="w-20 border border-border-strong dark:border-border-dark-strong rounded-xl px-3 py-2 text-center text-sm font-bold bg-bg-subtle dark:bg-bg-dark-muted text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                        />
                        <input
                            type="range"
                            min="0"
                            max="30"
                            value={parseInt(wastePct) || 0}
                            onChange={(e) => setWastePct(e.target.value)}
                            className="flex-1 accent-brand-primary"
                        />
                        <span className="text-sm font-bold text-text-primary dark:text-text-dark-primary w-8">{wastePct}%</span>
                    </div>
                </div>

                {/* Rooms */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide">
                            Rum ({rooms.length})
                        </label>
                        <button
                            onClick={addRoom}
                            className="flex items-center gap-1 px-3 py-1.5 bg-brand-primary text-white rounded-xl text-xs font-bold hover:bg-brand-primary/90 active:scale-95 transition-all"
                        >
                            <PlusIcon className="w-3.5 h-3.5" /> Tilføj rum
                        </button>
                    </div>
                    <div className="space-y-3">
                        {roomData.map(({ room, wallArea, ceilArea, totalArea }, i) => (
                            <RoomRow
                                key={room.id}
                                room={room}
                                index={i}
                                onUpdate={updateRoom}
                                onDelete={deleteRoom}
                                wallArea={wallArea}
                                ceilArea={ceilArea}
                                totalArea={totalArea}
                            />
                        ))}
                    </div>
                </div>

                {/* Results */}
                {results.totalPaintArea > 0 && (
                    <div ref={vizRef} className="space-y-4 pt-2">
                        {/* Area chart */}
                        <div className="bg-white dark:bg-bg-dark-surface rounded-xl border border-border dark:border-border-dark p-4">
                            <h3 className="font-bold text-sm text-text-primary dark:text-text-dark-primary mb-3">Areal pr. rum</h3>
                            <RoomAreaChart rooms={roomData.map((r) => ({ name: r.room.name, area: r.totalArea }))} />
                        </div>

                        {/* Summary bars */}
                        <div className="bg-white dark:bg-bg-dark-surface rounded-xl border border-border dark:border-border-dark p-4 space-y-3">
                            <h3 className="font-bold text-sm text-text-primary dark:text-text-dark-primary">Oversigt</h3>
                            <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3">
                                    <p className="text-2xl font-extrabold text-info-strong dark:text-info">
                                        <AnimatedNumber value={results.totalPaintArea} precision={1} />
                                    </p>
                                    <p className="text-xs text-info-strong dark:text-info mt-0.5">m² samlet areal</p>
                                </div>
                                <div className="bg-success-subtle dark:bg-success-subtle-dark rounded-xl p-3">
                                    <p className="text-2xl font-extrabold text-success-strong dark:text-success">
                                        <AnimatedNumber value={results.litersWithWaste} precision={1} />
                                    </p>
                                    <p className="text-xs text-success-strong dark:text-success mt-0.5">liter inkl. spild</p>
                                </div>
                            </div>
                            <ResultBar
                                value={results.litersNet}
                                max={results.litersWithWaste}
                                label="Netto"
                                unit="L"
                                precision={1}
                                color="blue"
                                showPct={false}
                            />
                            <div className="flex justify-between text-sm pt-1 border-t border-border dark:border-border-dark">
                                <span className="text-text-secondary dark:text-text-dark-secondary">Estimeret pris</span>
                                <span className="font-extrabold text-text-primary dark:text-text-dark-primary">
                                    <AnimatedNumber value={results.totalCost} precision={0} /> kr.
                                </span>
                            </div>
                        </div>

                        {/* Bucket visual */}
                        <BucketVisual
                            liters={results.litersWithWaste}
                            color="fill-brand-primary/70"
                            label="Nødvendige spande"
                            pricePerL={product.pricePerLiter}
                        />
                    </div>
                )}
            </div>
        </CalculatorPage>
    );
};

export default PaintEstimatorPro;
