
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeDeflection, STANDARDS_CATALOG } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

const TOOL_ID = 'statiske-beregninger-nedboejning';

const LIMIT_OPTIONS = [
    { denom: 400, label: 'L/400 – følsomme (skillevægge, glas)' },
    { denom: 360, label: 'L/360 – gulve med pudsede lofter' },
    { denom: 300, label: 'L/300 – almindelig bjælke/tag' },
];

const helpContent: HelpContent = {
    formaal: 'Beregner maksimal midspans nedbøjning for en simpelt understøttet bjælke med jævnt fordelt last og kontrollerer mod EC5/EC3 serviceabilitetsgrænser (L/300, L/360, L/400). Avanceret tilstand medregner EC5 krybning (kdef) til slutnedbøjningen.',
    variabler: [
        { name: 'Spændvidde', symbol: 'L', unit: 'm', description: 'Fri spændvidde.' },
        { name: 'Fordelt last', symbol: 'q', unit: 'kN/m', description: 'Karakteristisk jævnt fordelt last inkl. egenvægt.' },
        { name: 'Elasticitetsmodul', symbol: 'E', unit: 'GPa', description: 'Træ ≈ 11 GPa, Stål ≈ 210 GPa, Beton ≈ 30 GPa.' },
        { name: 'Inertimoment', symbol: 'I', unit: 'cm⁴', description: 'Tværsnittets inertimoment. Aflæs fra profilkatalog.' },
        { name: 'Krybefaktor', symbol: 'kdef', unit: '–', description: 'EC5 krybning: w_fin = w_inst·(1+kdef). Anvendelsesklasse 1 ≈ 0,6; klasse 3 ≈ 2,0.' },
    ],
    formel: 'w_inst = (5 × q × L⁴) / (384 × E × I)\nw_fin = w_inst × (1 + kdef)      [EC5 §2.2.3]\nGrænse = L / n  (n = 300/360/400)\nUdnyttelse = w / grænse ≤ 1,0',
    antagelser: 'Simpelt understøttet bjælke. Jævnt fordelt last. Lineær elastisk opførsel. Krybning kun relevant for træ.',
    standarder: 'DS/EN 1995-1-1 (EC5) §2.2.3 & §7.2 – Nedbøjning og krybning (kdef)\nDS/EN 1993-1-1 (EC3) §7.2 – Stål: serviceabilitetskrav\nBR18 – Anvendelsesgrænsetilstand (SLS)',
};

const DeflectionCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [span, setSpan] = useState('4');
    const [load, setLoad] = useState('5');
    const [eGPa, setEGPa] = useState('11');
    const [iCm4, setICm4] = useState('1000');
    const [limitDenom, setLimitDenom] = useState(400);
    const [kdef, setKdef] = useState('0.6');

    const useCreep = mode === 'advanced';
    const result = computeDeflection({
        spanM: parseFloat(span) || 0,
        loadKNm: parseFloat(load) || 0,
        elasticModulusGPa: parseFloat(eGPa) || 0,
        momentOfInertiaM4: (parseFloat(iCm4) || 0) * 1e-8,
        kdef: useCreep ? (parseFloat(kdef) || 0) : 0,
        limitDenominator: limitDenom,
    });

    const governingDeflection = useCreep ? result.finalDeflectionMm : result.deflectionMm;
    const utilPct = result.utilization * 100;

    const reportData: CalculatorReportData = {
        toolName: 'Nedbøjningsberegner',
        category: 'Statiske Beregninger',
        mode: useCreep ? 'Avanceret (m. krybning)' : 'Basis',
        inputs: [
            { label: 'Spændvidde', value: span, unit: 'm' },
            { label: 'Fordelt last', value: load, unit: 'kN/m' },
            { label: 'Elasticitetsmodul', value: eGPa, unit: 'GPa' },
            { label: 'Inertimoment', value: iCm4, unit: 'cm⁴' },
            { label: 'Grænse', value: `L/${limitDenom}` },
            ...(useCreep ? [{ label: 'Krybefaktor kdef', value: kdef }] : []),
        ],
        results: [
            { label: 'Øjeblikkelig nedbøjning w_inst', value: result.deflectionMm.toFixed(2), unit: 'mm', highlight: true },
            ...(useCreep ? [{ label: 'Slutnedbøjning w_fin', value: result.finalDeflectionMm.toFixed(2), unit: 'mm' }] : []),
            { label: `Grænse L/${limitDenom}`, value: result.selectedLimitMm.toFixed(1), unit: 'mm' },
            { label: 'Udnyttelsesgrad', value: `${utilPct.toFixed(0)}%` },
            { label: 'Status', value: result.passed ? 'OK (≤100%)' : 'OVERSKRIDES' },
        ],
        formula: 'w_inst = 5qL⁴/(384EI) ; w_fin = w_inst·(1+kdef) ; grænse = L/n',
        standardsStruktureret: STANDARDS_CATALOG.statics,
        safetyDisclaimer: 'Nedbøjningsberegning er vejledende. Bærende bjælker SKAL dimensioneres af en autoriseret konstruktør.',
    };

    // Beam-sag visualization (exaggerated)
    const Diagram = useMemo(() => {
        const L = 200, y0 = 20;
        const sagPx = Math.min(28, Math.max(2, result.utilization * 22));
        const path = `M 4 ${y0} Q ${L / 2 + 4} ${y0 + sagPx * 2} ${L + 4} ${y0}`;
        return (
            <svg viewBox="0 0 208 70" className="w-full h-auto max-h-24">
                <line x1="4" y1={y0} x2={L + 4} y2={y0} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
                <path d={path} fill="none" stroke={result.passed ? '#059669' : '#dc2626'} strokeWidth="3" strokeLinecap="round" />
                {/* supports */}
                <path d={`M 4 ${y0} l -4 8 l 8 0 z`} fill="#64748b" />
                <path d={`M ${L + 4} ${y0} l -4 8 l 8 0 z`} fill="#64748b" />
                <text x="106" y="56" textAnchor="middle" fontSize="9" fill={result.passed ? '#059669' : '#dc2626'} fontWeight="bold">
                    {governingDeflection.toFixed(1)} mm / grænse {result.selectedLimitMm.toFixed(1)} mm
                </text>
            </svg>
        );
    }, [result, governingDeflection]);

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Nedbøjningsberegner</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Nedbøjningsberegner"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={<CalculatorModeToggle toolId={TOOL_ID} advancedLocked={!advancedAllowed} onChange={setMode} />}
            stickyResultLabel="Udnyttelsesgrad"
            stickyResult={<><AnimatedNumber value={utilPct} precision={0} /> %</>}
            shareValue={`Nedbøjning: ${governingDeflection.toFixed(2)} mm · Grænse L/${limitDenom} = ${result.selectedLimitMm.toFixed(1)} mm · ${result.passed ? 'OK' : 'Overskrides'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>

                    <InputField label="Spændvidde (L)" value={span} onChange={e => setSpan(e.target.value)} unit="m" />
                    <InputField label="Fordelt last (q)" value={load} onChange={e => setLoad(e.target.value)} unit="kN/m" info="Karakteristisk last inkl. egenvægt." />
                    <InputField label="Elasticitetsmodul (E)" value={eGPa} onChange={e => setEGPa(e.target.value)} unit="GPa" info="Træ ≈ 11 GPa, Stål ≈ 210 GPa, Beton ≈ 30 GPa" />
                    <InputField label="Inertimoment (I)" value={iCm4} onChange={e => setICm4(e.target.value)} unit="cm⁴" info="Fx 200×50 mm rektangel: I = b×h³/12 = 5×20³/12 ≈ 3333 cm⁴" />

                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Nedbøjningsgrænse
                            <InfoHint
                                title="Serviceabilitetsgrænse (SLS)"
                                description="Den tilladte nedbøjning afhænger af hvad bjælken bærer. Følsomme konstruktioner (glaspartier, murede skillevægge) kræver den strengeste grænse L/400; almindelige tag-/etagebjælker L/300."
                                calculation="Grænse = L / n. Udnyttelse = w / grænse ≤ 1,0"
                            />
                        </label>
                        <select
                            aria-label="Nedbøjningsgrænse"
                            value={limitDenom}
                            onChange={e => setLimitDenom(parseInt(e.target.value))}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            {LIMIT_OPTIONS.map(o => <option key={o.denom} value={o.denom}>{o.label}</option>)}
                        </select>
                    </div>

                    {useCreep && (
                        <InputField
                            label="Krybefaktor (kdef)"
                            value={kdef}
                            onChange={e => setKdef(e.target.value)}
                            unit="–"
                            info="EC5 krybning: anvendelsesklasse 1 (tørt, indendørs) ≈ 0,6; klasse 2 ≈ 0,8; klasse 3 (udendørs) ≈ 2,0. Kun relevant for træ."
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${result.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {result.passed
                                ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${result.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    Udnyttelsesgrad {utilPct.toFixed(0)}%
                                </h4>
                                <p className={`text-sm mt-0.5 ${result.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {result.passed
                                        ? `${useCreep ? 'Slutnedbøjning' : 'Nedbøjning'} ${governingDeflection.toFixed(1)} mm er inden for grænsen L/${limitDenom} = ${result.selectedLimitMm.toFixed(1)} mm.`
                                        : `${useCreep ? 'Slutnedbøjning' : 'Nedbøjning'} ${governingDeflection.toFixed(1)} mm overskrider L/${limitDenom} = ${result.selectedLimitMm.toFixed(1)} mm. Øg I (højere bjælke) eller reducér spænd/last.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <ComplianceMeter label={`Nedbøjning vs. L/${limitDenom}`} value={utilPct} limit={100} min={0} max={150} unit="%" decimalPlaces={0} />

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Bjælkens nedbøjning (overdrevet)</h4>
                        {Diagram}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="w_inst" value={result.deflectionMm} precision={2} unit="mm" />
                        <ResultDisplay label={useCreep ? 'w_fin (m. krybning)' : 'Grænse'} value={useCreep ? result.finalDeflectionMm : result.selectedLimitMm} precision={useCreep ? 2 : 1} unit="mm" />
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Nedbøjningsberegning er vejledende. Bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør iht. BR18 og Eurokode-standarderne.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default DeflectionCalculator;
