
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { InfoHint } from '../../../../components/ui';
import { computeSoakaway } from '../../catalog';
import { InfoIcon } from '../../../../components/icons';

const SOIL_TYPES = [
    { label: 'Sand (k ≈ 1×10⁻⁴ m/s)', value: '1e-4' },
    { label: 'Sandet silt (k ≈ 1×10⁻⁵ m/s)', value: '1e-5' },
    { label: 'Silt (k ≈ 1×10⁻⁶ m/s)', value: '1e-6' },
    { label: 'Ler (k ≈ 1×10⁻⁸ m/s — uegnet)', value: '1e-8' },
];

const FILL_TYPES = [
    { label: 'Grus/singels (hulrum ~30%)', value: '0.3' },
    { label: 'Plastkassetter/faskineelementer (~95%)', value: '0.95' },
];

const helpContent: HelpContent = {
    formaal: 'Estimerer det nødvendige magasinvolumen til en faskine (nedsivning af regnvand) fra et tag- eller befæstet areal, samt udgravningsvolumen afhængigt af fyldtype. Vejledende dimensionering iht. DS 432 — kræver nedsivningstest og lokal afledningstilladelse.',
    variabler: [
        { name: 'Opland', symbol: 'A', unit: 'm²', description: 'Tilsluttet befæstet areal (tag, terrasse).' },
        { name: 'Afløbskoefficient', symbol: 'c', unit: '–', description: 'Andel af regn der løber af. Tag ~0,9.' },
        { name: 'Designregn', symbol: 'h', unit: 'mm', description: 'Regndybde for gentagelsesperioden. DK 5–10 år ~30–45 mm.' },
        { name: 'Nedsivningsevne', symbol: 'k', unit: 'm/s', description: 'Jordens hydrauliske ledningsevne (fra nedsivningstest).' },
    ],
    formel: 'Tilstrømning = A × c × (h/1000)   [m³]\nNedsivning = k × A_side × varighed   [m³]\nMagasin = Tilstrømning − Nedsivning\nUdgravning = Magasin / hulrumsandel',
    antagelser: 'Forenklet volumenmetode. Den fulde Spildevandskomité-metode bruger intensitet-varighed-kurver og en sikkerhedsfaktor for klimaændringer. Nedsivningsevnen SKAL bestemmes ved en nedsivningstest på stedet.',
    standarder: 'DS 432 – Afløbsinstallationer (nedsivning)\nSpildevandskomiteens skrift 27/30 – regnrækker & klimafaktor\nLokal afledningstilladelse fra kommunen kræves.',
};

