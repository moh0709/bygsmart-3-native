
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import { catalogHelpToContent, getCalculator } from '../../catalog';

type Shape = 'rectangle' | 'l-shape';

const meta = getCalculator('rumareal');

const RoomAreaCalculator: React.FC = () => {
    const [shape, setShape] = useState<Shape>('rectangle');
    const [dims, setDims] = useState({
        rectL: '', rectW: '',
        lShapeA: '', lShapeB: '', lShapeC: '', lShapeD: ''
    });
    const [area, setArea] = useState(0);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        let calculatedArea = 0;
        if (shape === 'rectangle') {
            const l = parseFloat(dims.rectL) || 0;
            const w = parseFloat(dims.rectW) || 0;
            calculatedArea = l * w;
        } else {
            // Treat as two rectangles
            const lA = parseFloat(dims.lShapeA) || 0;
            const wA = parseFloat(dims.lShapeB) || 0;
            const lB = parseFloat(dims.lShapeC) || 0;
            const wB = parseFloat(dims.lShapeD) || 0;
            calculatedArea = (lA * wA) + (lB * wB);
        }
        setArea(calculatedArea);
    }, [shape, dims]);

    const Diagram = useMemo(() => {
        // Helper for conditional styling
        const getStroke = (key: string) => focusedInput === key ? 'stroke-brand-accent stroke-[2px] opacity-100' : 'stroke-brand-primary dark:stroke-brand-light stroke-[0.5px] opacity-80';
        const getTextClass = (key: string) => `text-[0.5px] sm:text-[1px] font-bold transition-all duration-300 ${focusedInput === key ? 'fill-brand-accent scale-110' : 'fill-text-secondary dark:fill-text-dark-secondary'}`;

        if (shape === 'rectangle') {
            const l = parseFloat(dims.rectL) || 5;
            const w = parseFloat(dims.rectW) || 3;
            const padding = Math.max(l, w) * 0.2; 
            return (
                <div className="w-full flex justify-center items-center">
                    <svg viewBox={`${-padding} ${-padding} ${l + padding*2} ${w + padding*2}`} className="w-full h-full max-h-[200px]" preserveAspectRatio="xMidYMid meet">
                        <rect x="0" y="0" width={l} height={w} className="fill-blue-50 dark:fill-blue-900/10" />
                        
                        {/* Top Line (Length) */}
                        <line x1="0" y1="0" x2={l} y2="0" className={`transition-all duration-300 ${getStroke('rectL')}`} />
                        {/* Bottom Line (Length) */}
                        <line x1="0" y1={w} x2={l} y2={w} className={`transition-all duration-300 ${getStroke('rectL')}`} />
                        
                        {/* Left Line (Width) */}
                        <line x1="0" y1="0" x2="0" y2={w} className={`transition-all duration-300 ${getStroke('rectW')}`} />
                        {/* Right Line (Width) */}
                        <line x1={l} y1="0" x2={l} y2={w} className={`transition-all duration-300 ${getStroke('rectW')}`} />

                        <text x={l/2} y={-0.3} textAnchor="middle" className={getTextClass('rectL')}>{dims.rectL || 'Længde'}</text>
                        <text x={-0.3} y={w/2} textAnchor="end" dominantBaseline="middle" transform={`rotate(-90, -0.3, ${w/2})`} className={getTextClass('rectW')}>{dims.rectW || 'Bredde'}</text>
                    </svg>
                </div>
            );
        } else { // L-Shape
            const a = parseFloat(dims.lShapeA) || 4;
            const b = parseFloat(dims.lShapeB) || 2;
            const c = parseFloat(dims.lShapeC) || 2;
            const d = parseFloat(dims.lShapeD) || 3;

            const totalWidth = Math.max(a, c);
            const totalHeight = b + d;
            const padding = Math.max(totalWidth, totalHeight) * 0.2;

            return (
                <div className="w-full flex justify-center items-center p-4">
                     <svg viewBox={`${-padding} ${-padding} ${totalWidth + padding*2} ${totalHeight + padding*2}`} className="w-full h-full max-h-[200px]" preserveAspectRatio="xMidYMid meet">
                        {/* Background Shape */}
                        <path d={`M0,0 H${a} V${b} H${c} V${totalHeight} H0 V0 Z`} className="fill-blue-50 dark:fill-blue-900/10 stroke-none" />
                        
                        {/* Interactive Lines */}
                        <line x1="0" y1="0" x2={a} y2="0" className={`transition-all duration-300 ${getStroke('lShapeA')}`} /> {/* Top A */}
                        <line x1={a} y1="0" x2={a} y2={b} className={`transition-all duration-300 ${getStroke('lShapeB')}`} /> {/* Inner Vert B */}
                        <line x1={a} y1={b} x2={c} y2={b} className={`transition-all duration-300 ${getStroke('lShapeC')}`} /> {/* Inner Horiz C */}
                        <line x1={c} y1={b} x2={c} y2={totalHeight} className={`transition-all duration-300 ${getStroke('lShapeD')}`} /> {/* Bottom Vert D */}
                        
                        {/* Closing lines (static for visual completion) */}
                        <line x1={c} y1={totalHeight} x2={0} y2={totalHeight} className="stroke-gray-300 stroke-[0.5px]" />
                        <line x1={0} y1={totalHeight} x2={0} y2={0} className="stroke-gray-300 stroke-[0.5px]" />

                        {/* Labels */}
                        <text x={a/2} y={-0.3} textAnchor="middle" className={getTextClass('lShapeA')}>{dims.lShapeA || 'A'}</text>
                        <text x={a+0.3} y={b/2} dominantBaseline="middle" className={getTextClass('lShapeB')}>{dims.lShapeB || 'B'}</text>
                        <text x={a + (c-a)/2} y={b-0.3} textAnchor="middle" className={getTextClass('lShapeC')}>{dims.lShapeC || 'C'}</text>
                        <text x={c+0.3} y={b + d/2} dominantBaseline="middle" className={getTextClass('lShapeD')}>{dims.lShapeD || 'D'}</text>
                    </svg>
                </div>
            )
        }
    }, [shape, dims, focusedInput]);

    const reportData = useMemo<CalculatorReportData>(() => {
        const inputs = shape === 'rectangle'
            ? [
                { label: 'Længde', value: dims.rectL || '0', unit: 'm' },
                { label: 'Bredde', value: dims.rectW || '0', unit: 'm' },
            ]
            : [
                { label: 'Segment A (Længde)', value: dims.lShapeA || '0', unit: 'm' },
                { label: 'Segment B (Bredde)', value: dims.lShapeB || '0', unit: 'm' },
                { label: 'Segment C (Længde)', value: dims.lShapeC || '0', unit: 'm' },
                { label: 'Segment D (Bredde)', value: dims.lShapeD || '0', unit: 'm' },
            ];

        const breakdown = shape === 'l-shape'
            ? [
                { label: 'Rektangel 1 (A × B)', value: ((parseFloat(dims.lShapeA) || 0) * (parseFloat(dims.lShapeB) || 0)).toFixed(2), unit: 'm²' },
                { label: 'Rektangel 2 (C × D)', value: ((parseFloat(dims.lShapeC) || 0) * (parseFloat(dims.lShapeD) || 0)).toFixed(2), unit: 'm²' },
            ]
            : undefined;

        return {
            toolName: 'Rumareal Beregner',
            category: 'Areal & Rumfang',
            mode: shape === 'rectangle' ? 'Rektangel' : 'L-Form',
            inputs,
            results: [
                { label: 'Samlet Areal', value: area.toFixed(2), unit: 'm²', highlight: true },
            ],
            breakdown,
            formula: shape === 'rectangle' ? 'Areal = Længde × Bredde' : 'Areal = (A × B) + (C × D)',
        };
    }, [shape, dims, area]);

    return (
        <CalculatorPage
            title="Rumareal Beregner"
            helpContent={meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined}
            stickyResult={<>{area.toFixed(2)} m²</>}
            stickyResultLabel="Areal"
            shareValue={area > 0 ? `${area.toFixed(2)} m² rumareal` : undefined}
            reportData={reportData}
        >
            <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark mb-4">
                <SegmentedControl
                    options={[
                        { label: 'Rektangel', value: 'rectangle' },
                        { label: 'L-Form', value: 'l-shape' },
                    ]}
                    value={shape}
                    onChange={(val) => setShape(val as Shape)}
                />
            </div>

            <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Mål</h3>
                    {shape === 'rectangle' ? (
                        <>
                            <InputField
                                name="rectL"
                                label="Længde"
                                value={dims.rectL}
                                onChange={(e) => handleDimChange(e, 'rectL')}
                                onFocus={() => setFocusedInput('rectL')}
                                onBlur={() => setFocusedInput(null)}
                                unit="m"
                                info="Rummets indvendige længde."
                            />
                            <InputField
                                name="rectW"
                                label="Bredde"
                                value={dims.rectW}
                                onChange={(e) => handleDimChange(e, 'rectW')}
                                onFocus={() => setFocusedInput('rectW')}
                                onBlur={() => setFocusedInput(null)}
                                unit="m"
                                info="Rummets indvendige bredde."
                            />
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-text-secondary dark:text-text-dark-secondary">L-form: to rektangler lagt sammen.</p>
                            <div className="grid grid-cols-2 gap-3 border-b border-border dark:border-border-dark pb-3">
                                <InputField name="lShapeA" label="Segment A (L)" value={dims.lShapeA} onChange={(e) => handleDimChange(e, 'lShapeA')} onFocus={() => setFocusedInput('lShapeA')} onBlur={() => setFocusedInput(null)} unit="m" />
                                <InputField name="lShapeB" label="Segment B (B)" value={dims.lShapeB} onChange={(e) => handleDimChange(e, 'lShapeB')} onFocus={() => setFocusedInput('lShapeB')} onBlur={() => setFocusedInput(null)} unit="m" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <InputField name="lShapeC" label="Segment C (L)" value={dims.lShapeC} onChange={(e) => handleDimChange(e, 'lShapeC')} onFocus={() => setFocusedInput('lShapeC')} onBlur={() => setFocusedInput(null)} unit="m" />
                                <InputField name="lShapeD" label="Segment D (B)" value={dims.lShapeD} onChange={(e) => handleDimChange(e, 'lShapeD')} onFocus={() => setFocusedInput('lShapeD')} onBlur={() => setFocusedInput(null)} unit="m" />
                            </div>
                        </>
                    )}
                </div>

                <div className="space-y-4">
                    <ResultDisplay
                        label="Samlet Areal"
                        value={area}
                        unit={<>m<sup>2</sup></>}
                    />
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-sm text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-2">Visualisering</h3>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default RoomAreaCalculator;
