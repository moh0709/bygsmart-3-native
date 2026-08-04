
import React, { useState } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computeSolarPanelLayout } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'el-solpanel';

const helpContent: HelpContent = {
    formaal: 'Beregner det maksimale antal solpaneler der kan monteres på et tagfladereal og den samlede installerede effekt (kWp).',
    variabler: [
        { name: 'Taglængde', symbol: 'L', unit: 'm', description: 'Tagfladens længde i montageretningen.' },
        { name: 'Tagbredde', symbol: 'B', unit: 'm', description: 'Tagfladens bredde.' },
        { name: 'Panellængde', symbol: 'Lp', unit: 'm', description: 'Standardpaneler er typisk 1,7–2,0 m.' },
        { name: 'Panelbredde', symbol: 'Bp', unit: 'm', description: 'Standardpaneler er typisk 1,0–1,1 m.' },
        { name: 'Paneleffekt', symbol: 'P', unit: 'Wp', description: 'Nominel effekt under standardbetingelser (STC).' },
    ],
    formel: 'Kolonner = ⌊B / (Bp + mellemrum)⌋\nRækker = ⌊L / (Lp + mellemrum)⌋\nAntal = Kolonner × Rækker\nTotal = Antal × P / 1000  [kWp]',
    antagelser: 'Ens monteringsretning. Ensartet mellemrum. Tagkant-afstand ikke medregnet.',
    standarder: 'BR18 – Tekniske krav til solcelleanlæg\nNetselskabets tilslutningsbetingelser gælder ved nettilslutning',
};

const SolarPanelCalculator: React.FC = () => {
    const { allowed } = useToolAccess(TOOL_ID);
    const [roofLength, setRoofLength] = useState('10');
    const [roofWidth, setRoofWidth] = useState('8');
    const [panelLength, setPanelLength] = useState('1.72');
    const [panelWidth, setPanelWidth] = useState('1.04');
    const [spacing, setSpacing] = useState('0.02');
    const [panelPower, setPanelPower] = useState('400');

    const result = computeSolarPanelLayout({
        roofLengthM: parseFloat(roofLength) || 0,
        roofWidthM: parseFloat(roofWidth) || 0,
        panelLengthM: parseFloat(panelLength) || 0,
        panelWidthM: parseFloat(panelWidth) || 0,
        spacingM: parseFloat(spacing) || 0,
        panelPowerW: parseFloat(panelPower) || 0,
    });

    const reportData: CalculatorReportData = {
        toolName: 'Solpanel Layout',
        category: 'El',
        inputs: [
            { label: 'Taglængde', value: roofLength, unit: 'm' },
            { label: 'Tagbredde', value: roofWidth, unit: 'm' },
            { label: 'Panellængde', value: panelLength, unit: 'm' },
            { label: 'Panelbredde', value: panelWidth, unit: 'm' },
            { label: 'Mellemrum', value: spacing, unit: 'm' },
            { label: 'Paneleffekt', value: panelPower, unit: 'Wp' },
        ],
        results: [
            { label: 'Antal paneler', value: `${result.panelCount}`, unit: 'stk.', highlight: true },
            { label: 'Total installeret effekt', value: result.totalPowerKw.toFixed(2), unit: 'kWp' },
            { label: 'Rækker', value: `${result.rows}` },
            { label: 'Kolonner', value: `${result.cols}` },
        ],
        formula: 'n = Kolonner × Rækker\nTotal = n × Pp / 1000  [kWp]',
        standardsStruktureret: [{ code: 'BR18', note: 'Krav til solcelleanlæg og tilslutning.' }],
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Solpanel Layout</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Solpanel Layout"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Antal paneler"
            stickyResult={<><AnimatedNumber value={result.panelCount} precision={0} /> stk.</>}
            shareValue={`${result.panelCount} paneler · ${result.totalPowerKw.toFixed(2)} kWp på ${roofLength}×${roofWidth} m tag`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Tagflade</h3>
                    <InputField label="Taglængde" value={roofLength} onChange={e => setRoofLength(e.target.value)} unit="m" />
                    <InputField label="Tagbredde" value={roofWidth} onChange={e => setRoofWidth(e.target.value)} unit="m" />

                    <h3 className="font-bold text-lg pt-2 border-t border-border dark:border-border-dark">Paneldata</h3>
                    <InputField label="Panellængde" value={panelLength} onChange={e => setPanelLength(e.target.value)} unit="m" info="Standard 60-celle panel ≈ 1,65 m, 72-celle ≈ 2,0 m" />
                    <InputField label="Panelbredde" value={panelWidth} onChange={e => setPanelWidth(e.target.value)} unit="m" />
                    <InputField label="Mellemrum" value={spacing} onChange={e => setSpacing(e.target.value)} unit="m" info="Typisk 0,02–0,05 m" />
                    <InputField label="Paneleffekt" value={panelPower} onChange={e => setPanelPower(e.target.value)} unit="Wp" info="Standard monokristalin panel: 300–450 Wp" />
                </div>

                <div className="space-y-4">
                    <ResultDisplay label="Antal paneler" value={result.panelCount} unit="stk." />
                    <ResultDisplay label="Installeret effekt" value={result.totalPowerKw} unit="kWp" />

                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                        <p className="font-semibold">Layout</p>
                        <p>{result.rows} rækker × {result.cols} kolonner = {result.panelCount} paneler</p>
                        <p>Skønnet årsproduktion: ~{(result.totalPowerKw * 900).toFixed(0)} kWh (900 kWh/kWp i DK)</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default SolarPanelCalculator;
