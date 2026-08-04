import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { computeDuctDiameter, computeDuctPressureLoss } from '../../catalog';
import { RefreshCwIcon, CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

// ── Constants ────────────────────────────────────────────────────────────────
const STANDARD_SIZES = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630];

// DS 447 velocity guidance
const VELOCITY_LIMIT_MAIN = 6;    // m/s – main-duct støjgrænse (≈6 m/s)

// Advanced mode — duct material / absolute roughness for the pressure-loss calc
type DuctMaterial = 'spiro' | 'flex';
const DUCT_MATERIALS: Record<DuctMaterial, { label: string; roughnessMm: number }> = {
  spiro: { label: 'Spirorør / stål (glat)',      roughnessMm: 0.09 },
  flex:  { label: 'Fleksrør (bøjelig, ru)',       roughnessMm: 3    },
};

// Common local-loss coefficients ΣK (DS 447 / ASHRAE typiske værdier)
const FITTING_PRESETS: { label: string; k: number }[] = [
  { label: '90° bøjning', k: 0.3 },
  { label: 'Afgrening',   k: 1.0 },
  { label: 'Spjæld',      k: 0.5 },
];

// ── Help content ─────────────────────────────────────────────────────────────
const helpContent: HelpContent = {
  formaal:
    'Beregner den nødvendige kaneldiameter for et cirkulært spirorør baseret på luftmængde og ' +
    'maksimal lufthastighed. Viser nærmeste standarddimension (DS 447) og faktisk hastighed.',
  variabler: [
    { name: 'Luftmængde',      symbol: 'Q',   unit: 'm³/h',  description: 'Volumetrisk luftflow der skal transporteres i kanalen.' },
    { name: 'Maks. hastighed', symbol: 'v',   unit: 'm/s',   description: 'Maksimal tilladt lufthastighed. DS 447: ≤ 6 m/s (hoved), ≤ 4 m/s (gren).' },
    { name: 'Diameter',        symbol: 'd',   unit: 'mm',    description: 'Beregnet indvendig diameter. Afrundes op til nærmeste standardmål.' },
    { name: 'Tværsnitsareal',  symbol: 'A',   unit: 'm²',    description: 'Kanalens tværsnitsareal A = π/4 × d².' },
  ],
  formel:
    'A [m²] = Q [m³/s] / v [m/s]\nd [m]  = √(4 × A / π)\nStandarddim.: nærmeste ≥ d i DS 447-serien',
  antagelser:
    'Basis antager cirkulære spirorør med glat indvendig overflade. ' +
    'Avanceret tilstand beregner trykfaldet (friktion + enkelttab) med Swamee-Jain friktionsfaktor ' +
    'ved ρ = 1,2 kg/m³ – dvs. det statiske tryk ventilatoren mindst skal levere for den valgte strækning.',
  standarder:
    'BR18 §425–§445 – Ventilationskrav for boliger og erhverv\n' +
    'DS 447 – Ventilationsanlæg og kanaldimensionering\n' +
    'BR18 – Min. 0,3 L/s pr. m² + 7 L/s pr. person (boliger)',
  disclaimer: (
    <span>
      Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i
      overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.
    </span>
  ),
};

