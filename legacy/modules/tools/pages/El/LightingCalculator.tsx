
import React, { useState } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import { computeLightingLayout } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'el-lyspunkter';

const LUX_PRESETS: { label: string; lux: number }[] = [
    { label: 'Gang / Depot', lux: 100 },
    { label: 'Opholdsstue', lux: 200 },
    { label: 'Køkken', lux: 300 },
    { label: 'Kontor', lux: 500 },
    { label: 'Tegnestue / Værksted', lux: 750 },
];

const helpContent: HelpContent = {
    formaal: 'Beregner det anbefalede antal armaturer for at opnå en given belysningsstyrke i et rum via Lumen-metoden.',
    variabler: [
        { name: 'Rumareal', symbol: 'A', unit: 'm²', description: 'Gulvareal af rum.' },
        { name: 'Målbelysning', symbol: 'E', unit: 'lux', description: 'Ønsket belysningsstyrke. Kontor: 500 lux, Gang: 100 lux.' },
        { name: 'Lumen pr. armatur', symbol: 'Φ', unit: 'lm', description: 'Lyskildernes lysmængde pr. armatur.' },
        { name: 'Vedligeholdelsesfaktor', symbol: 'η', unit: '–', description: 'Typisk 0,6–0,8. Tager højde for snavs og lampeafslagning.' },
    ],
    formel: 'n = ⌈(A × E) / (Φ × η)⌉',
    antagelser: 'Jævn belysningsfordeling. Rumrefleksion ikke medregnet. Vedligeholdelsesfaktor η = 0,6 (standard).',
    standarder: 'DS/EN 12464-1 – Belysning af arbejdspladser indendørs: min. 500 lux for kontorarbejde, 300 lux for industri.',
};

const LightingCalculator: React.FC = () => {
    const { allowed } = useToolAccess(TOOL_ID);
    const [area, setArea] = useState('30');
    const [lux, setLux] = useState('500');
    const [lumens, setLumens] = useState('3000');
    const [mf, setMf] = useState('0.6');

    const result = computeLightingLayout({
        areaM2: parseFloat(area) || 0,
        targetLux: parseFloat(lux) || 0,
        lumensPerFixture: parseFloat(lumens) || 0,
        maintenanceFactor: parseFloat(mf) || 0.6,
    });

    const reportData: CalculatorReportData = {
        toolName: 'Lyspunkter Beregner',
        category: 'El',
        inputs: [
            { label: 'Rumareal', value: area, unit: 'm²' },
            { label: 'Målbelysning', value: lux, unit: 'lux' },
            { label: 'Lumen pr. armatur', value: lumens, unit: 'lm' },
            { label: 'Vedligeholdelsesfaktor', value: mf },
        ],
        results: [
            { label: 'Antal armaturer', value: `${result.fixtureCount}`, unit: 'stk.', highlight: true },
        ],
        formula: 'n = ⌈(A × E) / (Φ × η)⌉',
        standardsStruktureret: [{ code: 'DS/EN 12464-1', note: 'Belysning af arbejdspladser – minimale belysningsstyrker.' }],
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Lyspunkter Beregner</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Lyspunkter Beregner"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Antal armaturer"
            stickyResult={<><AnimatedNumber value={result.fixtureCount} precision={0} /> stk.</>}
            shareValue={`Lyspunkter: ${result.fixtureCount} armaturer til ${lux} lux i ${area} m²`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>

                    <InputField label="Rumareal" value={area} onChange={e => setArea(e.target.value)} unit="m²" />

                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-2">Rumtype (preset lux)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {LUX_PRESETS.map(p => (
                                <button
                                    key={p.lux}
                                    type="button"
                                    onClick={() => setLux(String(p.lux))}
                                    className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                                        lux === String(p.lux)
                                            ? 'bg-brand-primary text-white border-brand-primary'
                                            : 'bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark-strong hover:border-brand-primary'
                                    }`}
                                >
                                    {p.label}<br /><span className="font-bold">{p.lux} lux</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <InputField label="Målbelysning (E)" value={lux} onChange={e => setLux(e.target.value)} unit="lux" />
                    <InputField label="Lumen pr. armatur (Φ)" value={lumens} onChange={e => setLumens(e.target.value)} unit="lm" info="LED panel 36W ≈ 3000 lm, LED downlight 9W ≈ 700 lm" />
                    <InputField label="Vedligeholdelsesfaktor (η)" value={mf} onChange={e => setMf(e.target.value)} unit="–" info="Typisk 0,6–0,8. Lavere = mere snavs." />
                </div>

                <div className="space-y-4">
                    <ResultDisplay label="Antal armaturer" value={result.fixtureCount} unit="stk." />
                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                        <p className="font-semibold">Lumen-metoden</p>
                        <p>n = ({area} m² × {lux} lux) / ({lumens} lm × {mf})</p>
                        <p className="font-bold">= {result.fixtureCount} armaturer</p>
                    </div>
                </div>
            </div>
        </CalculatorPage>
    );
};

export default LightingCalculator;
