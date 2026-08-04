
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import { catalogHelpToContent, computePythagoras, getCalculator } from '../../catalog';

const meta = getCalculator('geometri-pythagoras');

const PythagorasCalculator: React.FC = () => {
    const [a, setA] = useState('3');
    const [b, setB] = useState('4');

    const aNum = parseFloat(a) || 0;
    const bNum = parseFloat(b) || 0;
    const { c } = computePythagoras({ a: aNum, b: bNum });

    const reportData = useMemo<CalculatorReportData>(() => ({
        toolName: 'Pythagoras Beregner',
        category: 'Geometri',
        inputs: [
            { label: 'Side A', value: aNum.toFixed(4), unit: 'm' },
            { label: 'Side B', value: bNum.toFixed(4), unit: 'm' },
        ],
        results: [
            { label: 'Hypotenuse c', value: c.toFixed(4), unit: 'm', highlight: true },
        ],
        formula: 'c = √(a² + b²)',
    }), [aNum, bNum, c]);

    return (
        <CalculatorPage
            title="3-4-5 Vinkel (Pythagoras)"
            reportData={reportData}
            helpContent={meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined}
            stickyResult={<><AnimatedNumber value={c} precision={4} /> m</>}
            stickyResultLabel="Diagonal c"
            shareValue={c > 0 ? `c = ${c.toFixed(4)} m (a=${a}, b=${b})` : undefined}
        >
            <div className="grid md:grid-cols-2 gap-4 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Kateter (siderne ind mod hjørnet)</h3>
                    <InputField label="Side A" value={a} onChange={e => setA(e.target.value)} unit="m" info="Mål fra hjørnet langs den ene væg." />
                    <InputField label="Side B" value={b} onChange={e => setB(e.target.value)} unit="m" info="Mål fra hjørnet langs den anden væg." />

                    <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30">
                        <p className="text-xs text-info-strong dark:text-info">
                            <strong>3-4-5 metoden:</strong> Brug a=3 m, b=4 m → diagonal skal måle 5,000 m for et perfekt 90° hjørne.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="font-bold text-xs text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-3">Hypotenuse c</h4>
                        <div className="text-center bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-xl">
                            <p className="text-sm text-info-strong dark:text-info mb-1">Mål denne diagonal på tværs</p>
                            <p className="text-4xl font-extrabold text-brand-primary dark:text-brand-light">
                                <AnimatedNumber value={c} precision={4} /> m
                            </p>
                        </div>
                    </div>

                    <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark flex justify-center">
                        <svg width="160" height="140" viewBox="0 0 110 100">
                            <path d="M 10,90 L 90,90 L 10,10 Z" className="fill-brand-subtle dark:fill-brand-subtle-dark stroke-brand-primary dark:stroke-brand-light" strokeWidth="2" fill="none" />
                            <rect x="10" y="80" width="10" height="10" fill="none" className="stroke-text-secondary dark:stroke-text-dark-secondary" strokeWidth="1.5" />
                            <text x="50" y="102" textAnchor="middle" className="fill-text-secondary dark:fill-text-dark-secondary text-caption">A = {a || '?'} m</text>
                            <text x="2" y="52" textAnchor="middle" className="fill-text-secondary dark:fill-text-dark-secondary text-caption" transform="rotate(-90,2,52)">B = {b || '?'} m</text>
                            <text x="60" y="48" textAnchor="middle" className="fill-brand-primary dark:fill-brand-light text-caption font-bold">c = {c.toFixed(3)}</text>
                        </svg>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default PythagorasCalculator;
