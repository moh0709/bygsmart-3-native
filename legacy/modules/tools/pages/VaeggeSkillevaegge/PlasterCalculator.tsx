
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computePlasterAmount } from '../../catalog';

const PlasterCalculator: React.FC = () => {
    const [dims, setDims] = useState({ area: '50', thickness: '2', yield: '1' });
    const [totalKg, setTotalKg] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computePlasterAmount({
            area: parseFloat(dims.area) || 0,
            thicknessMm: parseFloat(dims.thickness) || 0,
            yieldKgPerM2PerMm: parseFloat(dims.yield) || 0,
        });
        setTotalKg(r.totalKg);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Puds Beregner',
        category: 'Vaegge & Skillevaegge',
        inputs: [
            { label: 'Areal', value: dims.area, unit: 'm²' },
            { label: 'Lagtykkelse', value: dims.thickness, unit: 'mm' },
            { label: 'Forbrug pr. m² pr. mm', value: dims.yield, unit: 'kg' },
        ],
        results: [
            { label: 'Total Mængde', value: totalKg.toFixed(1), unit: 'kg', highlight: true },
        ],
        formula: 'Total (kg) = Areal (m²) × Lagtykkelse (mm) × Forbrug (kg/m²/mm)',
    }), [dims, totalKg]);

    return (
        <CalculatorPage title="Puds & Spartel Mængdeberegner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Værdier</h3>
                    <InputField label="Areal" value={dims.area} onChange={e => handleDimChange(e, 'area')} unit="m²" info="Det samlede areal af vægge og lofter der skal behandles."/>
                    <InputField label="Lagtykkelse" value={dims.thickness} onChange={e => handleDimChange(e, 'thickness')} unit="mm" info="Den gennemsnitlige tykkelse af laget."/>
                    <InputField 
                        label="Forbrug pr. m² pr. mm" 
                        value={dims.yield} 
                        onChange={e => handleDimChange(e, 'yield')} 
                        unit="kg"
                        info="Dette er produktets specifikke forbrug, som findes på databladet. En typisk værdi for spartelmasse er ca. 1 kg/m²/mm."
                    />
                </div>
                
                <ResultDisplay 
                    label="Total Mængde" 
                    value={totalKg} 
                    precision={1}
                    unit="kg" 
                />
            </div>
        </CalculatorPage>
    );
};

export default PlasterCalculator;
