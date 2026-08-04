
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeSpiralStair } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const helpContent: HelpContent = {
    formaal: 'Kontrollerer geometrien for en vindeltrappe (spindeltrappe) efter BR18 §64–§67. En vindeltrappes trin er dybe yderst og smalle inderst ved spindlen, så den brugbare grunddybde måles på gangkurven — 400 mm fra trinnets indre kant. Beregner antal trin, stigning pr. trin, vinkel pr. trin, effektiv grund på gangkurven og fri bredde samt pass/fail.',
    variabler: [
        { name: 'Etagehøjde', symbol: 'H', unit: 'm', description: 'Samlet lodret højde gulv-til-gulv som trappen skal overvinde.' },
        { name: 'Yderradius', symbol: 'r_ud', unit: 'm', description: 'Trappens yderste radius (fra centrum til ydre trinkant).' },
        { name: 'Spindelradius', symbol: 'r_ind', unit: 'm', description: 'Radius af den centrale spindel/søjle som trinene sidder på.' },
        { name: 'Trin pr. omgang', symbol: 'n360', unit: 'stk', description: 'Antal trin på en fuld 360°-omgang. Bestemmer vinkel og grunddybde.' },
        { name: 'Ønsket stigning', symbol: 's_mål', unit: 'm', description: 'Måltal for stigning pr. trin. Antal trin = H / s_mål (afrundet).' },
    ],
    formel: 'Antal trin = round(H / s_mål)\nStigning = H / antal trin\nVinkel pr. trin = 360° / (trin pr. omgang)\nGangkurve r = r_ind + 0,40 m (dog ≤ r_ud)\nEffektiv grund = 2·π·r_gang / (trin pr. omgang)\nKrav: 15 cm ≤ stigning ≤ 21 cm  og  effektiv grund ≥ 20 cm',
    antagelser: 'BR18/SBi måler den brugbare grunddybde på gangkurven 400 mm fra den indre (smalle) kant. Stigningen skal ligge mellem 15 og 21 cm, og den effektive grund på gangkurven skal være mindst 20 cm. Beregningen forudsætter jævnt fordelte, ensvinklede trin om en central spindel og tager ikke højde for reposer, håndlister eller fri højde.',
    standarder: 'BR18 §64–§67 – Trappers geometri (stigning, grund, bredde, fri højde)\nSBi-anvisning – vejledning for vindel- og spindeltrapper',
};

