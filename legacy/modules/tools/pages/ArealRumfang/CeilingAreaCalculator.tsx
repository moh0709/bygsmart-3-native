
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';

const CeilingAreaCalculator: React.FC = () => {
    const [dims, setDims] = useState({ length: '5', width: '3' });
    const [area, setArea] = useState(0);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const w = parseFloat(dims.width) || 0;
        setArea(l * w);
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Loftareal Beregner',
        category: 'Areal & Rumfang',
        inputs: [
            { label: 'Længde', value: dims.length, unit: 'm' },
            { label: 'Bredde', value: dims.width, unit: 'm' },
        ],
        results: [
            { label: 'Loftsareal', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: 'Areal = Længde × Bredde',
    }), [dims, area]);

    const Diagram = useMemo(() => {
        const baseClass = "transition-all duration-300";
        const focusedClass = "fill-brand-primary font-bold";
        const normalClass = "fill-text-secondary";
        const l = Math.max(parseFloat(dims.length) || 0, 1);
        const w = Math.max(parseFloat(dims.width) || 0, 1);
        const viewBoxWidth = l + 4;
        const viewBoxHeight = w + 4;

        return (
            <div className="w-full flex justify-center items-center p-4">
                <svg viewBox={`-4 -4 ${viewBoxWidth + 4} ${viewBoxHeight + 4}`} className="w-full h-auto max-h-[150px] transition-all duration-300" preserveAspectRatio="xMidYMid meet">
                    <rect x="0" y="0" width={l} height={w} className="fill-blue-100 stroke-brand-primary" strokeWidth="0.1" />
                    <text x={l/2} y={-0.5} textAnchor="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'length' ? focusedClass : normalClass}`}>{dims.length || 'Længde'}</text>
                    <text x={-0.5} y={w/2} textAnchor="end" dominantBaseline="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'width' ? focusedClass : normalClass}`}>{dims.width || 'Bredde'}</text>
                </svg>
            </div>
        );
    }, [dims, focusedInput]);

    return (
        <CalculatorPage title="Loftsareal Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Rummål</h3>
                    <InputField name="length" label="Længde" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Mål længden af loftet fra væg til væg."/>
                    <InputField name="width" label="Bredde" value={dims.width} onChange={(e) => handleDimChange(e, 'width')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Mål bredden af loftet fra væg til væg."/>
                </div>
                
                <div className="space-y-6">
                    <ResultDisplay 
                        label="Loftsareal" 
                        value={area} 
                        unit={<>m<sup>2</sup></>} 
                    />
                     <div className="bg-white p-4 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-2 text-center">Visuel Repræsentation</h3>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default CeilingAreaCalculator;
