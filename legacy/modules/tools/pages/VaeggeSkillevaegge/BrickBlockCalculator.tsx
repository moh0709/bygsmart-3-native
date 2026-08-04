
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { BuildingIcon } from '../../../../components/icons';
import { computeBrickBlock } from '../../catalog';

const BrickBlockCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        wallL: '5', wallH: '2.5',
        brickL: '228', brickH: '54',
        joint: '12', wastage: '5',
    });
    const [results, setResults] = useState({ numBricks: 0, mortarVolume: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeBrickBlock({
            wallL: parseFloat(dims.wallL) || 0,
            wallH: parseFloat(dims.wallH) || 0,
            brickLmm: parseFloat(dims.brickL) || 0,
            brickHmm: parseFloat(dims.brickH) || 0,
            jointMm: parseFloat(dims.joint) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
        });
        setResults({ numBricks: r.numBricks, mortarVolume: r.mortarVolume });
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Mursten & Blokke',
        category: 'Vaegge & Skillevaegge',
        inputs: [
            { label: 'Væg længde', value: dims.wallL, unit: 'm' },
            { label: 'Væg højde', value: dims.wallH, unit: 'm' },
            { label: 'Sten/blok længde', value: dims.brickL, unit: 'mm' },
            { label: 'Sten/blok højde', value: dims.brickH, unit: 'mm' },
            { label: 'Fuge tykkelse', value: dims.joint, unit: 'mm' },
            { label: 'Spildfaktor', value: dims.wastage, unit: '%' },
        ],
        results: [
            { label: 'Antal Sten/Blokke', value: results.numBricks.toFixed(0), unit: 'stk.', highlight: true },
            { label: 'Mørtel mængde (ca.)', value: results.mortarVolume.toFixed(3), unit: 'm³' },
        ],
    }), [dims, results]);

     const Diagram = useMemo(() => {
        const bL = parseFloat(dims.brickL) || 228;
        const bH = parseFloat(dims.brickH) || 54;
        const gap = parseFloat(dims.joint) || 12;
        
        // Scale down to fit SVG viewbox
        const scale = 100 / (bL * 2 + gap); 
        const visL = bL * scale;
        const visH = bH * scale;
        const visGap = gap * scale;
        
        return (
            <div className="w-full flex flex-col justify-center items-center p-4">
                 <svg viewBox="0 0 200 100" className="w-full h-auto max-h-[150px] bg-bg-muted border border-border-strong rounded shadow-inner">
                    <defs>
                        <pattern id="brickPattern" x="0" y="0" width={visL+visGap} height={(visH+visGap)*2} patternUnits="userSpaceOnUse">
                             {/* Row 1 */}
                            <rect x="0" y="0" width={visL} height={visH} className="fill-orange-400 stroke-orange-600" strokeWidth="0.5" rx="1" />
                            
                             {/* Row 2 (staggered) */}
                            <rect x={-(visL/2) - (visGap/2)} y={visH+visGap} width={visL} height={visH} className="fill-orange-400 stroke-orange-600" strokeWidth="0.5" rx="1" />
                            <rect x={(visL/2) + (visGap/2)} y={visH+visGap} width={visL} height={visH} className="fill-orange-400 stroke-orange-600" strokeWidth="0.5" rx="1" />
                        </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#brickPattern)" />
                </svg>
                <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> Sten</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-bg-muted border border-border-strong"></div> Fuge ({dims.joint}mm)</span>
                </div>
            </div>
        )
    }, [dims.brickL, dims.brickH, dims.joint]);

    return (
        <CalculatorPage title="Mursten/Blokke Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><BuildingIcon className="w-5 h-5 text-brand-primary"/>Indtast Mål</h3>
                    
                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2 text-sm text-text-secondary">Væg</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.wallL} onChange={e => handleDimChange(e, 'wallL')} unit="m" info="Længden på muren der skal bygges."/>
                            <InputField label="Højde" value={dims.wallH} onChange={e => handleDimChange(e, 'wallH')} unit="m" info="Højden på muren der skal bygges."/>
                        </div>
                    </div>

                    <div className="p-4 bg-bg-subtle rounded-lg">
                        <h4 className="font-semibold mb-2 text-sm text-text-secondary">Sten/Blok</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Længde" value={dims.brickL} onChange={e => handleDimChange(e, 'brickL')} unit="mm" info="Længden på én sten/blok."/>
                            <InputField label="Højde" value={dims.brickH} onChange={e => handleDimChange(e, 'brickH')} unit="mm" info="Højden på én sten/blok."/>
                        </div>
                        <div className="mt-4">
                            <InputField label="Fuge tykkelse" value={dims.joint} onChange={e => handleDimChange(e, 'joint')} unit="mm" info="Standardfuge i Danmark er typisk 12mm." />
                        </div>
                    </div>

                    <InputField label="Spildfaktor" value={dims.wastage} onChange={e => handleDimChange(e, 'wastage')} unit="%" info="Ekstra materiale til brud og tilpasning. 5% er standard." />
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="space-y-4">
                            <div className="text-center bg-warning-subtle p-4 rounded-lg border border-warning-border">
                                <p className="text-sm font-medium text-warning-strong">Antal Sten/Blokke</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.numBricks} precision={0} />
                                    <span className="text-2xl ml-1">stk.</span>
                                </div>
                            </div>
                            <div className="text-center bg-bg-subtle p-4 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Mørtel Mængde (ca.)</p>
                                <div className="text-3xl font-bold text-text-primary mt-1">
                                    <AnimatedNumber value={results.mortarVolume} precision={3} />
                                    <span className="text-2xl ml-1">m³</span>
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="bg-white p-4 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-2 text-center">Forbandt Preview</h3>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default BrickBlockCalculator;
