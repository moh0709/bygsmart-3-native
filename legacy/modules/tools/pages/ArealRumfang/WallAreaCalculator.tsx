
import React, { useState, useEffect, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { computeWallAreaWithDeductions, getCalculator, catalogHelpToContent } from '../../catalog';

const meta = getCalculator('vaegareal');

const WallAreaCalculator: React.FC = () => {
    const vizRef = useRef<SVGSVGElement>(null);
    const [dims, setDims] = useState({ length: '5', width: '4', height: '2.5' });
    const [deductions, setDeductions] = useState({
        numDoors: '1', doorW: '0.9', doorH: '2.1',
        numWindows: '2', windowW: '1.2', windowH: '1.2'
    });
    const [showDeductions, setShowDeductions] = useState(false);
    const [totalArea, setTotalArea] = useState(0);
    const [netArea, setNetArea] = useState(0);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };
    const handleDeductionChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof deductions) => {
        setDeductions(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const r = computeWallAreaWithDeductions({
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            height: parseFloat(dims.height) || 0,
            doors: showDeductions ? (parseInt(deductions.numDoors) || 0) : 0,
            doorW: parseFloat(deductions.doorW) || 0,
            doorH: parseFloat(deductions.doorH) || 0,
            windows: showDeductions ? (parseInt(deductions.numWindows) || 0) : 0,
            windowW: parseFloat(deductions.windowW) || 0,
            windowH: parseFloat(deductions.windowH) || 0,
        });
        setTotalArea(r.grossArea);
        setNetArea(r.netArea);
    }, [dims, deductions, showDeductions]);

    const helpContent = useMemo(() =>
        meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined,
    []);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Vægareal Beregner',
        category: meta?.category,
        inputs: [
            { label: 'Rumlængde', value: dims.length, unit: 'm' },
            { label: 'Rumbredde', value: dims.width, unit: 'm' },
            { label: 'Loftshøjde', value: dims.height, unit: 'm' },
            ...(showDeductions ? [
                { label: 'Antal døre', value: deductions.numDoors },
                { label: 'Dørbredde', value: deductions.doorW, unit: 'm' },
                { label: 'Dørhøjde', value: deductions.doorH, unit: 'm' },
                { label: 'Antal vinduer', value: deductions.numWindows },
                { label: 'Vinduesbredde', value: deductions.windowW, unit: 'm' },
                { label: 'Vindsueshøjde', value: deductions.windowH, unit: 'm' },
            ] : []),
        ],
        results: [
            { label: 'Brutto Vægareal', value: totalArea.toFixed(2), unit: 'm²' },
            { label: 'Netto Vægareal', value: netArea.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: vizRef,
    }), [dims, deductions, showDeductions, totalArea, netArea]);

    const Diagram = useMemo(() => {
        const h = parseFloat(dims.height) || 2.5;
        const l = parseFloat(dims.length) || 5;
        return (
            <div className="w-full flex justify-center items-center p-4">
                <svg ref={vizRef} viewBox={`0 0 ${l} ${h}`} className="w-full h-auto max-h-[150px] bg-bg-muted border border-border-strong">
                    <rect x="0" y="0" width={l} height={h} className="fill-blue-50 stroke-brand-primary" strokeWidth="0.05" />
                    {showDeductions && parseInt(deductions.numDoors) > 0 && (
                        <rect
                            x={l * 0.2}
                            y={h - (parseFloat(deductions.doorH) || 2.1)}
                            width={parseFloat(deductions.doorW) || 0.9}
                            height={parseFloat(deductions.doorH) || 2.1}
                            className="fill-white stroke-red-400 stroke-dashed"
                            strokeWidth="0.02"
                        />
                    )}
                    {showDeductions && parseInt(deductions.numWindows) > 0 && (
                        <rect
                            x={l * 0.6}
                            y={h * 0.3}
                            width={parseFloat(deductions.windowW) || 1.2}
                            height={parseFloat(deductions.windowH) || 1.2}
                            className="fill-white stroke-red-400 stroke-dashed"
                            strokeWidth="0.02"
                        />
                    )}
                    <text x={l/2} y={h-0.2} textAnchor="middle" className="text-[0.15px] fill-text-secondary">Væg Længde: {l}m</text>
                    <text x={0.2} y={h/2} textAnchor="middle" writingMode="tb" className="text-[0.15px] fill-text-secondary">Højde: {h}m</text>
                </svg>
            </div>
        );
    }, [dims, deductions, showDeductions]);

    return (
        <CalculatorPage
            title="Vægareal Beregner"
            helpContent={helpContent}
            reportData={reportData}
            shareValue={`Netto: ${netArea.toFixed(2)} m² · Brutto: ${totalArea.toFixed(2)} m²`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                        <h3 className="font-bold text-lg">Indtast Rummål</h3>
                        <InputField label="Rum Længde" value={dims.length} onChange={(e) => handleDimChange(e, 'length')} unit="m" info="Mål længden af rummet."/>
                        <InputField label="Rum Bredde" value={dims.width} onChange={(e) => handleDimChange(e, 'width')} unit="m" info="Mål bredden af rummet."/>
                        <InputField label="Rum Højde" value={dims.height} onChange={(e) => handleDimChange(e, 'height')} unit="m" info="Højden fra gulv til loft." />
                    </div>

                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-lg">Fratræk Areal (Døre/Vinduer)</h3>
                             <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={showDeductions} onChange={() => setShowDeductions(!showDeductions)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-border-strong rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                            </label>
                        </div>
                        {showDeductions && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="p-4 bg-bg-subtle rounded-lg">
                                    <h4 className="font-semibold mb-2">Døre</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <InputField label="Antal" value={deductions.numDoors} onChange={e => handleDeductionChange(e, 'numDoors')} unit="" />
                                        <InputField label="Bredde" value={deductions.doorW} onChange={e => handleDeductionChange(e, 'doorW')} unit="m" />
                                        <InputField label="Højde" value={deductions.doorH} onChange={e => handleDeductionChange(e, 'doorH')} unit="m" />
                                    </div>
                                </div>
                                <div className="p-4 bg-bg-subtle rounded-lg">
                                    <h4 className="font-semibold mb-2">Vinduer</h4>
                                    <div className="grid grid-cols-3 gap-2">
                                        <InputField label="Antal" value={deductions.numWindows} onChange={e => handleDeductionChange(e, 'numWindows')} unit="" />
                                        <InputField label="Bredde" value={deductions.windowW} onChange={e => handleDeductionChange(e, 'windowW')} unit="m" />
                                        <InputField label="Højde" value={deductions.windowH} onChange={e => handleDeductionChange(e, 'windowH')} unit="m" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-4 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-2 text-center">Visuel Repræsentation (1 Væg)</h3>
                        {Diagram}
                    </div>
                    <ResultDisplay
                        label="Brutto Vægareal"
                        value={totalArea}
                        unit={<>m<sup>2</sup></>}
                    />
                    {showDeductions &&
                        <div className="animate-fade-in">
                            <ResultDisplay
                                label="Netto Vægareal"
                                value={netArea}
                                unit={<>m<sup>2</sup></>}
                            />
                        </div>
                    }
                </div>
            </div>
        </CalculatorPage>
    );
};

export default WallAreaCalculator;
