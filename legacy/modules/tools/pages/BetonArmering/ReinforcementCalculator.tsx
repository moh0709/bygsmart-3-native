import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import {
    computeReinforcement,
    computeFlexuralReinforcement,
    getCalculator,
    catalogHelpToContent,
} from '../../catalog';

const TOOL_ID = 'beton-armering-armeringsstaal';
const meta = getCalculator(TOOL_ID);

// EC2 concrete strength classes → characteristic cylinder strength fck [MPa]
const CONCRETE_CLASSES: { label: string; fck: number }[] = [
    { label: 'C20/25', fck: 20 },
    { label: 'C25/30', fck: 25 },
    { label: 'C30/37', fck: 30 },
];

// Standard Danish rebar diameters [mm]
const BAR_DIAMETERS = [8, 10, 12, 16, 20, 25];

const ReinforcementCalculator: React.FC = () => {
    const { advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');

    // ── Basic (quantity take-off) state ───────────────────────────────────────
    const [type, setType] = useState<'mesh' | 'bars'>('mesh');
    const [inputs, setInputs] = useState({
        areaL: '5', areaW: '4',
        spacing: '150', // mm
        diameter: '10', // mm
        layers: '1',
        wastage: '10', // %
    });
    const [result, setResult] = useState({ length: 0, weight: 0, countL: 0, countW: 0 });

    // ── Advanced (EC2 flexural design) state ──────────────────────────────────
    const [design, setDesign] = useState({
        moment: '120',   // Med [kNm]
        width: '300',    // b [mm]
        depth: '450',    // d [mm]
        fck: '25',       // concrete class fck [MPa]
        barDia: '16',    // chosen bar Ø [mm]
        barCount: '4',   // chosen bar count
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleDesignChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof design) => {
        setDesign(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const L = parseFloat(inputs.areaL) || 0;
        const W = parseFloat(inputs.areaW) || 0;
        const spacing_mm = parseFloat(inputs.spacing) || 150;
        const diameter = parseFloat(inputs.diameter) || 10;
        const layers = parseInt(inputs.layers) || 1;
        const wastagePct = parseFloat(inputs.wastage) || 0;

        if (L > 0 && W > 0 && spacing_mm > 0) {
            const spacing_m = spacing_mm / 1000;

            // Bar counts for the visual grid only (computeReinforcement doesn't
            // return these — it only returns the totals used for materials).
            const countAlongL = Math.ceil(W / spacing_m) + 1;
            const countAlongW = Math.ceil(L / spacing_m) + 1;

            // Shared formula lives in services/calculatorCatalog.ts (also used by
            // CalculatorPickerModal and the catalog's 'beton-armering-armeringsstaal' entry).
            const { totalLengthM, weightKg } = computeReinforcement({
                areaL: L,
                areaW: W,
                ccMm: spacing_mm,
                diamMm: diameter,
                layers,
                wastagePct,
            });

            setResult({ length: totalLengthM, weight: weightKg, countL: countAlongL, countW: countAlongW });
        } else {
            setResult({ length: 0, weight: 0, countL: 0, countW: 0 });
        }
    }, [inputs]);

    // ── Advanced EC2 design computation (shared catalog formula) ──────────────
    const design_r = useMemo(() => computeFlexuralReinforcement({
        momentKNm: parseFloat(design.moment) || 0,
        widthMm: parseFloat(design.width) || 0,
        effectiveDepthMm: parseFloat(design.depth) || 0,
        fckMPa: parseFloat(design.fck) || 0,
        barDiameterMm: parseFloat(design.barDia) || 0,
        barCount: parseInt(design.barCount) || 0,
    }), [design]);

    const passes = design_r.provisionPasses; // boolean | null
    // Steel utilisation: required / provided → OK when ≤ 100 % (i.e. bars suffice)
    const asUtilPct = design_r.providedAsMm2 > 0
        ? (design_r.governingAsMm2 / design_r.providedAsMm2) * 100
        : 0;
    const selectedClass = CONCRETE_CLASSES.find(c => String(c.fck) === design.fck) ?? CONCRETE_CLASSES[1];

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData = useMemo<CalculatorReportData>(() => {
        if (mode === 'advanced') {
            return {
                toolName: meta?.name ?? 'Armeringsberegner',
                category: meta?.category ?? 'Beton & Armering',
                mode: 'EC2 Bøjningsdimensionering',
                inputs: [
                    { label: 'Designmoment (Med)', value: design.moment, unit: 'kNm' },
                    { label: 'Tværsnitsbredde (b)', value: design.width, unit: 'mm' },
                    { label: 'Effektiv højde (d)', value: design.depth, unit: 'mm' },
                    { label: 'Betonklasse', value: `${selectedClass.label} (fck=${selectedClass.fck} MPa)` },
                    { label: 'Valgt armering', value: `${design.barCount} × Ø${design.barDia}`, unit: 'mm' },
                ],
                results: [
                    { label: 'Nødvendig As (dim.givende)', value: design_r.governingAsMm2.toFixed(0), unit: 'mm²', highlight: true },
                    { label: 'Beregnet As (moment)', value: design_r.requiredAsMm2.toFixed(0), unit: 'mm²' },
                    { label: 'Minimumsarmering As,min', value: design_r.minAsMm2.toFixed(0), unit: 'mm²' },
                    { label: 'Maksimumsarmering As,max', value: design_r.maxAsMm2.toFixed(0), unit: 'mm²' },
                    { label: 'Leveret As (valgte jern)', value: design_r.providedAsMm2.toFixed(0), unit: 'mm²' },
                    { label: 'Indre momentarm z', value: design_r.leverArmMm.toFixed(0), unit: 'mm' },
                    { label: 'K-faktor', value: design_r.kFactor.toFixed(3) },
                    { label: 'Enkeltarmeret (K≤0,167)', value: design_r.singlyReinforced ? 'Ja' : 'Nej — trykarmering kræves' },
                    { label: 'Status', value: passes === null ? '–' : passes ? 'OK' : 'IKKE OK' },
                ],
                formula: 'K = Med/(b·d²·fcd) ≤ 0,167 ; z = d(0,5+√(0,25−K/1,134)) ; As = Med/(fyd·z)',
                standardsStruktureret: meta?.standards,
                safetyDisclaimer: 'EC2-dimensioneringen er vejledende og forudsætter et enkeltarmeret rektangulært tværsnit i bøjning. Bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret ingeniør/konstruktør iht. DS/EN 1992-1-1 (EC2) og BR18 §419.',
            };
        }
        return {
            toolName: meta?.name ?? 'Armeringsberegner',
            category: meta?.category ?? 'Beton & Armering',
            mode: type === 'mesh' ? 'Armeringsnet' : 'Løse Jern',
            inputs: [
                { label: 'Område Længde', value: inputs.areaL, unit: 'm' },
                { label: 'Område Bredde', value: inputs.areaW, unit: 'm' },
                { label: 'Afstand (c/c)', value: inputs.spacing, unit: 'mm' },
                { label: 'Diameter', value: inputs.diameter, unit: 'mm' },
                { label: 'Antal Lag', value: inputs.layers, unit: 'lag' },
                { label: 'Spild', value: inputs.wastage, unit: '%' },
            ],
            results: [
                { label: 'Total Længde', value: result.length.toFixed(1), unit: 'm', highlight: true },
                { label: 'Total Vægt', value: result.weight.toFixed(1), unit: 'kg' },
                { label: 'Antal jern (langs L)', value: String(result.countW) },
                { label: 'Antal jern (langs B)', value: String(result.countL) },
            ],
            formula: meta?.help?.formula ?? 'Vægt pr. meter = (diameter² / 162) kg/m',
            standardsStruktureret: meta?.standards,
            safetyDisclaimer: 'Armeringsmængder er vejledende og udgør ikke en statisk dimensionering. Bærende konstruktioner SKAL dimensioneres af en autoriseret ingeniør/konstruktør iht. DS/EN 1992-1-1 (EC2) og BR18 §419.',
        };
    }, [mode, type, inputs, result, design, design_r, passes, selectedClass]);

    const Diagram = useMemo(() => {
        const L = parseFloat(inputs.areaL) || 5;
        const W = parseFloat(inputs.areaW) || 4;
        const sp = (parseFloat(inputs.spacing) || 150) / 1000; // m

        if (L <= 0 || W <= 0) return null;

        // Visual scaling
        const maxDim = Math.max(L, W);
        const scale = 250 / maxDim;
        const svgW = L * scale;
        const svgH = W * scale;

        // Limit visual bars to avoid rendering thousands
        const maxBars = 20;
        const stepL = Math.max(1, Math.floor(result.countW / maxBars));
        const stepW = Math.max(1, Math.floor(result.countL / maxBars));

        const bars = [];

        // Vertical bars (along Width, spaced by L)
        for (let i = 0; i < result.countW; i += stepL) {
            const x = i * sp * scale;
            if (x <= svgW) {
                bars.push(<line key={`v-${i}`} x1={x} y1={0} x2={x} y2={svgH} stroke="#4b5563" strokeWidth="1" />);
            }
        }
        // Last vertical
        bars.push(<line key="v-last" x1={svgW} y1={0} x2={svgW} y2={svgH} stroke="#4b5563" strokeWidth="1" />);

        // Horizontal bars (along Length, spaced by W)
        for (let i = 0; i < result.countL; i += stepW) {
            const y = i * sp * scale;
            if (y <= svgH) {
                bars.push(<line key={`h-${i}`} x1={0} y1={y} x2={svgW} y2={y} stroke="#4b5563" strokeWidth="1" />);
            }
        }
        // Last horizontal
        bars.push(<line key="h-last" x1={0} y1={svgH} x2={svgW} y2={svgH} stroke="#4b5563" strokeWidth="1" />);

        return (
            <div className="w-full flex justify-center bg-bg-muted dark:bg-bg-dark-muted rounded-lg border border-border-strong p-4">
                <svg width={svgW + 20} height={svgH + 20} viewBox={`-10 -10 ${svgW + 20} ${svgH + 20}`}>
                    <rect x="0" y="0" width={svgW} height={svgH} fill="white" stroke="none" />
                    {bars}
                    <text x={svgW/2} y="-5" textAnchor="middle" className="text-[8px]">{L}m</text>
                    <text x="-5" y={svgH/2} textAnchor="middle" className="text-[8px]" style={{writingMode: 'vertical-rl'}}>{W}m</text>
                </svg>
            </div>
        );
    }, [inputs, result]);

    // ── Sticky result + share (Advanced only — Basic stays visually unchanged) ──
    const stickyResult = mode === 'advanced'
        ? <><AnimatedNumber value={design_r.governingAsMm2} precision={0} /> mm²</>
        : undefined;
    const shareValue = mode === 'advanced'
        ? `Nødvendig As: ${design_r.governingAsMm2.toFixed(0)} mm² · Leveret: ${design_r.providedAsMm2.toFixed(0)} mm² (${design.barCount}×Ø${design.barDia}) · ${passes === null ? '–' : passes ? 'OK' : 'Ikke OK'}`
        : undefined;

    return (
        <CalculatorPage
            title="Armeringsstål Beregner"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            stickyResultLabel="Nødvendig As"
            stickyResult={stickyResult}
            shareValue={shareValue}
        >
            {mode === 'basic' ? (
                /* ══════════════ BASIS — mængdeopgørelse (uændret) ══════════════ */
                <>
                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border mb-6">
                        <SegmentedControl
                            options={[{ label: 'Armeringsnet', value: 'mesh' }, { label: 'Løse Jern', value: 'bars' }]}
                            value={type}
                            onChange={(v) => setType(v)}
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                            <h3 className="font-bold text-lg">Armeringsdata</h3>
                            <InputField label="Område Længde" value={inputs.areaL} onChange={e => handleInputChange(e, 'areaL')} unit="m" info="Længden af området der skal armeres."/>
                            <InputField label="Område Bredde" value={inputs.areaW} onChange={e => handleInputChange(e, 'areaW')} unit="m" info="Bredden af området der skal armeres."/>

                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Afstand (c/c)" value={inputs.spacing} onChange={e => handleInputChange(e, 'spacing')} unit="mm" info="Center-afstand mellem jernene."/>
                                <InputField label="Diameter" value={inputs.diameter} onChange={e => handleInputChange(e, 'diameter')} unit="mm" info="Diameteren på armeringsjernet."/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Antal Lag" value={inputs.layers} onChange={e => handleInputChange(e, 'layers')} unit="lag" info="Antal lag af armering (f.eks. top og bund)."/>
                                <InputField label="Spild" value={inputs.wastage} onChange={e => handleInputChange(e, 'wastage')} unit="%" info="Spild ved overlæg, bukning og afkap — typisk 10 %."/>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                                <h3 className="font-bold text-lg mb-4">Resultat</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <ResultDisplay label="Total Længde" value={result.length} precision={1} unit="m" />
                                    <ResultDisplay label="Total Vægt" value={result.weight} precision={1} unit="kg" />
                                </div>
                                <div className="bg-bg-muted dark:bg-bg-dark-muted p-3 rounded-lg text-sm text-text-secondary">
                                    Antal jern: <strong>{result.countW}</strong> (langs L) + <strong>{result.countL}</strong> (langs B) pr. lag.
                                </div>
                            </div>

                            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border">
                                <h3 className="font-bold text-lg mb-2 text-center">Visuelt Grid</h3>
                                {Diagram}
                            </div>
                        </div>
                    </div>

                    <SafetyDisclaimer>
                        Armeringsmængder er vejledende og udgør ikke en statisk dimensionering. Bærende konstruktioner SKAL dimensioneres af en autoriseret ingeniør/konstruktør iht. DS/EN 1992-1-1 (EC2) og BR18 §419.
                    </SafetyDisclaimer>
                </>
            ) : (
                /* ══════════════ AVANCERET — EC2 bøjningsdimensionering ══════════════ */
                <>
                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        {/* ── Inputs ── */}
                        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                            <h3 className="font-bold text-lg">EC2 Bøjningsdimensionering</h3>
                            <p className="text-sm text-text-secondary -mb-1">
                                Dimensionér nødvendig trækarmering ud fra et designmoment (enkeltarmeret rektangulært tværsnit) iht. DS/EN 1992-1-1.
                            </p>

                            <InputField
                                label="Designmoment (Med)"
                                value={design.moment}
                                onChange={e => handleDesignChange(e, 'moment')}
                                unit="kNm"
                                info="Dimensionerende bøjningsmoment inkl. lastfaktorer (EC0)."
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="Bredde (b)"
                                    value={design.width}
                                    onChange={e => handleDesignChange(e, 'width')}
                                    unit="mm"
                                    info="Tværsnittets bredde i trykzonen."
                                />
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                                        Effektiv højde (d)
                                        <InfoHint
                                            title="Effektiv højde (d)"
                                            description="Afstanden fra trykranden til tyngdepunktet af trækarmeringen — ikke tværsnittets fulde højde h."
                                            calculation="d = h − dæklag − Ø/2"
                                        />
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            aria-label="Effektiv højde"
                                            value={design.depth}
                                            onChange={e => setDesign(prev => ({ ...prev, depth: e.target.value }))}
                                            className="w-full h-11 rounded-control border border-border-strong dark:border-border-dark-strong bg-bg pl-3 pr-12 text-base tabular-nums text-text-primary dark:bg-bg-dark-surface dark:text-text-dark-primary focus:outline-none focus:border-brand-primary transition-colors duration-150"
                                        />
                                        <span className="absolute inset-y-0 right-3 flex items-center text-label text-text-secondary dark:text-text-dark-secondary pointer-events-none">mm</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                    Betonklasse
                                    <InfoHint
                                        title="Betonens styrkeklasse"
                                        description="Vælg betonens karakteristiske cylinderstyrke fck. Den regningsmæssige styrke er fcd = fck / 1,5 (γc, EC2)."
                                        calculation="fcd = fck / 1,5"
                                    />
                                </label>
                                <select
                                    aria-label="Betonklasse"
                                    value={design.fck}
                                    onChange={e => setDesign(prev => ({ ...prev, fck: e.target.value }))}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                                >
                                    {CONCRETE_CLASSES.map(c => (
                                        <option key={c.fck} value={c.fck}>{c.label} (fck = {c.fck} MPa)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                        Vælg jern Ø
                                        <InfoHint
                                            title="Valgt armeringsjern"
                                            description="Vælg diameter og antal jern. Det leverede armeringsareal er As = antal · π·(Ø/2)² og sammenlignes med det nødvendige As."
                                            calculation="As,leveret = n · π·(Ø/2)²"
                                        />
                                    </label>
                                    <select
                                        aria-label="Armeringsdiameter"
                                        value={design.barDia}
                                        onChange={e => setDesign(prev => ({ ...prev, barDia: e.target.value }))}
                                        className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                                    >
                                        {BAR_DIAMETERS.map(d => (
                                            <option key={d} value={d}>Ø{d} mm</option>
                                        ))}
                                    </select>
                                </div>
                                <InputField
                                    label="Antal jern"
                                    value={design.barCount}
                                    onChange={e => handleDesignChange(e, 'barCount')}
                                    unit="stk"
                                    info="Antal trækjern i tværsnittet."
                                />
                            </div>
                        </div>

                        {/* ── Results ── */}
                        <div className="space-y-6">
                            {/* Verdict card */}
                            <div className={`p-5 rounded-card border-l-4 shadow-sm ${passes === false
                                ? 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'
                                : 'bg-success-subtle border-success dark:bg-success-subtle-dark'}`}>
                                <div className="flex items-start gap-3">
                                    {passes === false
                                        ? <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />
                                        : <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1">
                                            <h4 className={`font-bold ${passes === false ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}`}>
                                                {passes === null
                                                    ? 'Indtast gyldige data'
                                                    : passes
                                                        ? 'Armering OK'
                                                        : 'Armering utilstrækkelig'}
                                            </h4>
                                            <InfoHint
                                                title="Nødvendigt armeringsareal (As)"
                                                description="Det nødvendige trækarmeringsareal beregnes af designmomentet: As = Med / (fyd·z), hvor fyd = fyk/1,15 er regningsmæssig flydespænding og z er den indre momentarm. Det dimensionsgivende As er det største af det beregnede og minimumsarmeringen."
                                                calculation="As = Med / (fyd·z)  ·  As,dim = max(As, As,min)"
                                            />
                                        </div>
                                        <p className={`text-sm mt-0.5 ${passes === false ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}`}>
                                            {passes === null
                                                ? 'Udfyld moment, tværsnit og betonklasse for at dimensionere.'
                                                : passes
                                                    ? `De valgte ${design.barCount} × Ø${design.barDia} (${design_r.providedAsMm2.toFixed(0)} mm²) dækker det nødvendige areal på ${design_r.governingAsMm2.toFixed(0)} mm².`
                                                    : design_r.providedAsMm2 < design_r.governingAsMm2
                                                        ? `De valgte ${design.barCount} × Ø${design.barDia} giver kun ${design_r.providedAsMm2.toFixed(0)} mm² — under det nødvendige ${design_r.governingAsMm2.toFixed(0)} mm². Øg antal eller diameter.`
                                                        : `De valgte jern giver ${design_r.providedAsMm2.toFixed(0)} mm² og overskrider maksimumsarmeringen ${design_r.maxAsMm2.toFixed(0)} mm² (As,max). Reducér armeringen eller øg tværsnittet.`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Compression-steel warning when K > 0,167 */}
                            {!design_r.singlyReinforced && (
                                <div className="p-4 rounded-card border-l-4 border-warning bg-warning-subtle dark:bg-warning-subtle-dark shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangleIcon className="w-5 h-5 text-warning flex-shrink-0" />
                                        <div className="text-sm text-warning-strong dark:text-warning">
                                            <p className="font-semibold">K &gt; 0,167 — tværsnittet er ikke enkeltarmeret</p>
                                            <p className="mt-0.5">
                                                Trykzonen er overudnyttet (K = {design_r.kFactor.toFixed(3)}). Der kræves trykarmering eller et dybere/bredere tværsnit — den simple formel As = Med/(fyd·z) gælder ikke længere. Resultatet nedenfor er kun vejledende (afkortet ved balancegrænsen).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Kapacitetstjek — meters */}
                            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark space-y-3">
                                <div className="flex items-center gap-1">
                                    <h4 className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">Kapacitetstjek</h4>
                                    <InfoHint
                                        title="Balanceret grænse K ≤ 0,167"
                                        description="K = Med/(b·d²·fcd) udtrykker trykzonens udnyttelse. Ved K ≤ 0,167 kan tværsnittet armeres enkelt (kun trækarmering), og den indre momentarm z bestemmes af K. Over 0,167 kræves trykarmering eller et dybere tværsnit."
                                        calculation="K = Med/(b·d²·fcd) ≤ 0,167"
                                    />
                                </div>
                                {/* Steel utilisation (required vs provided) — OK when ≤ 100 % */}
                                <ComplianceMeter
                                    label="Udnyttelse As (nødvendig/leveret)"
                                    value={asUtilPct}
                                    limit={100}
                                    min={0}
                                    max={150}
                                    unit="%"
                                    decimalPlaces={0}
                                />
                                {/* Balanced-section limit K vs 0,167 */}
                                <ComplianceMeter
                                    label="Balancegrænse K ≤ 0,167"
                                    value={design_r.kFactor}
                                    limit={0.167}
                                    min={0}
                                    max={0.334}
                                    unit=""
                                    decimalPlaces={3}
                                />
                            </div>

                            {/* Armeringsarealer */}
                            <div className="flex items-center gap-1">
                                <h4 className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">Armeringsarealer</h4>
                                <InfoHint
                                    title="Minimumsarmering (EC2 §9.2.1)"
                                    description="For at undgå sprødt brud ved revnedannelse kræver EC2 en minimumsmængde trækarmering, afhængig af betonens middeltrækstyrke fctm. Den dimensionsgivende As er det største af det momentberegnede og denne minimumsarmering."
                                    calculation="As,min = max(0,26·fctm/fyk·b·d ; 0,0013·b·d)"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <ResultDisplay label="Nødvendig As (dim.giv.)" value={design_r.governingAsMm2} precision={0} unit="mm²" />
                                <ResultDisplay label="Leveret As (valgte jern)" value={design_r.providedAsMm2} precision={0} unit="mm²" />
                            </div>

                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                                <p className="font-semibold">Detaljerede designværdier</p>
                                <p>Beregnet As (moment) = {design_r.requiredAsMm2.toFixed(0)} mm² · As,min = {design_r.minAsMm2.toFixed(0)} mm² · As,max = {design_r.maxAsMm2.toFixed(0)} mm²</p>
                                <p>K = {design_r.kFactor.toFixed(3)} ({design_r.singlyReinforced ? 'enkeltarmeret' : 'trykarmering kræves'}) · z = {design_r.leverArmMm.toFixed(0)} mm</p>
                                <p>Beton {selectedClass.label} (fck = {selectedClass.fck} MPa, fcd = {(selectedClass.fck / 1.5).toFixed(1)} MPa) · fyk = 500 MPa</p>
                            </div>
                        </div>
                    </div>

                    <SafetyDisclaimer>
                        EC2-dimensioneringen dækker et enkeltarmeret rektangulært tværsnit i ren bøjning og medregner ikke forskydning,
                        forankring, revnevidde eller kombinerede snitkræfter. Bærende konstruktioner SKAL dimensioneres og godkendes af en
                        autoriseret ingeniør/konstruktør iht. DS/EN 1992-1-1 (EC2) og BR18 §419.
                    </SafetyDisclaimer>
                </>
            )}
        </CalculatorPage>
    );
};

export default ReinforcementCalculator;
