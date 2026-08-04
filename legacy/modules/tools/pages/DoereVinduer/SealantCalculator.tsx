
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';

const SealantCalculator: React.FC = () => {
    const [dims, setDims] = useState({
        length: '2.1',
        width: '0.9',
        jointWidth: '10',
        jointDepth: '5',
        cartridgeVolume: '300',
    });
    const [results, setResults] = useState({ totalLength: 0, cartridges: 0 });

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const length_m = parseFloat(dims.length) || 0;
        const width_m = parseFloat(dims.width) || 0;
        const jointW_mm = parseFloat(dims.jointWidth) || 0;
        const jointD_mm = parseFloat(dims.jointDepth) || 0;
        const cartridgeVol_ml = parseFloat(dims.cartridgeVolume) || 0;

        if (length_m > 0 && width_m > 0 && jointW_mm > 0 && jointD_mm > 0 && cartridgeVol_ml > 0) {
            const perimeter_m = 2 * (length_m + width_m);
            const jointVolume_mm3 = perimeter_m * 1000 * jointW_mm * jointD_mm;
            const jointVolume_ml = jointVolume_mm3 / 1000;
            const numCartridges = jointVolume_ml / cartridgeVol_ml;
            
            setResults({ totalLength: perimeter_m, cartridges: numCartridges });
        } else {
            setResults({ totalLength: 0, cartridges: 0 });
        }
    }, [dims]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Fugemasse Beregner',
        category: 'Dore & Vinduer',
        inputs: [
            { label: 'Højde på Åbning', value: dims.length, unit: 'm' },
            { label: 'Bredde på Åbning', value: dims.width, unit: 'm' },
            { label: 'Fugebredde', value: dims.jointWidth, unit: 'mm' },
            { label: 'Fugedybde', value: dims.jointDepth, unit: 'mm' },
            { label: 'Patron Størrelse', value: dims.cartridgeVolume, unit: 'ml' },
        ],
        results: [
            { label: 'Antal Patroner', value: String(Math.ceil(results.cartridges)), unit: 'stk.', highlight: true },
            { label: 'Samlet fugelængde', value: results.totalLength.toFixed(1), unit: 'm' },
        ],
        formula: 'Omkreds = 2 × (højde + bredde); Volumen (ml) = Omkreds (m) × 1000 × fugebredde (mm) × fugedybde (mm) / 1000; Patroner = ⌈Volumen / patronstørrelse⌉',
    }), [dims, results]);

    return (
        <CalculatorPage title="Fugemasse Beregner" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <InputField label="Højde på Åbning" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Højden på dør- eller vindueshullet."/>
                    <InputField label="Bredde på Åbning" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Bredden på dør- eller vindueshullet."/>
                    <InputField label="Fugebredde" value={dims.jointWidth} onChange={e => handleDimChange(e, 'jointWidth')} unit="mm" info="Bredden på fugen. Normalt 10-15mm rundt om vinduer/døre."/>
                    <InputField label="Fugedybde" value={dims.jointDepth} onChange={e => handleDimChange(e, 'jointDepth')} unit="mm" info="Dybden bør typisk være det halve af bredden, dog mindst 6mm."/>
                    <InputField label="Patron Størrelse" value={dims.cartridgeVolume} onChange={e => handleDimChange(e, 'cartridgeVolume')} unit="ml" info="Standardstørrelsen for en fugepatron er typisk 300 ml (310 ml)."/>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="space-y-4">
                            <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Samlet fugelængde</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.totalLength} precision={1} />
                                    <span className="text-2xl ml-1">m</span>
                                </div>
                            </div>
                            <div className="text-center bg-bg-subtle p-3 rounded-lg">
                                <p className="text-sm font-medium text-text-secondary">Antal Patroner</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={Math.ceil(results.cartridges)} precision={0} />
                                    <span className="text-2xl ml-1">stk.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default SealantCalculator;
