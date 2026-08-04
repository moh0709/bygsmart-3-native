
import React, { useState, useEffect } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { LoadDiagram, ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeBeamLoad, computeBeamCapacity, BEAM_MATERIALS, STANDARDS_CATALOG } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';

type LoadType = 'point' | 'distributed';

const helpContent: HelpContent = {
    formaal: 'Beregner maksimalt bøjningsmoment og forskydningskraft for en simpelt understøttet bjælke (frit oplagt). Avanceret tilstand beregner design-kræfter med EC0 lastkombinationskoefficienter.',
    variabler: [
        { name: 'Spændvidde', symbol: 'L', unit: 'm', description: 'Bjælkens længde mellem understøtninger.' },
        { name: 'Punktlast', symbol: 'P', unit: 'kN', description: 'Koncentreret kraft ved position a fra venstre.' },
        { name: 'Fordelt last', symbol: 'q', unit: 'kN/m', description: 'Jævnt fordelt belastning over hele spændvidden.' },
        { name: 'Position', symbol: 'a', unit: 'm', description: 'Afstand fra venstre understøtning til punktlast.' },
        { name: 'γQ', symbol: 'γQ', unit: '–', description: 'EC0 partialkoefficient for variabel last. Standard: 1,50.' },
    ],
    formel: 'Punktlast: M = P·a·b/L,  V = max(P·b/L, P·a/L)\nFordelt last: M = q·L²/8,  V = q·L/2\nDesign (EC0): Ed = γQ · Mk',
    antagelser: 'Simpelt understøttet bjælke (frit oplagt). Lineær elastisk adfærd. Egenvægt af bjælken ikke medregnet.',
    standarder: 'DS/EN 1990 (EC0) – Lastkombinationer og sikkerhed\nDS/EN 1991-1-1 (EC1) – Egenlast og nyttelast\nDS/EN 1991-1-3 (EC1 sne) – DK: sk = 1,0 kN/m²\nDS/EN 1991-1-4 (EC1 vind) – DK: vb,0 = 24 m/s',
};

const TOOL_ID = 'statiske-beregninger-bjaelkebelastning';