const SpiralStairCalculator: React.FC = () => {
    const [totalRise, setTotalRise] = useState('2.8');
    const [outerRadius, setOuterRadius] = useState('0.9');
    const [columnRadius, setColumnRadius] = useState('0.1');
    const [stepsPerTurn, setStepsPerTurn] = useState('12');
    const [targetRise, setTargetRise] = useState('0.18');

    const r = useMemo(() => computeSpiralStair({
        totalRiseM: parseFloat(totalRise) || 0,
        outerRadiusM: parseFloat(outerRadius) || 0,
        centerColumnRadiusM: parseFloat(columnRadius) || 0,
        stepsPerTurn: Math.max(0, Math.round(parseFloat(stepsPerTurn) || 0)),
        targetRiseM: parseFloat(targetRise) || 0.18,
    }), [totalRise, outerRadius, columnRadius, stepsPerTurn, targetRise]);

    const riseCm = r.actualRiseM * 100;
    const goingCm = r.goingAtWalkLineM * 100;

    const reportData: CalculatorReportData = {
        toolName: 'Vindeltrappe – geometri',
        category: 'Trapper',
        inputs: [
            { label: 'Etagehøjde H', value: totalRise, unit: 'm' },
            { label: 'Yderradius', value: outerRadius, unit: 'm' },
            { label: 'Spindelradius', value: columnRadius, unit: 'm' },
            { label: 'Trin pr. omgang', value: stepsPerTurn, unit: 'stk' },
            { label: 'Ønsket stigning', value: targetRise, unit: 'm' },
        ],
        results: [
            { label: 'Antal trin', value: r.numSteps.toFixed(0), unit: 'stk', highlight: true },
            { label: 'Stigning pr. trin', value: riseCm.toFixed(1), unit: 'cm' },
            { label: 'Vinkel pr. trin', value: r.anglePerStepDeg.toFixed(1), unit: '°' },
            { label: 'Effektiv grund (gangkurve)', value: goingCm.toFixed(1), unit: 'cm' },
            { label: 'Fri bredde', value: (r.clearWidthM * 100).toFixed(0), unit: 'cm' },
            { label: 'Status', value: r.passed ? 'OK (BR18 §64–§67)' : 'IKKE OK' },
        ],
        formula: 'Antal = round(H/s) ; stigning = H/antal ; grund = 2πr_gang/n ; r_gang = r_ind+0,4 m',
        standardsStruktureret: [
            { code: 'BR18', clause: '§64–§67', note: 'Trappers geometri – stigning, grund, bredde og fri højde.' },
            { code: 'SBi-anvisning', note: 'Vejledning for vindel-/spindeltrapper og måling på gangkurven.' },
        ],
        safetyDisclaimer: 'Beregningen er vejledende. Trappegeometri skal projekteres og kontrolleres af en fagkyndig og godkendes af kommunen efter gældende bygningsreglement (BR18).',
    };

    // Top-down infographic: outer circle, central newel, radial tread boundaries
    // and the highlighted walk-line circle 400 mm from the inner edge.
    const Diagram = useMemo(() => {
        const rOut = parseFloat(outerRadius) || 0;
        const rIn = parseFloat(columnRadius) || 0;
        const steps = Math.max(1, Math.round(parseFloat(stepsPerTurn) || 1));
        if (rOut <= rIn || rOut <= 0) {
            return (
                <p className="text-sm text-text-tertiary dark:text-text-dark-tertiary text-center py-8">
                    Angiv en yderradius større end spindelradius for at se tegningen.
                </p>
            );
        }
        const size = 220;
        const cx = size / 2;
        const cy = size / 2;
        const maxR = size / 2 - 16;
        const scale = maxR / rOut;
        const Rout = rOut * scale;
        const Rin = Math.max(rIn * scale, 2);
        const Rwalk = r.walkLineRadiusM * scale;
        const walkColor = r.goingOk ? '#059669' : '#dc2626';

        const lines = Array.from({ length: steps }, (_, i) => {
            const a = (i * ((2 * Math.PI) / steps)) - Math.PI / 2;
            return {
                x1: cx + Rin * Math.cos(a),
                y1: cy + Rin * Math.sin(a),
                x2: cx + Rout * Math.cos(a),
                y2: cy + Rout * Math.sin(a),
            };
        });

        return (
            <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full max-w-[260px] mx-auto text-text-tertiary dark:text-text-dark-tertiary"
                role="img"
                aria-label="Set ovenfra af vindeltrappen med gangkurve 400 mm fra indre kant"
            >
                {/* Outer boundary */}
                <circle cx={cx} cy={cy} r={Rout} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.7} />
                {/* Tread boundary lines radiating from the newel */}
                {lines.map((l, i) => (
                    <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" strokeWidth={1} opacity={0.45} />
                ))}
                {/* Walk-line circle (400 mm from inner edge) */}
                <circle cx={cx} cy={cy} r={Rwalk} fill="none" stroke={walkColor} strokeWidth={2} strokeDasharray="4 3" />
                {/* Central newel / spindle */}
                <circle cx={cx} cy={cy} r={Rin} fill="#94a3b8" stroke="#64748b" strokeWidth={1} />
                <circle cx={cx} cy={cy} r={1.5} fill="#334155" />
                {/* Walk-line label */}
                <text x={cx} y={cy - Rwalk - 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill={walkColor}>
                    Gangkurve
                </text>
            </svg>
        );
    }, [outerRadius, columnRadius, stepsPerTurn, r.walkLineRadiusM, r.goingOk]);

    return (
        <CalculatorPage
            title="Vindeltrappe – geometri"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Antal trin"
            stickyResult={<><AnimatedNumber value={r.numSteps} precision={0} /> stk</>}
            shareValue={`${r.numSteps} trin · stigning ${riseCm.toFixed(1)} cm · grund ${goingCm.toFixed(1)} cm · ${r.passed ? 'OK' : 'Ikke OK'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* ── Inputs ─────────────────────────────────────────────── */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">Vindeltrappe (spindeltrappe) om en central spindel.</p>

                    <InputField label="Etagehøjde (H)" value={totalRise} onChange={e => setTotalRise(e.target.value)} unit="m" info="Samlet højde gulv-til-gulv som trappen skal overvinde." />

                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField label="Yderradius" value={outerRadius} onChange={e => setOuterRadius(e.target.value)} unit="m" info="Fra centrum til trinnets ydre (dybe) kant." />
                        </div>
                        <InfoHint
                            title="Vindeltrappens geometri"
                            description="En vindeltrappe har dybe trin yderst og smalle trin inderst ved spindlen. Bredden = yderradius − spindelradius. Jo større yderradius, jo dybere brugbar grund på gangkurven."
                            calculation="Fri bredde = r_ud − r_ind"
                        />
                    </div>

                    <InputField label="Spindelradius (central søjle)" value={columnRadius} onChange={e => setColumnRadius(e.target.value)} unit="m" info="Radius af den centrale spindel/søjle. Den indre kant af trinene." />

                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField label="Trin pr. omgang" value={stepsPerTurn} onChange={e => setStepsPerTurn(e.target.value)} unit="stk" info="Antal trin på en fuld 360°-omgang. Færre trin = større vinkel og dybere grund." />
                        </div>
                        <InfoHint
                            title="Gangkurven (400 mm)"
                            description="Gangkurven er den linje 400 mm fra trinnets indre kant, hvor man reelt går. BR18/SBi måler den brugbare grunddybde netop her — ikke yderst hvor trinet er dybest. Den stiplede cirkel i tegningen viser gangkurven."
                            calculation="r_gang = r_ind + 0,40 m ; grund = 2·π·r_gang / n"
                        />
                    </div>

                    <div className="flex items-center gap-1">
                        <div className="flex-1">
                            <InputField label="Ønsket stigning pr. trin" value={targetRise} onChange={e => setTargetRise(e.target.value)} unit="m" info="Måltal for stigning. Standard ca. 0,18 m. Antal trin afrundes af H / ønsket stigning." />
                        </div>
                        <InfoHint
                            title="BR18 stigning & grund"
                            description="BR18 §64–§67: Stigningen (lodret pr. trin) skal ligge mellem 15 og 21 cm, og den effektive grunddybde på gangkurven skal være mindst 20 cm. Sammen sikrer det en gangbar, sikker trappe."
                            calculation="15 cm ≤ stigning ≤ 21 cm ; effektiv grund ≥ 20 cm"
                        />
                    </div>
                </div>

                {/* ── Results ────────────────────────────────────────────── */}
                <div className="space-y-4">
                    {/* Verdict card */}
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${r.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {r.passed ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed ? 'Geometri overholder BR18' : 'Geometri overholder ikke BR18'}
                                </h4>
                                <p className={`text-sm mt-0.5 ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    BR18/SBi måler den brugbare grund på gangkurven 400 mm fra den indre kant. Kravet er stigning 15–21 cm og effektiv grund ≥ 20 cm.
                                    {' '}Her: stigning {riseCm.toFixed(1)} cm ({r.riseOk ? 'OK' : 'uden for interval'}), grund {goingCm.toFixed(1)} cm ({r.goingOk ? 'OK' : 'for lav'}).
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pass/fail badges for the two BR18 limits (honest higher-is-better framing) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-3 rounded-card border text-center ${r.riseOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Stigning (15–21 cm)</p>
                            <p className={`text-lg font-bold tabular-nums ${r.riseOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                {riseCm.toFixed(1)} cm
                            </p>
                            <p className={`text-xs font-medium ${r.riseOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>{r.riseOk ? '✓ OK' : '✗ Uden for interval'}</p>
                        </div>
                        <div className={`p-3 rounded-card border text-center ${r.goingOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Grund på gangkurve (≥ 20 cm)</p>
                            <p className={`text-lg font-bold tabular-nums ${r.goingOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                {goingCm.toFixed(1)} cm
                            </p>
                            <p className={`text-xs font-medium ${r.goingOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>{r.goingOk ? '✓ OK' : '✗ For lav'}</p>
                        </div>
                    </div>

                    {/* ComplianceMeter — honest max-bound: rise must be ≤ 21 cm (steeper = unsafe).
                        The 15 cm minimum is covered by the badge above. */}
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <div className="flex items-center gap-1 mb-1">
                            <h4 className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">Stigning vs. maks. 21 cm</h4>
                            <InfoHint
                                title="Stigningens øvre grænse"
                                description="Måleren viser stigningen mod den øvre BR18-grænse på 21 cm (grøn = under grænsen). Den nedre grænse på 15 cm vises af badgen ovenfor — stigningen skal ligge inden for hele intervallet 15–21 cm."
                                calculation="stigning = H / antal trin ; krav ≤ 21 cm"
                            />
                        </div>
                        <ComplianceMeter label="Stigning" value={riseCm} limit={21} min={0} max={30} unit=" cm" decimalPlaces={1} />
                    </div>

                    {/* Numeric readouts */}
                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Antal trin" value={r.numSteps} precision={0} unit="stk" />
                        <ResultDisplay label="Effektiv grund" value={goingCm} precision={1} unit="cm" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Vinkel pr. trin</p>
                            <p className="text-xl font-bold tabular-nums text-brand-primary dark:text-brand-light">{r.anglePerStepDeg.toFixed(1)}°</p>
                        </div>
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Fri bredde</p>
                            <p className="text-xl font-bold tabular-nums text-brand-primary dark:text-brand-light">{(r.clearWidthM * 100).toFixed(0)} cm</p>
                        </div>
                    </div>

                    {/* Top-down infographic */}
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <div className="flex items-center gap-1 mb-2">
                            <h4 className="text-sm font-semibold text-text-secondary dark:text-text-dark-secondary">Set ovenfra</h4>
                            <InfoHint
                                title="Set ovenfra"
                                description="Tegningen viser trappen ovenfra: den centrale spindel, de radiale trinkanter for hver trin pr. omgang, og den stiplede gangkurve 400 mm fra den indre kant, hvor den brugbare grund måles. Grøn gangkurve = grunden er OK, rød = for lav."
                            />
                        </div>
                        {Diagram}
                        <p className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary text-center mt-1">
                            Stiplet cirkel = gangkurven (400 mm fra indre kant)
                        </p>
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Denne beregning er vejledende og erstatter ikke projektering af en fagkyndig. Trappegeometri (stigning, grund,
                bredde og fri højde) skal kontrolleres mod det gældende bygningsreglement (BR18 §64–§67) og godkendes af kommunen.
                For vindel- og spindeltrapper henvises til SBi-anvisning.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default SpiralStairCalculator;
