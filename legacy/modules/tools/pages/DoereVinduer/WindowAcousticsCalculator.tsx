
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeWindowAcoustics, type GlazingAcousticType } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

// Glazing build-ups and their indicative airborne sound reduction Rw [dB].
// Rw+Ctr (the traffic-relevant value) is computed by the shared, tested helper.
const GLAZING_OPTIONS: { key: GlazingAcousticType; label: string; rw: number }[] = [
    { key: 'standard-2', label: '2-lag standard (4-16-4)', rw: 30 },
    { key: 'thermal-3', label: '3-lag energirude', rw: 33 },
    { key: 'laminated', label: 'Lamineret (asymmetrisk + PVB)', rw: 38 },
    { key: 'acoustic', label: 'Lyddæmpende rude (tyk laminering)', rw: 42 },
];

// Noise-environment presets → indicative required Rw+Ctr for the facade [dB].
// The real requirement always comes from the project's støjkortlægning.
const NOISE_PRESETS: { key: string; label: string; required: number }[] = [
    { key: 'quiet', label: 'Stille område', required: 28 },
    { key: 'road', label: 'Almindelig vej', required: 33 },
    { key: 'heavy', label: 'Stærkt trafikeret', required: 38 },
    { key: 'custom', label: 'Brugerdefineret (fra støjrapport)', required: 0 },
];

const helpContent: HelpContent = {
    formaal: 'Vurderer om en rude opfylder facadens lydisolationskrav mod udefrakommende støj (fx trafik). Sammenligner rudens vejede lydreduktionstal med spektertilpasning, Rw+Ctr, mod det krævede facadekrav fra en støjkortlægning.',
    variabler: [
        { name: 'Vejet lydreduktionstal', symbol: 'Rw', unit: 'dB', description: 'Rudens samlede luftlydisolation som ét tal (DS/EN ISO 717-1).' },
        { name: 'Spektertilpasningsled', symbol: 'Ctr', unit: 'dB', description: 'Korrektion for lavfrekvent støj (trafik). Altid negativ.' },
        { name: 'Trafikrelevant tal', symbol: 'Rw+Ctr', unit: 'dB', description: 'Rw korrigeret for trafikstøj — dét facadekravet normalt stilles til.' },
        { name: 'Facadekrav', symbol: 'krav', unit: 'dB', description: 'Krævet Rw+Ctr for facaden iht. støjkortlægning/støjrapport.' },
    ],
    formel: 'Rw+Ctr = Rw + Ctr   (Ctr < 0)\nKrav: Rw+Ctr ≥ facadekrav',
    antagelser: 'Rw og Ctr er vejledende typiske værdier for ruden alene. Den samlede facadeisolation afhænger også af karm, tætninger, montage og vægkonstruktion — brug altid producentens testede Rw og en projektspecifik støjvurdering.',
    standarder: 'DS/EN ISO 717-1 – Vejet lydreduktionstal Rw og spektertilpasningsled C, Ctr\nDS/EN ISO 10140 – Laboratoriemåling af bygningsdeles luftlydisolation\nBR18 §368 – Støj; facadekrav fastlægges ud fra støjbelastning/støjkortlægning',
};

const TOOL_ID = 'doere-vinduer-lydrude';

