
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { computeExcavationSlope, getCalculator, catalogHelpToContent, type SoilType } from '../../catalog';
import { AlertTriangleIcon } from '../../../../components/icons';

const meta = getCalculator('udgravning-jord-skraaning');

const SOIL_OPTIONS: { label: string; value: SoilType }[] = [
    { label: 'Ler (anlæg 1:0,5)', value: 'clay' },
    { label: 'Sand/Grus (anlæg 1:1)', value: 'sand' },
    { label: 'Klippe (anlæg 1:0,18)', value: 'rock' },
];

// AT-vejledning D.2.17: excavations deeper than 1,7 m require documented battering or shoring.
const AT_DEPTH_LIMIT_M = 1.7;

const ExcavationSlopeCalculator: React.FC = () => {
    const [inputs, setInputs] = useState({ bottomWidth: '2', depth: '2', length: '10' });
    const [soilType, setSoilType] = useState<SoilType>('clay');
    const [results, setResults] = useState({ topWidth: 0, volume: 0, setback: 0, slopeRatio: 0 });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const bottomWidth = parseFloat(inputs.bottomWidth) || 0;
        const depth = parseFloat(inputs.depth) || 0;
        const length = parseFloat(inputs.length) || 0;
        if (bottomWidth > 0 && depth > 0 && length > 0) {
            const r = computeExcavationSlope({ bottomWidth, depth, length, soilType });
            setResults(r);
        } else {
            setResults({ topWidth: 0, volume: 0, setback: 0, slopeRatio: 0 });
        }
    }, [inputs, soilType]);

    const depth = parseFloat(inputs.depth) || 0;
    const deepExcavation = depth > AT_DEPTH_LIMIT_M;

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Udgravningsskråning (Anlæg)',
        category: 'Udgravning & Jord',
        inputs: [
            { label: 'Bundbredde', value: inputs.bottomWidth, unit: 'm' },
            { label: 'Dybde', value: inputs.depth, unit: 'm' },
            { label: 'Længde af udgravning', value: inputs.length, unit: 'm' },
            { label: 'Jordtype (anlæg)', value: SOIL_OPTIONS.find(s => s.value === soilType)?.label ?? soilType },
        ],
        results: [
            { label: 'Total Volumen (Fast mål)', value: results.volume.toFixed(2), unit: 'm³', highlight: true },
            { label: 'Krævet topbredde', value: results.topWidth.toFixed(2), unit: 'm' },
            { label: 'Setback pr. side', value: results.setback.toFixed(2), unit: 'm' },
        ],
        formula: 'Setback = Dybde × anlæg; Topbredde = Bundbredde + 2 × Setback; Volumen = ((Bundbredde + Topbredde) / 2) × Dybde × Længde',
        standardsStruktureret: meta?.standards,
        safetyDisclaimer: 'Skråningsanlæg er vejledende. Udgravninger dybere end 1,7 m kræver dokumenteret skråningsanlæg eller afstivning jf. Arbejdstilsynets vejledning D.2.17. Kontrollér altid med geoteknisk rapport ved blandede jordlag eller grundvand.',
    }), [inputs, soilType, results]);

    const Diagram = useMemo(() => {
        const b = Math.max(parseFloat(inputs.bottomWidth) || 1, 0.1);
        const d = Math.max(parseFloat(inputs.depth) || 1, 0.1);
        const t = results.topWidth > 0 ? results.topWidth : b;

        const scale = 100 / (t + 2);
        const viewHeight = d * scale + 20;
        const viewWidth = 120;
        const xCenter = viewWidth / 2;

        return (
            <div className="w-full flex justify-center items-center p-4">
                <svg viewBox={`-20 -20 ${viewWidth + 40} ${viewHeight + 40}`} className="w-full h-auto max-h-[150px]" preserveAspectRatio="xMidYMid meet">
                    {/* Soil cross-section (trapezoid: wide at top, narrow at bottom) */}
                    <path d={`M${xCenter - t * scale / 2},0 L${xCenter + t * scale / 2},0 L${xCenter + b * scale / 2},${d * scale} L${xCenter - b * scale / 2},${d * scale} Z`} className="fill-amber-100 stroke-amber-700" strokeWidth="1" />

                    {/* Dimensions */}
                    <line x1={xCenter - t * scale / 2} y1="-5" x2={xCenter + t * scale / 2} y2="-5" className="stroke-text-secondary" strokeWidth="0.5" />
                    <text x={xCenter} y="-8" textAnchor="middle" className="text-[8px]">Top: {t.toFixed(2)}m</text>

                    <line x1={xCenter - b * scale / 2} y1={d * scale + 5} x2={xCenter + b * scale / 2} y2={d * scale + 5} className="stroke-text-secondary" strokeWidth="0.5" />
                    <text x={xCenter} y={d * scale + 12} textAnchor="middle" className="text-[8px]">Bund: {inputs.bottomWidth}m</text>

                    <text x={xCenter} y={d * scale / 2} textAnchor="middle" className="text-[8px] fill-amber-900 font-bold">D: {inputs.depth}m</text>
                </svg>
            </div>
        );
    }, [inputs, results]);

    return (
        <CalculatorPage
            title="Udgravningsskråning (Anlæg)"
            helpContent={helpContent}
            stickyResult={<>{results.volume.toFixed(2)} m³</>}
            stickyResultLabel="Total volumen"
            shareValue={results.volume > 0 ? `Topbredde ${results.topWidth.toFixed(2)} m · ${results.volume.toFixed(2)} m³` : undefined}
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Dimensioner</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Bundbredde" value={inputs.bottomWidth} onChange={e => handleInputChange(e, 'bottomWidth')} unit="m" info="Bredden i bunden af udgravningen (friholdt arbejdsbredde)." />
                        <InputField label="Dybde" value={inputs.depth} onChange={e => handleInputChange(e, 'depth')} unit="m" info="Dybden af udgravningen. Over 1,7 m kræves dokumenteret anlæg/afstivning (AT D.2.17)." />
                    </div>
                    <InputField label="Længde af udgravning" value={inputs.length} onChange={e => handleInputChange(e, 'length')} unit="m" info="Længden af udgravningen." />
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Jordtype (bestemmer skråningsanlæg)
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
                            Anlæg jf. AT-vejledning D.2.17: Sand/grus 1:1, Ler 1:0,5, Klippe 1:0,18. Ved tvivl: brug 1:1.
                        </p>
                    </div>

                    {deepExcavation && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-subtle dark:bg-danger-subtle-dark text-danger-strong dark:text-danger text-sm">
                            <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                            <span>
                                <strong>Dybde over 1,7 m:</strong> Arbejdstilsynets vejledning D.2.17 kræver dokumenteret
                                skråningsanlæg eller afstivning (spunsning/gravekasse). Kontakt en geotekniker inden gravning.
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <ResultDisplay label="Total Volumen (Fast mål)" value={results.volume} precision={2} unit={<>m<sup>3</sup></>} />

                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border dark:border-border-dark">
                        <h3 className="font-bold text-lg mb-2 text-center">Tværsnit</h3>
                        {Diagram}
                        <p className="text-center text-sm text-text-secondary dark:text-text-dark-secondary mt-2">
                            Krævet topbredde: <strong className="text-text-primary dark:text-text-dark-primary">{results.topWidth.toFixed(2)} m</strong>
                            {' · '}Setback: <strong className="text-text-primary dark:text-text-dark-primary">{results.setback.toFixed(2)} m</strong> pr. side
                        </p>
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Skråningsanlæg er vejledende. Udgravninger dybere end 1,7 m kræver dokumenteret skråningsanlæg eller
                afstivning jf. Arbejdstilsynets vejledning D.2.17. Kontrollér altid med geoteknisk rapport ved blandede
                jordlag, blødbund eller grundvand.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default ExcavationSlopeCalculator;