const SoakawayCalculator: React.FC = () => {
    const [area, setArea] = useState('120');
    const [runoff, setRunoff] = useState('0.9');
    const [rain, setRain] = useState('40');
    const [soilK, setSoilK] = useState('1e-5');
    const [infilArea, setInfilArea] = useState('15');
    const [duration, setDuration] = useState('120');
    const [fill, setFill] = useState('0.95');

    const r = useMemo(() => computeSoakaway({
        catchmentAreaM2: parseFloat(area) || 0,
        runoffCoefficient: parseFloat(runoff) || 0.9,
        designRainfallMm: parseFloat(rain) || 40,
        infiltrationRateMs: parseFloat(soilK) || 1e-5,
        infiltrationAreaM2: parseFloat(infilArea) || 0,
        stormDurationMin: parseFloat(duration) || 120,
        voidRatio: parseFloat(fill) || 0.3,
    }), [area, runoff, rain, soilK, infilArea, duration, fill]);

    const clayWarning = parseFloat(soilK) <= 1e-7;

    const reportData: CalculatorReportData = {
        toolName: 'Faskine (nedsivning)',
        category: 'Udenomsarealer',
        inputs: [
            { label: 'Opland', value: area, unit: 'm²' },
            { label: 'Afløbskoefficient', value: runoff },
            { label: 'Designregn', value: rain, unit: 'mm' },
            { label: 'Nedsivningsevne k', value: soilK, unit: 'm/s' },
            { label: 'Nedsivningsareal', value: infilArea, unit: 'm²' },
            { label: 'Fyldtype hulrum', value: fill },
        ],
        results: [
            { label: 'Nødvendigt magasin', value: r.requiredStorageM3.toFixed(2), unit: 'm³', highlight: true },
            { label: 'Udgravningsvolumen', value: r.excavatedVolumeM3.toFixed(2), unit: 'm³' },
            { label: 'Tilstrømning', value: r.inflowM3.toFixed(2), unit: 'm³' },
            { label: 'Nedsivning under regn', value: r.infiltrationM3.toFixed(2), unit: 'm³' },
        ],
        formula: 'Magasin = A·c·(h/1000) − k·A_side·varighed ; Udgravning = Magasin / hulrum',
        standardsStruktureret: [
            { code: 'DS 432', note: 'Afløbsinstallationer — nedsivning' },
            { code: 'Kommunal tilladelse', note: 'Afledningstilladelse kræves' },
        ],
        safetyDisclaimer: 'Nedsivning kræver nedsivningstest og en afledningstilladelse fra kommunen. Afstandskrav til bygninger, skel og drikkevandsboringer skal overholdes.',
    };

    return (
        <CalculatorPage
            title="Faskine (nedsivning)"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Nødvendigt magasin"
            stickyResult={<><AnimatedNumber value={r.requiredStorageM3} precision={2} /> m³</>}
            shareValue={`Faskine: ${r.requiredStorageM3.toFixed(2)} m³ magasin · ${r.excavatedVolumeM3.toFixed(1)} m³ udgravning`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Opland & jord</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Opland (A)" value={area} onChange={e => setArea(e.target.value)} unit="m²" info="Tilsluttet tag/befæstet areal." />
                        <div className="flex items-end gap-1">
                            <div className="flex-1">
                                <InputField label="Afløbskoeff." value={runoff} onChange={e => setRunoff(e.target.value)} unit="–" info="Tag ~0,9; fliser ~0,7–0,8." />
                            </div>
                            <InfoHint
                                title="Designregn & afløbskoefficient"
                                description="Tilstrømningen = areal × afløbskoefficient × regndybde. Designregnen vælges efter en gentagelsesperiode (fx 5 eller 10 år) og bør have en klimafaktor iht. Spildevandskomiteens skrifter."
                                calculation="Tilstrømning = A · c · (h/1000)"
                            />
                        </div>
                    </div>
                    <InputField label="Designregn (h)" value={rain} onChange={e => setRain(e.target.value)} unit="mm" info="DK 5–10 år ~30–45 mm inkl. klimatillæg." />
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Jordtype (nedsivningsevne)
                            <InfoHint
                                title="Nedsivningsevne k"
                                description="Hvor hurtigt jorden kan optage vand. SKAL bestemmes ved en nedsivningstest på stedet — ler er normalt uegnet til nedsivning."
                                calculation="Nedsivning = k · nedsivningsareal · varighed"
                            />
                        </label>
                        <select aria-label="Jordtype" value={soilK} onChange={e => setSoilK(e.target.value)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary">
                            {SOIL_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Nedsivningsareal" value={infilArea} onChange={e => setInfilArea(e.target.value)} unit="m²" info="Bund + sider af faskinen der nedsiver." />
                        <InputField label="Regnvarighed" value={duration} onChange={e => setDuration(e.target.value)} unit="min" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Fyldtype</label>
                        <select aria-label="Fyldtype" value={fill} onChange={e => setFill(e.target.value)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary">
                            {FILL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-4">
                    {clayWarning && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning text-sm">
                            <InfoIcon className="w-5 h-5 flex-shrink-0" />
                            <span>Meget lav nedsivningsevne (ler). Nedsivning er sandsynligvis ikke mulig — overvej regnbed, forsinkelse eller kloaktilslutning.</span>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Nødvendigt magasin" value={r.requiredStorageM3} precision={2} unit="m³" />
                        <ResultDisplay label="Udgravningsvolumen" value={r.excavatedVolumeM3} precision={2} unit="m³" />
                    </div>
                    <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                        <p className="font-semibold">Vandbalance under designregn</p>
                        <p>Tilstrømning fra opland: {r.inflowM3.toFixed(2)} m³</p>
                        <p>Nedsivning under regn: {r.infiltrationM3.toFixed(2)} m³</p>
                        <p className="font-bold pt-1 border-t border-info-border dark:border-info/30">Magasin at etablere: {r.requiredStorageM3.toFixed(2)} m³</p>
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Nedsivning af regnvand kræver en nedsivningstest og en afledningstilladelse fra kommunen. Overhold afstandskrav
                til bygninger (typisk ≥ 2 m + hensyn til kælder), skel og drikkevandsboringer. Beregningen er vejledende og erstatter
                ikke en detailprojektering iht. DS 432 og Spildevandskomiteens skrifter.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default SoakawayCalculator;
