
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { InfoHint } from '../../../../components/ui';
import { computeWaterFlow, computeFixtureUnitDemand } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { InfoIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'vvs-vandflow';

// ── Advanced (DS 439) fixture catalog ──────────────────────────────────────────
// Standard loading-unit (belastningsenhed) values for common Danish fixtures.
const FIXTURE_SEED: Array<{ name: string; loadingUnits: number }> = [
    { name: 'Håndvask', loadingUnits: 1 },
    { name: 'Køkkenvask', loadingUnits: 2 },
    { name: 'Bruser/bad', loadingUnits: 3 },
    { name: 'Badekar', loadingUnits: 4 },
    { name: 'Toilet/cisterne', loadingUnits: 2 },
    { name: 'Vaskemaskine', loadingUnits: 3 },
    { name: 'Opvaskemaskine', loadingUnits: 2 },
    { name: 'Udvendig hane', loadingUnits: 2 },
];

const BUILDING_TYPES = {
    bolig: { label: 'Bolig', coefficient: 0.5 },
    kontor: { label: 'Kontor / erhverv', coefficient: 0.4 },
} as const;

type BuildingTypeKey = keyof typeof BUILDING_TYPES;

// Seed a realistic small dwelling so the Advanced mode shows a meaningful result.
const DEFAULT_COUNTS = [2, 1, 1, 0, 1, 1, 1, 0];

// Danish decimal formatting (comma separator).
const da = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

const helpContent: HelpContent = {
    formaal:
        'Basis: beregner vandflow (L/s og L/min) i et rør ud fra indvendig diameter og vandhastighed (kontinuitetsligningen). Avanceret (DS 439): estimerer det dimensionsgivende samtidige flow qd ud fra summen af armaturernes belastningsenheder — bruges til at dimensionere forsyningsledningen.',
    variabler: [
        { name: 'Indvendig diameter', symbol: 'd', unit: 'mm', description: 'Rørets indvendige diameter (netto flow-areal). Kun Basis.' },
        { name: 'Vandhastighed', symbol: 'v', unit: 'm/s', description: 'Strømningshastighed. Brugsvand: 1,5–2,0 m/s. Kun Basis.' },
        { name: 'Belastningsenhed', symbol: 'LU', unit: '–', description: 'Normeret mål for et armaturs vandforbrug (tappenhed). Kun Avanceret.' },
        { name: 'Samtidighedskoefficient', symbol: 'k', unit: '–', description: 'Andel af armaturer i samtidig brug. Bolig ≈ 0,5, kontor ≈ 0,4. Kun Avanceret.' },
        { name: 'Dimensionsgivende flow', symbol: 'qd', unit: 'L/s', description: 'Samtidigt flow som installationen skal kunne levere. Kun Avanceret.' },
    ],
    formel: 'Basis:  Q = A × v = π × (d/2)² × v\nAvanceret (DS 439):  ΣLU = Σ(antal × LU) ;  qd = k × √(ΣLU)',
    antagelser:
        'Basis: fuldt rørtværsnit (ingen delvist fyldt rør). Avanceret: forenklet samtidighedskurve (screening) — ikke alle armaturer kører samtidigt, og dette er ikke den fulde sandsynlighedsmetode. qd sættes aldrig under det største enkeltarmaturs flow.',
    standarder:
        'DS 439 – Norm for vandinstallationer (belastningsenheder / samtidig belastning).\nDS/EN 806-3 – Forenklet dimensionering af brugsvandsrør; anbefalet hastighed 1,5–2,0 m/s.',
};

const WaterFlowCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');

    // Basic mode state
    const [diameter, setDiameter] = useState('20');
    const [velocity, setVelocity] = useState('1.5');

    // Advanced mode state
    const [counts, setCounts] = useState<number[]>(DEFAULT_COUNTS);
    const [buildingType, setBuildingType] = useState<BuildingTypeKey>('bolig');

    const changeCount = (index: number, next: number) =>
        setCounts(prev => prev.map((c, i) => (i === index ? Math.max(0, Math.floor(Number.isFinite(next) ? next : 0)) : c)));

    const result = useMemo(() => computeWaterFlow({
        diameterMm: parseFloat(diameter) || 0,
        velocityMs: parseFloat(velocity) || 0,
    }), [diameter, velocity]);

    const coefficient = BUILDING_TYPES[buildingType].coefficient;
    const demand = useMemo(() => computeFixtureUnitDemand({
        fixtures: FIXTURE_SEED.map((f, i) => ({ name: f.name, loadingUnits: f.loadingUnits, count: counts[i] || 0 })),
        coefficient,
    }), [counts, coefficient]);

    const isAdvanced = mode === 'advanced';

    const reportData: CalculatorReportData = isAdvanced
        ? {
            toolName: 'Vandflow – Samtidig belastning (DS 439)',
            category: 'VVS',
            mode: 'Avanceret',
            inputs: [
                { label: 'Bygningstype', value: BUILDING_TYPES[buildingType].label },
                { label: 'Samtidighedskoefficient (k)', value: da(coefficient, 2) },
                ...FIXTURE_SEED.map((f, i) => ({
                    label: `${f.name} (LU ${f.loadingUnits})`,
                    value: String(counts[i] || 0),
                    unit: 'stk',
                })),
            ],
            results: [
                { label: 'Samlede belastningsenheder ΣLU', value: demand.totalLoadingUnits.toFixed(0), unit: 'LU' },
                { label: 'Dimensionsgivende flow qd', value: demand.designFlowLps.toFixed(3), unit: 'L/s', highlight: true },
                { label: 'Dimensionsgivende flow qd', value: demand.designFlowLpm.toFixed(1), unit: 'L/min' },
            ],
            formula: 'ΣLU = Σ(antal × LU) ; qd = k × √(ΣLU)',
            standardsStruktureret: [
                { code: 'DS 439', note: 'Norm for vandinstallationer – belastningsenheder og samtidig belastning.' },
                { code: 'DS/EN 806-3', note: 'Forenklet dimensionering af brugsvandsrør.' },
            ],
        }
        : {
            toolName: 'Vandflow Beregner',
            category: 'VVS',
            mode: 'Basis',
            inputs: [
                { label: 'Indvendig diameter', value: diameter, unit: 'mm' },
                { label: 'Vandhastighed', value: velocity, unit: 'm/s' },
            ],
            results: [
                { label: 'Flowrate', value: result.flowLps.toFixed(3), unit: 'L/s', highlight: true },
                { label: 'Flowrate', value: result.flowLpm.toFixed(2), unit: 'L/min' },
            ],
            formula: 'Q = π × (d/2)² × v',
            standardsStruktureret: [{ code: 'DS/EN 806-3', note: 'Indenlandske vandinstallationer – anbefalet hastighed 1,5–2,0 m/s.' }],
        };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Vandflow Beregner</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Vandflow Beregner"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            stickyResultLabel={isAdvanced ? 'Dim. flow qd' : 'Flowrate'}
            stickyResult={
                isAdvanced
                    ? <><AnimatedNumber value={demand.designFlowLps} precision={2} /> L/s</>
                    : <><AnimatedNumber value={result.flowLps} precision={3} /> L/s</>
            }
            shareValue={
                isAdvanced
                    ? `Dimensionsgivende flow qd: ${demand.designFlowLps.toFixed(2)} L/s (${demand.designFlowLpm.toFixed(1)} L/min) · ΣLU = ${demand.totalLoadingUnits.toFixed(0)}`
                    : `Vandflow: ${result.flowLps.toFixed(3)} L/s · ${result.flowLpm.toFixed(2)} L/min i ∅${diameter} mm rør`
            }
        >
            {isAdvanced ? (
                /* ── Advanced: Samtidig belastning (DS 439) ── */
                <div className="grid md:grid-cols-2 gap-6 items-start">
                    {/* Inputs: fixture list + building type */}
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                        <div className="flex items-center gap-1">
                            <h3 className="font-bold text-lg">Armaturer i installationen</h3>
                            <InfoHint
                                title="Belastningsenhed (LU)"
                                description="En belastningsenhed (loading unit / tappenhed) er et normeret mål for et armaturs vandforbrug — fx ~1 for en håndvask og ~3–4 for et badekar. Man lægger alle armaturers belastningsenheder sammen og omregner summen til et dimensionerende flow."
                                calculation="ΣLU = Σ (antal × LU pr. armatur)"
                            />
                        </div>
                        <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mb-1">Sæt antallet af hvert armatur. 0 = ikke til stede.</p>

                        <div className="space-y-2">
                            {FIXTURE_SEED.map((f, i) => (
                                <div key={f.name} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{f.name}</p>
                                        <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary">LU {f.loadingUnits}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            aria-label={`Færre ${f.name}`}
                                            onClick={() => changeCount(i, (counts[i] || 0) - 1)}
                                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong dark:border-border-dark-strong text-lg font-semibold text-text-secondary dark:text-text-dark-secondary hover:bg-bg-muted dark:hover:bg-bg-dark-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                                        >
                                            −
                                        </button>
                                        <input
                                            type="number"
                                            min={0}
                                            inputMode="numeric"
                                            aria-label={`Antal ${f.name}`}
                                            value={counts[i] ?? 0}
                                            onChange={e => changeCount(i, parseInt(e.target.value, 10))}
                                            className="w-14 h-11 text-center border border-border-strong dark:border-border-dark-strong rounded-lg bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            aria-label={`Flere ${f.name}`}
                                            onClick={() => changeCount(i, (counts[i] || 0) + 1)}
                                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border-strong dark:border-border-dark-strong text-lg font-semibold text-text-secondary dark:text-text-dark-secondary hover:bg-bg-muted dark:hover:bg-bg-dark-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Bygningstype (samtidighed)
                                <InfoHint
                                    title="Samtidighedskoefficient k"
                                    description="Ikke alle armaturer bruges samtidigt. Koefficienten k afspejler den forventede samtidighed for bygningstypen — lavere for kontor end for bolig. qd = k · √(ΣLU) er et forenklet screening-estimat (DS 439 / EN 806-3), ikke den fulde sandsynlighedsmetode."
                                    calculation="Bolig k ≈ 0,5 · Kontor k ≈ 0,4"
                                />
                            </label>
                            <select
                                aria-label="Bygningstype"
                                value={buildingType}
                                onChange={e => setBuildingType(e.target.value as BuildingTypeKey)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                            >
                                {(Object.entries(BUILDING_TYPES) as Array<[BuildingTypeKey, typeof BUILDING_TYPES[BuildingTypeKey]]>).map(([key, v]) => (
                                    <option key={key} value={key}>{v.label} (k = {da(v.coefficient, 1)})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Results */}
                    <div className="space-y-6">
                        {/* Highlighted qd result card */}
                        <div className="p-5 rounded-card border-l-4 border-brand-primary bg-info-subtle dark:bg-info-subtle-dark shadow-sm">
                            <div className="flex items-start gap-3">
                                <InfoIcon className="w-6 h-6 text-brand-primary flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                        <h4 className="font-bold text-text-primary dark:text-text-dark-primary">Dimensionsgivende flow qd</h4>
                                        <InfoHint
                                            title="Dimensionsgivende (samtidigt) flow qd"
                                            description="Det flow installationen skal kunne levere, når der tages højde for at ikke alle armaturer kører på én gang. Bruges til at dimensionere forsyningsledningen — indsæt qd i rørdimensioneringen (fx dette værktøjs Basis-tilstand med en hastighed på 1,5–2,0 m/s)."
                                            calculation="qd = k · √(ΣLU) — forenklet screening (DS 439 / EN 806-3), ikke den fulde sandsynlighedsmetode"
                                        />
                                    </div>
                                    <p className="text-3xl font-bold text-brand-primary mt-1">
                                        <AnimatedNumber value={demand.designFlowLps} precision={2} /> <span className="text-lg font-semibold">L/s</span>
                                    </p>
                                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
                                        ≈ {demand.designFlowLpm.toFixed(1)} L/min ved ΣLU = {demand.totalLoadingUnits.toFixed(0)} belastningsenheder
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <ResultDisplay label="Dim. flow qd" value={demand.designFlowLps} unit="L/s" precision={2} />
                            <ResultDisplay label="Samlede belastningsenheder" value={demand.totalLoadingUnits} unit="LU" precision={0} />
                        </div>

                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                            <p className="font-semibold">Sådan bruges qd</p>
                            <p>ΣLU = {demand.totalLoadingUnits.toFixed(0)} → qd = {da(coefficient, 1)} · √{demand.totalLoadingUnits.toFixed(0)} = {demand.designFlowLps.toFixed(2)} L/s</p>
                            <p>Brug qd til at dimensionere forsyningsledningen: vælg en rørdiameter, så hastigheden holder sig på 1,5–2,0 m/s (skift til Basis-tilstand for rørberegningen).</p>
                            <p className="text-xs opacity-90">Forenklet screening pr. DS 439 / EN 806-3 — ikke den fulde sandsynlighedsberegning. Ikke alle armaturer kører samtidigt.</p>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── Basic: flow fra diameter + hastighed ── */
                <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                        <h3 className="font-bold text-lg">Rørets Data</h3>
                        <InputField
                            label="Indvendig diameter (d)"
                            value={diameter}
                            onChange={e => setDiameter(e.target.value)}
                            unit="mm"
                            info="Rørets netto indvendige dimension (flow-areal)."
                        />
                        <InputField
                            label="Vandhastighed (v)"
                            value={velocity}
                            onChange={e => setVelocity(e.target.value)}
                            unit="m/s"
                            info="Anbefalet 1,5–2,0 m/s for brugsvandsrør for at undgå støj."
                        />
                    </div>

                    <div className="space-y-4">
                        <ResultDisplay label="Flowrate" value={result.flowLps} unit="L/s" precision={3} />
                        <ResultDisplay label="Flowrate" value={result.flowLpm} unit="L/min" precision={2} />

                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                            <p className="font-semibold">Beregning</p>
                            <p>A = π × (∅{diameter}/2)² = {(Math.PI * Math.pow((parseFloat(diameter) || 0) / 2000, 2) * 1e6).toFixed(2)} mm²</p>
                            <p>Q = A × {velocity} m/s = {result.flowLps.toFixed(3)} L/s</p>
                        </div>
                    </div>
                </div>
            )}
        </CalculatorPage>
    );
};

export default WaterFlowCalculator;
