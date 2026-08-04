
import React, { useState, useEffect, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import RegulationSwitch from '../../components/RegulationSwitch';
import ComplianceAlert from '../../components/ComplianceAlert';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeWindowUValue } from '../../catalog';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const TOOL_ID = 'doere-vinduer-u-vaerdi';

// Glass-edge spacer type → linear thermal transmittance ψg [W/mK] (EN ISO 10077-1).
const SPACER_OPTIONS = [
    { key: 'warm', label: 'Varm kant (warm-edge)', psi: 0.04 },
    { key: 'alu', label: 'Aluminium afstandsprofil', psi: 0.08 },
] as const;

const UValueCalculator: React.FC = () => {
    const { advancedAllowed } = useToolAccess(TOOL_ID);
    const [mode, setMode] = useState<CalcMode>('basic');

    // ── Basic mode state (2-term, area-weighted — kept fully intact) ──────────────
    const [dims, setDims] = useState({
        height: '1.2',
        width: '1.2',
        frameWidth: '0.08',
        uGlass: '0.7',
        uFrame: '1.3'
    });
    const [uValue, setUValue] = useState(0);
    const [areas, setAreas] = useState({ total: 0, glass: 0, frame: 0 });

    // Compliance State (Basic)
    const [isBR18Active, setIsBR18Active] = useState(false);
    const [compliance, setCompliance] = useState({ passed: false, message: '' });

    // ── Advanced mode state (full 3-term Uw incl. glass-edge ψg·lg) ───────────────
    const [adv, setAdv] = useState({
        width: '1.23',
        height: '1.48',
        frameWidthMm: '70',
        ug: '1.0',
        uf: '1.4',
        requirement: '1.2',
    });
    const [spacerKey, setSpacerKey] = useState<string>('warm');

    const handleDimChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
        setDims(prev => ({ ...prev, [field]: e.target.value }));
    };
    const handleAdvChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof adv) => {
        setAdv(prev => ({ ...prev, [field]: e.target.value }));
    };

    useEffect(() => {
        const H = parseFloat(dims.height) || 0;
        const W = parseFloat(dims.width) || 0;
        const fW = parseFloat(dims.frameWidth) || 0;
        const Ug = parseFloat(dims.uGlass) || 0;
        const Uf = parseFloat(dims.uFrame) || 0;

        if (H > 0 && W > 0 && fW > 0 && Ug > 0 && Uf > 0 && (H - 2 * fW) > 0 && (W - 2 * fW) > 0) {
            const totalArea = H * W;
            const glassArea = (H - 2 * fW) * (W - 2 * fW);
            const frameArea = totalArea - glassArea;

            const weightedU = ((Ug * glassArea) + (Uf * frameArea)) / totalArea;

            setUValue(weightedU);
            setAreas({ total: totalArea, glass: glassArea, frame: frameArea });

            // BR18 Check (Approximate reference value for new windows is often 1.2 or lower depending on Eref)
            const limit = 1.2;
            if (weightedU <= limit) {
                setCompliance({ passed: true, message: `U-værdien på ${weightedU.toFixed(2)} er under grænseværdien på ${limit} W/m²K for vinduer.` });
            } else {
                setCompliance({ passed: false, message: `U-værdien er for høj. Kravet til nye vinduer er typisk max ${limit} W/m²K.` });
            }
        } else {
            setUValue(0);
            setAreas({ total: 0, glass: 0, frame: 0 });
            setCompliance({ passed: false, message: 'Indtast gyldige værdier.' });
        }
    }, [dims]);

    // ── Advanced computation (shared, EN ISO 10077-1 tested helper) ───────────────
    const psiG = SPACER_OPTIONS.find(s => s.key === spacerKey)?.psi ?? 0.04;
    const requirement = parseFloat(adv.requirement) || 1.2;
    const spacerLabel = SPACER_OPTIONS.find(s => s.key === spacerKey)?.label ?? '';

    const advResult = useMemo(() => computeWindowUValue({
        widthM: parseFloat(adv.width) || 0,
        heightM: parseFloat(adv.height) || 0,
        frameWidthMm: parseFloat(adv.frameWidthMm) || 0,
        ugWm2K: parseFloat(adv.ug) || 0,
        ufWm2K: parseFloat(adv.uf) || 0,
        psiGWmK: psiG,
        requirementWm2K: requirement,
    }), [adv, psiG, requirement]);

    const isAdvanced = mode === 'advanced';
    // Extra loss from the glass-edge thermal bridge the simple 2-term method omits.
    const edgeLossWm2K = advResult.windowAreaM2 > 0
        ? (advResult.glassPerimeterM * psiG) / advResult.windowAreaM2
        : 0;

    const reportData: CalculatorReportData = useMemo(() => {
        if (isAdvanced) {
            return {
                toolName: 'U-Værdi Beregner (Vindue)',
                category: 'Døre & Vinduer',
                mode: 'Avanceret',
                inputs: [
                    { label: 'Bredde', value: adv.width, unit: 'm' },
                    { label: 'Højde', value: adv.height, unit: 'm' },
                    { label: 'Karm-/rammebredde', value: adv.frameWidthMm, unit: 'mm' },
                    { label: 'Ug (Glas)', value: adv.ug, unit: 'W/m²K' },
                    { label: 'Uf (Karm)', value: adv.uf, unit: 'W/m²K' },
                    { label: 'Afstandsprofil (ψg)', value: `${spacerLabel} (${psiG.toFixed(2)})`, unit: 'W/mK' },
                    { label: 'BR18-krav (Uw,max)', value: requirement.toFixed(2), unit: 'W/m²K' },
                ],
                results: [
                    { label: 'Fuldt vindue Uw', value: advResult.uwWm2K.toFixed(3), unit: 'W/m²K', highlight: true },
                    { label: 'Status', value: advResult.passed ? `OK (≤ ${requirement.toFixed(2)})` : `Overskrider krav (> ${requirement.toFixed(2)})` },
                    { label: 'Glasareal (Ag)', value: advResult.glassAreaM2.toFixed(2), unit: 'm²' },
                    { label: 'Karmareal (Af)', value: advResult.frameAreaM2.toFixed(2), unit: 'm²' },
                    { label: 'Glaskant-omkreds (lg)', value: advResult.glassPerimeterM.toFixed(2), unit: 'm' },
                    { label: 'Glaskant-bidrag (lg·ψg/Aw)', value: edgeLossWm2K.toFixed(3), unit: 'W/m²K' },
                ],
                formula: 'Uw = (Ag·Ug + Af·Uf + lg·ψg) / Aw   (EN ISO 10077-1)',
                safetyDisclaimer: 'Beregningen følger EN ISO 10077-1 med lineært glaskanttab (ψg). Kontrollér altid det samlede Uw mod producentens datablad.',
            };
        }
        return {
            toolName: 'U-Værdi Beregner (Vindue)',
            category: 'Døre & Vinduer',
            mode: 'Basis',
            inputs: [
                { label: 'Total Højde', value: dims.height, unit: 'm' },
                { label: 'Total Bredde', value: dims.width, unit: 'm' },
                { label: 'Karm-/rammebredde', value: dims.frameWidth, unit: 'm' },
                { label: 'Ug (Glas)', value: dims.uGlass, unit: 'W/m²K' },
                { label: 'Uf (Karm)', value: dims.uFrame, unit: 'W/m²K' },
            ],
            results: [
                { label: 'Vægtet U-Værdi (Uw)', value: uValue.toFixed(3), unit: 'W/m²K', highlight: true },
                { label: 'Glasareal', value: areas.glass.toFixed(2), unit: 'm²' },
                { label: 'Karmareal', value: areas.frame.toFixed(2), unit: 'm²' },
            ],
            safetyDisclaimer: 'Denne beregning inkluderer ikke lineære tab (psi-værdier). Kontrollér altid det samlede Uw med producentens datablad.',
        };
    }, [isAdvanced, dims, uValue, areas, adv, advResult, spacerLabel, psiG, requirement, edgeLossWm2K]);

    const activeUw = isAdvanced ? advResult.uwWm2K : uValue;
    const shareValue = isAdvanced
        ? (advResult.uwWm2K > 0 ? `Uw = ${advResult.uwWm2K.toFixed(3)} W/m²K · ${advResult.passed ? 'OK' : 'Overskrider krav'}` : undefined)
        : (uValue > 0 ? `Uw = ${uValue.toFixed(3)} W/m²K` : undefined);

    // Meter scale — keep it zoomed to the U-value range (helper default would be ~10).
    const meterMax = Math.max(requirement * 2, advResult.uwWm2K * 1.2, 2);

    return (
        <CalculatorPage
            title="U-Værdi Beregner (Vindue)"
            reportData={reportData}
            shareValue={shareValue}
            modeToggle={
                <CalculatorModeToggle
                    toolId={TOOL_ID}
                    advancedLocked={!advancedAllowed}
                    onChange={setMode}
                />
            }
            stickyResultLabel="U-Værdi (Uw)"
            stickyResult={<><AnimatedNumber value={activeUw} precision={2} /> W/m²K</>}
        >
            {!isAdvanced ? (
                // ══════════════════════════ BASIC MODE ══════════════════════════
                <>
                    <div className="grid md:grid-cols-2 gap-6 items-start">
                        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border space-y-4">
                            <RegulationSwitch isActive={isBR18Active} onToggle={setIsBR18Active} />

                            <h3 className="font-bold text-lg">Indtast Vinduesdata</h3>
                            <InputField label="Total Højde" value={dims.height} onChange={e => handleDimChange(e, 'height')} unit="m" info="Total højde af vinduet inklusiv karm."/>
                            <InputField label="Total Bredde" value={dims.width} onChange={e => handleDimChange(e, 'width')} unit="m" info="Total bredde af vinduet inklusiv karm."/>
                            <InputField label="Karm-/rammebredde" value={dims.frameWidth} onChange={e => handleDimChange(e, 'frameWidth')} unit="m" info="Den synlige bredde af rammen set forfra."/>
                            <InputField label="U-værdi for Glas (Ug)" value={dims.uGlass} onChange={e => handleDimChange(e, 'uGlass')} unit="W/m²K" info="Center U-værdi for ruden (findes i datablad). 3-lags lavenergi er ca. 0.5-0.7."/>
                            <InputField label="U-værdi for Karm (Uf)" value={dims.uFrame} onChange={e => handleDimChange(e, 'uFrame')} unit="W/m²K" info="U-værdi for rammeprofilen (findes i datablad). Træ/alu er ofte omkring 1.2-1.4."/>
                        </div>

                        <div className="space-y-6">
                            <ResultDisplay
                                label="Vægtet U-Værdi (Uw)"
                                value={uValue}
                                precision={3}
                                unit={<>W/m<sup>2</sup>K</>}
                            />

                            <ComplianceAlert
                                isActive={isBR18Active}
                                passed={compliance.passed}
                                message={compliance.message}
                                ruleRef="BR18, Kap. 11, § 258 (Energikrav)"
                            />

                            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border text-sm">
                                <h4 className="font-bold text-base text-text-primary mb-2">Arealfordeling</h4>
                                <div className="flex justify-between"><span className="text-text-secondary">Glasareal:</span><span className="font-semibold">{areas.glass.toFixed(2)} m²</span></div>
                                <div className="flex justify-between mt-1"><span className="text-text-secondary">Karm-/rammeareal:</span><span className="font-semibold">{areas.frame.toFixed(2)} m²</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border rounded-lg text-sm text-warning-strong dark:text-warning mt-6">
                        <strong>Bemærk:</strong> Denne beregning er en forsimpling og inkluderer ikke lineære tab ved samlingen mellem glas og ramme (psi-værdi). Skift til <strong>Avanceret</strong> for det fulde vindue-Uw iht. EN ISO 10077-1, eller se producentens datablad for den samlede Uw-værdi.
                    </div>
                </>
            ) : (
                // ════════════════════════ ADVANCED MODE ════════════════════════
                <div className="grid md:grid-cols-2 gap-6 items-start">
                    {/* ── Inputs ── */}
                    <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border dark:border-border-dark space-y-4">
                        <h3 className="font-bold text-lg">Fuldt vindue Uw (EN ISO 10077-1)</h3>
                        <p className="text-sm text-text-secondary -mb-1">Areal- og kantvægtet U-værdi for hele vinduet, inkl. det lineære glaskanttab ψg·lg.</p>

                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Bredde" value={adv.width} onChange={e => handleAdvChange(e, 'width')} unit="m" info="Vinduets ydre bredde (karmmål)."/>
                            <InputField label="Højde" value={adv.height} onChange={e => handleAdvChange(e, 'height')} unit="m" info="Vinduets ydre højde (karmmål)."/>
                        </div>
                        <InputField label="Karm-/rammebredde" value={adv.frameWidthMm} onChange={e => handleAdvChange(e, 'frameWidthMm')} unit="mm" info="Rammeprofilens synlige bredde set forfra. Typisk 60-90 mm."/>
                        <div className="grid grid-cols-2 gap-4">
                            <InputField label="Ug (Glas)" value={adv.ug} onChange={e => handleAdvChange(e, 'ug')} unit="W/m²K" info="Center U-værdi for ruden. 3-lags ≈ 0,6; 2-lags ≈ 1,1 (datablad)."/>
                            <InputField label="Uf (Karm)" value={adv.uf} onChange={e => handleAdvChange(e, 'uf')} unit="W/m²K" info="Rammeprofilens U-værdi. Træ/alu ofte ≈ 1,2-1,4 (datablad)."/>
                        </div>

                        {/* Spacer type → ψg (with InfoHint) */}
                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                Afstandsprofil (glaskant ψg)
                                <InfoHint
                                    title="Glaskant-tab ψg (afstandsprofil)"
                                    description="ψg er det lineære varmetab langs samlingen mellem rude og ramme — en kuldebro der afhænger af rudens afstandsprofil (spacer). En 'varm kant' i plast/rustfrit stål leder langt mindre varme end et traditionelt aluminiumsprofil og sænker derfor det samlede Uw."
                                    calculation="Varm kant ≈ 0,04 W/mK · Aluminium ≈ 0,08 W/mK"
                                />
                            </label>
                            <select
                                aria-label="Afstandsprofil"
                                value={spacerKey}
                                onChange={e => setSpacerKey(e.target.value)}
                                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                            >
                                {SPACER_OPTIONS.map(s => (
                                    <option key={s.key} value={s.key}>{s.label} (ψg = {s.psi.toFixed(2)})</option>
                                ))}
                            </select>
                        </div>

                        {/* BR18 requirement (with InfoHint) */}
                        <div>
                            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                                BR18-krav (Uw,max)
                                <InfoHint
                                    title="BR18 U-værdikrav for vinduer"
                                    description="Bygningsreglementets maksimale U-værdi for vinduer. Ved nybyggeri er kravet typisk Uw ≤ 1,2 W/m²K, mens udskiftning/renovering af vinduer i eksisterende byggeri normalt må overholde en lempeligere grænse omkring 1,65 W/m²K. Vælg den grænse der gælder for dit projekt."
                                    calculation="Nybyg ≈ 1,20 W/m²K · Renovering/udskiftning ≈ 1,65 W/m²K"
                                />
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.05"
                                    aria-label="BR18-krav Uw,max"
                                    value={adv.requirement}
                                    onChange={e => handleAdvChange(e, 'requirement')}
                                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 pr-20 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary dark:text-text-dark-tertiary">W/m²K</span>
                            </div>
                        </div>
                    </div>

                    {/* ── Results ── */}
                    <div className="space-y-6">
                        {/* Verdict card */}
                        <div className={`p-5 rounded-card border-l-4 shadow-sm ${advResult.passed ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                            <div className="flex items-start gap-3">
                                {advResult.passed
                                    ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                                    : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                                <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                        <h4 className={`font-bold ${advResult.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                            Uw = {advResult.uwWm2K.toFixed(2)} W/m²K
                                        </h4>
                                        <InfoHint
                                            title="Fuldt vindue Uw (EN ISO 10077-1)"
                                            description="Vinduets samlede U-værdi som areal- og kantvægtning af glas, ramme og glaskant. I modsætning til den simple 2-leds-metode medregner denne også det lineære glaskanttab ψg·lg — kuldebroen ved rudens kant — så resultatet bliver lidt højere (dårligere), men mere korrekt."
                                            calculation="Uw = (Ag·Ug + Af·Uf + lg·ψg) / Aw"
                                        />
                                    </div>
                                    <p className={`text-sm mt-0.5 ${advResult.passed ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                                        {advResult.passed
                                            ? `Overholder BR18-kravet på ${requirement.toFixed(2)} W/m²K.`
                                            : `Overskrider BR18-kravet på ${requirement.toFixed(2)} W/m²K. Vælg bedre rude (lavere Ug), varm kant eller smallere karm.`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ComplianceMeter
                            label="Uw vs. krav (W/m²K)"
                            value={advResult.uwWm2K}
                            limit={requirement}
                            min={0}
                            max={meterMax}
                            unit=""
                            decimalPlaces={2}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <ResultDisplay label="Glasareal (Ag)" value={advResult.glassAreaM2} precision={2} unit="m²" />
                            <ResultDisplay label="Karmareal (Af)" value={advResult.frameAreaM2} precision={2} unit="m²" />
                        </div>

                        {/* Breakdown + glass-edge highlight */}
                        <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-card border border-info-border text-xs text-info-strong dark:text-info space-y-1.5">
                            <p className="font-semibold text-sm">3-leds opdeling (EN ISO 10077-1)</p>
                            <p>Vinduesareal Aw = {advResult.windowAreaM2.toFixed(2)} m² · Glasomkreds lg = {advResult.glassPerimeterM.toFixed(2)} m</p>
                            <p>Glasbidrag Ag·Ug = {(advResult.glassAreaM2 * (parseFloat(adv.ug) || 0)).toFixed(2)} W/K · Karmbidrag Af·Uf = {(advResult.frameAreaM2 * (parseFloat(adv.uf) || 0)).toFixed(2)} W/K</p>
                            <p>Glaskant-bidrag lg·ψg = {(advResult.glassPerimeterM * psiG).toFixed(2)} W/K (ψg = {psiG.toFixed(2)} W/mK)</p>
                            <p className="pt-1 border-t border-info-border/60">
                                <strong>Glaskant-tillæg:</strong> lg·ψg/Aw ≈ +{edgeLossWm2K.toFixed(3)} W/m²K — netop det kuldebro-bidrag som den simple Basis-metode udelader.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </CalculatorPage>
    );
};

export default UValueCalculator;
