
import React, { useState, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import AnimatedNumber from '../../components/AnimatedNumber';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeRetainingWall } from '../../catalog';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const helpContent: HelpContent = {
    formaal: 'Screening af en tyngde-/massestøttemurs stabilitet: kontrollerer væltning, glidning og jordtryk med Rankines aktive jordtryk. Vejledende — endelig geoteknisk dimensionering skal udføres af en ingeniør iht. DS/EN 1997-1 (EC7).',
    variabler: [
        { name: 'Højde', symbol: 'H', unit: 'm', description: 'Den tilbageholdte jordhøjde.' },
        { name: 'Fodbredde', symbol: 'B', unit: 'm', description: 'Murens fundamentsbredde.' },
        { name: 'Murtykkelse', symbol: 't', unit: 'm', description: 'Gennemsnitlig murtykkelse (til egenvægt).' },
        { name: 'Jordvægt', symbol: 'γ', unit: 'kN/m³', description: 'Rumvægt af tilbageholdt jord (~18).' },
        { name: 'Friktionsvinkel', symbol: 'φ', unit: '°', description: 'Jordens indre friktionsvinkel (~30° for sand/grus).' },
    ],
    formel: 'Ka = tan²(45 − φ/2)   [Rankine aktivt jordtryk]\nPa = ½·Ka·γ·H²   (virker i H/3)\nVæltning: FS = M_modstand / M_væltning ≥ 2,0\nGlidning: FS = μ·W / Pa ≥ 1,5\nJordtryk: W/B ≤ tilladelig bæreevne',
    antagelser: 'Forenklet Rankine-model, lodret bagside, vandret jordoverflade. Vandtryk (opdrift/porevand) ikke medregnet — det er ofte dimensionsgivende. Kræver geoteknisk vurdering.',
    standarder: 'DS/EN 1997-1 (EC7) – Geoteknik, støttekonstruktioner\nDS/EN 1990 (EC0) – Sikkerhed og lastkombinationer',
};

const TOOL_ID = 'statiske-beregninger-stoettemur';

