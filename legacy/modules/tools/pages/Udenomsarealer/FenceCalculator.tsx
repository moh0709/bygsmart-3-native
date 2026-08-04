
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';

const FenceCalculator: React.FC = () => {
    const [length, setLength] = useState('10');
    const [spacing, setSpacing] = useState('1.8');
    const [postWidth, setPostWidth] = useState('10'); // cm
    const [results, setResults] = useState({ posts: 0, panels: 0, remainder: 0, panelWidth: 0 });

    useEffect(() => {
        const l = parseFloat(length) || 0;
        const s = parseFloat(spacing) || 1.8;
        const pw_m = (parseFloat(postWidth) || 10) / 100;

        if (l > 0 && s > 0) {
            // Distance center-to-center usually approximates panel width + post width
            // Or clear opening (spacing) + post. Let's assume input is post-center-to-post-center

            const numSections = Math.ceil(l / s);
            const numPosts = numSections + 1;

            // Calculate last section width
            const fullLengthCovered = (numSections - 1) * s;
            const remainder = l - fullLengthCovered;

            // Fri panelbredde: hvor meget stolpen "spiser" af c/c-afstanden
            const panelWidth = Math.max(0, s - pw_m);

            setResults({ posts: numPosts, panels: numSections, remainder, panelWidth });
        } else {
            setResults({ posts: 0, panels: 0, remainder: 0, panelWidth: 0 });
        }
    }, [length, spacing, postWidth]);

    const Diagram = useMemo(() => {
        const l = parseFloat(length) || 10;
        const s = parseFloat(spacing) || 1.8;
        const { posts, panels, remainder } = results;
        
        if (l <= 0 || s <= 0) return null;

        // Scale
        const svgW = 500;
        const scale = svgW / l;
        const svgH = 80; // height of fence visual
        const postW = 4; // visual width

        const elements = [];
        
        for(let i = 0; i < posts; i++) {
            const x = Math.min((i * s) * scale, svgW - postW);
            
            // Draw Post
            elements.push(
                <rect key={`post-${i}`} x={x} y="20" width={postW} height={svgH} className="fill-stone-700" />
            );

            // Draw Panel
            if (i < panels) {
                const isLast = i === panels - 1;
                const panelWidth = isLast ? (remainder * scale) : (s * scale);
                // Safety check for panel width not exceeding remaining space
                const visualPanelW = Math.max(0, panelWidth - postW);
                
                elements.push(
                    <rect 
                        key={`panel-${i}`} 
                        x={x + postW} 
                        y="30" 
                        width={visualPanelW} 
                        height={svgH - 20} 
                        className={`fill-amber-700 opacity-80 ${isLast ? 'fill-amber-500' : ''}`} 
                        rx="2"
                    />
                );
                
                if (isLast && panels > 1) {
                     elements.push(
                        <text key="last-text" x={x + postW + visualPanelW/2} y="15" textAnchor="middle" className="text-caption fill-amber-700 font-bold">
                            {remainder.toFixed(2)}m
                        </text>
                    );
                }
            }
        }

        return (
            <div className="w-full overflow-x-auto bg-bg rounded-lg border border-border p-4 mt-4">
                <svg width="100%" height="100%" viewBox={`-10 -20 ${svgW + 20} 160`} preserveAspectRatio="xMidYMid meet">
                    {elements}
                    {/* Ground */}
                    <line x1="-10" y1={20+svgH} x2={svgW+20} y2={20+svgH} className="stroke-green-600" strokeWidth="2" />
                    
                    {/* Dimensions Line */}
                    <line x1="0" y1={20+svgH+15} x2={svgW} y2={20+svgH+15} className="stroke-text-secondary" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)"/>
                    <text x={svgW/2} y={20+svgH+25} textAnchor="middle" className="text-[12px] fill-text-secondary">Total: {l} m</text>
                </svg>
                <div className="flex justify-center gap-4 mt-2 text-xs text-text-secondary">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-stone-700"></div> Stolpe</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-700 opacity-80"></div> Standard Fag ({s}m)</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-500 opacity-80"></div> Rest Fag</div>
                </div>
            </div>
        )
    }, [length, spacing, results]);

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Hegn Beregner',
        category: 'Udenomsarealer',
        inputs: [
            { label: 'Total Længde', value: length, unit: 'm' },
            { label: 'Stolpeafstand (c/c)', value: spacing, unit: 'm' },
            { label: 'Stolpebredde', value: postWidth, unit: 'cm' },
        ],
        results: [
            { label: 'Antal Stolper', value: String(results.posts), unit: 'stk', highlight: true },
            { label: 'Antal Fag', value: String(results.panels), unit: 'stk' },
            { label: 'Rest Fag Bredde', value: results.remainder.toFixed(2), unit: 'm' },
            { label: 'Fri Panelbredde', value: results.panelWidth.toFixed(2), unit: 'm' },
        ],
    }), [length, spacing, postWidth, results]);

    return (
        <CalculatorPage title="Hegn & Stolper" reportData={reportData}>
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Hegnslinje</h3>
                    <InputField label="Total Længde" value={length} onChange={e => setLength(e.target.value)} unit="m" info="Den samlede længde af hegnet."/>
                    <InputField 
                        label="Stolpeafstand (c/c)" 
                        value={spacing} 
                        onChange={e => setSpacing(e.target.value)} 
                        unit="m" 
                        info="Standard fagbredde er ofte 1.8m (plus stolpe)."
                    />
                    <InputField label="Stolpebredde" value={postWidth} onChange={e => setPostWidth(e.target.value)} unit="cm" info="Bredden af stolpen (f.eks. 10x10 cm)."/>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Resultat</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultDisplay label="Antal Stolper" value={results.posts} precision={0} unit="stk" />
                            <ResultDisplay label="Antal Fag" value={results.panels} precision={0} unit="stk" />
                            <ResultDisplay label="Fri Panelbredde" value={results.panelWidth} precision={2} unit="m" />
                            <ResultDisplay label="Rest Fag" value={results.remainder} precision={2} unit="m" />
                        </div>
                        {Diagram}
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default FenceCalculator;
