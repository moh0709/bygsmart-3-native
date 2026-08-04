import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computeSolarRoi } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'el-sol-roi';

const helpContent: HelpContent = {
    formaal: 'Beregner tilbagebetaling og 30-årig livstidsbesparelse for et solcelleanlæg med inflationskorrigerede elpriser.',
    variabler: [
        { name: 'Anlægsomkostning', symbol: 'C', unit: 'kr.', description: 'Samlet installationsomkostning inkl. moms.' },
        { name: 'Årlig produktion', symbol: 'P', unit: 'kWh', description: 'Skønnet årsproduktion. I DK ≈ 900 kWh/kWp.' },
        { name: 'Elpris', symbol: 'e', unit: 'kr./kWh', description: 'Gennemsnitlig elpris inkl. afgifter.' },
        { name: 'Elpristigning', symbol: 'i', unit: '%/år', description: 'Forventet årlig prisstigning.' },
    ],
    formel: 'Årsbesparelse = P × e\nTilbagebetaling: ΣBesparelse(1+i)^år ≥ Nettoomkostning\nLivstidsbesparelse = Σ30år − Nettoomkostning',
    antagelser: '30-årig beregningshorisont. Vedligeholdelsesomkostninger ikke medregnet. Ingen skattefradrag.',
    standarder: 'Energistyrelsens vejledning om solcelleanlæg og nettomålerordningen.',
};

const SolarRoiCalculator: React.FC = () => {
    const { allowed } = useToolAccess(TOOL_ID);
    const [systemCost, setSystemCost] = useState('80000');
    const [production, setProduction] = useState('5000');
    const [price, setPrice] = useState('3.0');
    const [inflation, setInflation] = useState('3');
    const [subsidy, setSubsidy] = useState('0');

    const result = useMemo(() => computeSolarRoi({
        systemCostDKK: parseFloat(systemCost) || 0,
        annualProductionKwh: parseFloat(production) || 0,
        electricityPriceDKK: parseFloat(price) || 0,
        annualInflationPct: parseFloat(inflation) || 0,
        subsidyDKK: parseFloat(subsidy) || 0,
    }), [systemCost, production, price, inflation, subsidy]);

    const reportData: CalculatorReportData = {
        toolName: 'Solcelle ROI Beregner',
        category: 'El',
        inputs: [
            { label: 'Anlægsomkostning', value: systemCost, unit: 'kr.' },
            { label: 'Årlig produktion', value: production, unit: 'kWh' },
            { label: 'Elpris', value: price, unit: 'kr./kWh' },
            { label: 'Elpristigning', value: inflation, unit: '%/år' },
            { label: 'Tilskud', value: subsidy, unit: 'kr.' },
        ],
        results: [
            { label: 'Tilbagebetaling', value: `${result.paybackYears}`, unit: 'år', highlight: true },
            { label: 'Årsbesparelse (år 1)', value: result.annualSavingsDKK.toFixed(0), unit: 'kr.' },
            { label: 'Livstidsbesparelse (30 år)', value: result.lifetimeSavingsDKK.toFixed(0), unit: 'kr.' },
        ],
        formula: 'Årsbesparelse = P × e\nTilbagebetaling: ΣBesparelse(1+i)^år ≥ Nettoomkostning',
        standardsStruktureret: [{ code: 'Energistyrelsens vejledning', note: 'Nettomålerordning og solcelleanlæg.' }],
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Solcelle ROI Beregner</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Solcelle ROI Beregner"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Tilbagebetaling"
            stickyResult={<><AnimatedNumber value={result.paybackYears} precision={0} /> år</>}
            shareValue={`Tilbagebetaling: ${result.paybackYears} år · Livstidsbesparelse: ${(result.lifetimeSavingsDKK / 1000).toFixed(0)}k kr.`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Anlægsdata</h3>
                    <InputField label="Anlægsomkostning" value={systemCost} onChange={e => setSystemCost(e.target.value)} unit="kr." info="Samlet pris inkl. moms, montering og installation." />
                    <InputField label="Tilskud / Rabat" value={subsidy} onChange={e => setSubsidy(e.target.value)} unit="kr." info="Fratrækkes anlægsomkostningen." />
                    <InputField label="Årlig produktion" value={production} onChange={e => setProduction(e.target.value)} unit="kWh" info="I DK typisk 900 kWh pr. installeret kWp." />
                    <InputField label="Elpris inkl. afgifter" value={price} onChange={e => setPrice(e.target.value)} unit="kr./kWh" info="Inkl. tariffer og afgifter. Tjek din elregning." />
                    <InputField label="Forventet elpristigning" value={inflation} onChange={e => setInflation(e.target.value)} unit="% pr. år" info="Historisk gennemsnit i DK: 3–5 %." />
                </div>

                <div className="space-y-4">
                    <ResultDisplay label="Tilbagebetaling" value={result.paybackYears} unit="år" />
                    <ResultDisplay label="Årsbesparelse (år 1)" value={result.annualSavingsDKK} unit="kr." />

                    <div className={`p-4 rounded-card border text-sm space-y-1 ${result.lifetimeSavingsDKK >= 0 ? 'bg-success-subtle dark:bg-success-subtle-dark border-success-border dark:border-success/30 text-success-strong dark:text-success' : 'bg-warning-subtle dark:bg-warning-subtle-dark border-warning-border dark:border-warning/30 text-warning-strong dark:text-warning'}`}>
                        <p className="font-semibold">30-årig livstidsresultat</p>
                        <p>{result.lifetimeSavingsDKK >= 0 ? `Overskud: +${(result.lifetimeSavingsDKK / 1000).toFixed(0)}k kr.` : `Underskud: ${(result.lifetimeSavingsDKK / 1000).toFixed(0)}k kr.`}</p>
                        <p className="text-xs opacity-75">Inflationskorrigeret · 30-årig horisont</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default SolarRoiCalculator;
