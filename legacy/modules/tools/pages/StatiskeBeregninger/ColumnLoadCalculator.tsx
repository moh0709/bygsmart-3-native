
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import {
    computeColumnCapacity,
    COLUMN_MATERIALS,
    COLUMN_END_CONDITIONS,
    STANDARDS_CATALOG,
} from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'statiske-beregninger-soejlebelastning';

const helpContent: HelpContent = {
    formaal:
        'Dimensionerer en trykpåvirket søjle iht. EC5 (træ) / EC3 (stål): beregner både knæk (buckling) og trykbrud (crushing) og viser udnyttelsesgraden Nd/N_b,Rd. I modsætning til en ren Euler-beregning fanger denne også korte, kraftige søjler, hvor trykbrud er dimensionsgivende.',
    variabler: [
        { name: 'Bredde', symbol: 'b', unit: 'm', description: 'Tværsnitsbredde.' },
        { name: 'Dybde', symbol: 'd', unit: 'm', description: 'Tværsnitsdybde. Knæk sker om den svage akse (mindste I).' },
        { name: 'Frihøjde', symbol: 'L', unit: 'm', description: 'Systemhøjde. Effektiv knæklængde = k × L.' },
        { name: 'Anvendt designlast', symbol: 'Nd', unit: 'kN', description: 'Dimensionerende aksialtrykkraft (allerede ganget med lastfaktorer, EC0).' },
        { name: 'Relativ slankhed', symbol: 'λrel', unit: '–', description: 'λrel = √(A·fck / Ncr). Lav = kraftig søjle (trykbrud), høj = slank (knæk).' },
        { name: 'Reduktionsfaktor', symbol: 'kc / χ', unit: '–', description: 'Reducerer trykstyrken pga. knækrisiko. kc=1 for helt kompakte søjler.' },
    ],
    formel:
        'I = min(b·d³, d·b³) / 12\nNcr = π²·E·I / (k·L)²          [Euler]\nλrel = √(A·fck / Ncr)\nkc = 1 / (k* + √(k*² − λrel²))\nN_b,Rd = kc · A · fc,d           [fc,d = kmod·fck / γM]\nUdnyttelse = Nd / N_b,Rd ≤ 1,0',
    antagelser:
        'Centrisk aksialtryk uden påsat moment. Konstante tværsnit. Reduktionsfaktoren følger den fælles EC5 §6.3.2 / EC3 §6.3.1-form. Excentricitet, tværlast og lokal pladeknækning er ikke medregnet.',
    standarder:
        'DS/EN 1995-1-1 (EC5) §6.3.2 – Trækonstruktioner, søjleknæk (kc, βc)\nDS/EN 1993-1-1 (EC3) §6.3.1 – Stålkonstruktioner, søjleknæk (χ, knækkurver)\nDS/EN 1990 (EC0) – Lastkombinationer og partialkoefficienter',
};

const ColumnLoadCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [dims, setDims] = useState({ height: '3', width: '0.1', depth: '0.1', appliedLoad: '150' });
    const [materialKey, setMaterialKey] = useState('steel-s235');
    const [endKey, setEndKey] = useState('pinned-pinned');

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    const material = COLUMN_MATERIALS[materialKey];
    const endCond = COLUMN_END_CONDITIONS[endKey];

    const r = useMemo(() => computeColumnCapacity({
        widthM: parseFloat(dims.width) || 0,
        depthM: parseFloat(dims.depth) || 0,
        heightM: parseFloat(dims.height) || 0,
        appliedLoadKN: parseFloat(dims.appliedLoad) || 0,
        material,
        // End-condition factor is an Advanced feature; Basic assumes pinned–pinned (k=1).
        effectiveLengthFactor: mode === 'advanced' ? endCond.k : 1,
    }), [dims, material, endCond, mode]);

    const utilPct = r.utilization * 100;
    const governingLabel = r.governing === 'buckling' ? 'Knæk (buckling)' : r.governing === 'crushing' ? 'Trykbrud (crushing)' : '–';

    const reportData: CalculatorReportData = {
        toolName: 'Søjlebelastning (EC5/EC3)',
        category: 'Statiske Beregninger',
        mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
        inputs: [
            { label: 'Materiale', value: material.label },
            { label: 'Frihøjde (L)', value: dims.height, unit: 'm' },
            { label: 'Bredde (b)', value: dims.width, unit: 'm' },
            { label: 'Dybde (d)', value: dims.depth, unit: 'm' },
            ...(mode === 'advanced' ? [{ label: 'Endebetingelser', value: endCond.label }] : []),
            { label: 'Anvendt designlast (Nd)', value: dims.appliedLoad, unit: 'kN' },
        ],
        results: [
            { label: 'Design-bæreevne N_b,Rd', value: r.bucklingResistanceKN.toFixed(1), unit: 'kN', highlight: true },
            { label: 'Udnyttelsesgrad Nd/N_b,Rd', value: `${utilPct.toFixed(0)}%` },
            { label: 'Status', value: r.passed ? 'OK (≤ 100%)' : 'OVERBELASTET' },
            { label: 'Dimensionsgivende', value: governingLabel },
            { label: 'Relativ slankhed λrel', value: r.relativeSlenderness.toFixed(2) },
            { label: 'Reduktionsfaktor kc', value: r.reductionFactor.toFixed(3) },
            { label: 'Euler knækkraft Ncr', value: r.eulerCritKN.toFixed(1), unit: 'kN' },
            { label: 'Trykbrud-bæreevne A·fc,d', value: r.crushResistanceKN.toFixed(1), unit: 'kN' },
        ],
        formula: 'N_b,Rd = kc · A · fc,d ; Udnyttelse = Nd / N_b,Rd ≤ 1,0',
        standardsStruktureret: STANDARDS_CATALOG.statics,
        safetyDisclaimer: 'Statiske beregninger er vejledende. Bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18 og Eurokode.',
    };

    // ── Interactive visualization: column + capacity-breakdown bars ─────────────
    const Diagram = useMemo(() => {
        const util = Math.min(Math.max(r.utilization, 0), 1.5);
        const barMax = Math.max(r.crushResistanceKN, r.eulerCritKN, r.bucklingResistanceKN, 1);
        const bar = (v: number) => `${Math.min(100, (v / barMax) * 100)}%`;
        const ok = r.passed;
        return (
            <div className="space-y-4">
                {/* Capacity comparison bars */}
                <div className="space-y-2">
                    {[
                        { label: 'Euler Ncr', v: r.eulerCritKN, color: 'bg-slate-400' },
                        { label: 'Trykbrud A·fc,d', v: r.crushResistanceKN, color: 'bg-amber-400' },
                        { label: 'Design N_b,Rd', v: r.bucklingResistanceKN, color: 'bg-brand-primary' },
                        { label: 'Anvendt Nd', v: parseFloat(dims.appliedLoad) || 0, color: ok ? 'bg-success' : 'bg-danger' },
                    ].map(row => (
                        <div key={row.label} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 text-xs text-text-secondary dark:text-text-dark-secondary">{row.label}</span>
                            <div className="flex-1 h-4 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                                <div className={`h-full rounded-full ${row.color} transition-all duration-500`} style={{ width: bar(row.v) }} />
                            </div>
                            <span className="w-16 shrink-0 text-right text-xs font-medium text-text-primary dark:text-text-dark-primary">{row.v.toFixed(0)} kN</span>
                        </div>
                    ))}
                </div>
                {/* Slenderness position marker */}
                <div>
                    <div className="flex justify-between text-[10px] text-text-tertiary dark:text-text-dark-tertiary mb-1">
                        <span>Kompakt (trykbrud)</span>
                        <span>Slank (knæk)</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-slate-400">
                        <div
                            className="absolute -top-1 w-1 h-4 bg-text-primary dark:bg-white rounded-full shadow"
                            style={{ left: `${Math.min(100, (r.relativeSlenderness / 2.5) * 100)}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-text-tertiary dark:text-text-dark-tertiary mt-1 text-center">
                        λrel = {r.relativeSlenderness.toFixed(2)} → dimensionsgivende: <strong>{governingLabel}</strong>
                    </p>
                </div>
                <p className="sr-only">Udnyttelse {util}</p>
            </div>
        );
    }, [r, dims.appliedLoad, governingLabel]);

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Søjlebelastning Beregner</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Søjlebelastning (EC5/EC3)"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            stickyResultLabel="Udnyttelsesgrad"
            stickyResult={<><AnimatedNumber value={utilPct} precision={0} /> %</>}
            shareValue={`Design-bæreevne: ${r.bucklingResistanceKN.toFixed(1)} kN · Udnyttelse: ${utilPct.toFixed(0)}% · ${r.passed ? 'OK' : 'Overbelastet'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* ── Inputs ── */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Søjledata</h3>
                    <p className="text-sm text-text-secondary -mb-2">Design-check af trykpåvirket søjle (knæk + trykbrud) iht. Eurokode.</p>

                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Materiale & styrkeklasse
                            <InfoHint
                                title="Materiale (Eurokode)"
                                description="Vælg konstruktionsmateriale. Hver klasse bærer sine karakteristiske styrke- og stivhedsværdier samt partialkoefficient γM fra Eurokode."
                                calculation={material.standardNote}
                            />
                        </label>
                        <select
                            aria-label="Materiale"
                            value={materialKey}
                            onChange={e => setMaterialKey(e.target.value)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                        >
                            {Object.values(COLUMN_MATERIALS).map(m => (
                                <option key={m.key} value={m.key}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <InputField label="Frihøjde (L)" value={dims.height} onChange={e => handleDimChange(e, 'height')} unit="m" info="Systemhøjde. Effektiv knæklængde = k × L." />
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Bredde (b)" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" />
                        <InputField label="Dybde (d)" value={dims.depth} onChange={e => handleDimChange(e, 'depth')} unit="m" info="Knæk sker om den svage akse (mindste inertimoment)." />
                    </div>

                    <InputField label="Anvendt designlast (Nd)" value={dims.appliedLoad} onChange={e => handleDimChange(e, 'appliedLoad')} unit="kN" info="Dimensionerende aksialtryk inkl. lastfaktorer (EC0)." />

                    {mode === 'advanced' && (
                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Endebetingelser (knæklængde)
                                <InfoHint
                                    title="Effektiv knæklængde"
                                    description="Understøtningernes fastholdelse bestemmer den effektive knæklængde Le = k · L. En kraget søjle (k=2) knækker langt lettere end en fast-fast (k=0,5)."
                                    calculation="Le = k · L → Ncr = π²EI / Le²"
                                />
                            </label>
                            <select
                                aria-label="Endebetingelser"
                                value={endKey}
                                onChange={e => setEndKey(e.target.value)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                            >
                                {Object.values(COLUMN_END_CONDITIONS).map(c => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* ── Results ── */}
                <div className="space-y-6">
                    {/* Utilisation verdict */}
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${r.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {r.passed
                                ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div className="flex-1">
                                <div className="flex items-center gap-1">
                                    <h4 className={`font-bold ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                        Udnyttelsesgrad {utilPct.toFixed(0)}%
                                    </h4>
                                    <InfoHint
                                        title="Udnyttelsesgrad (Nd/N_b,Rd)"
                                        description="Forholdet mellem den anvendte designlast og søjlens design-bæreevne. Skal være ≤ 100% (Eurokode ULS). Over 100% er søjlen overbelastet."
                                        calculation="Udnyttelse = Nd / N_b,Rd ≤ 1,0 (EC5 §6.3.2 / EC3 §6.3.1)"
                                    />
                                </div>
                                <p className={`text-sm mt-0.5 ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed
                                        ? `Bæreevnen er tilstrækkelig. Dimensionsgivende: ${governingLabel.toLowerCase()}.`
                                        : `Søjlen er overbelastet (${governingLabel.toLowerCase()}). Øg tværsnit eller reducér last/knæklængde.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ComplianceMeter
                        label="Udnyttelse vs. grænse (100%)"
                        value={utilPct}
                        limit={100}
                        min={0}
                        max={150}
                        unit="%"
                        decimalPlaces={0}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <ResultDisplay label="Design-bæreevne N_b,Rd" value={r.bucklingResistanceKN} precision={1} unit="kN" />
                        <ResultDisplay label="Relativ slankhed λrel" value={r.relativeSlenderness} precision={2} unit="" />
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-3 text-text-secondary dark:text-text-dark-secondary">Bæreevne-sammenligning & slankhed</h4>
                        {Diagram}
                    </div>

                    {mode === 'advanced' && (
                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                            <p className="font-semibold">Detaljerede designværdier</p>
                            <p>Areal A = {(r.areaM2 * 1e4).toFixed(0)} cm² · I_min = {(r.iMinM4 * 1e8).toFixed(2)} ×10⁻⁸ m⁴</p>
                            <p>Effektiv knæklængde Le = {r.effectiveLengthM.toFixed(2)} m (k = {endCond.k})</p>
                            <p>Euler Ncr = {r.eulerCritKN.toFixed(1)} kN · Trykbrud A·fc,d = {r.crushResistanceKN.toFixed(1)} kN</p>
                            <p>Reduktionsfaktor kc = {r.reductionFactor.toFixed(3)}</p>
                        </div>
                    )}
                </div>
            </div>

            <SafetyDisclaimer>
                Design-checket følger EC5/EC3-formlerne for centrisk trykpåvirkede søjler, men medregner ikke moment,
                excentricitet eller lokal pladeknækning. Bærende konstruktioner SKAL dimensioneres og godkendes af en
                autoriseret konstruktør iht. BR18 og Eurokode-standarderne.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default ColumnLoadCalculator;
