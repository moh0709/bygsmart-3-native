
import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import { computeEscapeWindow, getCalculator } from '../../catalog';

const meta = getCalculator('doere-vinduer-redningsaabning');

const EscapeWindowCalculator: React.FC = () => {
    const [dims, setDims] = useState({ width: '60', height: '100', heightAboveFloor: '90' });
    const diagramRef = useRef<HTMLDivElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const results = useMemo(() => {
        return computeEscapeWindow({
            widthCm: parseFloat(dims.width) || 0,
            heightCm: parseFloat(dims.height) || 0,
            heightAboveFloorCm: parseFloat(dims.heightAboveFloor) || 0,
        });
    }, [dims]);

    const Diagram = useMemo(() => {
        const { w, h, passed } = results;
        // Visual scaling
        const scale = 150;
        const visW = Math.min(w * scale, 250);
        const visH = Math.min(h * scale, 250);

        return (
            <div ref={diagramRef} className="flex flex-col items-center">
                <div className="relative border-4 border-border-dark-strong bg-info-subtle dark:bg-info-subtle-dark transition-all duration-300" style={{ width: visW, height: visH }}>
                    {/* Window Pane */}
                    <div className="absolute inset-2 border border-border-strong dark:border-border-dark bg-info/10"></div>
                    
                    {/* Status Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        {passed ? (
                            <div className="bg-white/80 rounded-full p-2 shadow-lg">
                                <CheckCircleIcon className="w-12 h-12 text-success" />
                            </div>
                        ) : (
                            <div className="bg-white/80 rounded-full p-2 shadow-lg">
                                <AlertTriangleIcon className="w-12 h-12 text-danger" />
                            </div>
                        )}
                    </div>
                    
                    {/* Dimensions */}
                    <div className="absolute -top-6 left-0 right-0 text-center text-xs font-bold">{dims.width} cm</div>
                    <div className="absolute top-0 -left-8 bottom-0 flex items-center text-xs font-bold" style={{writingMode: 'vertical-rl'}}>{dims.height} cm</div>
                </div>
                <p className="mt-4 text-sm font-bold">
                    Sum: {results.sum.toFixed(2)} m
                </p>
            </div>
        );
    }, [results, dims]);

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Redningsåbning Tjek',
        category: meta?.category,
        inputs: [
            { label: 'Fri bredde', value: dims.width, unit: 'cm' },
            { label: 'Fri højde', value: dims.height, unit: 'cm' },
            { label: 'Underkant over gulv', value: dims.heightAboveFloor, unit: 'cm' },
        ],
        results: [
            { label: 'Status', value: results.passed ? 'GODKENDT' : 'IKKE GODKENDT', highlight: true },
            { label: 'Sum H+B', value: (results.sum * 100).toFixed(0), unit: 'cm' },
        ],
        formula: meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        safetyDisclaimer: 'Dette er et vejledende tjek. Kontrollér altid med byggesagbehandler og bygningsreglement.',
        infographicRef: diagramRef,
    }), [dims, results, meta]);

    return (
        <CalculatorPage
            title="Redningsåbning Tjek"
            helpContent={meta?.help as import('../../components/CalculatorPage').HelpContent | undefined}
            shareValue={`Sum H+B = ${(results.sum).toFixed(2)} m · ${results.passed ? 'GODKENDT' : 'IKKE GODKENDT'}`}
            reportData={reportData}
        >
            <SafetyDisclaimer title="BR18 §92 — Compliance-tjek">
                Dette er et vejledende tjek. Kontrollér altid med byggesagbehandler og bygningsreglement.
            </SafetyDisclaimer>

            <div className="grid md:grid-cols-2 gap-4 items-start mt-4">
                <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Fri åbning (vinduet helt åbent)</h3>
                    <InputField label="Bredde" value={dims.width} onChange={e => handleInputChange(e, 'width')} unit="cm" info="Fri bredde — ekskl. karm." />
                    <InputField label="Højde" value={dims.height} onChange={e => handleInputChange(e, 'height')} unit="cm" info="Fri højde — ekskl. karm." />
                    <InputField label="Underkant over gulv" value={dims.heightAboveFloor} onChange={e => handleInputChange(e, 'heightAboveFloor')} unit="cm" info="Bør max. være 120 cm." />
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card shadow-sm border ${results.passed ? 'bg-success-subtle dark:bg-success-subtle-dark border-success' : 'bg-danger-subtle dark:bg-danger-subtle-dark border-danger'}`}>
                        <h3 className={`font-bold text-lg mb-3 text-center ${results.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                            {results.passed ? '✓ GODKENDT (BR18 §92)' : '✗ IKKE GODKENDT'}
                        </h3>
                        <div className="space-y-2 text-sm">
                            {[
                                { label: 'Højde ≥ 60 cm', ok: results.heightCheck, val: `${dims.height} cm` },
                                { label: 'Bredde ≥ 50 cm', ok: results.widthCheck, val: `${dims.width} cm` },
                                { label: 'Sum H+B ≥ 150 cm', ok: results.sumCheck, val: `${Math.round(results.sum * 100)} cm` },
                                { label: 'Underkant ≤ 120 cm', ok: results.floorCheck, val: `${dims.heightAboveFloor} cm` },
                            ].map(({ label, ok, val }) => (
                                <div key={label} className="flex justify-between items-center border-b dark:border-border-dark pb-1">
                                    <span className="text-text-secondary dark:text-text-dark-secondary">{label}</span>
                                    <span className={`font-bold ${ok ? 'text-success' : 'text-danger'}`}>{val} {ok ? '✓' : '✗'}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-center mt-4">{Diagram}</div>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default EscapeWindowCalculator;
