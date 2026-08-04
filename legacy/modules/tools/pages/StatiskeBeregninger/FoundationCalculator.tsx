
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeFoundationArea, computeFoundationBearing } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'statiske-beregninger-fundament';

const helpContent: HelpContent = {
    formaal: 'Basis dimensionerer det nødvendige fundamentareal (A = N/q). Avanceret laver et EC7-eftervisning: den faktiske kontakttryk under et valgt fundament – inkl. fundamentets egenvægt og excentricitet (moment) via effektiv-bredde-metoden – sammenholdes med grundens bæreevne.',
    variabler: [
        { name: 'Søjlelast', symbol: 'N', unit: 'kN', description: 'Aksial designlast til fundamentet.' },
        { name: 'Grundbæreevne', symbol: 'q', unit: 'kN/m²', description: 'Grundens design-bæreevne. Sand: 100–300, Ler: 50–150 kN/m².' },
        { name: 'Fundamentmål', symbol: 'B×L×t', unit: 'm', description: 'Bredde × længde × tykkelse af det valgte fundament.' },
        { name: 'Moment', symbol: 'M', unit: 'kNm', description: 'Evt. moment → excentricitet e = M/N.' },
        { name: 'Effektiv bredde', symbol: 'B′', unit: 'm', description: 'B′ = B − 2e (Meyerhof) — det areal der reelt bærer.' },
    ],
    formel: 'Basis: A = N / q\nAvanceret: Egenvægt = B·L·t·24\ne = M / (N + Egenvægt)\nB′ = B − 2e\nKontakttryk σ = (N + Egenvægt) / (B′·L)\nUdnyttelse = σ / q ≤ 1,0',
    antagelser: 'Ensartet lastfordeling over den effektive bredde. Basis medregner ikke egenvægt eller excentricitet. Beton egenvægt 24 kN/m³. Kræver geoteknisk rapport.',
    standarder: 'DS/EN 1997-1 (EC7) – Geoteknik, fundamenters bæreevne, effektiv-bredde-metode\nDS/EN 1990 (EC0) – Lastkombinationer og partialkoefficienter',
};

const FoundationCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [load, setLoad] = useState('500');
    const [capacity, setCapacity] = useState('150');
    const [dims, setDims] = useState({ width: '2', length: '2', thickness: '0.4', moment: '0' });

    const sizing = computeFoundationArea({ loadKN: parseFloat(load) || 0, capacityKNm2: parseFloat(capacity) || 0 });
    const bearing = computeFoundationBearing({
        loadKN: parseFloat(load) || 0,
        widthM: parseFloat(dims.width) || 0,
        lengthM: parseFloat(dims.length) || 0,
        thicknessM: parseFloat(dims.thickness) || 0,
        bearingCapacityKNm2: parseFloat(capacity) || 0,
        momentKNm: parseFloat(dims.moment) || 0,
    });
    const utilPct = bearing.utilization * 100;

    const reportData: CalculatorReportData = {
        toolName: 'Fundamentstørrelse',
        category: 'Statiske Beregninger',
        mode: mode === 'advanced' ? 'Avanceret (EC7 eftervisning)' : 'Basis (dimensionering)',
        inputs: [
            { label: 'Søjlelast (N)', value: load, unit: 'kN' },
            { label: 'Grundens bæreevne (q)', value: capacity, unit: 'kN/m²' },
            ...(mode === 'advanced' ? [
                { label: 'Fundament B×L×t', value: `${dims.width}×${dims.length}×${dims.thickness}`, unit: 'm' },
                { label: 'Moment (M)', value: dims.moment, unit: 'kNm' },
            ] : []),
        ],
        results: mode === 'advanced' ? [
            { label: 'Kontakttryk σ', value: bearing.bearingPressureKNm2.toFixed(1), unit: 'kN/m²', highlight: true },
            { label: 'Fundament egenvægt', value: bearing.selfWeightKN.toFixed(1), unit: 'kN' },
            { label: 'Excentricitet e', value: bearing.eccentricityM.toFixed(3), unit: 'm' },
            { label: 'Effektiv bredde B′', value: bearing.effectiveWidthM.toFixed(2), unit: 'm' },
            { label: 'Udnyttelsesgrad', value: `${utilPct.toFixed(0)}%` },
            { label: 'Status', value: bearing.passed ? 'OK (≤100%)' : 'OVERSKRIDES' },
        ] : [
            { label: 'Nødvendigt areal', value: sizing.areaM2.toFixed(2), unit: 'm²', highlight: true },
            { label: 'Kvadratisk sidelængde', value: sizing.sideLengthM.toFixed(2), unit: 'm' },
        ],
        formula: mode === 'advanced' ? 'σ = (N + egenvægt) / (B′·L) ; B′ = B − 2e ; Udnyttelse = σ/q' : 'A = N / q ; Sidelængde = √A',
        standardsStruktureret: [{ code: 'DS/EN 1997-1', clause: 'EC7', note: 'Geoteknik og fundamenters bæreevne (effektiv-bredde-metode).' }],
        safetyDisclaimer: 'Fundamentberegning kræver geoteknisk undersøgelse og skal godkendes af en autoriseret konstruktør.',
    };

    // Plan-view of footing with effective (loaded) width shaded
    const Diagram = useMemo(() => {
        const B = Math.max(parseFloat(dims.width) || 1, 0.1);
        const L = Math.max(parseFloat(dims.length) || 1, 0.1);
        const vw = 160, vh = 110;
        const scale = Math.min((vw - 20) / B, (vh - 20) / L);
        const w = B * scale, h = L * scale;
        const x0 = (vw - w) / 2, y0 = (vh - h) / 2;
        const effW = Math.max(0, bearing.effectiveWidthM) * scale;
        return (
            <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-auto max-h-40">
                <rect x={x0} y={y0} width={w} height={h} fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
                <rect x={x0} y={y0} width={effW} height={h} fill={bearing.passed ? '#86efac' : '#fca5a5'} opacity="0.7" />
                {/* column footprint */}
                <rect x={x0 + w / 2 - 6} y={y0 + h / 2 - 6} width="12" height="12" fill="#334155" />
                <text x={vw / 2} y={vh - 4} textAnchor="middle" fontSize="8" fill="#475467">
                    B′ = {bearing.effectiveWidthM.toFixed(2)} m af B = {B.toFixed(2)} m
                </text>
            </svg>
        );
    }, [dims.width, dims.length, bearing]);

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Fundamentstørrelse</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Fundamentstørrelse"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={<CalculatorModeToggle toolId={TOOL_ID} advancedLocked={!advancedAllowed} onChange={setMode} />}
            stickyResultLabel={mode === 'advanced' ? 'Udnyttelsesgrad' : 'Nødvendigt areal'}
            stickyResult={mode === 'advanced'
                ? <><AnimatedNumber value={utilPct} precision={0} /> %</>
                : <><AnimatedNumber value={sizing.areaM2} precision={2} /> m²</>}
            shareValue={mode === 'advanced'
                ? `Kontakttryk ${bearing.bearingPressureKNm2.toFixed(0)} kN/m² · Udnyttelse ${utilPct.toFixed(0)}% · ${bearing.passed ? 'OK' : 'Overskrides'}`
                : `Fundament: ${sizing.areaM2.toFixed(2)} m² · ${sizing.sideLengthM.toFixed(2)} × ${sizing.sideLengthM.toFixed(2)} m`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">
                        {mode === 'advanced' ? 'Eftervis et valgt fundament mod grundens bæreevne (EC7).' : 'Dimensionér minimum fundamentareal ud fra last og bæreevne.'}
                    </p>

                    <InputField label="Søjlelast (N)" value={load} onChange={e => setLoad(e.target.value)} unit="kN" info="Total aksial designlast." />
                    <InputField label="Grundens bæreevne (q)" value={capacity} onChange={e => setCapacity(e.target.value)} unit="kN/m²" info="Sand: 100–300, Fast ler: 100–150, Blød ler: 50–80 kN/m²." />

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                Valgt fundament
                                <InfoHint
                                    title="EC7 kontakttryk-eftervisning"
                                    description="I stedet for kun at dimensionere arealet eftervises et konkret fundament: dets egenvægt lægges til lasten, og et eventuelt moment giver en excentricitet, der reducerer det bærende areal (effektiv bredde B′ = B − 2e)."
                                    calculation="σ = (N + B·L·t·24) / ((B − 2e)·L) ≤ q"
                                />
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <InputField label="Bredde B" value={dims.width} onChange={e => setDims(p => ({ ...p, width: e.target.value }))} unit="m" />
                                <InputField label="Længde L" value={dims.length} onChange={e => setDims(p => ({ ...p, length: e.target.value }))} unit="m" />
                                <InputField label="Tykkelse t" value={dims.thickness} onChange={e => setDims(p => ({ ...p, thickness: e.target.value }))} unit="m" />
                            </div>
                            <InputField label="Moment (M)" value={dims.moment} onChange={e => setDims(p => ({ ...p, moment: e.target.value }))} unit="kNm" info="Excentrisk last → e = M/N. Ved e > B/6 opstår der løft i den ene kant." />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {mode === 'advanced' ? (
                        <>
                            <div className={`p-5 rounded-card border-l-4 shadow-sm ${bearing.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                                <div className="flex items-start gap-3">
                                    {bearing.passed
                                        ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                        : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                    <div>
                                        <h4 className={`font-bold ${bearing.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            Udnyttelsesgrad {utilPct.toFixed(0)}%
                                        </h4>
                                        <p className={`text-sm mt-0.5 ${bearing.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            {bearing.passed
                                                ? `Kontakttryk ${bearing.bearingPressureKNm2.toFixed(0)} kN/m² ≤ bæreevne ${capacity} kN/m².`
                                                : `Kontakttryk ${bearing.bearingPressureKNm2.toFixed(0)} kN/m² overstiger bæreevnen. Øg fundamentets areal.`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {bearing.eccentricityWarning && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning text-sm">
                                    <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                                    <span>Excentricitet e = {bearing.eccentricityM.toFixed(3)} m er uden for kernen (B/6). Én kant løfter — omfordel lasten eller forstør fundamentet.</span>
                                </div>
                            )}

                            <ComplianceMeter label="Kontakttryk vs. bæreevne" value={utilPct} limit={100} min={0} max={150} unit="%" decimalPlaces={0} />

                            <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                                <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Fundament (planview) — bærende areal markeret</h4>
                                {Diagram}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <ResultDisplay label="Kontakttryk σ" value={bearing.bearingPressureKNm2} precision={0} unit="kN/m²" />
                                <ResultDisplay label="Total last (m. egenvægt)" value={bearing.totalLoadKN} precision={0} unit="kN" />
                            </div>
                        </>
                    ) : (
                        <>
                            <ResultDisplay label="Nødvendigt fundamentareal" value={sizing.areaM2} precision={2} unit="m²" />
                            <ResultDisplay label="Kvadratisk sidelængde" value={sizing.sideLengthM} precision={2} unit="m" />
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info">
                                <p className="font-semibold mb-1">Kvadratisk fundament</p>
                                <p>{sizing.sideLengthM.toFixed(2)} m × {sizing.sideLengthM.toFixed(2)} m = {sizing.areaM2.toFixed(2)} m²</p>
                                <p className="mt-2 text-xs">Skift til Avanceret for at eftervise et konkret fundament inkl. egenvægt og moment (EC7).</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <SafetyDisclaimer>
                Fundamentberegning kræver jordbundsundersøgelse. Fundament SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. DS/EN 1997-1 (EC7) og BR18.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default FoundationCalculator;
