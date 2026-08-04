
import React, { useState } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeBearingWallLoad, computeMasonryWallCapacity, MASONRY_MATERIALS, STANDARDS_CATALOG } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'statiske-beregninger-baerende-vaeg';

const helpContent: HelpContent = {
    formaal: 'Basis beregner egenvægt og samlet vertikal last pr. løbende meter. Avanceret laver en EC6-eftervisning: murværkets design-bæreevne N_Rd = Φ·t·f_d (kapacitetsreduktion for slankhed og excentricitet, EC6 Annex G) sammenholdes med lasten → udnyttelsesgrad.',
    variabler: [
        { name: 'Vægghøjde', symbol: 'h', unit: 'm', description: 'Fri vægghøjde.' },
        { name: 'Tykkelse', symbol: 't', unit: 'm', description: 'Væggens tværsnitstykkelse.' },
        { name: 'Densitet', symbol: 'ρ', unit: 'kg/m³', description: 'Mursten ≈ 1800 kg/m³, Letbeton ≈ 800 kg/m³, Beton ≈ 2400 kg/m³.' },
        { name: 'Tillægslast', symbol: 'q_add', unit: 'kN/m', description: 'Ovenfor liggende last fra dæk, tag m.m.' },
        { name: 'Slankhed', symbol: 'h_ef/t_ef', unit: '–', description: 'Effektiv slankhed. EC6 grænse ≤ 27.' },
        { name: 'Reduktionsfaktor', symbol: 'Φ', unit: '–', description: 'EC6 kapacitetsreduktion for slankhed + excentricitet.' },
    ],
    formel: 'Egenvægt = h·t·ρ·9,81/1000\nTotal last = Egenvægt + q_add\nEC6: h_ef = ρ·h ; λ = (h_ef/t_ef)·√(f_k/E)\nΦ = A1·e^(−u²/2)  (Annex G)\nN_Rd = Φ·t·f_d  (f_d = f_k/γM)\nUdnyttelse = N_Ed/N_Rd ≤ 1,0',
    antagelser: 'Centrisk/let-excentrisk vertikal last. Enkeltvægget murværk. E ≈ 1000·f_k. Forenklet EC6 Annex G — fuld EC6-dimensionering kræves for endeligt projekt.',
    standarder: 'DS/EN 1996-1-1 (EC6) §6.1.2 & Annex G – Murværk, vertikal bæreevne\nDS/EN 1991-1-1 (EC1) – Egenlast\nDS/EN 1990 (EC0) – Lastkombinationer',
};

const RESTRAINTS = [
    { value: 'top-bottom' as const, label: 'Fastholdt top + bund (ρ=0,75)' },
    { value: 'pinned' as const, label: 'Leddet top + bund (ρ=1,0)' },
];

const BearingWallCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [height, setHeight] = useState('2.6');
    const [thickness, setThickness] = useState('0.25');
    const [density, setDensity] = useState('1800');
    const [additionalLoad, setAdditionalLoad] = useState('20');
    const [masonryKey, setMasonryKey] = useState('tegl-normalmoertel');
    const [restraint, setRestraint] = useState<'top-bottom' | 'pinned'>('top-bottom');
    const [eccentricity, setEccentricity] = useState('0');

    const result = computeBearingWallLoad({
        heightM: parseFloat(height) || 0,
        thicknessM: parseFloat(thickness) || 0,
        densityKgM3: parseFloat(density) || 0,
        additionalLoadKNm: parseFloat(additionalLoad) || 0,
    });

    const masonry = MASONRY_MATERIALS[masonryKey];
    const cap = computeMasonryWallCapacity({
        heightM: parseFloat(height) || 0,
        thicknessM: parseFloat(thickness) || 0,
        fkPa: masonry.fkPa,
        gammaM: masonry.gammaM,
        appliedLoadKNm: result.totalLoadKNm,
        restraint,
        loadEccentricityM: parseFloat(eccentricity) || 0,
    });
    const utilPct = cap.utilization * 100;

    const reportData: CalculatorReportData = {
        toolName: 'Bærende Vægbelastning',
        category: 'Statiske Beregninger',
        mode: mode === 'advanced' ? 'Avanceret (EC6 eftervisning)' : 'Basis (last)',
        inputs: [
            { label: 'Vægghøjde', value: height, unit: 'm' },
            { label: 'Tykkelse', value: thickness, unit: 'm' },
            { label: 'Densitet', value: density, unit: 'kg/m³' },
            { label: 'Tillægslast', value: additionalLoad, unit: 'kN/m' },
            ...(mode === 'advanced' ? [
                { label: 'Murværk', value: masonry.label },
                { label: 'Fastholdelse', value: restraint === 'pinned' ? 'Leddet (ρ=1,0)' : 'Fast (ρ=0,75)' },
                { label: 'Excentricitet', value: eccentricity, unit: 'm' },
            ] : []),
        ],
        results: [
            { label: 'Total last N_Ed', value: result.totalLoadKNm.toFixed(2), unit: 'kN/m', highlight: true },
            { label: 'Egenvægt', value: result.selfWeightKNm.toFixed(2), unit: 'kN/m' },
            ...(mode === 'advanced' ? [
                { label: 'Slankhed h_ef/t_ef', value: cap.slenderness.toFixed(1) },
                { label: 'Reduktionsfaktor Φ', value: cap.reductionFactor.toFixed(3) },
                { label: 'Bæreevne N_Rd', value: cap.capacityKNm.toFixed(1), unit: 'kN/m' },
                { label: 'Udnyttelsesgrad', value: `${utilPct.toFixed(0)}%` },
                { label: 'Status', value: cap.passed ? 'OK (≤100%)' : 'OVERBELASTET' },
            ] : []),
        ],
        formula: mode === 'advanced' ? 'N_Rd = Φ·t·f_d ; Udnyttelse = N_Ed/N_Rd ≤ 1,0' : 'Egenvægt = h·t·ρ·9,81/1000 ; Total = Egenvægt + q_add',
        standardsStruktureret: STANDARDS_CATALOG.statics,
        safetyDisclaimer: 'Bærende vægge SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18 og Eurokode-standarderne.',
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Bærende Vægbelastning</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Bærende Vægbelastning"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={<CalculatorModeToggle toolId={TOOL_ID} advancedLocked={!advancedAllowed} onChange={setMode} />}
            stickyResultLabel={mode === 'advanced' ? 'Udnyttelsesgrad' : 'Total last'}
            stickyResult={mode === 'advanced'
                ? <><AnimatedNumber value={utilPct} precision={0} /> %</>
                : <><AnimatedNumber value={result.totalLoadKNm} precision={2} /> kN/m</>}
            shareValue={mode === 'advanced'
                ? `N_Rd ${cap.capacityKNm.toFixed(0)} kN/m · Udnyttelse ${utilPct.toFixed(0)}% · ${cap.passed ? 'OK' : 'Overbelastet'}`
                : `Total: ${result.totalLoadKNm.toFixed(2)} kN/m (egenvægt: ${result.selfWeightKNm.toFixed(2)} kN/m)`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Vægdata</h3>

                    <InputField label="Vægghøjde (h)" value={height} onChange={e => setHeight(e.target.value)} unit="m" />
                    <InputField label="Tykkelse (t)" value={thickness} onChange={e => setThickness(e.target.value)} unit="m" />
                    <InputField
                        label="Densitet (ρ)"
                        value={density}
                        onChange={e => setDensity(e.target.value)}
                        unit="kg/m³"
                        info="Mursten ≈ 1800, Letbeton ≈ 800, Beton ≈ 2400 kg/m³"
                    />
                    <InputField
                        label="Tillægslast (q)"
                        value={additionalLoad}
                        onChange={e => setAdditionalLoad(e.target.value)}
                        unit="kN/m"
                        info="Last fra dæk, tag eller etager over."
                    />

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                Murværk & bæreevne (EC6)
                                <InfoHint
                                    title="EC6 vertikal bæreevne"
                                    description="Murværkets bæreevne reduceres af slankhed (h_ef/t_ef) og excentricitet via kapacitetsreduktionsfaktoren Φ (EC6 Annex G). En slank eller excentrisk belastet væg bærer markant mindre end det rene tryk-brud."
                                    calculation="N_Rd = Φ·t·(f_k/γM) pr. meter · Udnyttelse = N_Ed/N_Rd"
                                />
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Murværkstype</label>
                                <select aria-label="Murværkstype" value={masonryKey} onChange={e => setMasonryKey(e.target.value)}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary">
                                    {Object.values(MASONRY_MATERIALS).map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Fastholdelse (top/bund)</label>
                                <select aria-label="Fastholdelse" value={restraint} onChange={e => setRestraint(e.target.value as 'top-bottom' | 'pinned')}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary">
                                    {RESTRAINTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <InputField label="Excentricitet (e)" value={eccentricity} onChange={e => setEccentricity(e.target.value)} unit="m" info="Lastens excentricitet i forhold til vægmidten. 0 = centrisk." />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {mode === 'advanced' ? (
                        <>
                            <div className={`p-5 rounded-card border-l-4 shadow-sm ${cap.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                                <div className="flex items-start gap-3">
                                    {cap.passed
                                        ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                        : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                    <div>
                                        <h4 className={`font-bold ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            Udnyttelsesgrad {utilPct.toFixed(0)}%
                                        </h4>
                                        <p className={`text-sm mt-0.5 ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            {cap.passed
                                                ? `Last ${result.totalLoadKNm.toFixed(0)} kN/m ≤ bæreevne ${cap.capacityKNm.toFixed(0)} kN/m (Φ = ${cap.reductionFactor.toFixed(2)}).`
                                                : `Last ${result.totalLoadKNm.toFixed(0)} kN/m overstiger bæreevnen ${cap.capacityKNm.toFixed(0)} kN/m. Øg tykkelse eller vælg stærkere murværk.`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {cap.slendernessWarning && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning text-sm">
                                    <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />
                                    <span>Slankhed {cap.slenderness.toFixed(0)} overstiger EC6-grænsen på 27. Væggen er for slank — øg tykkelsen eller indfør afstivning.</span>
                                </div>
                            )}

                            <ComplianceMeter label="Last vs. bæreevne (N_Rd)" value={utilPct} limit={100} min={0} max={150} unit="%" decimalPlaces={0} />

                            <div className="grid grid-cols-2 gap-3">
                                <ResultDisplay label="Bæreevne N_Rd" value={cap.capacityKNm} precision={0} unit="kN/m" />
                                <ResultDisplay label="Reduktionsfaktor Φ" value={cap.reductionFactor} precision={2} unit="" />
                            </div>
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                                <p>Slankhed h_ef/t_ef = {cap.slenderness.toFixed(1)} · effektiv højde h_ef = {cap.effectiveHeightM.toFixed(2)} m</p>
                                <p>Samlet excentricitet e_mk = {(cap.eccentricityM * 1000).toFixed(0)} mm · Total last N_Ed = {result.totalLoadKNm.toFixed(1)} kN/m</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <ResultDisplay label="Egenvægt" value={result.selfWeightKNm} precision={2} unit="kN/m" />
                            <ResultDisplay label="Total belastning" value={result.totalLoadKNm} precision={2} unit="kN/m" />
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border dark:border-info/30 text-sm text-info-strong dark:text-info space-y-1">
                                <p className="font-semibold">Bidrag</p>
                                <p>Egenvægt: {result.selfWeightKNm.toFixed(2)} kN/m</p>
                                <p>Tillægslast: {(parseFloat(additionalLoad) || 0).toFixed(2)} kN/m</p>
                                <p className="font-bold pt-1 border-t border-info-border dark:border-info/30">Total: {result.totalLoadKNm.toFixed(2)} kN/m</p>
                                <p className="mt-2 text-xs">Skift til Avanceret for at eftervise murværkets bæreevne (EC6).</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <SafetyDisclaimer>
                Bærende vægge SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18, DS/EN 1996 (EC6) og DS/EN 1990 (EC0).
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default BearingWallCalculator;
