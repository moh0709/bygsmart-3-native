
import React, { useState, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import { catalogHelpToContent, computeCircle, getCalculator } from '../../catalog';

const meta = getCalculator('geometri-cirkel');

const CircleCalculator: React.FC = () => {
    const [radius, setRadius] = useState('2');

    const r = parseFloat(radius) || 0;
    const results = computeCircle({ radius: r });

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Cirkel Beregner',
        category: 'Geometri',
        inputs: [
            { label: 'Radius', value: r.toFixed(3), unit: 'm' },
        ],
        results: [
            { label: 'Areal', value: results.area.toFixed(4), unit: 'm²', highlight: true },
            { label: 'Omkreds', value: results.circumference.toFixed(3), unit: 'm' },
            { label: 'Diameter', value: results.diameter.toFixed(3), unit: 'm' },
        ],
        formula: 'A = π·r²  |  C = 2·π·r  |  d = 2·r',
    }), [r, results]);

    const svgR = 45;
    const cx = 55;
    const cy = 55;

    return (
        <CalculatorPage
            title="Cirkelberegner"
            helpContent={meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined}
            stickyResult={<>{results.area.toFixed(4)} m²</>}
            stickyResultLabel="Areal"
            shareValue={r > 0 ? `Areal: ${results.area.toFixed(4)} m² · Omkreds: ${results.circumference.toFixed(3)} m` : undefined}
            reportData={reportData}
        >
            <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Mål</h3>
                    <InputField
                        label="Radius"
                        value={radius}
                        onChange={e => setRadius(e.target.value)}
                        unit="m"
                        info="Halvdiameter — fra centrum til kanten."
                    />

                    <div className="flex justify-center py-2">
                        <svg width="120" height="120" viewBox="0 0 110 110">
                            <circle cx={cx} cy={cy} r={svgR} className="fill-brand-subtle dark:fill-brand-subtle-dark stroke-brand-primary dark:stroke-brand-light" strokeWidth="2" />
                            <line x1={cx} y1={cy} x2={cx + svgR} y2={cy} className="stroke-brand-primary dark:stroke-brand-light" strokeWidth="1.5" strokeDasharray="4,2" />
                            <circle cx={cx} cy={cy} r="2" className="fill-brand-primary dark:fill-brand-light" />
                            <text x={cx + svgR / 2 + 2} y={cy - 4} textAnchor="middle" className="fill-brand-primary dark:fill-brand-light text-[8px] font-bold">r</text>
                            <text x={cx} y={cy + svgR + 12} textAnchor="middle" className="fill-text-secondary dark:fill-text-dark-secondary text-[8px]">Ø {(r * 2).toFixed(2)} m</text>
                        </svg>
                    </div>
                </div>

                <div className="space-y-3">
                    <ResultDisplay label="Areal" value={results.area} precision={4} unit={<>m<sup>2</sup></>} />
                    <ResultDisplay label="Omkreds" value={results.circumference} precision={3} unit="m" />
                    <ResultDisplay label="Diameter" value={results.diameter} precision={3} unit="m" />
                </div>
            </div>
        </CalculatorPage>
    );
};

export default CircleCalculator;
