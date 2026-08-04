
import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeBackfill, getCalculator, catalogHelpToContent } from '../../catalog';

const meta = getCalculator('udgravning-jord-tilbagefyldning');

const BackfillCalculator: React.FC = () => {
    const [inputs, setInputs] = useState({
        excavatedVol: '50',
        structureVol: '10',
        compactionPct: '15',
    });

    const vizRef = useRef<SVGSVGElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    const results = useMemo(() => {
        const r = computeBackfill({
            excavatedVol: parseFloat(inputs.excavatedVol) || 0,
            structureVol: parseFloat(inputs.structureVol) || 0,
            compactionPct: parseFloat(inputs.compactionPct) || 0,
        });
        return r;
    }, [inputs]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: meta?.name ?? 'Tilbagefyldning',
        category: meta?.category,
        inputs: [
            { label: 'Udgravningsvolumen', value: inputs.excavatedVol, unit: 'm³' },
            { label: 'Konstruktionsvolumen', value: inputs.structureVol, unit: 'm³' },
            { label: 'Komprimeringstillæg', value: inputs.compactionPct, unit: '%' },
        ],
        results: [
            { label: 'Nødvendigt materiale (løst)', value: results.looseNeeded.toFixed(2), unit: 'm³', highlight: true },
            { label: 'Nettofyld', value: results.netFill.toFixed(2), unit: 'm³' },
            { label: 'Overskudsjord', value: results.excess.toFixed(2), unit: 'm³' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: vizRef,
    }), [inputs, results]);

    // Visualization: proportional volume bar diagram
    const excavatedVol = parseFloat(inputs.excavatedVol) || 0;
    const structureVol = parseFloat(inputs.structureVol) || 0;
    const maxVol = Math.max(excavatedVol, 1);
    const svgW = 300;
    const svgH = 80;
    const barH = 28;
    const excavatedW = (excavatedVol / maxVol) * (svgW - 60);
    const structureW = (structureVol / maxVol) * (svgW - 60);
    const netFillW = (results.netFill / maxVol) * (svgW - 60);
    const looseW = (results.looseNeeded / maxVol) * (svgW - 60);

    return (
        <CalculatorPage
            title={meta?.name ?? 'Tilbagefyldning'}
            helpContent={helpContent}
            reportData={reportData}
            shareValue={results.looseNeeded > 0 ? `${results.looseNeeded.toFixed(2)} m³ løst fyldmateriale` : undefined}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Volumener</h3>
                    <p className="text-sm text-text-secondary -mb-2">Beregn hvor meget jord/sand du skal bestille for at fylde et hul op igen.</p>

                    <InputField label="Udgravningens Volumen" value={inputs.excavatedVol} onChange={e => handleInputChange(e, 'excavatedVol')} unit="m³" info="Det totale volumen af det udgravede hul." />
                    <InputField
                        label="Volumen af indbygget emne"
                        value={inputs.structureVol}
                        onChange={e => handleInputChange(e, 'structureVol')}
                        unit="m³"
                        info="Volumen af f.eks. tank, rør, kælder eller fundament, der optager plads i hullet."
                    />
                    <InputField
                        label="Komprimeringstillæg"
                        value={inputs.compactionPct}
                        onChange={e => handleInputChange(e, 'compactionPct')}
                        unit="%"
                        info="Sand/grus: ~10%, ler: ~20%. Løst materiale fylder mere end komprimeret."
                    />
                </div>

                <div className="space-y-6">
                    <ResultDisplay
                        label="Nødvendigt Materiale (Løst mål)"
                        value={results.looseNeeded}
                        unit={<>m<sup>3</sup></>}
                    />
                    {results.netFill > 0 && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border text-center">
                                <p className="text-xs text-text-secondary mb-1">Nettofyld</p>
                                <p className="text-2xl font-bold text-text-primary">{results.netFill.toFixed(2)} m³</p>
                            </div>
                            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border text-center">
                                <p className="text-xs text-text-secondary mb-1">Overskudsjord</p>
                                <p className="text-2xl font-bold text-text-primary">{results.excess.toFixed(2)} m³</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {excavatedVol > 0 && (
                <div className="mt-6 bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                    <h3 className="font-bold text-lg mb-4">Volumenoversigt</h3>
                    <div className="overflow-x-auto">
                        <svg ref={vizRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
                            {/* Udgravning */}
                            <text x="0" y="12" fontSize="9" fill="#374151">Udgravning</text>
                            <rect x="60" y="0" width={excavatedW} height={barH - 4} rx="3" fill="#93c5fd" stroke="#3b82f6" strokeWidth="0.5" />
                            <text x={60 + excavatedW + 4} y="12" fontSize="9" fill="#374151">{excavatedVol.toFixed(1)} m³</text>

                            {/* Konstruktion */}
                            <text x="0" y="12" dy="20" fontSize="9" fill="#374151">Konstruktion</text>
                            <rect x="60" y={barH} width={structureW} height={barH - 4} rx="3" fill="#fca5a5" stroke="#ef4444" strokeWidth="0.5" />
                            <text x={60 + structureW + 4} y={barH + 12} fontSize="9" fill="#374151">{structureVol.toFixed(1)} m³</text>

                            {/* Nettofyld */}
                            <text x="0" y="12" dy="40" fontSize="9" fill="#374151">Nettofyld</text>
                            <rect x="60" y={barH * 2} width={netFillW} height={barH - 4} rx="3" fill="#6ee7b7" stroke="#10b981" strokeWidth="0.5" />
                            <text x={60 + netFillW + 4} y={barH * 2 + 12} fontSize="9" fill="#374151">{results.netFill.toFixed(2)} m³</text>

                            {/* Løst behov */}
                            {looseW > 0 && (
                                <>
                                    <text x="0" y="12" dy="60" fontSize="9" fill="#374151">Løs bestilling</text>
                                    <rect x="60" y={barH * 3 - barH / 2} width={looseW} height={barH - 4} rx="3" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.5" />
                                    <text x={60 + looseW + 4} y={barH * 3 - barH / 2 + 12} fontSize="9" fill="#374151">{results.looseNeeded.toFixed(2)} m³</text>
                                </>
                            )}
                        </svg>
                    </div>
                    <p className="text-xs text-text-secondary mt-2">Dette er mængden du skal bestille fra grusgraven (løst mål).</p>
                </div>
            )}
        </CalculatorPage>
    );
};

export default BackfillCalculator;
