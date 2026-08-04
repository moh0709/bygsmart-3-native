
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { InfoHint } from '../../../../components/ui';
import { computeEvCharger } from '../../catalog';
import { InfoIcon } from '../../../../components/icons';

const helpContent: HelpContent = {
    formaal: 'Dimensionerer ladekredsen til en elbil-lader: designstrøm, anbefalet gruppeafbryder og kabel, samt den krævede fejlstrømsafbryder (HPFI/RCD) iht. DS/HD 60364-7-722. Ladning er en kontinuerlig belastning med særlige beskyttelseskrav.',
    variabler: [
        { name: 'Ladeeffekt', symbol: 'P', unit: 'kW', description: 'Laderens mærkeeffekt. Typisk 3,7 / 7,4 / 11 / 22 kW.' },
        { name: 'Faser', symbol: '–', unit: '–', description: '1-faset (230 V) eller 3-faset (400 V).' },
        { name: 'Designstrøm', symbol: 'IB', unit: 'A', description: '1-faset: P/230. 3-faset: P/(√3·400).' },
    ],
    formel: '1-faset: IB = P / 230\n3-faset: IB = P / (√3 · 400)\nGruppeafbryder In = mindste standardstørrelse ≥ IB',
    antagelser: 'Kontinuerlig belastning. Kabel vælges vejledende ud fra afbryderstørrelse (installationsmetode C). Lange kabelstræk kan kræve større tværsnit pga. spændingsfald — brug kabelberegneren.',
    standarder: 'DS/HD 60364-7-722 – Forsyning af elkøretøjer (ladestandere)\nDS/HD 60364-4-41 – Beskyttelse ved automatisk afbrydelse\nDS/HD 60364-5-52 – Kabler og strømbelastningsevne',
};

const EvChargerCalculator: React.FC = () => {
    const [power, setPower] = useState('11');
    const [phases, setPhases] = useState<'1' | '3'>('3');

    const r = useMemo(() => computeEvCharger({ chargerPowerKW: parseFloat(power) || 0, phases: phases === '3' ? 3 : 1 }), [power, phases]);

    const reportData: CalculatorReportData = {
        toolName: 'Ladestander-dimensionering',
        category: 'El',
        inputs: [
            { label: 'Ladeeffekt', value: power, unit: 'kW' },
            { label: 'Faser', value: phases === '3' ? '3-faset (400 V)' : '1-faset (230 V)' },
        ],
        results: [
            { label: 'Designstrøm IB', value: r.designCurrentA.toFixed(1), unit: 'A', highlight: true },
            { label: 'Anbefalet gruppeafbryder', value: `${r.recommendedBreakerA}`, unit: 'A' },
            { label: 'Anbefalet kabel (vejl.)', value: `${r.recommendedCableMm2}`, unit: 'mm²' },
            { label: 'HPFI/RCD-type', value: r.rcdType },
        ],
        formula: '1-faset: IB=P/230 · 3-faset: IB=P/(√3·400) · In ≥ IB',
        standardsStruktureret: [
            { code: 'DS/HD 60364-7-722', note: 'Forsyning af elkøretøjer' },
            { code: 'DS/HD 60364-4-41', note: 'Beskyttelse ved automatisk afbrydelse' },
        ],
        safetyDisclaimer: 'Ladestandere skal installeres af en autoriseret elinstallatør. Fast tilslutning kræver typisk egen gruppe med korrekt HPFI/RCD.',
    };

    return (
        <CalculatorPage
            title="Ladestander (elbil)"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Gruppeafbryder"
            stickyResult={<><AnimatedNumber value={r.recommendedBreakerA} precision={0} /> A</>}
            shareValue={`${power} kW ${phases}-faset → IB ${r.designCurrentA.toFixed(1)} A · ${r.recommendedBreakerA} A · ${r.recommendedCableMm2} mm²`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Laderdata</h3>
                    <InputField label="Ladeeffekt (P)" value={power} onChange={e => setPower(e.target.value)} unit="kW" info="Laderens mærkeeffekt. Typisk 3,7 / 7,4 / 11 / 22 kW." />
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Faser
                            <InfoHint
                                title="1- vs 3-faset"
                                description="En 3-faset lader (400 V) trækker lavere strøm pr. fase end en 1-faset (230 V) ved samme effekt, og kan lade hurtigere. 11 og 22 kW er altid 3-faset."
                                calculation="IB(3-faset) = P/(√3·400) · IB(1-faset) = P/230"
                            />
                        </label>
                        <select
                            aria-label="Faser"
                            value={phases}
                            onChange={e => setPhases(e.target.value as '1' | '3')}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="1">1-faset (230 V)</option>
                            <option value="3">3-faset (400 V)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Designstrøm IB" value={r.designCurrentA} precision={1} unit="A" />
                        <ResultDisplay label="Gruppeafbryder" value={r.recommendedBreakerA} precision={0} unit="A" />
                    </div>
                    <ResultDisplay label="Anbefalet kabel (vejledende)" value={r.recommendedCableMm2} precision={1} unit="mm²" />

                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info flex items-start gap-2">
                        <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold flex items-center gap-1">
                                Krævet HPFI/RCD
                                <InfoHint
                                    title="Fejlstrømsbeskyttelse (RCD)"
                                    description="Ladestandere kan give jævnstrøms-fejlstrømme, som en almindelig type A HPFI ikke ser. DS/HD 60364-7-722 kræver derfor Type B HPFI — eller Type A kombineret med 6 mA DC-fejlstrømsdetektion indbygget i laderen."
                                    calculation="DS/HD 60364-7-722"
                                />
                            </p>
                            <p className="mt-0.5">{r.rcdType}</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-3 rounded-lg border border-border dark:border-border-dark text-xs text-text-secondary dark:text-text-dark-secondary">
                        Ved lange kabelstræk: kontrollér spændingsfald (≤ 4 %) med kabelberegneren — det kan kræve et større tværsnit end det vejledende ovenfor.
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Ladestandere til elbiler skal installeres og tilsluttes af en autoriseret elinstallatør iht. DS/HD 60364-7-722.
                Denne beregning er vejledende dimensionering — den endelige installation, HPFI-type og kabel skal projekteres af installatøren.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default EvChargerCalculator;