const BeamLoadCalculator: React.FC = () => {
    const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');
    const [loadType, setLoadType] = useState<LoadType>('point');
    const [dims, setDims] = useState({ length: '5', load: '10', position: '2.5', gammaQ: '1.50' });
    const [section, setSection] = useState({ width: '0.1', height: '0.2' });
    const [materialKey, setMaterialKey] = useState('timber-c24');
    const [results, setResults] = useState({ moment: 0, shear: 0, momentDesign: 0, shearDesign: 0 });

    const handleDimChange = (field: keyof typeof dims) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const L = parseFloat(dims.length) || 0;
        const load = parseFloat(dims.load) || 0;
        const a = Math.max(0, Math.min(parseFloat(dims.position) || L / 2, L));

        if (L <= 0 || load <= 0) {
            setResults({ moment: 0, shear: 0, momentDesign: 0, shearDesign: 0 });
            return;
        }

        let moment = 0;
        let shear = 0;

        const res = computeBeamLoad({ span: L, loadType, load, position: loadType === 'point' ? a : undefined });
        moment = res.maxMoment;
        shear = res.maxShear;

        const gQ = parseFloat(dims.gammaQ) || 1.50;
        const momentDesign = mode === 'advanced' ? gQ * moment : moment;
        const shearDesign = mode === 'advanced' ? gQ * shear : shear;

        setResults({ moment, shear, momentDesign, shearDesign });
    }, [dims, loadType, mode]);

    const advancedLocked = !advancedAllowed;

    const displayMoment = mode === 'advanced' ? results.momentDesign : results.moment;
    const displayShear = mode === 'advanced' ? results.shearDesign : results.shear;

    // Resistance/utilisation check for the chosen section + material (EC5/EC3).
    const material = BEAM_MATERIALS[materialKey];
    const cap = computeBeamCapacity({
        widthM: parseFloat(section.width) || 0,
        heightM: parseFloat(section.height) || 0,
        momentKNm: displayMoment,
        shearKN: displayShear,
        material,
    });
    const capUtilPct = cap.utilization * 100;
    const govLabel = cap.governing === 'bending' ? 'Bøjning' : cap.governing === 'shear' ? 'Forskydning' : '–';

    const reportData: CalculatorReportData = {
        toolName: 'Bjælkeberegner',
        category: 'Statiske Beregninger',
        mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
        inputs: [
            { label: 'Bjælkelængde', value: dims.length, unit: 'm' },
            { label: 'Lasttype', value: loadType === 'point' ? 'Punktlast' : 'Fordelt last' },
            { label: loadType === 'point' ? 'Punktlast' : 'Fordelt last', value: dims.load, unit: loadType === 'point' ? 'kN' : 'kN/m' },
            ...(loadType === 'point' ? [{ label: 'Lastposition (a)', value: dims.position, unit: 'm' }] : []),
            ...(mode === 'advanced' ? [{ label: 'γQ – Variabel last', value: dims.gammaQ }] : []),
            { label: 'Materiale', value: material.label },
            { label: 'Tværsnit b×h', value: `${section.width}×${section.height}`, unit: 'm' },
        ],
        results: [
            { label: 'Max Moment', value: results.moment.toFixed(2), unit: 'kNm', highlight: true },
            { label: 'Max Forskydning', value: results.shear.toFixed(2), unit: 'kN' },
            ...(mode === 'advanced' ? [
                { label: 'Design Moment Ed', value: results.momentDesign.toFixed(2), unit: 'kNm' },
                { label: 'Design Forskydning Ed', value: results.shearDesign.toFixed(2), unit: 'kN' },
            ] : []),
            ...(cap.governing !== 'none' ? [
                { label: 'Moment-bæreevne Mrd', value: cap.momentResistanceKNm.toFixed(2), unit: 'kNm' },
                { label: 'Forskydnings-bæreevne Vrd', value: cap.shearResistanceKN.toFixed(2), unit: 'kN' },
                { label: 'Udnyttelsesgrad', value: `${capUtilPct.toFixed(0)}%` },
                { label: 'Status', value: cap.passed ? 'OK (≤100%)' : 'OVERBELASTET' },
            ] : []),
        ],
        formula: 'Punktlast: M = P·a·b/L,  V = max(P·b/L, P·a/L)\nFordelt last: M = q·L²/8,  V = q·L/2\nDesign (EC0): Ed = γQ · Mk',
        standardsStruktureret: STANDARDS_CATALOG.statics,
        safetyDisclaimer: 'Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne.',
    };

    if (!allowed) {
        return (
            <div className="min-h-screen bg-bg-subtle dark:bg-bg-dark flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                    <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">Bjælkeberegner (Pro)</p>
                    <p className="text-text-secondary dark:text-text-dark-secondary text-sm">Dette værktøj kræver et aktivt abonnement.</p>
                </div>
            </div>
        );
    }

    return (
        <CalculatorPage
            title="Bjælkeberegner (Pro)"
            helpContent={helpContent}
            reportData={reportData}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={advancedLocked}
                    onChange={setMode}
                />
            }
            stickyResultLabel="Max Moment"
            stickyResult={<><AnimatedNumber value={displayMoment} precision={2} /> kNm</>}
            shareValue={`Max Moment: ${results.moment.toFixed(2)} kNm, Max Forskydning: ${results.shear.toFixed(2)} kN`}
        >
            {/* Load type selector */}
            <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                <SegmentedControl
                    options={[{ label: 'Punktlast', value: 'point' }, { label: 'Fordelt Last', value: 'distributed' }]}
                    value={loadType}
                    onChange={(value) => setLoadType(value as LoadType)}
                />
            </div>

            <div className="grid md:grid-cols-2 gap-6 items-start">
                {/* Inputs */}
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Indtast Data</h3>
                    <p className="text-sm text-text-secondary -mb-2">Simpelt understøttet bjælke – moment og forskydning.</p>

                    <InputField
                        label="Bjælkelængde (L)"
                        value={dims.length}
                        onChange={handleDimChange('length')}
                        unit="m"
                        info="Spændvidde mellem understøtninger."
                    />
                    {loadType === 'point' ? (
                        <>
                            <InputField
                                label="Punktlast (P)"
                                value={dims.load}
                                onChange={handleDimChange('load')}
                                unit="kN"
                                info="Koncentreret kraft, f.eks. en søjle der hviler på bjælken."
                            />
                            <InputField
                                label="Lastens Position (a)"
                                value={dims.position}
                                onChange={handleDimChange('position')}
                                unit="m"
                                placeholder={`midten (${(parseFloat(dims.length) || 0) / 2}m)`}
                                info="Afstand fra venstre understøtning til lasten."
                            />
                        </>
                    ) : (
                        <InputField
                            label="Fordelt Last (q)"
                            value={dims.load}
                            onChange={handleDimChange('load')}
                            unit="kN/m"
                            info="Jævnt fordelt belastning, f.eks. bjælkens egenvægt eller last fra et dæk."
                        />
                    )}

                    {mode === 'advanced' && (
                        <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">EC0 Lastkombination</p>
                            <InputField
                                label="γQ – Variabel last"
                                value={dims.gammaQ}
                                onChange={handleDimChange('gammaQ')}
                                unit="–"
                                info="Variabel last: 1,50."
                            />
                        </div>
                    )}

                    {/* Section + material → resistance check */}
                    <div className="border-t border-border dark:border-border-dark pt-4 space-y-3">
                        <p className="flex items-center gap-1 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                            Tværsnit & materiale (bæreevnetjek)
                            <InfoHint
                                title="Bæreevnetjek (EC5/EC3)"
                                description="Sammenholder det beregnede moment/forskydning med tværsnittets design-bæreevne, så du får en udnyttelsesgrad. I Basis bruges karakteristiske snitkræfter; i Avanceret ganges med γQ (EC0)."
                                calculation="Mrd = W·fm,d (W=b·h²/6) · Udnyttelse = Med/Mrd ≤ 1,0"
                            />
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Materiale</label>
                            <select
                                aria-label="Materiale"
                                value={materialKey}
                                onChange={e => setMaterialKey(e.target.value)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-white dark:bg-bg-dark-surface focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            >
                                {Object.values(BEAM_MATERIALS).map(m => (
                                    <option key={m.key} value={m.key}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Bredde (b)" value={section.width} onChange={e => setSection(p => ({ ...p, width: e.target.value }))} unit="m" />
                            <InputField label="Højde (h)" value={section.height} onChange={e => setSection(p => ({ ...p, height: e.target.value }))} unit="m" info="Bjælkehøjde i bøjningsretningen." />
                        </div>
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <ResultDisplay
                            label={mode === 'advanced' ? 'Design Moment Ed' : 'Max Moment'}
                            value={displayMoment}
                            unit="kNm"
                        />
                        <ResultDisplay
                            label={mode === 'advanced' ? 'Design Forskydning Ed' : 'Max Forskydning'}
                            value={displayShear}
                            unit="kN"
                        />
                    </div>

                    {mode === 'advanced' && (
                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                            <p className="font-semibold">Karakteristiske værdier:</p>
                            <p>Moment Mk = {results.moment.toFixed(2)} kNm</p>
                            <p>Forskydning Vk = {results.shear.toFixed(2)} kN</p>
                            <p>Ed = {dims.gammaQ} × Mk = {results.momentDesign.toFixed(2)} kNm</p>
                        </div>
                    )}

                    {/* LoadDiagram viz */}
                    <div className="bg-white dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                        <LoadDiagram
                            length={parseFloat(dims.length) || 5}
                            loadType={loadType}
                            load={parseFloat(dims.load) || 0}
                            position={loadType === 'point' ? (parseFloat(dims.position) || undefined) : undefined}
                        />
                    </div>

                    {/* Capacity / utilisation verdict */}
                    {cap.governing !== 'none' && (
                        <>
                            <div className={`p-4 rounded-card border-l-4 shadow-sm ${cap.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                                <div className="flex items-start gap-3">
                                    {cap.passed
                                        ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                        : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                    <div>
                                        <h4 className={`font-bold ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            Udnyttelsesgrad {capUtilPct.toFixed(0)}% ({govLabel})
                                        </h4>
                                        <p className={`text-sm mt-0.5 ${cap.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            {cap.passed
                                                ? `Tværsnittet bærer ${mode === 'advanced' ? 'design-' : ''}snitkræfterne. Mrd = ${cap.momentResistanceKNm.toFixed(1)} kNm · Vrd = ${cap.shearResistanceKN.toFixed(1)} kN.`
                                                : `Tværsnittet er overbelastet i ${govLabel.toLowerCase()}. Øg højden h eller vælg en stærkere styrkeklasse.`}
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
                            <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary dark:text-text-dark-secondary">
                                <div className="bg-white dark:bg-bg-dark-surface p-2 rounded-lg border border-border dark:border-border-dark">
                                    Bøjning: {(cap.bendingUtilization * 100).toFixed(0)}% (Mrd {cap.momentResistanceKNm.toFixed(1)} kNm)
                                </div>
                                <div className="bg-white dark:bg-bg-dark-surface p-2 rounded-lg border border-border dark:border-border-dark">
                                    Forskydning: {(cap.shearUtilization * 100).toFixed(0)}% (Vrd {cap.shearResistanceKN.toFixed(1)} kN)
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <SafetyDisclaimer>
                Statiske beregninger er vejledende. Alle bærende konstruktioner SKAL dimensioneres og godkendes af en autoriseret konstruktør i henhold til BR18 og Eurokode-standarderne. Disse beregninger erstatter ikke et konstruktionsprojekt.
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default BeamLoadCalculator;
