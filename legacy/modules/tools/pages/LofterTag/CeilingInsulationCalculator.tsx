
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeInsulationBatts, getCalculator, catalogHelpToContent } from '../../catalog';

const TOOL_ID = 'loftisolering';
const meta = getCalculator(TOOL_ID);

const CeilingInsulationCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        areaL: '6', areaW: '5',
        battL: '1.2', battW: '0.6',
        wastage: '5',
    });
    const [results, setResults] = useState({ numBatts: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeInsulationBatts({
            areaL: parseFloat(dims.areaL) || 0,
            areaW: parseFloat(dims.areaW) || 0,
            battL: parseFloat(dims.battL) || 0,
            battW: parseFloat(dims.battW) || 0,
        });
        const wastagePct = parseFloat(dims.wastage) || 0;
        setResults({ numBatts: Math.ceil(r.numBatts * (1 + wastagePct / 100)) });
    }, [dims]);

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Loftisolering',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Loftsareal – Længde', value: dims.areaL, unit: 'm' },
            { label: 'Loftsareal – Bredde', value: dims.areaW, unit: 'm' },
            { label: 'Isoleringsbatt Længde', value: dims.battL, unit: 'm' },
            { label: 'Isoleringsbatt Bredde', value: dims.battW, unit: 'm' },
            { label: 'Spild', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal Isoleringsbatts', value: results.numBatts.toFixed(0), unit: 'stk.', highlight: true },
        ],
        formula: 'Antal batts = ⌈(Loftslængde × Loftsbredde) / (Batt-længde × Batt-bredde) × (1 + Spild/100)⌉',
        standardsStruktureret: meta?.standards,
    }), [dims, results]);

    return (
        <CalculatorPage title="Loftisolering Beregner" reportData={reportData} helpContent={helpContent}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Loftsareal</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.areaL} onChange={e => handleDimChange(e, 'areaL')} unit="m" info="Længden af loftet."/>
                            <InputField label="Bredde" value={dims.areaW} onChange={e => handleDimChange(e, 'areaW')} unit="m" info="Bredden af loftet."/>
                        </div>
                    </div>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Isoleringsbatts Mål</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.battL} onChange={e => handleDimChange(e, 'battL')} unit="m" info="Længden på en enkelt isoleringsplade."/>
                            <InputField label="Bredde" value={dims.battW} onChange={e => handleDimChange(e, 'battW')} unit="m" info="Bredden på en enkelt isoleringsplade."/>
                        </div>
                    </div>
                    <InputField label="Spild (%)" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Ekstra batts til tilskæring. 5-10% anbefales, mere hvis loftet har mange hjørner eller gennembrydninger."/>
                </div>

                <div className="space-y-6">
                    <ResultDisplay
                        label="Antal Isoleringsbatts"
                        value={results.numBatts}
                        precision={0}
                        unit="stk."
                    />
                     <div className="bg-white p-4 rounded-card shadow-sm border text-sm text-text-secondary">
                        <h4 className="font-bold text-base text-text-primary mb-2">Husk Spild</h4>
                        <p>Resultatet inkluderer allerede den valgte spildprocent. Justér spildfeltet op, hvis loftet har mange hjørner eller gennembrydninger.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default CeilingInsulationCalculator;
