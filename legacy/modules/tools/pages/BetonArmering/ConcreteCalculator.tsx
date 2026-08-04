
import React, { useState, useEffect, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorHero from '../../components/CalculatorHero';
import { DimensionedShape } from '../../components/viz';
import { computeConcreteVolume } from '../../catalog';

type Shape = 'slab' | 'footing' | 'column';

const QUALITY_CLASSES = [
    { label: 'C20/25', density: 2300, hint: 'Simple konstruktioner, let fundament' },
    { label: 'C25/30', density: 2400, hint: 'Gulvplader, kældre, standardbrug' },
    { label: 'C30/37', density: 2450, hint: 'Bærende konstruktioner, høj belastning' },
] as const;

type QualityLabel = typeof QUALITY_CLASSES[number]['label'];

const SHAPE_HINTS: Record<Shape, { hint: string; compliance: string }> = {
    slab: {
        hint: 'Pladedæk og gulvplader bør have min. 150 mm tykkelse for tilstrækkelig styrke. Tilsæt min. 5% spild.',
        compliance: 'BR18 §418, DS/EN 1992-1-1 (Eurokode 2)',
    },
    footing: {
        hint: 'Fundament under terræn dimensioneres ud fra frostdybde og jordtype. Underkant fundament: typisk min. 0,9 m u.t.',
        compliance: 'BR18 §§167–168, DS/EN 1997-1',
    },
    column: {
        hint: 'Søjlediameter og armeringsmønster bør verificeres af konstruktør. Minimumsdækning: 25–40 mm.',
        compliance: 'BR18 §419, DS/EN 1992-1-1 Kap. 5',
    },
};

const ConcreteCalculator: React.FC = () => {
    const [shape, setShape] = useState<Shape>('slab');
    const [dims, setDims] = useState({ length: '5', width: '4', depth: '0.1', diameter: '0.3', quantity: '1', wastage: '5' });
    const [qualityClass, setQualityClass] = useState<QualityLabel>('C25/30');
    const [volume, setVolume] = useState(0);
    const [weight, setWeight] = useState(0);

    const density = QUALITY_CLASSES.find(q => q.label === qualityClass)?.density ?? 2400;
    const diagramRef = useRef<HTMLDivElement>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const { volume: totalVol, weightKg } = computeConcreteVolume({
            shape,
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            depth: parseFloat(dims.depth) || 0,
            diameter: parseFloat(dims.diameter) || 0,
            quantity: parseFloat(dims.quantity) || 1,
            wastagePct: parseFloat(dims.wastage) || 0,
            density,
        });
        setVolume(totalVol);
        setWeight(weightKg);
    }, [dims, shape, density]);

    const slabThickness = parseFloat(dims.depth) || 0;
    const thicknessWarning = shape === 'slab' && slabThickness > 0 && slabThickness < 0.15;

    // ── Annotated isometric shape diagram (via shared viz kit) ────────────────
    const ShapeDiagram = (
        <div ref={diagramRef}>
        <DimensionedShape
            shape={shape}
            length={parseFloat(dims.length) || 5}
            width={parseFloat(dims.width) || 4}
            depth={parseFloat(dims.depth) || 0.1}
            diameter={parseFloat(dims.diameter) || 0.3}
            showRebar
        />
        </div>
    );

    const selectedQuality = QUALITY_CLASSES.find(q => q.label === qualityClass)!;
    const shapeHint = SHAPE_HINTS[shape];

    const shapeLabel = shape === 'slab' ? 'Plade/Gulv' : shape === 'footing' ? 'Fundament' : 'Søjle/Rør';
    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Betonberegner',
        category: 'Beton & Armering',
        mode: shapeLabel,
        inputs: [
            ...(shape !== 'column' ? [
                { label: 'Længde', value: dims.length, unit: 'm' },
                { label: 'Bredde', value: dims.width, unit: 'm' },
            ] : [
                { label: 'Diameter', value: dims.diameter, unit: 'm' },
            ]),
            { label: shape === 'column' ? 'Højde' : 'Tykkelse / Dybde', value: dims.depth, unit: 'm' },
            { label: 'Antal', value: dims.quantity, unit: 'stk' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
            { label: 'Betonkvalitet', value: qualityClass },
            { label: 'Densitet', value: String(density), unit: 'kg/m³' },
        ],
        results: [
            { label: 'Nødvendig Volumen', value: volume.toFixed(3), unit: 'm³', highlight: true },
            { label: 'Estimeret Vægt', value: (weight / 1000).toFixed(2), unit: 'tons' },
        ],
        formula: shape === 'slab'
            ? 'V = L × B × T × antal × (1 + spild%/100)'
            : shape === 'footing'
            ? 'V = L × B × D × antal × (1 + spild%/100)'
            : 'V = π × (d/2)² × H × antal × (1 + spild%/100)',
        standardsStruktureret: [
            { code: shapeHint.compliance.split(',')[0].trim(), note: shapeHint.hint },
        ],
        safetyDisclaimer: 'Betonmængder er vejledende. Verificér altid dimensioner og bæreevne med en autoriseret konstruktør inden støbning. Underkant fundament skal ligge under frostdybde iht. lokale krav.',
        infographicRef: diagramRef,
    }), [shape, dims, qualityClass, density, volume, weight, shapeHint, shapeLabel]);

    return (
        <CalculatorPage
            title="Betonberegner"
            stickyResultLabel="Volumen"
            stickyResult={<><AnimatedNumber value={volume} precision={3} /> m³</>}
            shareValue={volume > 0 ? `${volume.toFixed(3)} m³ beton · ${(weight / 1000).toFixed(2)} t (${qualityClass})` : undefined}
            reportData={reportData}
        >
            {/* Shape selector */}
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border dark:border-border-dark mb-4">
                <SegmentedControl
                    options={[
                        { label: 'Plade/Gulv', value: 'slab' },
                        { label: 'Fundament', value: 'footing' },
                        { label: 'Søjle/Rør', value: 'column' }
                    ]}
                    value={shape}
                    onChange={(v) => setShape(v)}
                />
            </div>

            {/* Illustrated hero with hint + compliance */}
            <CalculatorHero
                illustration={ShapeDiagram}
                hint={shapeHint.hint}
                complianceRef={shapeHint.compliance}
                accentFrom="#3b82f6"
                accentTo="#1e40af"
                className="mb-4"
            />

            <div className="grid md:grid-cols-2 gap-4 items-start">
                {/* Input card */}
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Dimensioner</h3>

                    {shape === 'column' ? (
                        <InputField label="Diameter" value={dims.diameter} onChange={e => handleDimChange(e, 'diameter')} unit="m" />
                    ) : (
                        <>
                            <InputField label="Længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" />
                            <InputField label="Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" />
                        </>
                    )}

                    <InputField
                        label={shape === 'column' ? 'Højde' : 'Tykkelse / Dybde'}
                        value={dims.depth}
                        onChange={e => handleDimChange(e, 'depth')}
                        unit="m"
                        info="Pladedæk: typisk 150–300 mm. Fundament: typisk 300–600 mm."
                    />

                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Antal" value={dims.quantity} onChange={e => handleDimChange(e, 'quantity')} unit="stk" />
                        <InputField label="Spild" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Tilsæt 5–10 % for ujævnt underlag og spild ved støbning." />
                    </div>

                    {/* Quality class selector */}
                    <div>
                        <label className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-2 block">
                            Betonkvalitet
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {QUALITY_CLASSES.map(qc => (
                                <button
                                    key={qc.label}
                                    onClick={() => setQualityClass(qc.label)}
                                    className={`py-2.5 rounded-xl text-sm font-bold border transition-colors min-h-[44px] ${
                                        qualityClass === qc.label
                                            ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                                            : 'bg-bg-subtle dark:bg-bg-dark-surface text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark-strong hover:border-brand-primary'
                                    }`}
                                >
                                    {qc.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-2 pl-1">
                            {selectedQuality.hint}
                        </p>
                    </div>
                </div>

                {/* Results column */}
                <div className="space-y-4">
                    <ResultDisplay
                        label="Nødvendig Volumen"
                        value={volume}
                        precision={3}
                        unit={<>m<sup>3</sup></>}
                    />

                    {/* Weight card with AnimatedNumber */}
                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border dark:border-border-dark">
                        <h4 className="font-bold text-xs text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">
                            Estimeret Vægt
                        </h4>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-text-primary dark:text-text-dark-primary">
                                <AnimatedNumber value={weight / 1000} precision={2} />
                            </span>
                            <span className="text-xl font-bold text-text-secondary dark:text-text-dark-secondary">tons</span>
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                            Densitet: {density} kg/m³ · {qualityClass}
                        </p>
                    </div>

                    {/* Thin-slab compliance warning */}
                    {thicknessWarning && (
                        <div className="bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-xl p-3 flex gap-2.5 items-start">
                            <svg className="w-5 h-5 text-warning-strong dark:text-warning flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <p className="text-sm font-bold text-warning-strong dark:text-warning">Tykkelse under anbefalet minimum</p>
                                <p className="text-xs text-warning-strong dark:text-warning mt-0.5">
                                    Pladedæk anbefales min. 150 mm. Nuværende: {Math.round(slabThickness * 1000)} mm.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Project/quotation hint */}
                    <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-xs text-info-strong dark:text-info leading-snug">
                            Gem betonvolumen som indkøb og brug det direkte i dit tilbud via <strong>Gem til Projekt</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default ConcreteCalculator;
