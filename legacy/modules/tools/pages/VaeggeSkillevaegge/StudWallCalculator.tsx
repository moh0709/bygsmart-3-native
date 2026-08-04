
import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { SlidersHorizontalIcon, CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import {
    getCalculator,
    catalogHelpToContent,
    computeStudWall,
    computeColumnCapacity,
    COLUMN_MATERIALS,
    COLUMN_END_CONDITIONS,
    STANDARDS_CATALOG,
} from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';

const TOOL_ID = 'vaegge-skillevaegge-skeletvaeg';
const meta = getCalculator(TOOL_ID);

const StudWallCalculator: React.FC = () => {
    const { advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');

    // Shared wall geometry (used by both modes: height = stud length, spacing = c/c)
    const [dims, setDims] = useState({
        length: '4',
        height: '2.5',
        spacing: '450',
        layers: '2',
    });

    // Advanced (EC5 bearing capacity) inputs — a single stud treated as a column
    const [stud, setStud] = useState({
        width: '45',    // b [mm]
        depth: '95',    // d [mm]
        lineLoad: '10', // w_Ed [kN/m] design vertical line load on the wall
    });
    const [materialKey, setMaterialKey] = useState('timber-c24');
    const [endKey, setEndKey] = useState('pinned-pinned');

    const vizRef = useRef<SVGSVGElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };
    const handleStudChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof stud) => {
        setStud(prev => ({ ...prev, [field]: e.target.value }));
    };

    // ── Basic mode: quantity take-off ──────────────────────────────────────────
    const results = useMemo(() => {
        const L = parseFloat(dims.length) || 0;
        const H = parseFloat(dims.height) || 0;
        const cc = parseFloat(dims.spacing) || 450;
        const lay = parseFloat(dims.layers) || 1;
        if (L <= 0 || H <= 0) return { studs: 0, trackLengthM: 0, insulationM2: 0, boards: 0, screws: 0 };
        return computeStudWall({ lengthM: L, heightM: H, spacingMm: cc, layers: lay });
    }, [dims]);

    // ── Advanced mode: EC5 buckling capacity of a single stud ───────────────────
    const material = COLUMN_MATERIALS[materialKey];
    const endCond = COLUMN_END_CONDITIONS[endKey];

    const wallHeightM = parseFloat(dims.height) || 0;
    const ccM = (parseFloat(dims.spacing) || 0) / 1000;
    const wEd = parseFloat(stud.lineLoad) || 0;
    // Load per stud = design line load × tributary width (c/c)
    const nEd = wEd * ccM;

    const cap = useMemo(() => computeColumnCapacity({
        widthM: (parseFloat(stud.width) || 0) / 1000,
        depthM: (parseFloat(stud.depth) || 0) / 1000,
        heightM: wallHeightM,
        appliedLoadKN: nEd,
        material,
        // Studs are held by top/bottom plates and sheathing — pinned (k=1) is a
        // reasonable default; the dropdown lets the user pick a stiffer restraint.
        effectiveLengthFactor: endCond.k,
    }), [stud.width, stud.depth, wallHeightM, nEd, material, endCond]);

    const utilPct = cap.utilization * 100;
    const governingLabel = cap.governing === 'buckling'
        ? 'Knæk (buckling)'
        : cap.governing === 'crushing'
            ? 'Trykbrud (crushing)'
            : '–';

    const helpContent = useMemo(
        () => (meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined),
        [],
    );

    const reportData: CalculatorReportData = useMemo(() => {
        if (mode === 'advanced') {
            return {
                toolName: meta?.name ?? 'Skeletvæg (Stål/Træ)',
                category: meta?.category ?? 'Vægge & Skillevægge',
                mode: 'Avanceret — Bæreevne (EC5)',
                inputs: [
                    { label: 'Materiale', value: material.label },
                    { label: 'Væghøjde (stolpelængde)', value: dims.height, unit: 'm' },
                    { label: 'Stolpe bredde (b)', value: stud.width, unit: 'mm' },
                    { label: 'Stolpe dybde (d)', value: stud.depth, unit: 'mm' },
                    { label: 'Stolpeafstand c/c', value: dims.spacing, unit: 'mm' },
                    { label: 'Endebetingelser', value: endCond.label },
                    { label: 'Designlast på væg (w_Ed)', value: stud.lineLoad, unit: 'kN/m' },
                    { label: 'Last pr. stolpe (N_Ed)', value: nEd.toFixed(2), unit: 'kN' },
                ],
                results: [
                    { label: 'Design-bæreevne N_b,Rd (pr. stolpe)', value: cap.bucklingResistanceKN.toFixed(1), unit: 'kN', highlight: true },
                    { label: 'Last pr. stolpe N_Ed', value: nEd.toFixed(2), unit: 'kN' },
                    { label: 'Udnyttelsesgrad N_Ed/N_b,Rd', value: `${utilPct.toFixed(0)}%` },
                    { label: 'Status', value: cap.passed ? 'OK (≤ 100%)' : 'OVERBELASTET' },
                    { label: 'Dimensionsgivende', value: governingLabel },
                    { label: 'Relativ slankhed λrel', value: cap.relativeSlenderness.toFixed(2) },
                    { label: 'Reduktionsfaktor kc', value: cap.reductionFactor.toFixed(3) },
                ],
                formula: 'N_Ed = w_Ed · (c/c) ; N_b,Rd = kc · A · fc,d ; Udnyttelse = N_Ed / N_b,Rd ≤ 1,0',
                standardsStruktureret: STANDARDS_CATALOG.statics,
                safetyDisclaimer: 'Checket dækker KUN aksialknæk af én enkelt stolpe. Det medregner ikke kombineret bøjning (vindlast på væggen), top-/bundskinnen eller samlinger. Bærende vægge SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18 og Eurokode.',
            };
        }
        return {
            toolName: meta?.name ?? 'Skeletvæg (Stål/Træ)',
            category: meta?.category ?? 'Vægge & Skillevægge',
            mode: 'Basis — Materialeliste',
            inputs: [
                { label: 'Vægglængde', value: dims.length, unit: 'm' },
                { label: 'Væghøjde', value: dims.height, unit: 'm' },
                { label: 'Stolpeafstand c/c', value: dims.spacing, unit: 'mm' },
                { label: 'Lag gips pr. side', value: dims.layers, unit: 'lag' },
            ],
            results: [
                { label: 'Stolper', value: String(results.studs), unit: 'stk.', highlight: true },
                { label: 'Skinner', value: results.trackLengthM.toFixed(1), unit: 'm' },
                { label: 'Isolering', value: results.insulationM2.toFixed(1), unit: 'm²' },
                { label: 'Gipsplader (ca.)', value: String(results.boards), unit: 'stk.' },
                { label: 'Skruer', value: String(results.screws), unit: 'stk.' },
            ],
            formula: meta?.help?.formula,
            standardsStruktureret: meta?.standards,
            infographicRef: vizRef,
        };
    }, [mode, dims, results, stud, material, endCond, nEd, cap, utilPct, governingLabel]);

    // ── Opstalt (stud plan) geometry — Basic mode only ──────────────────────────
    const L = parseFloat(dims.length) || 4;
    const H = parseFloat(dims.height) || 2.5;
    const cc = parseFloat(dims.spacing) || 450;

    const scale = 100;
    const svgW = L * scale;
    const svgH = H * scale;
    const spacingPx = (cc / 1000) * scale;

    const studPositions: number[] = [];
    if (L > 0 && H > 0) {
        for (let x = 0; x <= svgW; x += spacingPx) {
            studPositions.push(x);
        }
        if (studPositions.length === 0 || studPositions[studPositions.length - 1] < svgW - 5) studPositions.push(svgW);
    }

    const shareValue = mode === 'advanced'
        ? `Bæreevne pr. stolpe: ${cap.bucklingResistanceKN.toFixed(1)} kN · Udnyttelse: ${utilPct.toFixed(0)}% · ${cap.passed ? 'OK' : 'Overbelastet'}`
        : (results.studs > 0 ? `${results.studs} stolper · ${results.trackLengthM.toFixed(1)} m skinner` : undefined);

    return (
        <CalculatorPage
            title={meta?.name ?? 'Skeletvæg (Stål/Træ)'}
            reportData={reportData}
            helpContent={helpContent}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            shareValue={shareValue}
            stickyResultLabel={mode === 'advanced' ? 'Udnyttelsesgrad' : undefined}
            stickyResult={mode === 'advanced' ? <><AnimatedNumber value={utilPct} precision={0} /> %</> : undefined}
        >
            {mode === 'basic' ? (
                <>
                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <SlidersHorizontalIcon className="w-5 h-5 text-brand-primary" />
                                Væg Dimensioner
                            </h3>
                            <InputField label="Længde" value={dims.length} onChange={e => handleInputChange(e, 'length')} unit="m" info="Væggens længde." />
                            <InputField label="Højde" value={dims.height} onChange={e => handleInputChange(e, 'height')} unit="m" info="Væggens højde." />
                            <InputField
                                label="Stolpeafstand (c/c)"
                                value={dims.spacing}
                                onChange={e => handleInputChange(e, 'spacing')}
                                unit="mm"
                                info="Standard er 450mm (for 900mm gips) eller 600mm (for 1200mm gips)."
                            />
                            <InputField label="Lag gips (pr. side)" value={dims.layers} onChange={e => handleInputChange(e, 'layers')} unit="lag" info="2 lag anbefales ofte for bedre stabilitet og lydisolering." />
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                                <h3 className="font-bold text-lg mb-4">Materialeliste (Estimat)</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <ResultDisplay label="Stolper" value={results.studs} unit="stk" precision={0} />
                                    <ResultDisplay label="Skinner" value={results.trackLengthM} unit="m" precision={1} />
                                    <ResultDisplay label="Isolering" value={results.insulationM2} unit="m²" precision={1} />
                                    <ResultDisplay label="Plader (ca.)" value={results.boards} unit="stk" precision={0} />
                                </div>
                                <div className="mt-4 text-center text-sm text-text-secondary dark:text-text-dark-secondary bg-bg-subtle dark:bg-bg-dark-muted p-2 rounded">
                                    Antal skruer: <strong>{results.screws}</strong> stk.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-lg mb-2">Opstalt (Stolpeplan)</h3>
                        <p className="text-sm text-text-secondary dark:text-text-dark-secondary mb-4">Viser placering af stolper baseret på c/c afstand.</p>
                        <div className="w-full overflow-x-auto bg-bg-subtle dark:bg-bg-dark-muted p-4 rounded-lg border border-border dark:border-border-dark">
                            {L > 0 && H > 0 && (
                                <svg
                                    ref={vizRef}
                                    width={svgW + 40}
                                    height={svgH + 40}
                                    viewBox={`-30 -30 ${svgW + 60} ${svgH + 60}`}
                                >
                                    {/* Top Track */}
                                    <rect x="0" y="0" width={svgW} height="10" className="fill-gray-300 stroke-gray-500" />
                                    {/* Bottom Track */}
                                    <rect x="0" y={svgH - 10} width={svgW} height="10" className="fill-gray-300 stroke-gray-500" />
                                    {/* Studs */}
                                    {studPositions.map((x, i) => (
                                        <g key={i}>
                                            <rect x={Math.min(x, svgW - 5)} y="10" width="5" height={svgH - 20} className="fill-gray-400 stroke-gray-600" />
                                            <text x={Math.min(x, svgW - 5) + 2.5} y={svgH + 15} textAnchor="middle" className="text-[8px] fill-text-secondary">
                                                {Math.round(i * (cc / 10)) * 10}
                                            </text>
                                        </g>
                                    ))}
                                    {/* Height dimension */}
                                    <line x1={svgW + 10} y1="0" x2={svgW + 10} y2={svgH} className="stroke-text-secondary" strokeWidth="1" />
                                    <text x={svgW + 15} y={svgH / 2} className="text-[10px] fill-text-secondary" style={{ writingMode: 'vertical-rl' }}>H: {H}m</text>
                                </svg>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="grid md:grid-cols-2 gap-6 items-start">
                    {/* ── Inputs ── */}
                    <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <SlidersHorizontalIcon className="w-5 h-5 text-brand-primary" />
                            Bæreevne-check (EC5)
                        </h3>

                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info flex items-start gap-2">
                            <InfoHint
                                title="Er væggen bærende?"
                                description="En let skeletvæg (skillevæg) er normalt IKKE bærende — den bærer kun sin egen vægt. Dette check er kun relevant, hvis stolperne rent faktisk skal bære en lodret last fra etagen/taget ovenover. Er du i tvivl: væggen er sandsynligvis ikke-bærende."
                                calculation="Bærende væg ⇒ hver stolpe = en trykpåvirket søjle (EC5 §6.3.2)"
                            />
                            <span>En skillevæg er normalt <strong>ikke-bærende</strong>. Brug kun dette check, når stolperne faktisk bærer lodret last ovenfra.</span>
                        </div>

                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Stolpemateriale & styrkeklasse
                                <InfoHint
                                    title="Materiale (Eurokode)"
                                    description="Vælg stolpernes materiale. Hver klasse bærer sine karakteristiske styrke- og stivhedsværdier samt partialkoefficient γM fra Eurokode."
                                    calculation={material.standardNote}
                                />
                            </label>
                            <select
                                aria-label="Stolpemateriale"
                                value={materialKey}
                                onChange={e => setMaterialKey(e.target.value)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                            >
                                {Object.values(COLUMN_MATERIALS).map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        <InputField label="Væghøjde (stolpelængde)" value={dims.height} onChange={e => handleInputChange(e, 'height')} unit="m" info="Stolpens frie længde = knæklængde. Samme som væghøjden i Basis." />

                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Stolpe bredde (b)" value={stud.width} onChange={e => handleStudChange(e, 'width')} unit="mm" info="Tværsnitsbredde, fx 45 mm." />
                            <InputField label="Stolpe dybde (d)" value={stud.depth} onChange={e => handleStudChange(e, 'depth')} unit="mm" info="Tværsnitsdybde, fx 95 eller 120 mm. Knæk sker om den svage akse (mindste inertimoment)." />
                        </div>

                        <InputField
                            label="Stolpeafstand (c/c)"
                            value={dims.spacing}
                            onChange={e => handleInputChange(e, 'spacing')}
                            unit="mm"
                            info="Centerafstand mellem stolper. Bestemmer bredden, hver stolpe bærer (lastfordeling)."
                        />

                        <div>
                            <InputField
                                label="Designlast på væg (w_Ed)"
                                value={stud.lineLoad}
                                onChange={e => handleStudChange(e, 'lineLoad')}
                                unit="kN/m"
                                info="Lodret designlinjelast på væggen (fx fra etagedæk/tag ovenover), inkl. lastfaktorer (EC0)."
                            />
                            <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary mt-1 flex items-center gap-1">
                                <span>Last pr. stolpe: N_Ed = {wEd.toFixed(1)} × {ccM.toFixed(3)} = <strong>{nEd.toFixed(2)} kN</strong></span>
                                <InfoHint
                                    title="Last pr. stolpe (N_Ed)"
                                    description="Den lodrette designlinjelast, væggen skal bære, fordeles ud på stolperne. Hver stolpe bærer den del, der svarer til dens centerafstand (c/c)."
                                    calculation="N_Ed = w_Ed · (c/c)  [kN pr. stolpe]"
                                />
                            </p>
                        </div>

                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Endebetingelser (knæklængde)
                                <InfoHint
                                    title="Effektiv knæklængde"
                                    description="Stolper er typisk fastholdt af top-/bundskinne og beklædning. Leddet–leddet (k=1) er et rimeligt udgangspunkt. Understøtningernes fastholdelse bestemmer den effektive knæklængde Le = k · L."
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
                    </div>

                    {/* ── Results ── */}
                    <div className="space-y-6">
                        {/* Utilisation verdict */}
                        <div className={`p-5 rounded-card border-l-4 shadow-sm ${cap.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                            <div className="flex items-start gap-3">
                                {cap.passed
                                    ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                    : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                        <h4 className={`font-bold ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            Udnyttelsesgrad {utilPct.toFixed(0)}%
                                        </h4>
                                        <InfoHint
                                            title="Udnyttelsesgrad (N_Ed/N_b,Rd)"
                                            description="Forholdet mellem lasten pr. stolpe og stolpens design-bæreevne. Skal være ≤ 100% (Eurokode ULS). Over 100% er stolpen overbelastet."
                                            calculation="Udnyttelse = N_Ed / N_b,Rd ≤ 1,0 (EC5 §6.3.2)"
                                        />
                                    </div>
                                    <p className={`text-sm mt-0.5 ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                        {cap.passed
                                            ? `Stolpernes bæreevne er tilstrækkelig. Dimensionsgivende: ${governingLabel.toLowerCase()}.`
                                            : `Stolperne er overbelastede (${governingLabel.toLowerCase()}). Prøv dybere stolper, tættere c/c-afstand eller en stærkere styrkeklasse.`}
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
                            <ResultDisplay label="Bæreevne pr. stolpe N_b,Rd" value={cap.bucklingResistanceKN} precision={1} unit="kN" />
                            <ResultDisplay label="Last pr. stolpe N_Ed" value={nEd} precision={2} unit="kN" />
                            <ResultDisplay label="Relativ slankhed λrel" value={cap.relativeSlenderness} precision={2} unit="" />
                            <ResultDisplay label="Reduktionsfaktor kc" value={cap.reductionFactor} precision={3} unit="" />
                        </div>

                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                            <div className="flex items-center gap-1">
                                <p className="font-semibold">Detaljerede designværdier</p>
                                <InfoHint
                                    title="Knækreduktion kc (χ)"
                                    description="Reduktionsfaktoren kc (≤ 1) nedskriver stolpens trykstyrke pga. knækrisiko. En slank stolpe (høj λrel) giver lav kc og lavere bæreevne; en kort/kraftig stolpe har kc ≈ 1 og fejler i stedet ved trykbrud."
                                    calculation="N_b,Rd = kc · A · fc,d"
                                />
                            </div>
                            <p>Dimensionsgivende: <strong>{governingLabel}</strong></p>
                            <p>Effektiv knæklængde Le = {cap.effectiveLengthM.toFixed(2)} m (k = {endCond.k})</p>
                            <p>Areal A = {(cap.areaM2 * 1e4).toFixed(1)} cm² · Euler Ncr = {cap.eulerCritKN.toFixed(1)} kN</p>
                            <p>Trykbrud A·fc,d = {cap.crushResistanceKN.toFixed(1)} kN · kc = {cap.reductionFactor.toFixed(3)}</p>
                        </div>
                    </div>
                </div>
            )}

            {mode === 'advanced' && (
                <SafetyDisclaimer>
                    Dette check dækker <strong>kun aksialknæk af én enkelt stolpe</strong> (centrisk tryk iht. EC5 §6.3.2).
                    Det medregner IKKE kombineret bøjning (fx vindlast på væggen), top-/bundskinnen eller samlinger.
                    Bærende vægge SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18 og Eurokode.
                </SafetyDisclaimer>
            )}
        </CalculatorPage>
    );
};

export default StudWallCalculator;
