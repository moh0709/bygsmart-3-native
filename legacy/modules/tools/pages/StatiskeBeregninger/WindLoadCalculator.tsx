
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { computeWindLoad } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';

const TERRAIN_CATEGORIES = [
    { value: '0', label: 'Kategori 0 – Hav/kyst', z0: 0.003, kr: 0.156 },
    { value: '1', label: 'Kategori 1 – Åbent land', z0: 0.01, kr: 0.17 },
    { value: '2', label: 'Kategori 2 – Spredt bebyggelse (standard)', z0: 0.05, kr: 0.19 },
    { value: '3', label: 'Kategori 3 – Forstæder/skov', z0: 0.3, kr: 0.215 },
    { value: '4', label: 'Kategori 4 – By/tæt bebyggelse', z0: 1.0, kr: 0.234 },
];

const helpContent: HelpContent = {
    formaal: 'Beregner vindtryk og vindkraft på en bygningsflade iht. DS/EN 1991-1-4 (Eurocode 1 vind). Simpel tilstand: basistryk × areal. Avanceret tilstand tilføjer terræneksponering (ce) og trykkoefficient (Cp).',
    variabler: [
        { name: 'Vindhastighed', symbol: 'vb', unit: 'm/s', description: 'Basis referencehastighed. DK indland: 24 m/s, Vesterhavet: 27 m/s.' },
        { name: 'Areal', symbol: 'A', unit: 'm²', description: 'Det areal vinden virker på (gavl, tagflade osv.).' },
        { name: 'Trykkoefficient', symbol: 'Cp', unit: '–', description: 'Formfaktor for bygningsdelen. Typisk 0,8 (pres) til −0,5 (sug). Avanceret tilstand.' },
        { name: 'Terrænkategori', symbol: '–', unit: '–', description: 'Omgivelsernes ruhed. Påvirker eksponeringskoefficienten ce. Avanceret tilstand.' },
    ],
    formel: 'qb = ½ · ρ · vb²   (ρ = 1,25 kg/m³)\nwe = qb · ce · Cp\nF = we · A',
    antagelser: 'Simpel tilstand: ce = 1,0, Cp = 1,0 (konservativt). Avanceret: ce beregnes fra terrænkategori og referencevindhøjde z.',
    standarder: 'DS/EN 1990 (EC0) – Lastkombinationer og sikkerhed\nDS/EN 1991-1-1 (EC1) – Egenlast og nyttelast\nDS/EN 1991-1-3 (EC1 sne) – DK: sk = 1,0 kN/m²\nDS/EN 1991-1-4 (EC1 vind) – DK: vb,0 = 24 m/s',
};

const TOOL_ID = 'statiske-beregninger-vindlast';

// Typical cladding design limit
const PRESSURE_DESIGN_LIMIT = 1.5;

const WindLoadCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [inputs, setInputs] = useState({
        area: '50',
        windSpeed: '24',
        terrainCategory: '2',
        cp: '0.8',
        height: '10',
    });
    const [results, setResults] = useState({ pressure: 0, force: 0 });

    const handleChange = (field: keyof typeof inputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const area = parseFloat(inputs.area) || 0;
        const v = parseFloat(inputs.windSpeed) || 0;

        if (mode === 'basic') {
            const result = computeWindLoad({ windSpeed: v, area, Cp: 1.0 });
            setResults({ pressure: result.pressureKPa, force: result.forceKN });
        } else {
            const terrain = TERRAIN_CATEGORIES.find(t => t.value === inputs.terrainCategory) ?? TERRAIN_CATEGORIES[2];
            const z = Math.max(parseFloat(inputs.height) || 10, 1);
            const z0 = terrain.z0;
            const kr = terrain.kr;
            const cr = kr * Math.log(Math.max(z, z0) / z0);
            const Iv = 1 / Math.log(Math.max(z, z0) / z0);
            const ce = Math.max(cr * cr * (1 + 7 * Iv), 0.1);
            const cp = parseFloat(inputs.cp) || 0.8;
            // Scale wind speed by √ce so that ½ρv²·ce = ½ρ(v·√ce)²
            const vEff = v * Math.sqrt(ce);
            const result = computeWindLoad({ windSpeed: vEff, area, Cp: cp });
            setResults({ pressure: result.pressureKPa, force: result.forceKN });
        }
    }, [inputs, mode]);

    const reportData = useMemo<CalculatorReportData>(() => {
        const terrainLabel = TERRAIN_CATEGORIES.find(t => t.value === inputs.terrainCategory)?.label ?? inputs.terrainCategory;
        const baseInputs = [
            { label: 'Basis Vindhastighed (vb)', value: inputs.windSpeed, unit: 'm/s' },
            { label: 'Areal af Fladen (A)', value: inputs.area, unit: 'm²' },
        ];
        const advancedInputs = mode === 'advanced' ? [
            { label: 'Terrænkategori', value: terrainLabel },
            { label: 'Referencevindhøjde (z)', value: inputs.height, unit: 'm' },
            { label: 'Trykkoefficient (Cp)', value: inputs.cp, unit: '–' },
        ] : [];
        return {
            toolName: 'Vindlast Beregner',
            category: 'Statiske Beregninger',
            mode: mode === 'basic' ? 'Simpel' : 'Avanceret (EC1)',
            inputs: [...baseInputs, ...advancedInputs],
            results: [
                { label: 'Vindtryk (we)', value: results.pressure.toFixed(3), unit: 'kPa', highlight: true },
                { label: 'Total Vindkraft (F)', value: results.force.toFixed(2), unit: 'kN' },
            ],
            formula: 'qb = ½ · ρ · vb²   (ρ = 1,25 kg/m³)\nwe = qb · ce · Cp\nF = we · A',
            standardsStruktureret: [
                { code: 'DS/EN 1991-1-4', note: 'EC1 Vind – DK: vb,0 = 24 m/s' },
                { code: 'DS/EN 1990', note: 'EC0 – Lastkombinationer og sikkerhed' },
                { code: 'BR18', note: 'Bygningsreglementet' },
            ],
            safetyDisclaimer: 'Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.',
        };
    }, [inputs, results, mode]);

    if (!allowed) return null;

    return (
        <CalculatorPage
            title="Vindlast Beregner"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            shareValue={`Vindtryk: ${results.pressure.toFixed(3)} kPa, Vindkraft: ${results.force.toFixed(2)} kN`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* Inputs */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">
                        {mode === 'basic'
                            ? 'Forsimplet vindlast: basistryk × areal.'
                            : 'EC1-beregning med terræneksponering og trykkoefficient.'}
                    </p>

                    <InputField
                        label="Basis Vindhastighed (vb)"
                        value={inputs.windSpeed}
                        onChange={handleChange('windSpeed')}
                        unit="m/s"
                        info="Referencevindhastighed. DK indland: 24 m/s. Vesterhavet: 27 m/s."
                    />
                    <InputField
                        label="Areal af Fladen (A)"
                        value={inputs.area}
                        onChange={handleChange('area')}
                        unit="m²"
                        info="Det areal vinden rammer, f.eks. en gavl eller et tag."
                    />

                    {mode === 'advanced' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Terrænkategori
                                </label>
                                <select
                                    value={inputs.terrainCategory}
                                    onChange={handleChange('terrainCategory')}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                >
                                    {TERRAIN_CATEGORIES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>
                            <InputField
                                label="Referencevindhøjde (z)"
                                value={inputs.height}
                                onChange={handleChange('height')}
                                unit="m"
                                info="Højde over terræn for fladen. Typisk bygningshøjde."
                            />
                            <InputField
                                label="Trykkoefficient (Cp)"
                                value={inputs.cp}
                                onChange={handleChange('cp')}
                                unit="–"
                                info="Formfaktor: 0,8 typisk vindpres på facade. Negativ for sug. Jf. EC1-1-4 tabel 7."
                            />
                        </>
                    )}
                </div>

                {/* Results */}
                <div className="space-y-6">
                    <ResultDisplay
                        label="Vindtryk (we)"
                        value={results.pressure}
                        precision={3}
                        unit="kPa"
                    />
                    <ResultDisplay
                        label="Total Vindkraft (F)"
                        value={results.force}
                        unit="kN"
                    />
                    <ComplianceMeter
                        label="Vindtryk vs. typisk beklædningsgrænse (1,5 kPa)"
                        value={results.pressure}
                        limit={PRESSURE_DESIGN_LIMIT}
                        unit="kPa"
                        decimalPlaces={3}
                    />
                </div>
            </div>

            <SafetyDisclaimer>
                Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default WindLoadCalculator;