const WindowAcousticsCalculator: React.FC = () => {
    const [glazingType, setGlazingType] = useState<GlazingAcousticType>('thermal-3');
    const [requiredRwCtr, setRequiredRwCtr] = useState('33');
    const [presetKey, setPresetKey] = useState('road');

    const glazing = GLAZING_OPTIONS.find(g => g.key === glazingType) ?? GLAZING_OPTIONS[0];
    const required = parseFloat(requiredRwCtr) || 0;

    const r = useMemo(() => computeWindowAcoustics({
        glazingType,
        requiredRwCtr: required,
    }), [glazingType, required]);

    // Noise-environment preset sets the required Rw+Ctr; manual edit switches to "custom".
    const handlePreset = (key: string) => {
        setPresetKey(key);
        const preset = NOISE_PRESETS.find(p => p.key === key);
        if (preset && preset.key !== 'custom') {
            setRequiredRwCtr(String(preset.required));
        }
    };
    const handleRequiredChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRequiredRwCtr(e.target.value);
        setPresetKey('custom');
    };

    const margin = r.rwCtr - required; // ≥ 0 → opfylder kravet

    const reportData: CalculatorReportData = {
        toolName: 'Lydrude (facadestøj)',
        category: 'Døre & Vinduer',
        inputs: [
            { label: 'Rudetype', value: r.label },
            { label: 'Facadekrav (Rw+Ctr)', value: requiredRwCtr, unit: 'dB' },
        ],
        results: [
            { label: 'Rw', value: r.rw.toFixed(0), unit: 'dB' },
            { label: 'Rw+Ctr (trafikstøj)', value: r.rwCtr.toFixed(0), unit: 'dB', highlight: true },
            { label: 'Margin ift. krav', value: `${margin >= 0 ? '+' : ''}${margin.toFixed(0)}`, unit: 'dB' },
            { label: 'Status', value: r.passed ? 'OK (Rw+Ctr ≥ krav)' : 'IKKE OK' },
        ],
        formula: 'Rw+Ctr = Rw + Ctr ; krav: Rw+Ctr ≥ facadekrav',
        standardsStruktureret: [
            { code: 'DS/EN ISO 717-1', note: 'Vejet lydreduktionstal Rw og spektertilpasningsled C, Ctr' },
            { code: 'DS/EN ISO 10140', note: 'Laboratoriemåling af luftlydisolation' },
            { code: 'BR18', clause: '§368', note: 'Støj — facadekrav fra støjkortlægning/støjbelastning' },
        ],
        safetyDisclaimer: 'Rw- og Ctr-værdierne er vejledende for ruden alene. Det faktiske facadekrav kommer fra en støjkortlægning/støjrapport, og den opnåede lydisolation skal dokumenteres med producentens testede Rw samt korrekt montage og tætning.',
    };

    // Honest achieved-vs-required bar: fill = opnået Rw+Ctr, marker = krav.
    // Grøn når opnået ≥ krav (højere Rw+Ctr er bedre).
    const AchievedBar = useMemo(() => {
        const scale = 50; // dB, dækker typiske ruder (~20-45)
        const achievedPct = Math.min(100, Math.max(0, (r.rwCtr / scale) * 100));
        const reqPct = Math.min(100, Math.max(0, (required / scale) * 100));
        return (
            <div className="space-y-1">
                <div className="relative h-5 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                    <div
                        className={`absolute inset-y-0 left-0 ${r.passed ? 'bg-success/70' : 'bg-danger/60'}`}
                        style={{ width: `${achievedPct}%` }}
                    />
                    {/* Krav-markør (minimum) */}
                    <div className="absolute top-0 bottom-0 w-1 bg-text-primary dark:bg-white" style={{ left: `${reqPct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-text-tertiary dark:text-text-dark-tertiary">
                    <span>0 dB</span>
                    <span>Krav (min.) = {required.toFixed(0)} dB</span>
                    <span>{scale} dB</span>
                </div>
            </div>
        );
    }, [r.rwCtr, r.passed, required]);

    return (
        <CalculatorPage
            title="Lydrude (facadestøj)"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Rw+Ctr"
            stickyResult={<><AnimatedNumber value={r.rwCtr} precision={0} /> dB</>}
            shareValue={`Rw+Ctr ${r.rwCtr.toFixed(0)} dB / krav ${required.toFixed(0)} dB · ${r.passed ? 'OK' : 'Ikke OK'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">Rudens lydisolation mod udefrakommende støj (fx trafik).</p>

                    {/* Rudetype */}
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Rudetype
                            <InfoHint
                                title="Rw — vejet lydreduktionstal"
                                description="Rw beskriver rudens samlede luftlydisolation som ét tal (jo højere, jo bedre) og bestemmes efter DS/EN ISO 717-1 ud fra en måling i hele frekvensområdet. Det er et laboratorietal for ruden alene."
                                calculation="Højere Rw ⇒ bedre lydisolation"
                            />
                        </label>
                        <select
                            aria-label="Rudetype"
                            value={glazingType}
                            onChange={e => setGlazingType(e.target.value as GlazingAcousticType)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            {GLAZING_OPTIONS.map(g => <option key={g.key} value={g.key}>{g.label} (Rw ≈ {g.rw})</option>)}
                        </select>
                        <p className="mt-1 text-xs text-text-tertiary dark:text-text-dark-tertiary">
                            Lamineret/asymmetrisk glas (forskellig glastykkelse + PVB-folie) og gode tætninger/karme forbedrer lydisolationen markant.
                        </p>
                    </div>

                    {/* Støjmiljø preset */}
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Støjmiljø (forudindstiller kravet)
                            <InfoHint
                                title="Ctr — spektertilpasning for trafikstøj"
                                description="Ctr er et korrektionsled (altid negativt) der tilpasser Rw til lavfrekvent støj som vejtrafik. Netop Rw+Ctr — ikke Rw alene — er dét, der er relevant for trafikstøj, fordi bilmotorer og dæk larmer mest i de lave frekvenser."
                                calculation="Rw+Ctr = Rw + Ctr (Ctr < 0)"
                            />
                        </label>
                        <select
                            aria-label="Støjmiljø"
                            value={presetKey}
                            onChange={e => handlePreset(e.target.value)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            {NOISE_PRESETS.map(p => (
                                <option key={p.key} value={p.key}>
                                    {p.label}{p.key !== 'custom' ? ` (≈ ${p.required} dB)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField
                                label="Facadekrav (Rw+Ctr)"
                                value={requiredRwCtr}
                                onChange={handleRequiredChange}
                                unit="dB"
                                info="Det krævede Rw+Ctr for facaden. Fastlægges i en støjkortlægning/støjrapport ud fra støjbelastningen på grunden."
                            />
                        </div>
                        <InfoHint
                            title="Facadekrav fra støjkortlægning"
                            description="Facadens lydisolationskrav afhænger af den udvendige støjbelastning (fx Lden fra trafik) og fastlægges i projektets støjrapport. BR18 §368 stiller krav om, at støjniveauet indendørs holdes under grænseværdierne — dette tal er dét, ruden (og hele facaden) skal leve op til."
                            calculation="Krav afhænger af udvendig støj − ønsket indendørs niveau"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Verdict */}
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${r.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {r.passed ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed ? 'Ruden opfylder facadekravet' : 'Utilstrækkelig — vælg en tungere/lamineret rude'}
                                </h4>
                                <p className={`text-sm mt-0.5 ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed
                                        ? `Rw+Ctr = ${r.rwCtr.toFixed(0)} dB ≥ krav ${required.toFixed(0)} dB (margin +${margin.toFixed(0)} dB).`
                                        : `Rw+Ctr = ${r.rwCtr.toFixed(0)} dB < krav ${required.toFixed(0)} dB (mangler ${Math.abs(margin).toFixed(0)} dB). Vælg lamineret/asymmetrisk eller en decideret lyddæmpende rude.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Rw" value={r.rw} precision={0} unit="dB" />
                        <ResultDisplay label="Rw+Ctr (trafik)" value={r.rwCtr} precision={0} unit="dB" />
                    </div>

                    {/* Honest achieved-vs-required bar (higher Rw+Ctr is better) */}
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Opnået Rw+Ctr vs. krav</h4>
                        {AchievedBar}
                        <p className="mt-2 text-xs text-text-tertiary dark:text-text-dark-tertiary">
                            Højere Rw+Ctr er bedre. Bjælken er grøn når ruden opnår mindst det krævede — den sorte markør viser facadekravet (minimum).
                        </p>
                    </div>

                    {/* ComplianceMeter — honest inverted framing: kravet (nål) skal ligge ≤ opnået (grænse) */}
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <ComplianceMeter
                            label="Krav ≤ opnået Rw+Ctr (dB)"
                            value={required}
                            limit={r.rwCtr}
                            min={0}
                            max={50}
                            unit=" dB"
                            decimalPlaces={0}
                        />
                        <p className="mt-1 text-xs text-text-tertiary dark:text-text-dark-tertiary">
                            Nålen er facadekravet; den grønne zone rækker op til det ruden opnår (Rw+Ctr = {r.rwCtr.toFixed(0)} dB). Grøn = kravet er dækket.
                        </p>
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Rw- og Ctr-værdierne er vejledende typiske tal for ruden alene. Det faktiske facadekrav skal komme fra en
                støjkortlægning/støjvurdering (BR18 §368), og den opnåede lydisolation afhænger også af karm, tætninger og montage —
                dokumentér altid med producentens testede Rw efter DS/EN ISO 717-1 / DS/EN ISO 10140.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default WindowAcousticsCalculator;
