
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';

const WaterproofingCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        area: '100',
        rollL: '10',
        rollW: '1',
        overlap: '10',
    });
    const [numRolls, setNumRolls] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const area_m2 = parseFloat(dims.area) || 0;
        const rollL_m = parseFloat(dims.rollL) || 0;
        const rollW_m = parseFloat(dims.rollW) || 0;
        const overlap_pct = parseFloat(dims.overlap) || 0;

        if (area_m2 > 0 && rollL_m > 0 && rollW_m > 0) {
            const effectiveRollArea = rollL_m * rollW_m * (1 - (overlap_pct / 100));
            const rolls = area_m2 / effectiveRollArea;
            setNumRolls(Math.ceil(rolls));
        } else {
            setNumRolls(0);
        }
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Vandtaetning',
        category: 'Lofter & Tag',
        inputs: [
            { label: 'Samlet Tagareal', value: dims.area, unit: 'm²' },
            { label: 'Rullelængde', value: dims.rollL, unit: 'm' },
            { label: 'Rullebredde', value: dims.rollW, unit: 'm' },
            { label: 'Overlap', value: dims.overlap, unit: '%' },
        ],
        results: [
            { label: 'Antal Ruller', value: String(numRolls), unit: 'stk.', highlight: true },
        ],
        formula: 'Effektivt rulleareal = L × B × (1 − overlap/100); Antal ruller = ⌈Tagareal / Effektivt rulleareal⌉',
    }), [dims, numRolls]);

    return (
        <CalculatorPage title="Vandtætning (Tagpap) Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Samlet Tagareal" value={dims.area} onChange={e => handleDimChange(e, 'area')} unit="m²" info="Det samlede areal, der skal dækkes med tagpap."/>
                    <InputField label="Rullelængde" value={dims.rollL} onChange={e => handleDimChange(e, 'rollL')} unit="m" info="Længden af en rulle tagpap."/>
                    <InputField label="Rullebredde" value={dims.rollW} onChange={e => handleDimChange(e, 'rollW')} unit="m" info="Bredden af en rulle tagpap."/>
                    <InputField 
                        label="Overlap" 
                        value={dims.overlap} 
                        onChange={e => handleDimChange(e, 'overlap')} 
                        unit="%"
                        info="Den procentdel af rullens areal, der går tabt til overlap. 10% er et almindeligt estimat."
                    />
                </div>
                
                <ResultDisplay 
                    label="Antal Ruller" 
                    value={numRolls} 
                    precision={0}
                    unit="stk." 
                />
            </div>
        </CalculatorPage>
    );
};

export default WaterproofingCalculator;
