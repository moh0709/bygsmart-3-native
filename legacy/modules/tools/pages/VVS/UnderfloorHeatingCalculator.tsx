
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computeUnderfloorHeating } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'vvs-gulvvarme';

const helpContent: HelpContent = {
    formaal: 'Beregner samlet rørlængde og antal kredse for gulvvarme baseret på rumareal, rørafstand og max. kredsslængde.',
    variabler: [
        { name: 'Rumareal', symbol: 'A', unit: 'm²', description: 'Rummets netto gulvareal.' },
        { name: 'Rørcentrum–centrum', symbol: 's', unit: 'cm', description: 'Afstand mellem parallelle rørcentre. Typisk 10–30 cm.' },
        { name: 'Max. kredslængde', symbol: 'L_max', unit: 'm', description: 'Max rørlængde pr. kreds. Typisk 80–120 m for ∅16/20 mm rør.' },
    ],
    formel: 'L_total = (A / s) × 1,1   [+10 % bøjningstillæg]\nKredse = ⌈L_total / L_max⌉',
    antagelser: '10 % tillæg for bøjninger og tilslutningsrør. Jævn fordeling antaget.',
    standarder: 'DS/EN 1264-4 – Gulvvarmesystemer: rørinstallation og dimensionering\nDS/EN 15377-1 – Varme- og køleanlæg integreret i bygningsdele',
};

const UnderfloorHeatingCalculator: React.FC = () => {
    const { allowed } = useToolAccess(TOOL_ID);
    const [length, setLength] = useState('5');
    const [width, setWidth] = useState('4');
    const [spacing, setSpacing] = useState('20');
    const [maxLoop, setMaxLoop] = useState('100');

    const areaM2 = (parseFloat(length) || 0) * (parseFloat(width) || 0);
    const spacingM = (parseFloat(spacing) || 20) / 100;

    const result = useMemo(() => computeUnderfloorHeating({
        areaM2,
        spacingM,
        loopLengthM: parseFloat(maxLoop) || undefined,
    }), [areaM2, spacingM, maxLoop]);

    const reportData: CalculatorReportData = {
        toolName: 'Gulvvarme Rørlængde',
        category: 'VVS',
        inputs: [
            { label: 'Rumlængde', value: length, unit: 'm' },
            { label: 'Rumbredde', value: width, unit: 'm' },
            { label: 'Rørcentrum–centrum', value: spacing, unit: 'cm' },
            { label: 'Max. kredslængde', value: maxLoop, unit: 'm' },
        ],
        results: [
            { label: 'Samlet rørlængde', value: result.totalLengthM.toFixed(1), unit: 'm', highlight: true },
            ...(result.loopCount !== undefined
                ? [{ label: 'Antal kredse', value: `${result.loopCount}`, unit: 'stk.' }]
                : []),
        ],
        formula: 'L_total = (A / s) × 1,1\nKredse = ⌈L_total / L_max⌉',
        standardsStruktureret: [
            { code: 'DS/EN 1264-4', note: 'Gulvvarmesystemer – rørinstallation og dimensionering.' },
            { code: 'DS/EN 15377-1', note: 'Varme- og køleanlæg integreret i bygningsdele.' },
        ],
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Gulvvarme Rørlængde</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Gulvvarme Rørlængde"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Samlet rørlængde"
            stickyResult={<><AnimatedNumber value={result.totalLengthM} precision={1} /> m</>}
            shareValue={`Gulvvarme: ${result.totalLengthM.toFixed(1)} m rør i ${areaM2.toFixed(1)} m² rum (${spacing} cm afstand)`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Rumareal</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Længde" value={length} onChange={e => setLength(e.target.value)} unit="m" />
                        <InputField label="Bredde" value={width} onChange={e => setWidth(e.target.value)} unit="m" />
                    </div>
                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Areal: {areaM2.toFixed(1)} m²</p>

                    <h3 className="font-bold text-lg pt-2 border-t border-border dark:border-border-dark">Rørdata</h3>
                    <InputField
                        label="Centrum–centrum afstand"
                        value={spacing}
                        onChange={e => setSpacing(e.target.value)}
                        unit="cm"
                        info="Typisk 10–15 cm i kantzoner, 20–30 cm i midterzone."
                    />
                    <InputField
                        label="Max. kredslængde"
                        value={maxLoop}
                        onChange={e => setMaxLoop(e.target.value)}
                        unit="m"
                        info="∅16 mm rør: 80–100 m, ∅20 mm rør: 100–120 m anbefales."
                    />
                </div>

                <div className="space-y-4">
                    <ResultDisplay label="Samlet rørlængde" value={result.totalLengthM} unit="m" precision={1} />
                    {result.loopCount !== undefined && (
                        <ResultDisplay label="Antal kredse" value={result.loopCount} unit="stk." precision={0} />
                    )}

                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                        <p className="font-semibold">Beregning</p>
                        <p>Netto: {areaM2.toFixed(1)} m² ÷ {spacingM.toFixed(2)} m = {(areaM2 / spacingM).toFixed(1)} m</p>
                        <p>+10 % bøjningstillæg = {result.totalLengthM.toFixed(1)} m</p>
                        {result.loopCount !== undefined && (
                            <p>Kredse: ⌈{result.totalLengthM.toFixed(1)} / {maxLoop}⌉ = {result.loopCount} stk.</p>
                        )}
                    </div>

                    <div className="p-4 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-card text-sm text-warning-strong dark:text-warning">
                        <p className="font-semibold">Husk</p>
                        <p>Bestil ca. 10 % ekstra rør som buffer. En kreds bør sjældent overstige 120 m for at sikre jævnt tryk og temperaturfordeling.</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default UnderfloorHeatingCalculator;
