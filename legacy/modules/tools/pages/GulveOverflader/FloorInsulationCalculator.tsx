
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import ResultDisplay from '../../components/ResultDisplay';
import { computeFloorInsulation } from '../../catalog';

const FloorInsulationCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        areaL: '6', areaW: '5',
        boardL: '1.2', boardW: '0.6'
    });
    const [results, setResults] = useState({ numBoards: 0, totalArea: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeFloorInsulation({
            areaL: parseFloat(dims.areaL) || 0,
            areaW: parseFloat(dims.areaW) || 0,
            boardL: parseFloat(dims.boardL) || 0,
            boardW: parseFloat(dims.boardW) || 0,
        });
        setResults({ numBoards: r.numBoards, totalArea: r.totalArea });
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Gulvisolering',
        category: 'Gulve & Overflader',
        inputs: [
            { label: 'Gulv længde', value: dims.areaL, unit: 'm' },
            { label: 'Gulv bredde', value: dims.areaW, unit: 'm' },
            { label: 'Plade længde', value: dims.boardL, unit: 'm' },
            { label: 'Plade bredde', value: dims.boardW, unit: 'm' },
        ],
        results: [
            { label: 'Antal plader', value: results.numBoards.toFixed(0), unit: 'stk.', highlight: true },
            { label: 'Samlet gulvareal', value: results.totalArea.toFixed(2), unit: 'm²' },
        ],
        formula: 'Antal plader = ⌈Gulvareal / Pladeareal⌉, Gulvareal = Længde × Bredde, Pladeareal = Plade L × Plade B',
    }), [dims, results]);

    return (
        <CalculatorPage title="Gulvisolering Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Gulvareal</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.areaL} onChange={e => handleDimChange(e, 'areaL')} unit="m" info="Længden af gulvet der skal isoleres."/>
                            <InputField label="Bredde" value={dims.areaW} onChange={e => handleDimChange(e, 'areaW')} unit="m" info="Bredden af gulvet der skal isoleres."/>
                        </div>
                    </div>
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2">Isoleringsplade Mål</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField 
                                label="Længde" 
                                value={dims.boardL} 
                                onChange={e => handleDimChange(e, 'boardL')} 
                                unit="m"
                                info="Standardmål for isoleringsplader er ofte 1.2m."
                            />
                            <InputField 
                                label="Bredde" 
                                value={dims.boardW} 
                                onChange={e => handleDimChange(e, 'boardW')} 
                                unit="m"
                                info="Standardmål for isoleringsplader er ofte 0.6m."
                            />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                         <div className="text-center bg-bg-subtle p-4 rounded-lg">
                            <p className="text-sm font-medium text-text-secondary">Antal Plader</p>
                            <div className="text-4xl font-bold text-brand-primary mt-1">
                                <AnimatedNumber value={results.numBoards} precision={0} />
                                <span className="text-3xl ml-1">stk.</span>
                            </div>
                        </div>
                    </div>
                     <div className="bg-white p-4 rounded-card shadow-sm border text-sm text-text-secondary">
                        <h4 className="font-bold text-base text-text-primary mb-2">Tip</h4>
                        <p>Resultatet tager ikke højde for spild ved tilskæring. Det er en god idé at tilføje 5-10% ekstra, hvilket ofte svarer til 1-2 ekstra plader.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default FloorInsulationCalculator;
