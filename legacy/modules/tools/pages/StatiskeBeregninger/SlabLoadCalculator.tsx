
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeSlabLoad, computeSlabFlexure } from '../../catalog';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const helpContent: HelpContent = {
    formaal: 'Beregner egenlast og nyttelast for et betondæk iht. DS/EN 1991-1-1. Avanceret tilstand beregner design-last (Ed) med EC0 partialkoefficienter γG og γQ.',
    variabler: [
        { name: 'Areal', symbol: 'A', unit: 'm²', description: 'Dækkets plan-areal (L × B).' },
        { name: 'Tykkelse', symbol: 't', unit: 'm', description: 'Dækkets konstruktionstykkelse.' },
        { name: 'Materialedensitet', symbol: 'ρ', unit: 'kg/m³', description: 'Armeret beton: 2400 kg/m³.' },
        { name: 'Nyttelast', symbol: 'qk', unit: 'kN/m²', description: 'Karakteristisk variabel last. Bolig: 1,5–2,0. Kontor: 2,5–3,0 kN/m².' },
        { name: 'γG', symbol: 'γG', unit: '–', description: 'EC0 partialkoefficient for egenlast. Ugunstig: 1,35.' },
        { name: 'γQ', symbol: 'γQ', unit: '–', description: 'EC0 partialkoefficient for nyttelast. Ugunstig: 1,50.' },
    ],
    formel: 'Gk = ρ · g · t · A / 1000   Qk = qk · A   Ed = γG · Gk + γQ · Qk',
    antagelser: 'Plan, homogen dækplade. Egenvægt beregnes som volumenvægt. Nyttelast antages jævnt fordelt over hele fladen.',
    standarder: 'DS/EN 1990 (EC0) – Lastkombinationer og sikkerhed\nDS/EN 1991-1-1 (EC1) – Egenlast og nyttelast\nDS/EN 1991-1-3 (EC1 sne) – DK: sk = 1,0 kN/m²\nDS/EN 1991-1-4 (EC1 vind) – DK: vb,0 = 24 m/s',
};

