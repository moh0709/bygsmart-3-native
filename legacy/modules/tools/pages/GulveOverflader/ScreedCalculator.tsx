
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage, { type CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle, { type CalcMode } from '../../components/CalculatorModeToggle';
import { InfoHint } from '../../../../components/ui';
import { AlertTriangleIcon, ClockIcon } from '../../../../components/icons';
import { computeScreed, computeScreedDryingTime } from '../../catalog';

const TOOL_ID = 'gulve-overflader-afretningslag';

// Advanced-mode option catalogs (drying-time estimate).
const BINDERS = {
    cement: { key: 'cement' as const, label: 'Cementbaseret (CT)' },
    anhydrite: { key: 'anhydrite' as const, label: 'Calciumsulfat (CA)' },
};

const SITE_CONDITIONS = {
    good: { key: 'good', label: 'God: 20 °C / 50 % RF', factor: 1.0 },
    medium: { key: 'medium', label: 'Middel', factor: 1.25 },
    poor: { key: 'poor', label: 'Dårlig: kold / fugtig', factor: 1.5 },
} as const;

const ScreedCalculator: React.FC = () => {
    const [mode, setMode] = useState<CalcMode>('basic');
    const [dims, setDims] = useState({ length: '5', width: '4', thickness: '40', wastage: '10' });
    const [results, setResults] = useState({ volumeM3: 0, bags: 0 });
    const [binderKey, setBinderKey] = useState<'cement' | 'anhydrite'>('cement');
    const [conditionKey, setConditionKey] = useState<keyof typeof SITE_CONDITIONS>('good');

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        // Formula lives in services/calculatorCatalog.ts (shared with CalculatorPickerModal)
        const r = computeScreed({
            length: parseFloat(dims.length) || 0,
            width: parseFloat(dims.width) || 0,
            thicknessMm: parseFloat(dims.thickness) || 0,
            wastagePct: parseFloat(dims.wastage) || 0,
        });
        setResults({ volumeM3: r.volumeM3, bags: r.bags });
    }, [dims]);

    // Advanced mode: screed drying-time screening estimate.
    // Formula lives in services/calculatorCatalog.ts (already tested).
    const drying = useMemo(() => computeScreedDryingTime({
        thicknessMm: parseFloat(dims.thickness) || 0,
        binder: binderKey,
        conditionFactor: SITE_CONDITIONS[conditionKey].factor,
    }), [dims.thickness, binderKey, conditionKey]);

    const reportData = useMemo<CalculatorReportData>(() => {
        if (mode === 'advanced') {
            return {
                toolName: 'Afretningslag – Tørretid før belægning',
                category: 'Gulve & Overflader',
                mode: 'Avanceret',
                inputs: [
                    { label: 'Lagtykkelse', value: dims.thickness, unit: 'mm' },
                    { label: 'Bindemiddel', value: BINDERS[binderKey].label },
                    { label: 'Forhold på pladsen', value: SITE_CONDITIONS[conditionKey].label },
                ],
                results: [
                    { label: 'Anslået tørretid', value: String(drying.estimatedDays), unit: 'dage', highlight: true },
                    { label: 'Svarer til', value: drying.estimatedWeeks.toFixed(1), unit: 'uger' },
                ],
                formula: 'Screening-estimat: ~1 uge/cm for de første 4 cm cementafretning (CT), derefter ~2 uger/cm; calciumsulfat (CA) tørrer hurtigere (×0,6); ganges med forholds-faktor (god 1,0 / middel 1,25 / dårlig 1,5). Kun vejledende — restfugten SKAL måles (RF % / CM %) før belægning.',
                safetyDisclaimer: 'Tørretiden er kun et screening-estimat. Afretningslaget SKAL fugtmåles (RF % eller CM %) og ligge under belægningens grænseværdi (fx < 85 % RF / < 2,5 CM % — træ/vinyl er strengere), FØR belægningen lægges. For tidlig belægning er den hyppigste årsag til gulvskader.',
            };
        }
        return {
            toolName: 'Afretningslag',
            category: 'Gulve & Overflader',
            mode: 'Basis',
            inputs: [
                { label: 'Rum Længde', value: dims.length, unit: 'm' },
                { label: 'Rum Bredde', value: dims.width, unit: 'm' },
                { label: 'Lagtykkelse', value: dims.thickness, unit: 'mm' },
                { label: 'Spildfaktor', value: dims.wastage, unit: '%' },
            ],
            results: [
                { label: 'Antal Poser (25 kg)', value: String(results.bags), unit: 'stk.', highlight: true },
                { label: 'Volumen', value: results.volumeM3.toFixed(3), unit: 'm³' },
            ],
            formula: 'Volumen = Længde × Bredde × (Tykkelse / 1000) × (1 + Spild / 100); Poser = ⌈Volumen (m³) × 80⌉ (80 poser á 25 kg pr. m³, baseret på ca. 2000 kg/m³ tørvægt)',
        };
    }, [mode, dims, results, drying, binderKey, conditionKey]);

    const SectionDiagram = useMemo(() => {
        const thickness = parseFloat(dims.thickness) || 40; // mm
        
        // Visual scaling
        // Base floor (concrete) fixed height ~ 100mm visual
        // Insulation fixed height ~ 100mm visual
        // Screed dynamic
        
        const scale = 2; // pixels per mm
        const screedH = Math.max(10, Math.min(thickness * scale, 150)); 
        const isoH = 100;
        const concreteH = 60;
        const width = 250;
        
        const totalH = screedH + isoH + concreteH;

        return (
            <div className="w-full flex justify-center items-center bg-bg-subtle rounded-lg border border-border p-6">
                <svg width={width + 100} height={totalH + 40} viewBox={`-50 -20 ${width + 100} ${totalH + 40}`}>
                    <defs>
                        <pattern id="concretePattern" width="10" height="10" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1" fill="#9ca3af" />
                            <path d="M 5 5 L 8 8" stroke="#9ca3af" strokeWidth="1"/>
                        </pattern>
                        <pattern id="insulationPattern" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line x1="0" y1="0" x2="0" y2="20" stroke="#fbbf24" strokeWidth="10" opacity="0.3"/>
                        </pattern>
                        <pattern id="screedPattern" width="4" height="4" patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="0.5" fill="#4b5563" />
                        </pattern>
                    </defs>

                    {/* Screed Layer */}
                    <g>
                        <rect x="0" y="0" width={width} height={screedH} fill="url(#screedPattern)" stroke="#374151" strokeWidth="1" className="fill-gray-300"/>
                        <line x1={width + 10} y1="0" x2={width + 10} y2={screedH} stroke="#374151" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)"/>
                        <text x={width + 15} y={screedH/2} dominantBaseline="middle" className="text-xs font-bold fill-gray-800">{thickness} mm</text>
                        <text x={width/2} y={screedH/2} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-gray-800 opacity-70">Afretning / Slidlag</text>
                    </g>

                    {/* Insulation Layer */}
                    <g transform={`translate(0, ${screedH})`}>
                        <rect x="0" y="0" width={width} height={isoH} fill="url(#insulationPattern)" stroke="#d97706" strokeWidth="1" className="fill-yellow-50"/>
                        <text x={width/2} y={isoH/2} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-yellow-700 opacity-70">Isolering (EPS)</text>
                    </g>

                    {/* Concrete Layer */}
                    <g transform={`translate(0, ${screedH + isoH})`}>
                        <rect x="0" y="0" width={width} height={concreteH} fill="url(#concretePattern)" stroke="#6b7280" strokeWidth="1" className="fill-gray-100"/>
                        <text x={width/2} y={concreteH/2} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-gray-500 opacity-70">Betondæk</text>
                    </g>
                </svg>
            </div>
        );
    }, [dims.thickness]);

    return (
        <CalculatorPage
            title="Gulvafretning Beregner"
            reportData={reportData}
            modeToggle={<CalculatorModeToggle toolId={TOOL_ID} onChange={setMode} />}
            stickyResultLabel={mode === 'advanced' ? 'Anslået tørretid' : 'Antal Poser (25 kg)'}
            stickyResult={
                mode === 'advanced'
                    ? <><AnimatedNumber value={drying.estimatedDays} precision={0} /> dage</>
                    : <><AnimatedNumber value={results.bags} precision={0} /> stk.</>
            }
            shareValue={
                mode === 'advanced'
                    ? `Anslået tørretid: ${drying.estimatedDays} dage (~${drying.estimatedWeeks.toFixed(1)} uger) — mål altid restfugt (RF %/CM %) før belægning`
                    : `Afretningslag: ${results.bags} poser (25 kg) · ${results.volumeM3.toFixed(3)} m³`
            }
        >
            {mode === 'basic' && (
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white p-6 rounded-card shadow-sm border space-y-4">
                    <h3 className="font-bold text-lg">Indtast Mål</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Rum Længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Rummets indvendige længde."/>
                        <InputField label="Rum Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Rummets indvendige bredde."/>
                    </div>
                    <InputField 
                        label="Lagtykkelse" 
                        value={dims.thickness} 
                        onChange={e => handleDimChange(e, 'thickness')} 
                        unit="mm"
                        info="Den gennemsnitlige tykkelse af dit afretningslag. Typisk mellem 30-50 mm for slidlag."
                    />
                    <InputField 
                        label="Spildfaktor" 
                        value={dims.wastage} 
                        onChange={e => handleDimChange(e, 'wastage')} 
                        unit="%"
                        info="En sikkerhedsmargin for spild og ujævnheder. 5-10% er normalt."
                    />
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-card shadow-sm border">
                        <h3 className="font-bold text-lg mb-4">Resultat</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <ResultDisplay label="Volumen" value={results.volumeM3} precision={3} unit="m³"/>
                            <div className="text-center bg-info-subtle p-4 rounded-lg border border-info-border">
                                <p className="text-sm font-medium text-info-strong">Antal Poser (25kg)</p>
                                <div className="text-3xl font-bold text-brand-primary mt-1">
                                    <AnimatedNumber value={results.bags} precision={0} />
                                    <span className="text-xl ml-1">stk.</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6">
                            <h4 className="font-bold text-sm text-text-secondary mb-2">Snittegning (Opbygning)</h4>
                            {SectionDiagram}
                        </div>
                    </div>
                </div>
            </div>
            )}

            {mode === 'advanced' && (
            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* ── Inputs ── */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Tørretid før belægning</h3>
                    <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mb-2">
                        Estimér hvor længe afretningslaget skal tørre, før belægning kan lægges.
                    </p>

                    <InputField
                        label="Lagtykkelse"
                        value={dims.thickness}
                        onChange={e => handleDimChange(e, 'thickness')}
                        unit="mm"
                        info="Afretningslagets tykkelse (samme som i Basis). Tørretiden vokser kraftigt med tykkelsen."
                    />

                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Bindemiddel (afretningstype)
                            <InfoHint
                                title="Bindemiddel: CT vs. CA"
                                description="Cementbaseret afretning (CT) tørrer langsomt: tommelfingerregel ~1 uge/cm for de første 4 cm, derefter ~2 uger/cm. Calciumsulfat / anhydrit (CA) tørrer hurtigere, men tåler ikke vedvarende fugt."
                                calculation="CT: 1 uge/cm (≤ 4 cm) + 2 uger/cm (> 4 cm) · CA ≈ ×0,6"
                            />
                        </label>
                        <select
                            aria-label="Bindemiddel"
                            value={binderKey}
                            onChange={e => setBinderKey(e.target.value as 'cement' | 'anhydrite')}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                        >
                            {Object.values(BINDERS).map(b => (
                                <option key={b.key} value={b.key}>{b.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                            Forhold på byggepladsen
                            <InfoHint
                                title="Temperatur & luftfugtighed"
                                description="Tørring afhænger stærkt af temperatur og luftfugtighed. Gode forhold (ca. 20 °C og 50 % relativ luftfugtighed med udluftning) tørrer hurtigst; koldt, fugtigt eller dårligt ventileret miljø kan let fordoble tørretiden."
                                calculation="God = ×1,0 · Middel = ×1,25 · Dårlig (kold/fugtig) = ×1,5"
                            />
                        </label>
                        <select
                            aria-label="Forhold på byggepladsen"
                            value={conditionKey}
                            onChange={e => setConditionKey(e.target.value as keyof typeof SITE_CONDITIONS)}
                            className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                        >
                            {Object.entries(SITE_CONDITIONS).map(([k, c]) => (
                                <option key={k} value={k}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Results ── */}
                <div className="space-y-6">
                    {/* Prominent drying-time result card */}
                    <div className="p-5 rounded-card border-l-4 border-brand-primary bg-info-subtle dark:bg-info-subtle-dark shadow-sm">
                        <div className="flex items-start gap-3">
                            <ClockIcon className="w-6 h-6 text-brand-primary flex-shrink-0" />
                            <div className="flex-1">
                                <div className="flex items-center gap-1">
                                    <h4 className="font-bold text-info-strong dark:text-info">Anslået tørretid før belægning</h4>
                                    <InfoHint
                                        title="Anslået tørretid (screening)"
                                        description="Vejledende estimat for, hvornår afretningslaget kan være tørt nok til belægning under de valgte forhold. Den faktiske tid kan afvige betydeligt og SKAL bekræftes med en fugtmåling, før belægningen lægges."
                                        calculation="dage = uge/cm-regel × bindemiddel-faktor × forholds-faktor"
                                    />
                                </div>
                                <div className="mt-2 text-4xl font-bold text-brand-primary">
                                    <AnimatedNumber value={drying.estimatedDays} precision={0} />
                                    <span className="text-xl ml-1">dage</span>
                                </div>
                                <p className="text-sm mt-1 text-info-strong dark:text-info">
                                    Svarer til ca. <strong>{drying.estimatedWeeks.toFixed(1)}</strong> uger.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <ResultDisplay label="Tørretid" value={drying.estimatedDays} precision={0} unit="dage" />
                        <ResultDisplay label="Svarer til" value={drying.estimatedWeeks} precision={1} unit="uger" />
                    </div>

                    {/* STRONG amber/warning callout — measure before covering */}
                    <div className="p-5 rounded-card border-l-4 border-warning bg-warning-subtle dark:bg-warning-subtle-dark shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangleIcon className="w-6 h-6 text-warning flex-shrink-0" />
                            <div className="flex-1">
                                <div className="flex items-center gap-1">
                                    <h4 className="font-bold text-warning-strong dark:text-warning">
                                        Kun et screening-estimat — mål fugten før belægning
                                    </h4>
                                    <InfoHint
                                        title="Fugtmåling er obligatorisk"
                                        description="Restfugten SKAL måles (RF % eller CM %) og ligge under belægningens grænseværdi, før belægningen lægges. For tidlig belægning er den hyppigste årsag til gulvskader — buler, opskalning og skimmel."
                                        calculation="Typisk: < 85 % RF / < 2,5 CM % (træ og vinyl er strengere) — følg altid leverandørens krav."
                                    />
                                </div>
                                <p className="text-sm mt-1 text-warning-strong dark:text-warning">
                                    Dette tal er <strong>ikke</strong> en garanti for, at gulvet er klar. Afretningslaget
                                    SKAL fugtmåles (RF % eller CM %) og ligge under belægningens grænseværdi
                                    (fx &lt; 85 % RF / &lt; 2,5 CM % for mange belægninger; træ og vinyl er strengere)
                                    <strong> før</strong> belægningen lægges. For tidlig belægning er den hyppigste årsag
                                    til gulvskader — buler, opskalning og skimmel.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </CalculatorPage>
    );
};

export default ScreedCalculator;
