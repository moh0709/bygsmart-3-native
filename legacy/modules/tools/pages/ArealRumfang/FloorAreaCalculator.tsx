
import React, { useState, useEffect, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import { getCalculator, catalogHelpToContent } from '../../catalog';

const meta = getCalculator('rumareal');

type Shape = 'rectangle' | 'l-shape';

const FloorAreaCalculator: React.FC = () => {
    const vizRef = useRef<SVGSVGElement>(null);
    const [shape, setShape] = useState<Shape>('rectangle');
    const [dims, setDims] = useState({
        rectL: '5', rectW: '3',
        lShapeA: '4', lShapeB: '2', lShapeC: '2', lShapeD: '3'
    });
    const [area, setArea] = useState(0);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const helpContent = useMemo(() =>
        meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined,
    []);

    useEffect(() => {
        let calculatedArea = 0;
        if (shape === 'rectangle') {
            const l = parseFloat(dims.rectL) || 0;
            const w = parseFloat(dims.rectW) || 0;
            calculatedArea = l * w;
        } else {
            const a = parseFloat(dims.lShapeA) || 0;
            const b = parseFloat(dims.lShapeB) || 0;
            const c = parseFloat(dims.lShapeC) || 0;
            const d = parseFloat(dims.lShapeD) || 0;
            calculatedArea = (a * (b + d)) + ((c - a) * d);
        }
        setArea(calculatedArea);
    }, [shape, dims]);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Gulvareal Beregner',
        category: meta?.category,
        inputs: shape === 'rectangle'
            ? [
                { label: 'Længde', value: dims.rectL, unit: 'm' },
                { label: 'Bredde', value: dims.rectW, unit: 'm' },
            ]
            : [
                { label: 'Side A', value: dims.lShapeA, unit: 'm' },
                { label: 'Side B', value: dims.lShapeB, unit: 'm' },
                { label: 'Side C', value: dims.lShapeC, unit: 'm' },
                { label: 'Side D', value: dims.lShapeD, unit: 'm' },
            ],
        results: [
            { label: 'Gulvareal', value: area.toFixed(2), unit: 'm²', highlight: true },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        infographicRef: vizRef,
    }), [shape, dims, area]);

     const Diagram = useMemo(() => {
        const baseClass = "transition-all duration-300";
        const focusedClass = "fill-brand-primary font-bold";
        const normalClass = "fill-text-secondary";

        if (shape === 'rectangle') {
            const l = Math.max(parseFloat(dims.rectL) || 0, 1);
            const w = Math.max(parseFloat(dims.rectW) || 0, 1);
            const viewBoxWidth = l + 4;
            const viewBoxHeight = w + 4;

            return (
                 <svg ref={vizRef} viewBox={`-4 -4 ${viewBoxWidth + 4} ${viewBoxHeight + 4}`} className="w-full h-auto max-h-[150px] transition-all duration-300" preserveAspectRatio="xMidYMid meet">
                    <rect x="0" y="0" width={l} height={w} className="fill-blue-100 stroke-brand-primary" strokeWidth="0.1" />
                    <text x={l/2} y={-0.5} textAnchor="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'rectL' ? focusedClass : normalClass}`}>{dims.rectL || 'Længde'}</text>
                    <text x={-0.5} y={w/2} textAnchor="end" dominantBaseline="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'rectW' ? focusedClass : normalClass}`}>{dims.rectW || 'Bredde'}</text>
                </svg>
            );
        } else {
            const a = Math.max(parseFloat(dims.lShapeA) || 0, 1);
            const b = Math.max(parseFloat(dims.lShapeB) || 0, 1);
            const c = Math.max(parseFloat(dims.lShapeC) || 0, 1);
            const d = Math.max(parseFloat(dims.lShapeD) || 0, 1);
            const totalWidth = c;
            const totalHeight = b + d;
            const viewBoxWidth = totalWidth + 4;
            const viewBoxHeight = totalHeight + 4;

            return (
                 <svg ref={vizRef} viewBox={`-4 -4 ${viewBoxWidth + 4} ${viewBoxHeight + 4}`} className="w-full h-auto max-h-[150px] transition-all duration-300" preserveAspectRatio="xMidYMid meet">
                    <path d={`M0,0 H${a} V${b} H${c} V${totalHeight} H0 V0 Z`} className="fill-blue-100 stroke-brand-primary" strokeWidth="0.1" />
                    <text x={a/2} y={-0.5} textAnchor="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'lShapeA' ? focusedClass : normalClass}`}>{dims.lShapeA || 'A'}</text>
                    <text x={a} y={b/2} dominantBaseline="middle" textAnchor="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'lShapeB' ? focusedClass : normalClass}`}>{dims.lShapeB || 'B'}</text>
                    <text x={c+0.5} y={b + d/2} textAnchor="start" dominantBaseline="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'lShapeD' ? focusedClass : normalClass}`}>{dims.lShapeD || 'D'}</text>
                    <text x={a + (c-a)/2} y={b-0.5} textAnchor="middle" className={`${baseClass} text-[1px] sm:text-[1.5px] ${focusedInput === 'lShapeC' ? focusedClass : normalClass}`}>{dims.lShapeC || 'C'}</text>
                </svg>
            )
        }
    }, [shape, dims, focusedInput]);

    return (
        <CalculatorPage
            title="Gulvareal Beregner"
            helpContent={helpContent}
            reportData={reportData}
            shareValue={area > 0 ? `${area.toFixed(2)} m²` : undefined}
        >
            <div className="bg-white p-4 rounded-card shadow-sm border">
                <SegmentedControl options={[{ label: 'Rektangel', value: 'rectangle' }, { label: 'L-Form', value: 'l-shape' }]} value={shape} onChange={(value) => setShape(value)} />
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    {shape === 'rectangle' ? (
                        <>
                            <InputField name="rectL" label="Længde" value={dims.rectL} onChange={(e) => handleDimChange(e, 'rectL')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Mål rummets længde."/>
                            <InputField name="rectW" label="Bredde" value={dims.rectW} onChange={(e) => handleDimChange(e, 'rectW')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Mål rummets bredde."/>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-text-secondary -mb-2">Opdel L-formen i to rektangler.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField name="lShapeA" label="Side A" value={dims.lShapeA} onChange={(e) => handleDimChange(e, 'lShapeA')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Den øverste vandrette længde."/>
                                <InputField name="lShapeB" label="Side B" value={dims.lShapeB} onChange={(e) => handleDimChange(e, 'lShapeB')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Den indvendige lodrette side."/>
                                <InputField name="lShapeC" label="Side C" value={dims.lShapeC} onChange={(e) => handleDimChange(e, 'lShapeC')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Den nederste vandrette længde (total bredde)."/>
                                <InputField name="lShapeD" label="Side D" value={dims.lShapeD} onChange={(e) => handleDimChange(e, 'lShapeD')} unit="m" onFocus={setFocusedInput} onBlur={() => setFocusedInput(null)} info="Den nederste lodrette højde."/>
                            </div>
                        </>
                    )}
                </div>
                
                <div className="space-y-6">
                    <ResultDisplay label="Samlet Gulvareal" value={area} unit={<>m<sup>2</sup></>} />
                    <div className="bg-white p-4 rounded-card shadow-sm border"><h3 className="font-bold text-lg mb-2 text-center">Visuel Repræsentation</h3>{Diagram}</div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default FloorAreaCalculator;
