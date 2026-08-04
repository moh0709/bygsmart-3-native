
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeInsulationBatts } from '../../catalog';

const WallInsulationCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        areaL: '8', areaW: '2.5',
        battL: '1.2', battW: '0.6'
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
        setResults({ numBatts: r.numBatts });
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Vaegisolering',
        category: 'Vaegge & Skillevaegge',
        inputs: [
            { label: 'Væggens længde', value: dims.areaL, unit: 'm' },
            { label: 'Væggens højde', value: dims.areaW, unit: 'm' },
            { label: 'Isoleringsplade længde', value: dims.battL, unit: 'm' },
            { label: 'Isoleringsplade bredde', value: dims.battW, unit: 'm' },
        ],
        results: [
            { label: 'Antal isoleringsbatts', value: String(results.numBatts), unit: 'stk.', highlight: true },
        ],
        formula: 'Antal batts = ⌈(Væggens areal) / (Batt areal)⌉',
    }), [dims, results]);

    return (
        <CalculatorPage title="Vægisolering Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Vægareal</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.areaL} onChange={e => handleDimChange(e, 'areaL')} unit="m" info="Væggens længde."/>
                            <InputField label="Højde" value={dims.areaW} onChange={e => handleDimChange(e, 'areaW')} unit="m" info="Væggens højde."/>
                        </div>
                    </div>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Isoleringsbatts Mål</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.battL} onChange={e => handleDimChange(e, 'battL')} unit="m" info="Længden på en isoleringsplade."/>
                            <InputField label="Bredde" value={dims.battW} onChange={e => handleDimChange(e, 'battW')} unit="m" info="Bredden på en isoleringsplade."/>
                        </div>
                    </div>
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
                        <p>Resultatet tager ikke højde for spild ved tilskæring. Det er en god idé at tilføje 5-10% ekstra, især hvis væggen har vinduer, døre eller andre gennembrydninger.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default WallInsulationCalculator;
