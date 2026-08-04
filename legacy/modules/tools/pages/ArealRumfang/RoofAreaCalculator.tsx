
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';

type RoofType = 'gable'; // Add 'shed', 'hip' later

const RoofAreaCalculator: React.FC = () => {
    const [roofType, setRoofType] = useState<RoofType>('gable');
    const [dims, setDims] = useState({ length: '10', span: '8', pitch: '35' });
    const [area, setArea] = useState(0);
    const [focusedInput, setFocusedInput] = useState<string|null>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const l = parseFloat(dims.length) || 0;
        const span = parseFloat(dims.span) || 0;
        const pitch = parseFloat(dims.pitch) || 0;

        if (roofType === 'gable' && l > 0 && span > 0 && pitch > 0) {
            const pitchRadians = (pitch * Math.PI) / 180;
            const rafterLength = (span / 2) / Math.cos(pitchRadians);
            const calculatedArea = rafterLength * l * 2;
            setArea(calculatedArea);
        } else {
            setArea(0);
        }
    }, [roofType, dims]);
    
    const Diagram = useMemo(() => {
        const baseClass = "transition-all duration-300";
        const focusedClass = "fill-brand-primary font-bold";
        const normalClass = "fill-text-secondary";

        const pitch = Math.max(5, Math.min(parseFloat(dims.pitch) || 0, 85));
        const span = Math.max(parseFloat(dims.span) || 0, 1);
        const height = (span/2) * Math.tan(pitch * Math.PI / 180);
        
        return (
            <div className="w-full flex justify-center items-center p-4">
                <svg viewBox={`-4 -4 ${span+8} ${height+8}`} className="w-full h-auto max-h-[150px] transition-all duration-300" preserveAspectRatio="xMidYMid meet">
                    <path d={`M0,${height} L${span/2},0 L${span},${height} Z`} className="fill-blue-100 stroke-brand-primary" strokeWidth="0.1" />
                    <text x={span/2} y={height + 0.8} textAnchor="middle" className={`${baseClass} text-[0.5px] ${focusedInput === 'span' ? focusedClass : normalClass}`}>Spændvidde: {dims.span || 'B'}</text>
                    
                    {/* Arc for angle */}
                    <path d={`M ${span/2 - 0.5},${height} A 0.5 0.5 0 0 1 ${span/2 - 0.5 * Math.cos(pitch * Math.PI/180)}, ${height - 0.5 * Math.sin(pitch * Math.PI/180)}`} fill="none" stroke="currentColor" strokeWidth="0.05" className={`${baseClass} ${focusedInput === 'pitch' ? 'stroke-brand-primary' : 'stroke-text-secondary/50'}`} />
                    <text x={span/2-0.7} y={height-0.2} textAnchor="end" className={`${baseClass} text-[0.3px] ${focusedInput === 'pitch' ? focusedClass : normalClass}`}>{dims.pitch}°</text>
                    
                    <text x={-0.5} y={height/2} textAnchor="end" className={`${baseClass} text-[0.5px] ${focusedInput === 'length' ? focusedClass : normalClass}`} transform={`rotate(-90, -0.5, ${height/2})`}>Længde: {dims.length || 'L'}</text>
                </svg>
            </div>
        );
    }, [dims, focusedInput]);


    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Tagareal Beregner',
        category: 'Areal & Rumfang',
        mode: roofType === 'gable' ? 'Saddeltag' : roofType,
        inputs: [
            { label: 'Bygningens Længde (L)', value: dims.length, unit: 'm' },
            { label: 'Spændvidde (B)', value: dims.span, unit: 'm' },
            { label: 'Taghældning', value: dims.pitch, unit: '°' },
        ],
        results: [
            { label: 'Samlet Tagareal', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: 'Areal = 2 × (spændvidde/2 / cos(taghældning°)) × længde',
    }), [roofType, dims, area]);

    return (
        <CalculatorPage title="Tagareal Beregner" reportData={reportData}>
             <div className="bg-white p-4 rounded-card shadow-sm border">
                <SegmentedControl options={[{ label: 'Saddeltag', value: 'gable' }]} value={roofType} onChange={(value) => setRoofType(value)} />
                <p className="text-center text-xs text-text-secondary mt-2">Yderligere tagtyper tilføjes i en kommende opdatering.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Bygningsmål</h3>
                    <InputField name="length" label="Bygningens Længde (L)" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Bygningens længde ved tagfoden (den lange led)."/>
                    <InputField name="span" label="Spændvidde (B)" value={dims.span} onChange={(e) => handleDimChange(e, 'span')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Bygningens totale bredde fra gavl til gavl inklusiv udhæng."/>
                    <InputField name="pitch" label="Taghældning" value={dims.pitch} onChange={(e) => handleDimChange(e, 'pitch')} unit="°" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Vinklen på taget i grader. Et fladt tag er 0°, et saddeltag er ofte 45°."/>
                </div>
                
                <div className="space-y-6">
                    <ResultDisplay label="Samlet Tagareal" value={area} unit={<>m<sup>2</sup></>} />
                    <div className="bg-white p-4 rounded-card shadow-sm border relative"><h3 className="font-bold text-lg mb-2 text-center">Visuel Repræsentation</h3>{Diagram}</div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default RoofAreaCalculator;
