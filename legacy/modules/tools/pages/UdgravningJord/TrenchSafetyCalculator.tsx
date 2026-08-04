
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { InfoHint } from '../../../../components/ui';
import { computeTrenchSafety, STANDARDS_CATALOG, type SoilType } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const SOIL_OPTIONS: { label: string; value: SoilType }[] = [
    { label: 'Ler (anlæg 1:0,5)', value: 'clay' },
    { label: 'Sand/Grus (anlæg 1:1)', value: 'sand' },
    { label: 'Klippe (anlæg 1:0,18)', value: 'rock' },
];

const helpContent: HelpContent = {
    formaal: 'Vurderer hvilke sikkerhedsforanstaltninger en udgravning kræver iht. Arbejdstilsynets vejledning D.2.17 — lodrette sider, skråningsanlæg eller afstivning — ud fra dybde og jordtype, samt den nødvendige setback pr. side ved skråning.',
    variabler: [
        { name: 'Dybde', symbol: 'D', unit: 'm', description: 'Udgravningens dybde fra terræn til bund.' },
        { name: 'Jordtype', symbol: '–', unit: '–', description: 'Bestemmer skråningsanlægget: sand 1:1, ler 1:0,5, klippe 1:0,18.' },
        { name: 'Setback', symbol: 's', unit: 'm', description: 'Vandret tilbagetrækning pr. side = D × anlæg.' },
    ],
    formel: 'Setback pr. side = Dybde × anlæg\nD ≤ 1,7 m: lodret evt. muligt (med agtpågivenhed)\nD > 1,7 m: skråningsanlæg eller afstivning KRÆVES\nD > 5 m: geoteknisk/ingeniørvurdering',
    antagelser: 'Homogen jord uden vandtryk eller nabobelastning. Blødbund, grundvand og trafiklast kræver skærpede foranstaltninger. Kontrollér altid med geoteknisk rapport.',
    standarder: 'AT-vejledning D.2.17 – Udgravninger (skråningsanlæg/afstivning)\nDS/EN ISO 14688 – Geoteknisk klassifikation',
};

const ACTION_TEXT: Record<string, { title: string; body: string }> = {
    'vertical-ok': {
        title: 'Lodrette sider evt. muligt',
        body: 'Ved dybde ≤ 1,7 m i stabil jord kan lodrette sider være forsvarlige med agtpågivenhed. Vurdér altid jordbund, vand og nabobelastning konkret.',
    },
    'batter-or-shore': {
        title: 'Skråningsanlæg eller afstivning KRÆVES',
        body: 'Ved dybde over 1,7 m kræver AT-vejledning D.2.17 dokumenteret skråningsanlæg eller afstivning (spuns/gravekasse).',
    },
    'engineer-required': {
        title: 'Geoteknisk/ingeniørvurdering KRÆVES',
        body: 'Ved dybe udgravninger (> 5 m) skal en geotekniker/ingeniør projektere afstivning og kontrollere stabilitet, vandtryk og opdrift.',
    },
};

const TOOL_ID = 'udgravning-jord-afstivning';

