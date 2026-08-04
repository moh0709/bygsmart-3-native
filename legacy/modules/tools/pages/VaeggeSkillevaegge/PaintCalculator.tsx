
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { FileTextIcon } from '../../../../components/icons';
import { computePaintAmount } from '../../catalog';

const PaintCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        area: '50',
        primerCoats: '1',
        primerCoverage: '8',
        paintCoats: '2',
        paintCoverage: '10',
    });
    const [results, setResults] = useState({ primerLiters: 0, paintLiters: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computePaintAmount({
            area: parseFloat(dims.area) || 0,
            primerCoats: parseInt(dims.primerCoats) || 0,
            primerCoverage: parseFloat(dims.primerCoverage) || 0,
            paintCoats: parseInt(dims.paintCoats) || 0,
            paintCoverage: parseFloat(dims.paintCoverage) || 0,
        });
        setResults({ primerLiters: r.primerLiters, paintLiters: r.paintLiters });
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Malings Beregner',
        category: 'Vaegge & Skillevaegge',
        inputs: [
            { label: 'Areal der skal males', value: dims.area, unit: 'm²' },
            { label: 'Grunder – antal lag', value: dims.primerCoats, unit: 'stk.' },
            { label: 'Grunder – dækkeevne', value: dims.primerCoverage, unit: 'm²/L' },
            { label: 'Maling – antal lag', value: dims.paintCoats, unit: 'stk.' },
            { label: 'Maling – dækkeevne', value: dims.paintCoverage, unit: 'm²/L' },
        ],
        results: [
            { label: 'Maling (topstrøg)', value: results.paintLiters.toFixed(1), unit: 'L', highlight: true },
            { label: 'Grunder (primer)', value: results.primerLiters.toFixed(1), unit: 'L' },
        ],
        formula: 'Liter = (Areal × Antal lag) / Dækkeevne',
    }), [dims, results]);

    const BucketVisual: React.FC<{ liters: number, color: string, label: string }> = ({ liters, color, label }) => {
        const largeBuckets = Math.floor(liters / 9);
        const remainder = liters % 9;
        const smallBuckets = Math.ceil(remainder / 2.7); // Approx 2.7L buckets
        
        return (
            <div className="bg-bg-subtle p-4 rounded-lg border border-border mb-3">
                <div className="flex justify-between items-end mb-2">
                    <h4 className="font-semibold text-text-primary">{label}</h4>
                    <span className="text-2xl font-bold text-brand-primary"><AnimatedNumber value={liters} precision={1} /> L</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Array.from({ length: largeBuckets }).map((_, i) => (
                         <div key={`l-${i}`} className="flex flex-col items-center">
                             <div className={`w-10 h-12 rounded-b-md border-2 border-border-strong border-t-0 relative ${color} opacity-90`}>
                                 <div className="absolute -top-1 left-0 right-0 h-1 bg-border-strong rounded-t-sm"></div>
                                 <div className="absolute top-4 left-1 right-1 h-6 bg-white/30 rounded-sm transform rotate-12"></div>
                             </div>
                             <span className="text-caption font-medium mt-1">9L</span>
                         </div>
                    ))}
                    {Array.from({ length: smallBuckets }).map((_, i) => (
                         <div key={`s-${i}`} className="flex flex-col items-center justify-end">
                             <div className={`w-7 h-9 rounded-b-md border-2 border-border-strong border-t-0 relative ${color} opacity-90`}>
                                 <div className="absolute -top-1 left-0 right-0 h-1 bg-border-strong rounded-t-sm"></div>
                             </div>
                             <span className="text-caption font-medium mt-1">2.7L</span>
                         </div>
                    ))}
                    {largeBuckets === 0 && smallBuckets === 0 && <span className="text-sm text-text-tertiary italic">Ingen mængde beregnet</span>}
                </div>
            </div>
        );
    };

    return (
        <CalculatorPage title="Maling & Grunder Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <FileTextIcon className="w-5 h-5 text-brand-primary"/>
                        Indtast Værdier
                    </h3>
                    <InputField label="Areal der skal males" value={dims.area} onChange={e => handleDimChange(e, 'area')} unit="m²" info="Det samlede overfladeareal af vægge og lofter, der skal males."/>
                    
                    <div className="p-4 bg-info-subtle/50 rounded-lg border border-info-border">
                        <h4 className="font-semibold mb-2 text-info-strong">Grunder (Primer)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Antal lag" value={dims.primerCoats} onChange={e => handleDimChange(e, 'primerCoats')} unit="stk." info="Normalt 1 lag grunder på nye overflader."/>
                            <InputField label="Dækkeevne" value={dims.primerCoverage} onChange={e => handleDimChange(e, 'primerCoverage')} unit="m²/L" info="Hvor mange m² dækker 1 liter? Se spanden."/>
                        </div>
                    </div>
                    
                     <div className="p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                        <h4 className="font-semibold mb-2 text-purple-900">Maling (Topstrøg)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Antal lag" value={dims.paintCoats} onChange={e => handleDimChange(e, 'paintCoats')} unit="stk." info="Normalt 2 lag maling for god dækning."/>
                            <InputField label="Dækkeevne" value={dims.paintCoverage} onChange={e => handleDimChange(e, 'paintCoverage')} unit="m²/L" info="Typisk 8-12 m²/L for vægmaling."/>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Indkøbsliste</h3>
                        
                        <BucketVisual liters={results.primerLiters} color="bg-blue-200" label="Grunder" />
                        <BucketVisual liters={results.paintLiters} color="bg-purple-300" label="Maling" />

                        <div className="mt-4 p-3 bg-warning-subtle border border-warning-border rounded-lg text-sm text-warning-strong flex gap-2">
                            <span className="font-bold">!</span>
                            <p>Husk at købe afdækning, tape, ruller og pensler. Ru overflader (f.eks. savsmuldstapet eller vandskuring) kræver ofte 20-30% mere maling.</p>
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default PaintCalculator;