// ── Component ─────────────────────────────────────────────────────────────────
const DuctSizingCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [inputs, setInputs] = useState({ airflow: '150', velocity: '3' });
  const [result, setResult] = useState({ diameterMm: 0, standardSize: 0, actualVelocity: 0 });

  // Advanced mode — pressure-loss / fan static-pressure inputs
  const [ductLength, setDuctLength] = useState('10');
  const [ductMaterial, setDuctMaterial] = useState<DuctMaterial>('spiro');
  const [fittingsK, setFittingsK] = useState('0.6');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
    setInputs(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  useEffect(() => {
    const airflow_m3h = parseFloat(inputs.airflow) || 0;
    const targetVelocity = parseFloat(inputs.velocity) || 0;

    if (airflow_m3h > 0 && targetVelocity > 0) {
      const { diamMm } = computeDuctDiameter({ flowM3h: airflow_m3h, velocityMs: targetVelocity });

      // Nearest standard size (round up to keep velocity at or below target)
      const standardSize = STANDARD_SIZES.find(s => s >= diamMm) ?? STANDARD_SIZES[STANDARD_SIZES.length - 1];

      // Actual velocity with standard size
      const standardArea = Math.PI * Math.pow(standardSize / 2000, 2);
      const actualVelocity = (airflow_m3h / 3600) / standardArea;

      setResult({ diameterMm: diamMm, standardSize, actualVelocity });
    } else {
      setResult({ diameterMm: 0, standardSize: 0, actualVelocity: 0 });
    }
  }, [inputs]);

  // DS 447 recommended main-duct velocity (≈6 m/s) — støjgrænse
  const velocityLimit = VELOCITY_LIMIT_MAIN;

  // ── Advanced: duct pressure loss / fan static pressure ─────────────────────
  // Computed for the recommended standard dimension (the duct actually installed).
  const addFitting = useCallback((k: number) => {
    setFittingsK(prev => {
      const next = (parseFloat(prev) || 0) + k;
      return (Math.round(next * 100) / 100).toString();
    });
  }, []);

  const pressure = useMemo(() => computeDuctPressureLoss({
    flowM3h: parseFloat(inputs.airflow) || 0,
    diameterMm: result.standardSize,
    lengthM: parseFloat(ductLength) || 0,
    fittingsK: parseFloat(fittingsK) || 0,
    roughnessMm: DUCT_MATERIALS[ductMaterial].roughnessMm,
  }), [inputs.airflow, result.standardSize, ductLength, fittingsK, ductMaterial]);

  // ── Pipe visual (preserved from original) ──────────────────────────────────
  const PipeVisual = useMemo(() => {
    const { diameterMm, standardSize, actualVelocity } = result;
    if (standardSize === 0) return null;

    const maxVelScale = 8;
    const gaugePct = Math.min((actualVelocity / maxVelScale) * 100, 100);

    let velocityColor = 'bg-success';
    let velocityStatus = 'Lav (Støjsvag)';
    if (actualVelocity > 4) { velocityColor = 'bg-warning'; velocityStatus = 'Middel'; }
    if (actualVelocity > 6) { velocityColor = 'bg-danger'; velocityStatus = 'Høj (Støjrisiko)'; }

    return (
      <div className="mt-4 space-y-4">
        {/* Velocity bar */}
        <div className="bg-bg-muted dark:bg-bg-dark-muted p-4 rounded-xl border border-border dark:border-border-dark">
          <div className="flex justify-between text-sm font-semibold mb-1">
            <span className="text-text-primary dark:text-text-dark-primary">Lufthastighed</span>
            <span className={actualVelocity > velocityLimit ? 'text-danger-strong dark:text-danger' : 'text-success-strong dark:text-success'}>
              {actualVelocity.toFixed(2)} m/s
            </span>
          </div>
          <div className="h-4 w-full bg-bg-muted dark:bg-bg-dark-muted rounded-full relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-success/40" />
            <div className="absolute inset-y-0 left-1/2 w-1/4 bg-warning/40" />
            <div className="absolute inset-y-0 right-0 w-1/4 bg-danger/40" />
            <div
              className="absolute top-0 bottom-0 w-1 bg-text-primary dark:bg-text-dark-primary shadow transition-all duration-500"
              style={{ left: `${gaugePct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
            <span>0 m/s</span>
            <span>{velocityStatus}</span>
            <span>{maxVelScale}+ m/s</span>
          </div>
        </div>

        {/* Pipe cross-section visual */}
        <div className="flex items-center justify-center p-4">
          <div className="relative flex items-center justify-center">
            <div
              className="rounded-full border-4 border-border-strong dark:border-border-dark-strong bg-bg dark:bg-bg-dark-surface flex items-center justify-center shadow-lg transition-all duration-500 z-10"
              style={{ width: '160px', height: '160px' }}
            >
              <div className="text-center">
                <span className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">Ø{standardSize}</span>
                <span className="text-xs text-text-tertiary dark:text-text-dark-secondary block">Standardmål (mm)</span>
              </div>
            </div>
            <div
              className="absolute rounded-full border-2 border-info border-dashed bg-info-subtle/50 dark:bg-info-subtle-dark transition-all duration-500"
              style={{
                width:  `${(diameterMm / standardSize) * 160}px`,
                height: `${(diameterMm / standardSize) * 160}px`,
              }}
            />
            <div className="absolute -bottom-8 text-info-strong dark:text-info text-xs font-semibold">
              Beregn.: Ø{diameterMm.toFixed(1)} mm
            </div>
          </div>
        </div>
      </div>
    );
  }, [result, velocityLimit]);

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Kanal Dimensionering',
    category: 'HVAC & Ventilation',
    mode: mode === 'advanced' ? 'Trykfald & ventilatortryk' : 'Basis',
    inputs: [
      { label: 'Luftmængde (Flow)', value: inputs.airflow, unit: 'm³/h' },
      { label: 'Maks. Lufthastighed', value: inputs.velocity, unit: 'm/s' },
      ...(mode === 'advanced' ? [
        { label: 'Kanallængde', value: ductLength, unit: 'm' },
        { label: 'Kanaltype (ruhed)', value: DUCT_MATERIALS[ductMaterial].label },
        { label: 'Modstandskoefficienter ΣK', value: fittingsK },
      ] : []),
    ],
    results: [
      { label: 'Anbefalet Standard Dimension', value: String(result.standardSize), unit: 'mm', highlight: true },
      { label: 'Beregnet Diameter', value: result.diameterMm.toFixed(1), unit: 'mm' },
      { label: 'Faktisk Lufthastighed', value: result.actualVelocity.toFixed(2), unit: 'm/s' },
      ...(mode === 'advanced' ? [
        { label: 'Friktionstab', value: pressure.frictionLossPa.toFixed(1), unit: 'Pa' },
        { label: 'Enkelttab (ΣK)', value: pressure.minorLossPa.toFixed(1), unit: 'Pa' },
        { label: 'Samlet trykfald / ventilatortryk', value: pressure.totalLossPa.toFixed(1), unit: 'Pa' },
      ] : []),
    ],
    formula: mode === 'advanced'
      ? 'Δp_friktion = f·(L/d)·½ρv²\nΔp_enkelttab = ΣK·½ρv²\nΔp_total = Δp_friktion + Δp_enkelttab  (statisk ventilatortryk)'
      : 'A [m²] = Q [m³/s] / v [m/s]\nd [m]  = √(4 × A / π)\nStandarddim.: nærmeste ≥ d i DS 447-serien',
    standardsStruktureret: [
      { code: 'BR18', clause: '§425–§445', note: 'Ventilationskrav for boliger og erhverv' },
      { code: 'DS 447', note: 'Ventilationsanlæg og kanaldimensionering' },
    ],
    safetyDisclaimer:
      'Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.',
  }), [mode, ductLength, ductMaterial, fittingsK, inputs, result, pressure]);

  const modeToggle = (
    <CalculatorModeToggle toolId="duct-sizing" onChange={handleModeChange} />
  );

  return (
    <CalculatorPage
      title="Kanaldimensionering (Spirorør)"
      helpContent={helpContent}
      modeToggle={modeToggle}
      reportData={reportData}
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* ── Input card ──────────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary flex items-center gap-2">
            <RefreshCwIcon className="w-5 h-5 text-brand-primary" />
            Indtast Værdier
          </h3>

          <InputField
            label="Luftmængde (Flow)"
            value={inputs.airflow}
            onChange={e => handleInputChange(e, 'airflow')}
            unit="m³/h"
          />
          <InputField
            label="Maks. Lufthastighed"
            value={inputs.velocity}
            onChange={e => handleInputChange(e, 'velocity')}
            unit="m/s"
            info="DS 447: Hovedkanal ≤ 6 m/s, Tilslutningskanal ≤ 4 m/s."
          />

          {/* Advanced: pressure-loss / fan static-pressure inputs */}
          {mode === 'advanced' && (
            <div className="pt-2 border-t border-border dark:border-border-dark space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-text-primary dark:text-text-dark-primary flex items-center gap-1">
                  Trykfald &amp; ventilatortryk
                  <InfoHint
                    title="Trykfald (statisk ventilatortryk)"
                    description="Beregner det samlede trykfald luften møder i strækningen — friktion langs røret plus enkelttab i bøjninger, afgreninger og spjæld. Summen er det statiske tryk ventilatoren mindst skal levere."
                    calculation="Δp_total = Δp_friktion + Δp_enkelttab"
                  />
                </h4>
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
                  Beregnes for den anbefalede dimension{' '}
                  <span className="font-semibold">{result.standardSize > 0 ? `Ø${result.standardSize} mm` : '—'}</span>.
                </p>
              </div>

              <InputField
                label="Kanallængde"
                value={ductLength}
                onChange={e => setDuctLength(e.target.value)}
                unit="m"
                info="Samlet lige kanallængde for strækningen."
              />

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                  Kanaltype (ruhed)
                  <InfoHint
                    title="Kanalens ruhed (friktionstab)"
                    description="Overfladeruheden bestemmer friktionsfaktoren f. Glatte spirorør/stålkanaler (ε≈0,09 mm) giver lavt trykfald; bøjelige fleksrør (ε≈3 mm) giver markant højere friktionstab ved samme hastighed."
                    calculation="Δp_friktion = f·(L/d)·½ρv²   (f afhænger af ε/d og Reynolds)"
                  />
                </label>
                <select
                  aria-label="Kanaltype (ruhed)"
                  value={ductMaterial}
                  onChange={e => setDuctMaterial(e.target.value as DuctMaterial)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                >
                  {(Object.keys(DUCT_MATERIALS) as DuctMaterial[]).map(k => (
                    <option key={k} value={k}>
                      {DUCT_MATERIALS[k].label} — ε={DUCT_MATERIALS[k].roughnessMm.toString().replace('.', ',')} mm
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                  Modstandskoefficienter ΣK
                  <InfoHint
                    title="Enkelttab (bøjninger, afgreninger, spjæld)"
                    description="Fittings skaber lokale tryktab proportionalt med det dynamiske tryk. Læg K-værdierne sammen — fx to 90° bøjninger + ét spjæld ≈ 0,3 + 0,3 + 0,5 = 1,1."
                    calculation="Δp_enkelttab = ΣK·½ρv²   ·   90° bøjning K≈0,3 · afgrening K≈1,0 · spjæld K≈0,5"
                  />
                </label>
                <InputField
                  label=""
                  value={fittingsK}
                  onChange={e => setFittingsK(e.target.value)}
                  unit="ΣK"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {FITTING_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => addFitting(p.k)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border dark:border-border-dark-strong bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary hover:border-brand-primary transition-colors"
                    >
                      + {p.label} (K {p.k.toString().replace('.', ',')})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFittingsK('0')}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border dark:border-border-dark-strong text-text-tertiary dark:text-text-dark-tertiary hover:border-danger transition-colors"
                  >
                    Nulstil
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Result card ──────────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary mb-4">
            Resultat
          </h3>

          <ResultDisplay
            label="Anbefalet Standard Dimension"
            value={result.standardSize}
            precision={0}
            unit="mm"
          />

          {/* ComplianceMeter: velocity vs DS 447 limit */}
          {result.actualVelocity > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                Hastighed vs. DS 447 grænse ({velocityLimit} m/s)
              </p>
              <ComplianceMeter
                label="Lufthastighed"
                value={result.actualVelocity}
                limit={velocityLimit}
                max={10}
                unit=" m/s"
                decimalPlaces={2}
              />
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                {result.actualVelocity <= velocityLimit
                  ? `✓ Hastighed overholder DS 447 (hovedkanal ≤ ${velocityLimit} m/s).`
                  : `⚠ Hastighed overstiger DS 447-grænsen for hovedkanal (≤ ${velocityLimit} m/s). Vælg større dimension.`}
              </p>
            </div>
          )}

          {PipeVisual}

          {/* ── Advanced: pressure loss / fan static pressure ──────────────── */}
          {mode === 'advanced' && result.standardSize > 0 && (
            <div className="mt-6 pt-6 border-t border-border dark:border-border-dark space-y-4">
              <h4 className="font-bold text-base text-text-primary dark:text-text-dark-primary flex items-center gap-1">
                Trykfald &amp; ventilatortryk
                <InfoHint
                  title="DS 447 – hastighed &amp; støj"
                  description="DS 447 anbefaler ca. 6 m/s i hovedkanaler. Boliger og støjfølsomme rum dimensioneres lavere (ofte 2–4 m/s) for at undgå strømningsstøj. Høj hastighed giver både mere støj og kvadratisk stigende trykfald."
                  calculation="Anbefalet: ≈6 m/s hovedkanal · lavere ved beboelse (støj)"
                />
              </h4>

              {/* Velocity verdict card (green/red) */}
              <div className={`p-4 rounded-card border-l-4 shadow-sm ${pressure.velocityOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                <div className="flex items-start gap-3">
                  {pressure.velocityOk
                    ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                    : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                  <div className="flex-1">
                    <h5 className={`font-bold ${pressure.velocityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {pressure.velocityOk ? 'Hastighed OK' : 'Hastighed for høj → støj'}
                    </h5>
                    <p className={`text-sm mt-0.5 ${pressure.velocityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {pressure.velocityOk
                        ? `${pressure.velocityMs.toFixed(2)} m/s ligger under DS 447-anbefalingen (≈${velocityLimit} m/s for hovedkanal).`
                        : `${pressure.velocityMs.toFixed(2)} m/s overstiger DS 447-anbefalingen (≈${velocityLimit} m/s). Vælg større dimension for at dæmpe støj og trykfald.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* ComplianceMeter: velocity vs DS 447 recommended max */}
              <div>
                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Hastighed vs. DS 447 anbefaling ({velocityLimit} m/s)
                </p>
                <ComplianceMeter
                  label="Lufthastighed"
                  value={pressure.velocityMs}
                  limit={velocityLimit}
                  max={10}
                  unit=" m/s"
                  decimalPlaces={2}
                />
              </div>

              {/* Pressure loss breakdown */}
              <div className="bg-bg-muted dark:bg-bg-dark-muted p-4 rounded-card border border-border dark:border-border-dark space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-text-secondary dark:text-text-dark-secondary">
                    Friktionstab (rør)
                    <InfoHint
                      title="Friktionstab"
                      description="Modstanden luften møder langs kanalens væg. Vokser med længden, ruheden og kvadratisk med hastigheden."
                      calculation="Δp_friktion = f·(L/d)·½ρv²"
                    />
                  </span>
                  <span className="font-mono font-semibold text-text-primary dark:text-text-dark-primary">{pressure.frictionLossPa.toFixed(1)} Pa</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-text-secondary dark:text-text-dark-secondary">
                    Enkelttab (ΣK)
                    <InfoHint
                      title="Enkelttab (fittings)"
                      description="Lokale tab i bøjninger, afgreninger og spjæld, samlet via ΣK."
                      calculation="Δp_enkelttab = ΣK·½ρv²"
                    />
                  </span>
                  <span className="font-mono font-semibold text-text-primary dark:text-text-dark-primary">{pressure.minorLossPa.toFixed(1)} Pa</span>
                </div>
                {/* Stacked friction vs minor bar */}
                {pressure.totalLossPa > 0 && (
                  <div className="h-3 w-full rounded-full overflow-hidden flex bg-bg dark:bg-bg-dark-surface">
                    <div className="h-full bg-brand-primary" style={{ width: `${(pressure.frictionLossPa / pressure.totalLossPa) * 100}%` }} />
                    <div className="h-full bg-info" style={{ width: `${(pressure.minorLossPa / pressure.totalLossPa) * 100}%` }} />
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark">
                  <span className="text-sm font-bold text-text-primary dark:text-text-dark-primary">Samlet trykfald</span>
                  <span className="font-mono font-bold text-brand-primary text-lg">{pressure.totalLossPa.toFixed(1)} Pa</span>
                </div>
              </div>

              {/* Fan static pressure note */}
              <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-xl border border-info-border dark:border-info/30 text-xs text-info-strong dark:text-info leading-snug">
                <strong>Ventilatortryk:</strong> De {pressure.totalLossPa.toFixed(1)} Pa er det statiske tryk
                ventilatoren mindst skal overvinde for denne strækning. Læg tryktab fra filtre, riste, lyddæmpere
                og varmeflader til ved dimensionering af det samlede anlæg.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Safety disclaimer */}
      <SafetyDisclaimer
        title="Vejledende Kanaldimensionering"
        className="mt-6"
      >
        Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i
        overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.
      </SafetyDisclaimer>
    </CalculatorPage>
  );
};

export default DuctSizingCalculator;
