
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { InfoHint } from '../../../../components/ui';
import { computeSnowLoad, computeSnowDrift } from '../../catalog';
import { ZoomInIcon, ZoomOutIcon, LayersIcon, EyeIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

// --- 3D Diagram Component (preserved from original) ---
const Diagram: React.FC<{
    length: number;
    span: number;
    pitch: number;
    snowLoad: number;
    zoom: number;
    showTextures: boolean;
    showMeasurements: boolean;
}> = ({ length, span, pitch, snowLoad, zoom, showTextures, showMeasurements }) => {
    const [rotation, setRotation] = useState({ x: -20, y: 45 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, startRotation: { x: 0, y: 0 } });

    const handleDragStart = useCallback((clientX: number, clientY: number) => {
        setIsDragging(true);
        dragStartRef.current = { x: clientX, y: clientY, startRotation: rotation };
    }, [rotation]);

    const handleDragMove = useCallback((clientX: number, clientY: number) => {
        if (!isDragging) return;
        const deltaX = clientX - dragStartRef.current.x;
        const deltaY = clientY - dragStartRef.current.y;
        setRotation({
            y: dragStartRef.current.startRotation.y + deltaX * 0.5,
            x: Math.max(-90, Math.min(90, dragStartRef.current.startRotation.x - deltaY * 0.5)),
        });
    }, [isDragging]);

    const handleDragEnd = useCallback(() => setIsDragging(false), []);

    const onMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX, e.clientY);
    const onMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onMouseLeave = () => handleDragEnd();
    const onTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    const onTouchEnd = () => handleDragEnd();

    const scale = 25;
    const L_px = length * scale;
    const B_px = span * scale;
    const wallH_px = Math.max(2.5 * scale, B_px * 0.4);
    const pitchRad = (pitch * Math.PI) / 180;
    const rise_px = (B_px / 2) * Math.tan(pitchRad);
    const rafterLength_px = (B_px / 2) / Math.cos(pitchRad);
    const overhang_px = 0.3 * scale;
    const snowThick_px = Math.min(Math.max(snowLoad * 4, 2), 20);

    const wallStyle = showTextures
        ? { backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }
        : { backgroundColor: 'rgba(255,255,255,0.1)', border: '1px solid #4b5563' };

    const roofStyle = showTextures
        ? {
            backgroundColor: '#9a3412',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,0,0,0.2) 20px), repeating-linear-gradient(90deg, transparent, transparent 14px, rgba(0,0,0,0.1) 15px)',
            border: '1px solid #7c2d12'
          }
        : { backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #2563eb' };

    const snowStyle = {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 0 5px rgba(255,255,255,0.8)',
        border: '1px solid #e5e7eb'
    };

    return (
        <div
            className="w-full h-[400px] bg-gradient-to-b from-blue-50 to-gray-100 rounded-lg overflow-hidden cursor-move relative flex items-center justify-center"
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{ perspective: '1200px' }}
        >
            <div style={{
                transformStyle: 'preserve-3d',
                transform: `scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
                transition: isDragging ? 'none' : 'transform 0.3s ease-out'
            }}>
                <div style={{ transformStyle: 'preserve-3d', transform: `translateY(${wallH_px / 4}px)` }}>
                    {/* Floor */}
                    <div style={{
                        position: 'absolute', width: L_px, height: B_px,
                        transform: `rotateX(90deg) translateZ(${wallH_px / 2}px) translateX(-50%) translateY(-50%)`,
                        backgroundColor: 'rgba(0,0,0,0.1)', boxShadow: '0 0 30px rgba(0,0,0,0.2)',
                    }} />
                    {/* Front wall */}
                    <div style={{ position: 'absolute', width: L_px, height: wallH_px, transform: `translateZ(${B_px / 2}px) translateX(-50%) translateY(-50%)`, ...wallStyle }}>
                        {showMeasurements && (
                            <div style={{ position: 'absolute', bottom: '-20px', left: 0, width: '100%', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ height: '5px', width: '1px', backgroundColor: '#374151', position: 'absolute', left: 0, bottom: 0 }}></div>
                                <div style={{ height: '5px', width: '1px', backgroundColor: '#374151', position: 'absolute', right: 0, bottom: 0 }}></div>
                                <span className="bg-white/80 px-1 text-caption font-bold text-text-primary">L = {length}m</span>
                            </div>
                        )}
                    </div>
                    {/* Back wall */}
                    <div style={{ position: 'absolute', width: L_px, height: wallH_px, transform: `rotateY(180deg) translateZ(${B_px / 2}px) translateX(-50%) translateY(-50%)`, ...wallStyle }} />
                    {/* Right wall */}
                    <div style={{ position: 'absolute', width: B_px, height: wallH_px, transform: `rotateY(90deg) translateZ(${L_px / 2}px) translateX(-50%) translateY(-50%)`, ...wallStyle }}>
                        {showMeasurements && (
                            <div style={{ position: 'absolute', bottom: '-20px', left: 0, width: '100%', borderBottom: '1px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ height: '5px', width: '1px', backgroundColor: '#374151', position: 'absolute', left: 0, bottom: 0 }}></div>
                                <div style={{ height: '5px', width: '1px', backgroundColor: '#374151', position: 'absolute', right: 0, bottom: 0 }}></div>
                                <span className="bg-white/80 px-1 text-caption font-bold text-text-primary">B = {span}m</span>
                            </div>
                        )}
                    </div>
                    {/* Left wall */}
                    <div style={{ position: 'absolute', width: B_px, height: wallH_px, transform: `rotateY(-90deg) translateZ(${L_px / 2}px) translateX(-50%) translateY(-50%)`, ...wallStyle }} />
                    {/* Gable right */}
                    <div style={{
                        position: 'absolute', width: B_px, height: rise_px,
                        transform: `rotateY(90deg) translateZ(${L_px / 2}px) translateY(${-wallH_px / 2 - rise_px / 2}px) translateX(-50%)`,
                        backgroundColor: wallStyle.backgroundColor, borderBottom: wallStyle.border,
                        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    }}>
                        {showMeasurements && (
                            <div style={{ position: 'absolute', bottom: '5px', left: '10px', color: '#374151', fontSize: '10px', fontWeight: 'bold' }}>{pitch}°</div>
                        )}
                    </div>
                    {/* Gable left */}
                    <div style={{
                        position: 'absolute', width: B_px, height: rise_px,
                        transform: `rotateY(-90deg) translateZ(${L_px / 2}px) translateY(${-wallH_px / 2 - rise_px / 2}px) translateX(-50%)`,
                        backgroundColor: wallStyle.backgroundColor, borderBottom: wallStyle.border,
                        clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    }} />
                    {/* Front roof */}
                    <div style={{ transformStyle: 'preserve-3d', transform: `translateY(${-wallH_px / 2 - rise_px}px) rotateX(${pitch}deg)`, transformOrigin: 'bottom center' }}>
                        <div style={{ position: 'absolute', width: L_px + overhang_px * 2, height: rafterLength_px + overhang_px, transformOrigin: 'top center', transform: `translateX(-50%) rotateX(${pitch}deg)`, ...roofStyle }}>
                            {snowLoad > 0 && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: `translateZ(${snowThick_px}px)`, ...snowStyle }} />
                            )}
                        </div>
                    </div>
                    {/* Back roof */}
                    <div style={{ transformStyle: 'preserve-3d', transform: `translateY(${-wallH_px / 2 - rise_px}px)` }}>
                        <div style={{ position: 'absolute', width: L_px + overhang_px * 2, height: rafterLength_px + overhang_px, transformOrigin: 'top center', transform: `translateX(-50%) rotateX(${-pitch}deg)`, ...roofStyle }}>
                            {snowLoad > 0 && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: `translateZ(${snowThick_px}px)`, ...snowStyle }} />
                            )}
                        </div>
                    </div>
                    {/* Ridge cap */}
                    {showTextures && (
                        <div style={{ position: 'absolute', width: L_px + overhang_px * 2, height: 6, backgroundColor: '#7c2d12', transform: `translateY(${-wallH_px / 2 - rise_px - 2}px) translateX(-50%)` }} />
                    )}
                    {/* Snow indicator */}
                    {showMeasurements && snowLoad > 0 && (
                        <div style={{
                            position: 'absolute',
                            transform: `translateY(${-wallH_px / 2 - rise_px - 40}px) translateX(0)`,
                            backgroundColor: 'white', padding: '2px 6px', borderRadius: '4px',
                            fontSize: '10px', fontWeight: 'bold', color: '#1E3A8A',
                            border: '1px solid #93C5FD', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', whiteSpace: 'nowrap'
                        }}>
                            ❄️ {snowLoad.toFixed(2)} kN/m²
                            <div style={{ position: 'absolute', bottom: '-12px', left: '50%', marginLeft: '-1px', width: '2px', height: '12px', backgroundColor: '#93C5FD' }} />
                        </div>
                    )}
                </div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end pointer-events-none">
                <div className="text-xs text-text-secondary bg-white/80 px-2 py-1 rounded shadow">
                    Rotér: Træk | Zoom: Knapper
                </div>
            </div>
        </div>
    );
};

// ── Main Calculator ─────────────────────────────────────────────────────────

const helpContent: HelpContent = {
    formaal: 'Beregner egenlast og snelast på et sadeltag iht. DS/EN 1991-1-3 (Eurocode 1 sne). Formfaktor μ1 reduceres ved hældninger over 30°. Avanceret tilstand tilføjer eksponeringskoefficient Ce og termisk koefficient Ct.',
    variabler: [
        { name: 'Taghældning', symbol: 'α', unit: '°', description: 'Vinklen på taget. Påvirker formfaktor μ1.' },
        { name: 'Karakteristisk snelast', symbol: 'sk', unit: 'kN/m²', description: 'Grundværdi fra nationalt anneks. DK: 1,0 kN/m².' },
        { name: 'Ce', symbol: 'Ce', unit: '–', description: 'Eksponeringskoefficient. Normal: 1,0. Avanceret tilstand.' },
        { name: 'Ct', symbol: 'Ct', unit: '–', description: 'Termisk koefficient. Normalt isoleret tag: 1,0. Avanceret tilstand.' },
        { name: 'Egenlast', symbol: 'gk', unit: 'kg/m²', description: 'Tagkonstruktionens vægt inkl. tagsten, lægter og isolering.' },
    ],
    formel: 'μ1 = 0,8 for α ≤ 30°  (lineær → 0 ved α = 60°)\nsd = μ1 · Ce · Ct · sk\nS_total = sd · L · B',
    antagelser: 'Sadeltag med symmetrisk hældning. Formfaktor beregnes efter EC1-1-3 figur 5.2. Snelast beregnes i grundplan.',
    standarder: 'DS/EN 1990 (EC0) – Lastkombinationer og sikkerhed\nDS/EN 1991-1-1 (EC1) – Egenlast og nyttelast\nDS/EN 1991-1-3 (EC1 sne) – DK: sk = 1,0 kN/m²\nDS/EN 1991-1-4 (EC1 vind) – DK: vb,0 = 24 m/s',
};

const RoofSnowLoadCalculator: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('basic');
    const [inputs, setInputs] = useState({
        pitch: '30',
        deadLoad: '50',
        snowZone: '1.0',
        length: '12',
        span: '8',
        ce: '1.0',
        ct: '1.0',
        parapet: '0.5',
    });
    const [results, setResults] = useState<{ dead: number; snow: number; total: number; shapeFactor: number; sdPerSqm: number }>({ dead: 0, snow: 0, total: 0, shapeFactor: 0.8, sdPerSqm: 0 });
    const [zoom, setZoom] = useState(1);
    const [showTextures, setShowTextures] = useState(true);
    const [showMeasurements, setShowMeasurements] = useState(true);

    const handleInputChange = (field: keyof typeof inputs) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const pitch = parseFloat(inputs.pitch) || 0;
        const deadLoad_kg_m2 = parseFloat(inputs.deadLoad) || 0;
        const sk = parseFloat(inputs.snowZone) || 0;
        const l = parseFloat(inputs.length) || 0;
        const span = parseFloat(inputs.span) || 0;
        const ce = mode === 'advanced' ? (parseFloat(inputs.ce) || 1.0) : 1.0;
        const ct = mode === 'advanced' ? (parseFloat(inputs.ct) || 1.0) : 1.0;

        if (l === 0 || span === 0) {
            setResults({ dead: 0, snow: 0, total: 0, shapeFactor: 0.8, sdPerSqm: 0 });
            return;
        }

        // Egenlast over skrå rafterareal
        const pitchRadians = (pitch * Math.PI) / 180;
        const rafterLength = pitchRadians > 0 ? (span / 2) / Math.cos(pitchRadians) : span / 2;
        const roofArea = rafterLength * l * 2;
        const dead_kN = (roofArea * deadLoad_kg_m2 * 9.81) / 1000;

        // Snelast fra catalog
        const snowResult = computeSnowLoad({ pitchDeg: pitch, sk, Ce: ce, Ct: ct });
        const groundArea = l * span;
        const snow_kN = snowResult.sd * groundArea;

        setResults({ dead: dead_kN, snow: snow_kN, total: dead_kN + snow_kN, shapeFactor: snowResult.mu1, sdPerSqm: snowResult.sd });
    }, [inputs, mode]);

    // Advanced: local drift/accumulation against a parapet or roof step (EC1-1-3 §6).
    const drift = useMemo(() => computeSnowDrift({
        obstructionHeightM: parseFloat(inputs.parapet) || 0,
        sk: parseFloat(inputs.snowZone) || 0,
        Ce: mode === 'advanced' ? (parseFloat(inputs.ce) || 1) : 1,
        Ct: mode === 'advanced' ? (parseFloat(inputs.ct) || 1) : 1,
    }), [inputs.parapet, inputs.snowZone, inputs.ce, inputs.ct, mode]);
    const driftGoverns = drift.sDrift > results.sdPerSqm;

    const reportData = useMemo<CalculatorReportData>(() => {
        const advancedInputs = mode === 'advanced'
            ? [
                { label: 'Eksponeringskoefficient (Ce)', value: inputs.ce, unit: '–' },
                { label: 'Termisk koefficient (Ct)', value: inputs.ct, unit: '–' },
              ]
            : [];
        return {
            toolName: 'Sne Last Beregner',
            category: 'Statiske Beregninger',
            mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
            inputs: [
                { label: 'Bygningslængde', value: inputs.length, unit: 'm' },
                { label: 'Spændvidde', value: inputs.span, unit: 'm' },
                { label: 'Taghældning (α)', value: inputs.pitch, unit: '°' },
                { label: 'Tagets Egenlast', value: inputs.deadLoad, unit: 'kg/m²' },
                { label: 'Karakteristisk Snelast (sk)', value: inputs.snowZone, unit: 'kN/m²' },
                ...advancedInputs,
            ],
            results: [
                { label: 'Egenlast', value: results.dead.toFixed(2), unit: 'kN' },
                { label: 'Snelast', value: results.snow.toFixed(2), unit: 'kN' },
                { label: 'Total Last', value: results.total.toFixed(2), unit: 'kN', highlight: true },
            ],
            breakdown: [
                { label: 'Formfaktor (μ1)', value: results.shapeFactor.toFixed(3), unit: '–' },
                ...(mode === 'advanced' ? [
                    { label: 'Driftlast s_drift (μ=' + drift.muDrift.toFixed(2) + ')', value: drift.sDrift.toFixed(2), unit: 'kN/m²' },
                    { label: 'Dimensionsgivende', value: driftGoverns ? 'Snelæ/drift' : 'Jævn last' },
                ] : []),
            ],
            formula: 'μ1 = 0,8 for α ≤ 30°  (lineær → 0 ved α = 60°)\nsd = μ1 · Ce · Ct · sk\nS_total = sd · L · B',
            standardsStruktureret: [
                { code: 'DS/EN 1990', note: 'Lastkombinationer og sikkerhed' },
                { code: 'DS/EN 1991-1-1', note: 'Egenlast og nyttelast' },
                { code: 'DS/EN 1991-1-3', note: 'Snelast – DK: sk = 1,0 kN/m²' },
                { code: 'BR18', note: 'Bygningsreglementet' },
            ],
            safetyDisclaimer: 'Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.',
        };
    }, [inputs, results, mode, drift, driftGoverns]);

    return (
        <CalculatorPage
            title="Tag- & Snelastberegner"
            helpContent={helpContent}
            modeToggle={
                <CalculatorModeToggle
                    toolId="roof-snow-load"
                    onChange={setMode}
                />
            }
            shareValue={`Snelast: ${results.snow.toFixed(2)} kN, Egenlast: ${results.dead.toFixed(2)} kN, Total: ${results.total.toFixed(2)} kN`}
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* Inputs */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Tagdata</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField name="length" label="Bygningslængde" value={inputs.length} onChange={handleInputChange('length')} unit="m" info="Bygningens længde ved tagfoden." />
                        <InputField name="span" label="Spændvidde" value={inputs.span} onChange={handleInputChange('span')} unit="m" info="Bygningens bredde fra gavl til gavl." />
                    </div>
                    <InputField
                        name="pitch"
                        label="Taghældning (α)"
                        value={inputs.pitch}
                        onChange={handleInputChange('pitch')}
                        unit="°"
                        info="0–30°: fuld snelast (μ1=0,8). 30–60°: lineær reduktion. >60°: ingen snelast."
                    />
                    <InputField
                        label="Tagets Egenlast"
                        value={inputs.deadLoad}
                        onChange={handleInputChange('deadLoad')}
                        unit="kg/m²"
                        info="Tagkonstruktionens vægt inkl. tagsten, lægter og isolering."
                    />
                    <InputField
                        label="Karakteristisk Snelast (sk)"
                        value={inputs.snowZone}
                        onChange={handleInputChange('snowZone')}
                        unit="kN/m²"
                        info="Fra nationalt anneks. DK standard: 1,0 kN/m²."
                    />

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">EC1 Koefficienter</p>
                            <InputField
                                label="Eksponeringskoefficient (Ce)"
                                value={inputs.ce}
                                onChange={handleInputChange('ce')}
                                unit="–"
                                info="Blæsende terræn: 0,8. Normal: 1,0. Beskyttet: 1,2."
                            />
                            <InputField
                                label="Termisk koefficient (Ct)"
                                value={inputs.ct}
                                onChange={handleInputChange('ct')}
                                unit="–"
                                info="Normalt isoleret tag: 1,0. Glasdæk med stor varmeledning: < 1,0."
                            />
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info">
                                <p className="font-semibold">Formfaktor μ1 = {results.shapeFactor.toFixed(3)}</p>
                                <p>sd = {results.shapeFactor.toFixed(3)} · {inputs.ce} · {inputs.ct} · {inputs.snowZone} = {results.sdPerSqm.toFixed(3)} kN/m²</p>
                            </div>

                            <div className="border-t border-border dark:border-border-dark pt-3 space-y-2">
                                <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                    Snelæ / ophobning (drift)
                                    <InfoHint
                                        title="Snelæ mod forhindring (EC1-1-3 §6)"
                                        description="Den jævne snelast er ofte ikke dimensionsgivende. Sne fejer sammen og ophober sig mod parapeter, højere nabobygninger og i skotrender. Her giver et lokalt formtal μ = γ·h/sk (0,8–2,0) en typisk højere last i lævirkningszonen."
                                        calculation="μ_drift = γ·h/sk (γ=2 kN/m³, 0,8 ≤ μ ≤ 2,0) · s_drift = μ·Ce·Ct·sk · ls = 2h (5–15 m)"
                                    />
                                </p>
                                <InputField
                                    label="Højde af forhindring (parapet/trin)"
                                    value={inputs.parapet}
                                    onChange={handleInputChange('parapet')}
                                    unit="m"
                                    info="Højden af den parapet, tagtrin eller nabobygning som sneen ophober sig imod."
                                />
                                <div className={`p-3 rounded-lg text-xs ${driftGoverns ? 'bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning' : 'bg-info-subtle dark:bg-info-subtle-dark text-info-strong dark:text-info'}`}>
                                    <p className="font-semibold">Driftlast: μ = {drift.muDrift.toFixed(2)} → s_drift = {drift.sDrift.toFixed(2)} kN/m² · lævænge ls = {drift.driftLengthM.toFixed(1)} m</p>
                                    <p>{driftGoverns
                                        ? `⚠ Driftlasten (${drift.sDrift.toFixed(2)} kN/m²) er STØRRE end den jævne last (${results.sdPerSqm.toFixed(2)} kN/m²) og er dimensionsgivende i lævirkningszonen.`
                                        : `Den jævne snelast (${results.sdPerSqm.toFixed(2)} kN/m²) er dimensionsgivende for dette tilfælde.`}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Viz + Results */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark relative">
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                            <h3 className="font-bold text-lg">3D Visualisering</h3>
                            <div className="flex items-center space-x-2 bg-bg-subtle dark:bg-bg-dark-muted p-1 rounded-lg border border-border dark:border-border-dark">
                                <button
                                    onClick={() => setShowTextures(!showTextures)}
                                    className={`p-1.5 rounded transition-colors ${showTextures ? 'bg-brand-primary text-white shadow-sm' : 'hover:bg-bg-muted text-text-secondary'}`}
                                    title={showTextures ? 'Vis Wireframe' : 'Vis Solid'}
                                >
                                    <LayersIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowMeasurements(!showMeasurements)}
                                    className={`p-1.5 rounded transition-colors ${showMeasurements ? 'bg-brand-primary text-white shadow-sm' : 'hover:bg-bg-muted text-text-secondary'}`}
                                    title={showMeasurements ? 'Skjul Mål' : 'Vis Mål'}
                                >
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                                <div className="w-px h-4 bg-border-strong mx-1"></div>
                                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 hover:bg-bg-muted rounded text-text-secondary"><ZoomOutIcon className="w-4 h-4" /></button>
                                <span className="text-xs font-mono w-8 text-center text-text-secondary">{(zoom * 100).toFixed(0)}%</span>
                                <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-bg-muted rounded text-text-secondary"><ZoomInIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <Diagram
                            length={parseFloat(inputs.length) || 0}
                            span={parseFloat(inputs.span) || 0}
                            pitch={parseFloat(inputs.pitch) || 0}
                            snowLoad={results.sdPerSqm}
                            zoom={zoom}
                            showTextures={showTextures}
                            showMeasurements={showMeasurements}
                        />
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark text-sm">
                        <h3 className="font-bold text-lg mb-4">Resultater</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-lg">
                                <span className="text-text-secondary">Egenlast:</span>
                                <span className="font-bold text-lg"><AnimatedNumber value={results.dead} /> kN</span>
                            </div>
                            <div className="flex justify-between items-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-lg">
                                <span className="text-text-secondary">
                                    Snelast
                                    {mode === 'basic' && <span className="text-xs ml-1">(μ1={results.shapeFactor.toFixed(2)})</span>}
                                    :
                                </span>
                                <span className="font-bold text-lg"><AnimatedNumber value={results.snow} /> kN</span>
                            </div>
                            <div className="flex justify-between items-center bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg">
                                <span className="font-semibold text-brand-primary">Total Last:</span>
                                <span className="font-bold text-xl text-brand-primary"><AnimatedNumber value={results.total} /> kN</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default RoofSnowLoadCalculator;