const TrenchSafetyCalculator: React.FC = () => {
    const [depth, setDepth] = useState('2');
    const [width, setWidth] = useState('1');
    const [soilType, setSoilType] = useState<SoilType>('clay');

    const r = useMemo(() => computeTrenchSafety({ depthM: parseFloat(depth) || 0, soilType }), [depth, soilType]);
    const isSafe = r.action === 'vertical-ok';
    const action = ACTION_TEXT[r.action];
    const bottomWidth = parseFloat(width) || 0;
    const topWidth = bottomWidth + 2 * r.minSetbackM;

    const reportData: CalculatorReportData = {
        toolName: 'Udgravning — sikkerhed (AT D.2.17)',
        category: 'Udgravning & Jord',
        inputs: [
            { label: 'Dybde', value: depth, unit: 'm' },
            { label: 'Bundbredde', value: width, unit: 'm' },
            { label: 'Jordtype', value: SOIL_OPTIONS.find(s => s.value === soilType)?.label ?? soilType },
        ],
        results: [
            { label: 'Krav', value: action.title, highlight: true },
            { label: 'Setback pr. side', value: r.minSetbackM.toFixed(2), unit: 'm' },
            { label: 'Krævet topbredde ved skråning', value: topWidth.toFixed(2), unit: 'm' },
            { label: 'Afstivning påkrævet', value: r.requiresSupport ? 'Ja' : 'Nej' },
        ],
        formula: 'Setback = Dybde × anlæg ; D>1,7m → skråning/afstivning ; D>5m → ingeniør',
        standardsStruktureret: STANDARDS_CATALOG.excavation,
        safetyDisclaimer: 'Arbejde i udgravninger er livsfarligt ved sammenstyrtning. Følg altid Arbejdstilsynets vejledning D.2.17 og en geoteknisk vurdering.',
    };

    // Cross-section preview
    const Diagram = useMemo(() => {
        const D = Math.max(parseFloat(depth) || 1, 0.1);
        const b = Math.max(bottomWidth, 0.2);
        const t = b + 2 * r.minSetbackM;
        const vw = 160, vh = 100, pad = 12;
        const scale = Math.min((vw - pad * 2) / t, (vh - pad * 2) / D);
        const bPx = b * scale, tPx = t * scale, dPx = D * scale;
        const cx = vw / 2, topY = pad;
        return (
            <svg viewBox={`0 0 ${vw} ${vh}`} className="w-full h-auto max-h-40">
                <line x1="0" y1={topY} x2={vw} y2={topY} className="stroke-green-600" strokeWidth="1" strokeDasharray="3" />
                <path d={`M${cx - tPx / 2},${topY} L${cx + tPx / 2},${topY} L${cx + bPx / 2},${topY + dPx} L${cx - bPx / 2},${topY + dPx} Z`}
                    fill={isSafe ? '#fde68a' : '#fca5a5'} className="stroke-amber-700" strokeWidth="1" opacity="0.8" />
                <text x={cx} y={topY + dPx / 2} textAnchor="middle" fontSize="8" className="fill-amber-900 font-bold">D = {depth} m</text>
                <text x={cx} y={vh - 2} textAnchor="middle" fontSize="7" className="fill-text-secondary">Top {topWidth.toFixed(2)} m · bund {b.toFixed(2)} m</text>
            </svg>
        );
    }, [depth, bottomWidth, r.minSetbackM, isSafe, topWidth]);

    return (
        <CalculatorPage
            title="Udgravning — sikkerhed"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Setback pr. side"
            stickyResult={<><AnimatedNumber value={r.minSetbackM} precision={2} /> m</>}
            shareValue={`Dybde ${depth} m (${soilType}) → ${action.title}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Udgravningsdata</h3>
                    <InputField label="Dybde (D)" value={depth} onChange={e => setDepth(e.target.value)} unit="m" info="Fra terræn til udgravningens bund. Over 1,7 m kræves foranstaltninger." />
                    <InputField label="Bundbredde" value={width} onChange={e => setWidth(e.target.value)} unit="m" info="Fri arbejdsbredde i bunden af udgravningen." />
                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Jordtype (skråningsanlæg)
                            <InfoHint
                                title="Skråningsanlæg pr. jordtype"
                                description="Anlægget angiver hvor meget siderne skal skråne for at være stabile: løs jord kræver fladere skråning end fast jord. AT D.2.17: sand/grus 1:1, ler 1:0,5, klippe 1:0,18."
                                calculation="Setback = Dybde × anlæg"
                            />
                        </label>
                        <select
                            aria-label="Jordtype"
                            value={soilType}
                            onChange={e => setSoilType(e.target.value as SoilType)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        >
                            {SOIL_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${isSafe ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : r.riskLevel === 'high' ? 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark' : 'bg-warning-subtle border-warning dark:bg-warning-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {isSafe ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className={`w-6 h-6 flex-shrink-0 ${r.riskLevel === 'high' ? 'text-danger' : 'text-warning'}`} />}
                            <div>
                                <h4 className={`font-bold ${isSafe ? 'text-success-strong dark:text-success' : r.riskLevel === 'high' ? 'text-danger-strong dark:text-danger' : 'text-warning-strong dark:text-warning'}`}>
                                    {action.title}
                                </h4>
                                <p className="text-sm mt-0.5 text-text-primary dark:text-text-dark-primary">{action.body}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Setback pr. side" value={r.minSetbackM} precision={2} unit="m" />
                        <ResultDisplay label="Krævet topbredde" value={topWidth} precision={2} unit="m" />
                    </div>

                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <h4 className="text-sm font-semibold mb-2 text-text-secondary dark:text-text-dark-secondary">Tværsnit med skråningsanlæg</h4>
                        {Diagram}
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Sammenstyrtning i udgravninger dræber. Følg altid Arbejdstilsynets vejledning D.2.17, sørg for korrekt
                skråningsanlæg eller afstivning, og indhent en geoteknisk vurdering ved dybder over 1,7 m, blødbund eller grundvand.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default TrenchSafetyCalculator;
