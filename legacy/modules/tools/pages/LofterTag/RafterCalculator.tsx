
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import {
    computeRafter,
    computeBeamLoad,
    computeBeamCapacity,
    BEAM_MATERIALS,
    getCalculator,
    catalogHelpToContent,
} from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const meta = getCalculator('lofter-tag-spaer-estimat');
const TOOL_ID = 'lofter-tag-spaer-estimat';

const RafterCalculator: React.FC = () => {
    const { advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [dims, setDims] = useState({ span: '8', pitch: '30', buildingLength: '12', cc: '600' });
    const [results, setResults] = useState({ count: 0, rafterLength: 0, ridgeHeight: 0 });

    // Advanced (EC5) structural-capacity inputs
    const [adv, setAdv] = useState({ gk: '0.6', sk: '1.0', b: '45', h: '195' });
    const [materialKey, setMaterialKey] = useState('timber-c24');

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };
    const handleAdvChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof adv) => {
        setAdv(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const r = computeRafter({
            spanM: parseFloat(dims.span) || 0,
            pitchDeg: parseFloat(dims.pitch) || 0,
            ccMm: parseFloat(dims.cc) || 600,
            buildingLengthM: parseFloat(dims.buildingLength) || 0,
        });
        setResults(r);
    }, [dims]);

    const helpContent = useMemo(() =>
        meta?.help ? catalogHelpToContent(meta.help, meta.standards) : undefined,
    []);

    // ── Advanced: EC5 bæreevne-tjek af spærtværsnittet ─────────────────────────
    const material = BEAM_MATERIALS[materialKey];
    const advCalc = useMemo(() => {
        const gk = parseFloat(adv.gk) || 0;                 // kN/m² tag-egenlast
        const sk = parseFloat(adv.sk) || 0;                 // kN/m² snelast
        const spacingM = (parseFloat(dims.cc) || 0) / 1000; // c/c i meter
        // EC0 lastkombination (ULS): q_d = (1,35·gk + 1,5·sk) · c/c   [kN/m langs spæret]
        const qd = (1.35 * gk + 1.5 * sk) * spacingM;
        const spanM = results.rafterLength;                 // sloped spærlængde tagfod→rygning
        const load = computeBeamLoad({ span: spanM, loadType: 'distributed', load: qd });
        const cap = computeBeamCapacity({
            widthM: (parseFloat(adv.b) || 0) / 1000,
            heightM: (parseFloat(adv.h) || 0) / 1000,
            momentKNm: load.maxMoment,
            shearKN: load.maxShear,
            material,
        });
        return { gk, sk, spacingM, qd, spanM, load, cap };
    }, [adv, dims.cc, results.rafterLength, material]);

    const capUtilPct = advCalc.cap.utilization * 100;
    const govLabel = advCalc.cap.governing === 'bending' ? 'Bøjning'
        : advCalc.cap.governing === 'shear' ? 'Forskydning' : '–';

    const reportData: CalculatorReportData = useMemo(() => ({
        toolName: 'Spær Estimat',
        category: meta?.category,
        mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
        inputs: [
            { label: 'Bygningsbredde (spænd)', value: dims.span, unit: 'm' },
            { label: 'Taghældning', value: dims.pitch, unit: '°' },
            { label: 'Bygningslængde', value: dims.buildingLength, unit: 'm' },
            { label: 'Spærafstand (c/c)', value: dims.cc, unit: 'mm' },
            ...(mode === 'advanced' ? [
                { label: 'Tag-egenlast (gk)', value: adv.gk, unit: 'kN/m²' },
                { label: 'Snelast (sk)', value: adv.sk, unit: 'kN/m²' },
                { label: 'Materiale', value: material.label },
                { label: 'Spærtværsnit b×h', value: `${adv.b}×${adv.h}`, unit: 'mm' },
            ] : []),
        ],
        results: [
            { label: 'Antal spær', value: String(results.count), unit: 'stk.', highlight: true },
            { label: 'Spærlængde (halvdel)', value: results.rafterLength.toFixed(2), unit: 'm' },
            { label: 'Ridgehøjde', value: results.ridgeHeight.toFixed(2), unit: 'm' },
            ...(mode === 'advanced' ? [
                { label: 'Designlast q_d', value: advCalc.qd.toFixed(2), unit: 'kN/m' },
                { label: 'Design-moment Med', value: advCalc.load.maxMoment.toFixed(2), unit: 'kNm' },
                { label: 'Design-forskydning Ved', value: advCalc.load.maxShear.toFixed(2), unit: 'kN' },
                { label: 'Moment-bæreevne Mrd', value: advCalc.cap.momentResistanceKNm.toFixed(2), unit: 'kNm' },
                { label: 'Forskydnings-bæreevne Vrd', value: advCalc.cap.shearResistanceKN.toFixed(2), unit: 'kN' },
                { label: 'Udnyttelsesgrad', value: `${capUtilPct.toFixed(0)}%` },
                { label: 'Dimensionsgivende', value: govLabel },
                { label: 'Status', value: advCalc.cap.passed ? 'OK (≤100%)' : 'OVERBELASTET' },
            ] : []),
        ],
        formula: mode === 'advanced'
            ? 'q_d = (1,35·gk + 1,5·sk)·c/c ; M = q·L²/8 ; Mrd = W·fm,d (W=b·h²/6) ; Udnyttelse = Med/Mrd ≤ 1,0'
            : meta?.help?.formula,
        standardsStruktureret: meta?.standards,
        safetyDisclaimer: 'Spærkonstruktion skal dimensioneres og godkendes af konstruktør iht. EC5 (DS/EN 1995-1-1). Snemasse beregnes iht. DS/EN 1991-1-3.',
    }), [dims, results, mode, adv, material, advCalc, capUtilPct, govLabel]);

    const Diagram = useMemo(() => {
        const span = parseFloat(dims.span) || 8;
        const pitch = parseFloat(dims.pitch) || 30;
        const buildingLength = parseFloat(dims.buildingLength) || 12;
        const cc = (parseFloat(dims.cc) || 600) / 1000;
        const numRafters = results.count;

        if (span <= 0 || buildingLength <= 0 || numRafters <= 0) return null;

        const maxDim = Math.max(buildingLength, span);
        const scale = 300 / maxDim;
        const svgL = buildingLength * scale;
        const svgW = span * scale;
        const rafterW = Math.max(1, 0.045 * scale);

        const rafters = [];
        for (let i = 0; i < numRafters; i++) {
            let x = i * cc * scale;
            if (i === numRafters - 1) x = svgL - rafterW;
            if (x > svgL - rafterW) x = svgL - rafterW;
            rafters.push(
                <rect key={i} x={x} y="0" width={rafterW} height={svgW} className="fill-orange-200 stroke-orange-800" strokeWidth="0.5" />
            );
        }

        return (
            <div className="w-full flex justify-center bg-info-subtle rounded-lg border border-info-border p-4 overflow-hidden">
                <svg width="100%" height="100%" viewBox={`-30 -30 ${svgL + 60} ${svgW + 60}`} preserveAspectRatio="xMidYMid meet">
                    <rect x="0" y="0" width={svgL} height="4" className="fill-gray-400" />
                    <rect x="0" y={svgW - 4} width={svgL} height="4" className="fill-gray-400" />
                    {rafters}
                    <line x1="0" y1="-10" x2={svgL} y2="-10" className="stroke-text-secondary" strokeWidth="1" />
                    <text x={svgL/2} y="-15" textAnchor="middle" className="text-[10px] fill-text-secondary">Længde: {dims.buildingLength}m</text>
                    <line x1="-10" y1="0" x2="-10" y2={svgW} className="stroke-text-secondary" strokeWidth="1" />
                    <text x="-15" y={svgW/2} textAnchor="middle" className="text-[10px] fill-text-secondary" style={{writingMode: 'vertical-rl'}}>Spændvidde: {dims.span}m</text>
                    {numRafters > 2 && (
                        <>
                            <line x1={0} y1={svgW/2} x2={cc*scale} y2={svgW/2} className="stroke-red-500" strokeWidth="1"/>
                            <text x={(cc*scale)/2} y={svgW/2 - 5} textAnchor="middle" className="text-[8px] fill-red-600 font-bold">{dims.cc}mm</text>
                        </>
                    )}
                </svg>
            </div>
        );
    }, [dims, results]);

    return (
        <CalculatorPage
            title="Spær Estimat"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            shareValue={mode === 'advanced'
                ? `Udnyttelse: ${capUtilPct.toFixed(0)}% (${govLabel}) · Mrd ${advCalc.cap.momentResistanceKNm.toFixed(1)} kNm · ${advCalc.cap.passed ? 'OK' : 'Overbelastet'}`
                : (results.count > 0 ? `${results.count} spær · ${results.rafterLength.toFixed(2)} m spærlængde · ridge +${results.ridgeHeight.toFixed(2)} m` : undefined)}
            stickyResultLabel={mode === 'advanced' ? 'Udnyttelsesgrad' : 'Antal spær'}
            stickyResult={mode === 'advanced'
                ? <><AnimatedNumber value={capUtilPct} precision={0} /> %</>
                : <><AnimatedNumber value={results.count} precision={0} /> stk.</>}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Tagkonstruktion</h3>
                    <InputField label="Bygningsbredde (spænd)" value={dims.span} onChange={e => handleDimChange(e, 'span')} unit="m" info="Den vandrette spændvidde for spærene (bygningens bredde)."/>
                    <InputField label="Taghældning" value={dims.pitch} onChange={e => handleDimChange(e, 'pitch')} unit="°" info="Tagets hældningsvinkel i grader (typisk 20–45°)."/>
                    <InputField label="Bygningslængde" value={dims.buildingLength} onChange={e => handleDimChange(e, 'buildingLength')} unit="m" info="Husets længde — bestemmer antal spær."/>
                    <InputField label="Spærafstand (c/c)" value={dims.cc} onChange={e => handleDimChange(e, 'cc')} unit="mm" info="Center til center afstand — typisk 600–900 mm."/>

                    {/* ── Advanced: laster, materiale & tværsnit ── */}
                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                                Laster & tværsnit (bæreevne-tjek)
                                <InfoHint
                                    title="Bæreevne-tjek (EC5)"
                                    description="Kontrollerer om det valgte spærtværsnit bærer tag-lasterne. Lasten regnes som en jævnt fordelt last langs spæret (sloped længde tagfod→rygning) og tværsnittet checkes for bøjning og forskydning iht. Eurokode 5."
                                    calculation="q_d = (1,35·gk + 1,5·sk)·c/c → M = q_d·L²/8 → Udnyttelse = Med/Mrd ≤ 1,0"
                                />
                            </p>

                            <InputField
                                label="Tag-egenlast (gk)"
                                value={adv.gk}
                                onChange={e => handleAdvChange(e, 'gk')}
                                unit="kN/m²"
                                info="Permanent last: tagsten + lægter + undertag. Typisk 0,5–0,7 kN/m² for tegltag."
                            />
                            <InputField
                                label="Snelast (sk)"
                                value={adv.sk}
                                onChange={e => handleAdvChange(e, 'sk')}
                                unit="kN/m²"
                                info="Karakteristisk snelast på jorden. DK zone 1: sk = 1,0 kN/m² (DS/EN 1991-1-3)."
                            />

                            <div>
                                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                    Materiale & styrkeklasse
                                    <InfoHint
                                        title="Materiale (Eurokode)"
                                        description="Vælg spærmateriale. Hver klasse bærer sine karakteristiske styrkeværdier samt partialkoefficient γM og kmod fra Eurokode. Spær udføres typisk i konstruktionstræ C24."
                                        calculation={material.standardNote}
                                    />
                                </label>
                                <select
                                    aria-label="Materiale"
                                    value={materialKey}
                                    onChange={e => setMaterialKey(e.target.value)}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                >
                                    {Object.values(BEAM_MATERIALS).map(m => (
                                        <option key={m.key} value={m.key}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Bredde (b)" value={adv.b} onChange={e => handleAdvChange(e, 'b')} unit="mm" info="Spærets tykkelse, f.eks. 45 mm." />
                                <InputField label="Højde (h)" value={adv.h} onChange={e => handleAdvChange(e, 'h')} unit="mm" info="Spærhøjden i bøjningsretningen, f.eks. 195 mm." />
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <ResultDisplay label="Estimeret Antal Spær" value={results.count} precision={0} unit="stk." />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark text-center">
                            <p className="text-xs text-text-secondary mb-1">Spærlængde (halvdel)</p>
                            <p className="text-2xl font-bold text-brand-primary">{results.rafterLength.toFixed(2)} m</p>
                        </div>
                        <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark text-center">
                            <p className="text-xs text-text-secondary mb-1">Ridgehøjde</p>
                            <p className="text-2xl font-bold text-brand-primary">+{results.ridgeHeight.toFixed(2)} m</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h3 className="font-bold text-lg mb-2">Spærplan (Oversigt)</h3>
                        {Diagram}
                        <p className="text-xs text-center text-text-secondary mt-2">Illustration viser placering fra gavl til gavl.</p>
                    </div>

                    {/* ── Advanced: EC5 bæreevne-resultater ── */}
                    {mode === 'advanced' && (
                        <>
                            {/* Load chain summary */}
                            <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                                <p className="flex items-center gap-1 font-semibold">
                                    Lastkæde (EC0/EC1)
                                    <InfoHint
                                        title="Designlast langs spæret"
                                        description="Egenlast og snelast ganges med EC0-partialkoefficienterne (1,35 og 1,5) og multipliceres med spærafstanden for at give en linjelast langs spæret. Bemærk: snelast virker på den vandrette projektion — her regnes forenklet som en jævnt fordelt last langs spæret (let konservativt). En fuld dimensionering kræver også vindlast og lastkombinationer."
                                        calculation="q_d = (1,35·gk + 1,5·sk)·c/c"
                                    />
                                </p>
                                <p>q_d = (1,35·{advCalc.gk} + 1,5·{advCalc.sk}) × {advCalc.spacingM.toFixed(3)} m = <strong>{advCalc.qd.toFixed(2)} kN/m</strong></p>
                                <p className="flex items-center gap-1">
                                    M = q_d·L²/8 = {advCalc.load.maxMoment.toFixed(2)} kNm · V = q_d·L/2 = {advCalc.load.maxShear.toFixed(2)} kN
                                    <InfoHint
                                        title="Snitkræfter (frit oplagt)"
                                        description="Spæret regnes som en frit oplagt bjælke med jævnt fordelt last over den sloped spærlængde L (tagfod→rygning)."
                                        calculation={`M = q·L²/8 · V = q·L/2 · L = ${advCalc.spanM.toFixed(2)} m`}
                                    />
                                </p>
                            </div>

                            {/* Utilisation verdict */}
                            <div className={`p-4 rounded-card border-l-4 shadow-sm ${advCalc.cap.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                                <div className="flex items-start gap-3">
                                    {advCalc.cap.passed
                                        ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                        : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1">
                                            <h4 className={`font-bold ${advCalc.cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                                Udnyttelsesgrad {capUtilPct.toFixed(0)}% ({govLabel})
                                            </h4>
                                            <InfoHint
                                                title="Udnyttelsesgrad (Med/Mrd)"
                                                description="Forholdet mellem det dimensionerende moment/forskydning og spærtværsnittets design-bæreevne. Skal være ≤ 100% (Eurokode ULS). Over 100% er spæret overbelastet."
                                                calculation="Mrd = W·fm,d (W = b·h²/6, fm,d = kmod·fm,k/γM) · Udnyttelse = Med/Mrd ≤ 1,0"
                                            />
                                        </div>
                                        <p className={`text-sm mt-0.5 ${advCalc.cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            {advCalc.cap.passed
                                                ? `Spærtværsnittet ${adv.b}×${adv.h} mm bærer tag-lasterne. Mrd = ${advCalc.cap.momentResistanceKNm.toFixed(1)} kNm · Vrd = ${advCalc.cap.shearResistanceKN.toFixed(1)} kN.`
                                                : `Spærtværsnittet er overbelastet i ${govLabel.toLowerCase()}. Øg højden h, reducér spærafstanden (c/c) eller vælg en stærkere styrkeklasse.`}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <ComplianceMeter
                                label="Udnyttelse vs. grænse (100%)"
                                value={capUtilPct}
                                limit={100}
                                min={0}
                                max={150}
                                unit="%"
                                decimalPlaces={0}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <ResultDisplay label="Moment-bæreevne Mrd" value={advCalc.cap.momentResistanceKNm} precision={2} unit="kNm" />
                                <ResultDisplay label="Forskydnings-bæreevne Vrd" value={advCalc.cap.shearResistanceKN} precision={2} unit="kN" />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary dark:text-text-dark-secondary">
                                <div className="bg-white dark:bg-bg-dark-surface p-2 rounded-lg border border-border dark:border-border-dark">
                                    Bøjning: {(advCalc.cap.bendingUtilization * 100).toFixed(0)}% (Mrd {advCalc.cap.momentResistanceKNm.toFixed(1)} kNm)
                                </div>
                                <div className="bg-white dark:bg-bg-dark-surface p-2 rounded-lg border border-border dark:border-border-dark">
                                    Forskydning: {(advCalc.cap.shearUtilization * 100).toFixed(0)}% (Vrd {advCalc.cap.shearResistanceKN.toFixed(1)} kN)
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </CalculatorPage>
    );
};

export default RafterCalculator;
