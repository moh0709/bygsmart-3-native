
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { computeExcavation, getCalculator, catalogHelpToContent, type SoilType } from '../../catalog';

const meta = getCalculator('udgravning-jord-jordvolumen');

const SOIL_OPTIONS: { label: string; value: SoilType }[] = [
    { label: 'Ler', value: 'clay' },
    { label: 'Sand', value: 'sand' },
    { label: 'Grus', value: 'gravel' },
    { label: 'Klippe', value: 'rock' },
];

const ExcavationCalculator: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('basic');
    const [dims, setDims] = useState({ length: '10', width: '5', depth: '0.5', swell: '20' });
    const [soilType, setSoilType] = useState<SoilType>('clay');
    const [results, setResults] = useState({ inSitu: 0, loose: 0, swellPct: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        const d = parseFloat(dims.depth) || 0;
        const r = computeExcavation({ length: l, width: w, depth: d, soilType });
        // Advanced: use the geotechnical soil-typed swell from the catalog table.
        // Basic: use the manual free-text løsningsfaktor.
        const swellPct = mode === 'advanced' ? r.swellPct : (parseFloat(dims.swell) || 0);
        const loose = r.inSitu * (1 + swellPct / 100);
        setResults({ inSitu: r.inSitu, loose, swellPct });
    }, [dims, soilType, mode]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Udgravning Beregner',
        category: 'Udgravning & Jord',
        mode: mode === 'advanced' ? 'Avanceret (jordtype)' : 'Basis',
        inputs: [
            { label: 'Længde', value: dims.length, unit: 'm' },
            { label: 'Bredde', value: dims.width, unit: 'm' },
            { label: 'Dybde', value: dims.depth, unit: 'm' },
            ...(mode === 'advanced'
                ? [{ label: 'Jordtype', value: SOIL_OPTIONS.find(s => s.value === soilType)?.label ?? soilType }]
                : []),
            { label: 'Løsningsfaktor', value: results.swellPct.toFixed(0), unit: '%' },
        ],
        results: [
            { label: 'Fast volumen (i hullet)', value: results.inSitu.toFixed(2), unit: 'm³', highlight: true },
            { label: 'Løst mål (container/lastbil)', value: results.loose.toFixed(2), unit: 'm³' },
            { label: 'Antal lastbiler (à 11 m³)', value: String(Math.ceil(results.loose / 11)), unit: 'stk' },
        ],
        formula: 'V_fast = L × B × D; V_løst = V_fast × (1 + løsningsfaktor%/100)',
        standardsStruktureret: meta?.standards,
    }), [dims, results, mode, soilType]);

     const Diagram = useMemo(() => {
        const l = Math.max(parseFloat(dims.length) || 1, 0.1);
        const d = Math.max(parseFloat(dims.depth) || 1, 0.1);
        const width = 100; 
        const height = (d / l) * width;
        const clampedHeight = Math.min(Math.max(height, 20), 80);

        return (
            <div className="w-full flex justify-center items-center p-4">
                 <svg viewBox={`-10 -10 ${width + 20} ${clampedHeight + 30}`} className="w-full h-auto max-h-[150px]">
                    {/* Ground level line */}
                    <line x1="-5" y1="0" x2={width+5} y2="0" className="stroke-green-600" strokeWidth="1" strokeDasharray="4"/>
                    
                    {/* Excavation Pit */}
                    <path d={`M0,0 L0,${clampedHeight} L${width},${clampedHeight} L${width},0`} className="fill-amber-100 stroke-amber-700" strokeWidth="1" />
                    
                    {/* Dimensions */}
                    <line x1="0" y1="-5" x2={width} y2="-5" className="stroke-text-secondary" strokeWidth="0.5" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                    <text x={width/2} y="-8" textAnchor="middle" className="text-[8px] fill-text-secondary">{dims.length}m</text>
                    
                    <line x1="-5" y1="0" x2="-5" y2={clampedHeight} className="stroke-text-secondary" strokeWidth="0.5" />
                    <text x="-8" y={clampedHeight/2} textAnchor="end" dominantBaseline="middle" className="text-[8px] fill-text-secondary">{dims.depth}m</text>
                </svg>
            </div>
        )
    }, [dims]);


    return (
        <CalculatorPage
            title="Jordvolumen (Udgravning)"
            helpContent={helpContent}
            modeToggle={<CalculatorModeToggle toolId="udgravning-jord-jordvolumen" onChange={setMode} />}
            stickyResult={<>{results.inSitu.toFixed(2)} m³</>}
            stickyResultLabel="Fast volumen"
            shareValue={results.inSitu > 0 ? `${results.inSitu.toFixed(2)} m³ fast · ${results.loose.toFixed(2)} m³ løst` : undefined}
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Hullets Dimensioner</h3>
                    <InputField label="Længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Længden af udgravningen."/>
                    <InputField label="Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Bredden af udgravningen."/>
                    <InputField label="Dybde" value={dims.depth} onChange={e => handleDimChange(e, 'depth')} unit="m" info="Dybden af udgravningen."/>
                    {mode === 'advanced' ? (
                        <div>
                            <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Jordtype
                            </label>
                            <select
                                aria-label="Jordtype"
                                value={soilType}
                                onChange={e => setSoilType(e.target.value as SoilType)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                                {SOIL_OPTIONS.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary mt-1">
                                Løsningsfaktor fra geoteknisk tabel: <strong>{results.swellPct.toFixed(0)}%</strong>. Klippe (sprængt) varierer 30–60%+ — verificér mod geoteknisk rapport.
                            </p>
                        </div>
                    ) : (
                        <InputField
                            label="Jordens Løsningsfaktor"
                            value={dims.swell}
                            onChange={e => handleDimChange(e, 'swell')}
                            unit="%"
                            info="Hvor meget jorden fylder mere, når den graves op (swell factor). Sand/grus: ~10-15%, Muld/ler: ~20-30%. Skift til Avanceret for jordtype-baseret opslag."
                        />
                    )}
                </div>
                
                <div className="space-y-4">
                    <ResultDisplay label="Fast volumen (i hullet)" value={results.inSitu} precision={2} unit={<>m<sup>3</sup></>} />
                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30">
                        <p className="text-xs font-medium text-info-strong dark:text-info uppercase tracking-wider mb-1">Løst mål (container/lastbil)</p>
                        <div className="text-3xl font-extrabold text-brand-primary dark:text-brand-light">{results.loose.toFixed(2)} m³</div>
                    </div>
                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border dark:border-border-dark text-sm text-text-secondary dark:text-text-dark-secondary">
                        <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary mb-2">Visualisering</h3>
                        {Diagram}
                        <p className="mt-2">Ca. <strong className="text-text-primary dark:text-text-dark-primary">{Math.ceil(results.loose / 11)}</strong> lastbiler (à 11 m³).</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default ExcavationCalculator;