const RetainingWallCalculator: React.FC = () => {
    const [inp, setInp] = useState({ height: '2', base: '1.5', thickness: '0.4', gamma: '18', phi: '30', surcharge: '0', mu: '0.5', bearing: '150' });
    const set = (k: keyof typeof inp) => (e: React.ChangeEvent<HTMLInputElement>) => setInp(p => ({ ...p, [k]: e.target.value }));

    const r = useMemo(() => computeRetainingWall({
        heightM: parseFloat(inp.height) || 0,
        baseWidthM: parseFloat(inp.base) || 0,
        wallThicknessM: parseFloat(inp.thickness) || 0,
        soilDensityKNm3: parseFloat(inp.gamma) || 18,
        frictionAngleDeg: parseFloat(inp.phi) || 30,
        surchargeKPa: parseFloat(inp.surcharge) || 0,
        baseFrictionCoeff: parseFloat(inp.mu) || 0.5,
        bearingCapacityKNm2: parseFloat(inp.bearing) || 150,
    }), [inp]);

    const reportData: CalculatorReportData = {
        toolName: 'Støttemur-stabilitet',
        category: 'Statiske Beregninger',
        inputs: [
            { label: 'Højde', value: inp.height, unit: 'm' },
            { label: 'Fodbredde', value: inp.base, unit: 'm' },
            { label: 'Murtykkelse', value: inp.thickness, unit: 'm' },
            { label: 'Jordvægt γ', value: inp.gamma, unit: 'kN/m³' },
            { label: 'Friktionsvinkel φ', value: inp.phi, unit: '°' },
            { label: 'Overlast', value: inp.surcharge, unit: 'kN/m²' },
        ],
        results: [
            { label: 'Ka (aktivt jordtryk)', value: r.ka.toFixed(3), highlight: true },
            { label: 'Aktivt tryk Pa', value: r.activeThrustKN.toFixed(1), unit: 'kN/m' },
            { label: 'Sikkerhed mod væltning', value: `${r.overturningFoS.toFixed(2)} (≥2,0)` },
            { label: 'Sikkerhed mod glidning', value: `${r.slidingFoS.toFixed(2)} (≥1,5)` },
            { label: 'Jordtryk under fod', value: `${r.bearingPressureKNm2.toFixed(0)} kN/m²` },
            { label: 'Status', value: r.passed ? 'OK (alle tjek)' : 'IKKE OK' },
        ],
        formula: 'Ka=tan²(45−φ/2) · Pa=½Ka γH² · FS_vælt=Mr/Mo≥2 · FS_glid=μW/Pa≥1,5',
        standardsStruktureret: [{ code: 'DS/EN 1997-1', clause: 'EC7', note: 'Geoteknik — støttekonstruktioner' }],
        safetyDisclaimer: 'Støttemure over ~1 m og alle mure med vand-/trafiklast skal dimensioneres af en geotekniker/ingeniør iht. EC7.',
    };

    const checks = [
        { label: 'Væltning', fos: r.overturningFoS, limit: 2.0, ok: r.overturningOk },
        { label: 'Glidning', fos: r.slidingFoS, limit: 1.5, ok: r.slidingOk },
    ];

    return (
        <CalculatorPage
            title="Støttemur-stabilitet (EC7)"
            helpContent={helpContent}
            reportData={reportData}
            stickyResultLabel="Væltning FS"
            stickyResult={<><AnimatedNumber value={r.overturningFoS} precision={2} /></>}
            shareValue={`Støttemur H=${inp.height}m: væltning ${r.overturningFoS.toFixed(2)}, glidning ${r.slidingFoS.toFixed(2)} · ${r.passed ? 'OK' : 'Ikke OK'}`}
        >
            <div className="grid md:grid-cols-2 gap-6 items-start">
                <div className="bg-white dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
                    <h3 className="font-bold text-lg">Mur- & jorddata</h3>
                    <div className="grid grid-cols-3 gap-3">
                        <InputField label="Højde H" value={inp.height} onChange={set('height')} unit="m" />
                        <InputField label="Fodbredde B" value={inp.base} onChange={set('base')} unit="m" info="Bredere fod = bedre stabilitet mod væltning og glidning." />
                        <InputField label="Tykkelse t" value={inp.thickness} onChange={set('thickness')} unit="m" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Jordvægt γ" value={inp.gamma} onChange={set('gamma')} unit="kN/m³" info="Sand/grus ~18–20, ler ~18." />
                        <div className="flex items-end gap-1">
                            <div className="flex-1">
                                <InputField label="Friktionsvinkel φ" value={inp.phi} onChange={set('phi')} unit="°" info="Sand/grus ~30–35°, ler lavere." />
                            </div>
                            <InfoHint
                                title="Aktivt jordtryk (Rankine)"
                                description="Jorden bag muren skubber udad. Jo lavere friktionsvinkel, jo større tryk. Ka = tan²(45−φ/2) omsætter friktionsvinklen til en trykkoefficient."
                                calculation="Pa = ½·Ka·γ·H² (virker i H/3 over foden)"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <InputField label="Overlast" value={inp.surcharge} onChange={set('surcharge')} unit="kN/m²" info="Fx trafik/oplag bag muren." />
                        <InputField label="Friktion μ" value={inp.mu} onChange={set('mu')} unit="–" info="Mellem fod og jord, ~0,5." />
                        <InputField label="Bæreevne" value={inp.bearing} onChange={set('bearing')} unit="kN/m²" />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${r.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                        <div className="flex items-start gap-3">
                            {r.passed ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" /> : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                            <div>
                                <h4 className={`font-bold ${r.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                    {r.passed ? 'Alle stabilitetstjek OK' : 'Stabilitet ikke opfyldt'}
                                </h4>
                                <p className="text-sm mt-0.5 text-text-primary dark:text-text-dark-primary">
                                    {r.passed
                                        ? 'Muren opfylder de forenklede krav til væltning, glidning og jordtryk.'
                                        : `Ikke opfyldt: ${[!r.overturningOk && 'væltning', !r.slidingOk && 'glidning', !r.bearingOk && 'jordtryk'].filter(Boolean).join(', ')}. Øg fodbredden/egenvægten eller reducér højden.`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {checks.map(c => (
                        <div key={c.label}>
                            <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">Sikkerhed mod {c.label.toLowerCase()} (krav ≥ {c.limit})</p>
                            <ComplianceMeter label={c.label} value={Math.min(c.fos, c.limit * 2.5)} limit={c.limit} min={0} max={c.limit * 2.5} unit="" decimalPlaces={2} />
                        </div>
                    ))}

                    <div className="grid grid-cols-2 gap-3">
                        <ResultDisplay label="Jordtryk under fod" value={r.bearingPressureKNm2} precision={0} unit="kN/m²" />
                        <ResultDisplay label="Aktivt tryk Pa" value={r.activeThrustKN} precision={1} unit="kN/m" />
                    </div>
                </div>
            </div>

            <SafetyDisclaimer>
                Dette er en forenklet screening (Rankine, uden vandtryk). Støttemure er geotekniske konstruktioner —
                mure over ca. 1 m, eller med vand-, skrånings- eller trafiklast, SKAL dimensioneres af en ingeniør/geotekniker
                iht. DS/EN 1997-1 (EC7).
            </SafetyDisclaimer>
        </CalculatorPage>
    );
};

export default RetainingWallCalculator;