const SlabLoadCalculator: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('basic');
    const [dims, setDims] = useState({
        length: '8',
        width: '6',
        thickness: '0.2',
        density: '2400',
        liveLoad: '2.0',
        gammaG: '1.35',
        gammaQ: '1.50',
    });
    const [flex, setFlex] = useState({ span: '5', fck: '25', cover: '30' });
    const [results, setResults] = useState({ dead: 0, live: 0, total: 0, design: 0, designPerSqm: 0 });

    const handleDimChange = (field: keyof typeof dims) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        const t = parseFloat(dims.thickness) || 0;
        const density = parseFloat(dims.density) || 0;
        const liveLoadPerSqm = parseFloat(dims.liveLoad) || 0;
        const area = l * w;

        const perSqm = computeSlabLoad({ thicknessM: t, densityKgM3: density, liveLoadKNm2: liveLoadPerSqm });
        const dead = perSqm.deadLoadKNm2 * area;
        const live = liveLoadPerSqm * area;
        const total = perSqm.totalLoadKNm2 * area;

        const gG = parseFloat(dims.gammaG) || 1.35;
        const gQ = parseFloat(dims.gammaQ) || 1.50;
        const design = gG * dead + gQ * live;
        const designPerSqm = gG * perSqm.deadLoadKNm2 + gQ * liveLoadPerSqm;

        setResults({ dead, live, total, design, designPerSqm });
    }, [dims]);

    // EC2 one-way flexure: design moment per metre → required tension reinforcement.
    const flexure = useMemo(() => {
        const span = parseFloat(flex.span) || 0;
        const thicknessMm = (parseFloat(dims.thickness) || 0) * 1000;
        const d = Math.max(0, thicknessMm - (parseFloat(flex.cover) || 30)); // effective depth
        const medPerM = results.designPerSqm * span * span / 8; // simply-supported, per metre width
        const r = computeSlabFlexure({ momentKNmPerM: medPerM, effectiveDepthMm: d, fckMPa: parseFloat(flex.fck) || 25 });
        // Suggested bar spacing for Ø10 (78.5 mm²) to meet the governing As
        const barArea = 78.5;
        const spacingMm = r.providedGoverningAsMm2 > 0 ? Math.floor((barArea / r.providedGoverningAsMm2) * 1000 / 10) * 10 : 0;
        return { medPerM, d, spacingMm, ...r };
    }, [flex, dims.thickness, results.designPerSqm]);

    const reportData = useMemo<CalculatorReportData>(() => {
        const baseInputs = [
            { label: 'Dækkets Længde (L)', value: dims.length, unit: 'm' },
            { label: 'Dækkets Bredde (B)', value: dims.width, unit: 'm' },
            { label: 'Dækkets Tykkelse (t)', value: dims.thickness, unit: 'm' },
            { label: 'Materialedensitet (ρ)', value: dims.density, unit: 'kg/m³' },
            { label: 'Nyttelast (qk)', value: dims.liveLoad, unit: 'kN/m²' },
        ];
        const advancedInputs = mode === 'advanced'
            ? [
                { label: 'γG – Egenlast partialkoefficient', value: dims.gammaG, unit: '–' },
                { label: 'γQ – Nyttelast partialkoefficient', value: dims.gammaQ, unit: '–' },
            ]
            : [];

        const baseResults = [
            { label: 'Total Karakteristisk Last (Gk + Qk)', value: results.total.toFixed(2), unit: 'kN', highlight: true },
            { label: 'Egenlast Gk (dødvægt)', value: results.dead.toFixed(2), unit: 'kN' },
            { label: 'Nyttelast Qk (live load)', value: results.live.toFixed(2), unit: 'kN' },
        ];
        const advancedResults = mode === 'advanced'
            ? [
                { label: 'Design last Ed (EC0)', value: results.design.toFixed(2), unit: 'kN' },
                { label: 'Designmoment M_Ed', value: flexure.medPerM.toFixed(1), unit: 'kNm/m' },
                { label: 'Nødvendig armering As', value: flexure.providedGoverningAsMm2.toFixed(0), unit: 'mm²/m' },
                { label: 'Min. As (EC2 §9.2.1)', value: flexure.minAsMm2.toFixed(0), unit: 'mm²/m' },
            ]
            : [];

        return {
            toolName: 'Daek Last Beregner',
            category: 'Statiske Beregninger',
            mode,
            inputs: [...baseInputs, ...advancedInputs],
            results: [...baseResults, ...advancedResults],
            formula: 'Gk = ρ · g · t · A / 1000   Qk = qk · A   Ed = γG · Gk + γQ · Qk',
            standardsStruktureret: [
                { code: 'DS/EN 1990', note: 'EC0 – Lastkombinationer og sikkerhed' },
                { code: 'DS/EN 1991-1-1', note: 'EC1 – Egenlast og nyttelast' },
                { code: 'DS/EN 1991-1-3', note: 'EC1 sne – DK: sk = 1,0 kN/m²' },
                { code: 'DS/EN 1991-1-4', note: 'EC1 vind – DK: vb,0 = 24 m/s' },
            ],
            safetyDisclaimer: 'Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.',
        };
    }, [dims, results, mode, flexure]);

    return (
        <CalculatorPage
            title="Dækbelastning Beregner"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId="slab-load"
                    onChange={setMode}
                />
            }
            shareValue={`Total last: ${results.total.toFixed(2)} kN${mode === 'advanced' ? `, Design (Ed): ${results.design.toFixed(2)} kN` : ''}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* Inputs */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Dækdata</h3>

                    <InputField label="Dækkets Længde (L)" value={dims.length} onChange={handleDimChange('length')} unit="m" info="Total længde af dækket." />
                    <InputField label="Dækkets Bredde (B)" value={dims.width} onChange={handleDimChange('width')} unit="m" info="Total bredde af dækket." />
                    <InputField label="Dækkets Tykkelse (t)" value={dims.thickness} onChange={handleDimChange('thickness')} unit="m" info="Tykkelsen af dækkonstruktionen." />
                    <InputField
                        label="Materialedensitet (ρ)"
                        value={dims.density}
                        onChange={handleDimChange('density')}
                        unit="kg/m³"
                        info="Massen pr. kubikmeter. Armeret beton: ~2400 kg/m³, Letbeton: ~600–1800 kg/m³."
                    />
                    <InputField
                        label="Nyttelast (qk)"
                        value={dims.liveLoad}
                        onChange={handleDimChange('liveLoad')}
                        unit="kN/m²"
                        info="Variabel last fra brug. Bolig: ~1,5–2,0 kN/m². Kontor: ~2,5–3,0 kN/m²."
                    />

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">EC0 Partialkoefficienter</p>
                            <InputField
                                label="γG – Egenlast"
                                value={dims.gammaG}
                                onChange={handleDimChange('gammaG')}
                                unit="–"
                                info="Ugunstig egenlast: 1,35 (STR/GEO). Gunstig: 1,0."
                            />
                            <InputField
                                label="γQ – Nyttelast"
                                value={dims.gammaQ}
                                onChange={handleDimChange('gammaQ')}
                                unit="–"
                                info="Ugunstig nyttelast: 1,50."
                            />
                        </div>
                    )}

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                EC2 Armering (énvejs plade)
                                <InfoHint
                                    title="Nødvendig armering (EC2)"
                                    description="Design-lasten giver et bøjningsmoment M_Ed = q_d·L²/8 pr. meter. EC2 §6.1 bestemmer den nødvendige trækarmering As = M_Ed/(f_yd·z). Minimumsarmering (§9.2.1) kontrolleres også."
                                    calculation="M_Ed = q_d·L²/8 · As = M_Ed/(f_yd·z) · z = d·(0,5+√(0,25−K/1,134))"
                                />
                            </p>
                            <InputField label="Spændvidde (L)" value={flex.span} onChange={e => setFlex(p => ({ ...p, span: e.target.value }))} unit="m" info="Fri spændvidde for énvejs-plade (simpelt understøttet)." />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Betonstyrke (fck)" value={flex.fck} onChange={e => setFlex(p => ({ ...p, fck: e.target.value }))} unit="MPa" info="C20/25→20, C25/30→25, C30/37→30." />
                                <InputField label="Dæklag+Ø/2" value={flex.cover} onChange={e => setFlex(p => ({ ...p, cover: e.target.value }))} unit="mm" info="Trækkes fra tykkelsen → effektiv højde d. Typisk 25–35 mm." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Results */}
                <div className="space-y-6">
                    <ResultDisplay label="Total Karakteristisk Last (Gk + Qk)" value={results.total} unit="kN" />

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark text-sm">
                        <h4 className="font-bold text-base text-text-primary mb-3">Lastfordeling</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Egenlast Gk (dødvægt):</span>
                                <span className="font-semibold">{results.dead.toFixed(2)} kN</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary">Nyttelast Qk (live load):</span>
                                <span className="font-semibold">{results.live.toFixed(2)} kN</span>
                            </div>
                            {mode === 'advanced' && (
                                <>
                                    <div className="border-t border-border dark:border-border-dark pt-2 mt-2 flex justify-between">
                                        <span className="font-semibold text-brand-primary">Design last Ed (EC0):</span>
                                        <span className="font-bold text-brand-primary">{results.design.toFixed(2)} kN</span>
                                    </div>
                                    <p className="text-xs text-text-secondary">
                                        Ed = {dims.gammaG}·Gk + {dims.gammaQ}·Qk
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Load proportion bar */}
                    {results.total > 0 && (
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                            <p className="text-xs font-semibold text-text-secondary mb-2">Lastfordeling (%)</p>
                            <div className="flex h-5 rounded overflow-hidden text-xs font-bold text-white">
                                <div
                                    className="bg-blue-500 flex items-center justify-center transition-all duration-300"
                                    style={{ width: `${(results.dead / results.total) * 100}%` }}
                                >
                                    {((results.dead / results.total) * 100).toFixed(0)}%
                                </div>
                                <div
                                    className="bg-orange-400 flex items-center justify-center transition-all duration-300"
                                    style={{ width: `${(results.live / results.total) * 100}%` }}
                                >
                                    {((results.live / results.total) * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-500"></span>Egenlast</span>
                                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-orange-400"></span>Nyttelast</span>
                            </div>
                        </div>
                    )}

                    {/* EC2 reinforcement result */}
                    {mode === 'advanced' && flexure.d > 0 && (
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark space-y-3">
                            <h4 className="font-bold text-base text-text-primary dark:text-text-dark-primary">EC2 Armeringsbehov</h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <ResultDisplay label="Designmoment M_Ed" value={flexure.medPerM} precision={1} unit="kNm/m" />
                                <ResultDisplay label="Nødvendig As" value={flexure.providedGoverningAsMm2} precision={0} unit="mm²/m" />
                            </div>
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                                <p>Krævet As = {flexure.requiredAsMm2.toFixed(0)} mm²/m · Min. As (§9.2.1) = {flexure.minAsMm2.toFixed(0)} mm²/m</p>
                                <p>Effektiv højde d = {flexure.d.toFixed(0)} mm · indre momentarm z = {flexure.leverArmMm.toFixed(0)} mm</p>
                                {flexure.spacingMm > 0 && <p className="font-semibold">Forslag: Ø10 pr. {flexure.spacingMm} mm (≈ {(78.5 / flexure.spacingMm * 1000).toFixed(0)} mm²/m)</p>}
                            </div>
                            {!flexure.singlyReinforced && (
                                <div className="flex items-start gap-2 p-2 rounded-lg bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning text-xs">
                                    <span>⚠ K &gt; 0,167: pladen kræver trykarmering eller en tykkere plade — den forenklede enkeltarmerings-formel gælder ikke. Kontakt en konstruktør.</span>
                                </div>
                            )}
                            <ComplianceMeter label="Momentudnyttelse (K vs. 0,167)" value={Math.min(flexure.kFactor, 0.3)} limit={0.167} min={0} max={0.3} unit="" decimalPlaces={3} />
                        </div>
                    )}
                </div>
            </div>

            <SafetyDisclaimer>
                Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default SlabLoadCalculator;
