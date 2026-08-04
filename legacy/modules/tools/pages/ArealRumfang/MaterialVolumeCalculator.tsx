
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';

const MaterialVolumeCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '5', width: '3', depth: '0.1' });
    const [volume, setVolume] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        const d = parseFloat(dims.depth) || 0;
        setVolume(l * w * d);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Materialevolumen',
        category: 'Areal & Rumfang',
        inputs: [
            { label: 'Længde', value: dims.length, unit: 'm' },
            { label: 'Bredde', value: dims.width, unit: 'm' },
            { label: 'Dybde / Tykkelse', value: dims.depth, unit: 'm' },
        ],
        results: [
            { label: 'Nødvendig Volumen', value: volume.toFixed(3), unit: 'm³', highlight: true },
        ],
        formula: 'V = Længde × Bredde × Dybde',
    }), [dims, volume]);

    return (
        <CalculatorPage title="Materialevolumen Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål for Området</h3>
                    <p className="text-sm text-text-secondary -mb-2">Beregner volumen af materialer som beton, grus eller jord.</p>
                    <InputField label="Længde" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" info="Områdets længde."/>
                    <InputField label="Bredde" value={dims.width} onChange={(e) => handleDimChange(e, 'width')} unit="m" info="Områdets bredde."/>
                    <InputField 
                        label="Dybde / Tykkelse" 
                        value={dims.depth} 
                        onChange={(e) => handleDimChange(e, 'depth')} 
                        unit="m" 
                        info="Angiv tykkelsen på det lag materiale, du skal bruge (f.eks. 0,1 m for et 10 cm betonlag)."
                    />
                </div>
                
                <ResultDisplay 
                    label="Nødvendig Volumen" 
                    value={volume} 
                    precision={3}
                    unit={<>m<sup>3</sup></>} 
                />
            </div>
        </CalculatorPage>
    );
};

export default MaterialVolumeCalculator;
