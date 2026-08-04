
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';

const BuildingShellAreaCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '10', width: '8', height: '6' });
    const [area, setArea] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        const h = parseFloat(dims.height) || 0;
        const calculatedArea = (2 * l * h) + (2 * w * h);
        setArea(calculatedArea);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Klimaskarm Areal',
        category: 'Areal & Rumfang',
        inputs: [
            { label: 'Bygningens Længde', value: dims.length, unit: 'm' },
            { label: 'Bygningens Bredde', value: dims.width, unit: 'm' },
            { label: 'Bygningens Højde', value: dims.height, unit: 'm' },
        ],
        results: [
            { label: 'Bygningsskal', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: 'A = (2 × L × H) + (2 × B × H)',
    }), [dims, area]);

    return (
        <CalculatorPage title="Bygningsskal Areal" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Bygningsmål</h3>
                    <p className="text-sm text-text-secondary -mb-2">Beregner det samlede areal af de ydre vægge.</p>
                    <InputField label="Bygningens Længde" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" info="Længden af bygningen."/>
                    <InputField label="Bygningens Bredde" value={dims.width} onChange={(e) => handleDimChange(e, 'width')} unit="m" info="Bredden af bygningen."/>
                    <InputField label="Bygningens Højde" value={dims.height} onChange={(e) => handleDimChange(e, 'height')} unit="m" info="Gennemsnitlig højde af facaderne. Ekskluderer gavltrekanter og tag."/>
                </div>
                
                <ResultDisplay 
                    label="Bygningsskal" 
                    value={area} 
                    unit={<>m<sup>2</sup></>} 
                />
            </div>
        </CalculatorPage>
    );
};

export default BuildingShellAreaCalculator;
