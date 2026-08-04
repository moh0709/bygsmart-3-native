import React, { useState, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import { computePipeDiameter, computePipePressureLoss, STANDARDS_CATALOG } from '../../catalog';
import type { CalculatorReportData } from '../../components/CalculatorPage';

// DS 439 max recommended velocity to avoid noise / erosion
const DS439_MAX_VELOCITY_MS = 2.0;

// Standard copper/steel pipe inner diameters [mm]
const STANDARD_PIPES_MM = [10, 12, 15, 18, 22, 28, 35, 42, 54, 76, 108];

// Local-loss coefficients (ΣK) per fitting — typical VVS values
const K_BEND = 0.9;  // 90° bøjning
const K_VALVE = 0.5; // ventil (åben)
const K_TEE = 1.0;   // T-stykke (afgrening)

type PipeMaterial = 'copper' | 'steel' | 'pex' | 'cpvc';

interface MaterialInfo {
  label: string;
  /** Absolute roughness ε [mm] used by the Darcy–Weisbach / Swamee–Jain friction model. */
  roughnessMm: number;
  roughnessNote: string;
}

const MATERIALS: Record<PipeMaterial, MaterialInfo> = {
  copper:  { label: 'Kobber', roughnessMm: 0.007, roughnessNote: 'ε ≈ 0,007 mm' },
  steel:   { label: 'Stål',   roughnessMm: 0.045, roughnessNote: 'ε ≈ 0,045 mm' },
  pex:     { label: 'PEX',    roughnessMm: 0.007, roughnessNote: 'ε ≈ 0,007 mm' },
  cpvc:    { label: 'CPVC',   roughnessMm: 0.007, roughnessNote: 'ε ≈ 0,007 mm' },
};

const HELP: HelpContent = {
  formaal:
    'Beregner den nødvendige indvendige rørdiameter for brugsvandinstallationer ud fra ' +
    'flowhastighed og ønsket vandhastighed. I avanceret tilstand beregnes det samlede tryktab ' +
    'og den nødvendige pumpe-/cirkulationsløftehøjde (Darcy–Weisbach, DS 439).',
  variabler: [
    { name: 'Flowhastighed',   symbol: 'Q',  unit: 'L/s', description: 'Vandmængde pr. sekund. En håndvask bruger ca. 0,1–0,2 L/s.' },
    { name: 'Vandhastighed',   symbol: 'v',  unit: 'm/s', description: 'Strømningshastighed. DS 439: max 2,0 m/s.' },
    { name: 'Diameter',        symbol: 'd',  unit: 'mm',  description: 'Indvendig rørdiameter.' },
    { name: 'Kredsløbslængde', symbol: 'L',  unit: 'm',   description: 'Rørets samlede længde (frem + retur for en kreds).' },
    { name: 'Lokaltab',        symbol: 'ΣK', unit: '–',   description: 'Sum af tabskoefficienter for bøjninger, ventiler og T-stykker.' },
    { name: 'Løftehøjde',      symbol: 'H',  unit: 'm',   description: 'Nødvendigt pumpehoved = friktionstab + lokale tab.' },
  ],
  formel:
    'A  = Q / v            [m²]\n' +
    'd  = √(4·A / π)      [m]  → konvertér til mm\n\n' +
    'Tryktab (Darcy–Weisbach):\n' +
    'Δp = f · (L/d) · ½ρv²        [Pa]\n' +
    'Lokale tab: Δp_lokal = ΣK · ½ρv²   [Pa]\n' +
    'Løftehøjde H = h_friktion + h_lokal   [m]',
  antagelser:
    'Beregningen antager jævn, fuldt udviklet strøm og cirkulært tværsnit. ' +
    'Friktionsfaktoren f findes med Swamee–Jain ud fra Reynolds-tal og relativ ruhed. ' +
    'Lokale tab estimeres via ΣK (bøjninger, ventiler, T-stykker).',
  standarder:
    'DS 439 – Vandinstallationer, max. vandhastighed 2,0 m/s\n' +
    'DS 432 – Afløbsinstallationer, min. fald 1:40 (20 ‰)\n' +
    'DS 469 – Varme- og køleanlæg',
  disclaimer: (
    <span>
      VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
      Beregninger er vejledende og erstatter ikke et installationsprojekt.
    </span>
  ),
};

/** Compact +/- stepper for counting fittings (mobile-friendly). */
const FittingStepper: React.FC<{
  label: string;
  sub: string;
  value: number;
  onChange: (n: number) => void;
}> = ({ label, sub, value, onChange }) => (
  <div className="flex items-center justify-between gap-2">
    <div className="min-w-0">
      <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">{label}</p>
      <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary">{sub}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        aria-label={`Færre ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 rounded-lg border border-border-strong dark:border-border-dark-strong text-lg leading-none text-text-secondary dark:text-text-dark-secondary hover:border-brand-primary disabled:opacity-40"
        disabled={value <= 0}
      >
        −
      </button>
      <span className="w-8 text-center text-base font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{value}</span>
      <button
        type="button"
        aria-label={`Flere ${label}`}
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-lg border border-border-strong dark:border-border-dark-strong text-lg leading-none text-text-secondary dark:text-text-dark-secondary hover:border-brand-primary"
      >
        +
      </button>
    </div>
  </div>
);

const PipeSizingCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [flowRate, setFlowRate]   = useState('0.5');
  const [velocity, setVelocity]   = useState('1.5');
  const [material, setMaterial]   = useState<PipeMaterial>('copper');

  // Advanced (Trykfald & pumpehoved) inputs
  const [innerDiameter, setInnerDiameter] = useState('22');
  const [circuitLength, setCircuitLength] = useState('20');
  const [bends, setBends] = useState(4);
  const [valves, setValves] = useState(2);
  const [tees, setTees] = useState(0);

  const Q = parseFloat(flowRate) || 0;
  const v = parseFloat(velocity) || 0;

  const { diamMm } = computePipeDiameter({ flowLps: Q, velocityMs: v });

  const recommendedPipe = STANDARD_PIPES_MM.find(p => p >= diamMm) ?? STANDARD_PIPES_MM[STANDARD_PIPES_MM.length - 1];

  const mat = MATERIALS[material];

  // Advanced: total pressure loss + required pump head (Darcy–Weisbach + minor losses)
  const dInner = parseFloat(innerDiameter) || 0;
  const lengthM = parseFloat(circuitLength) || 0;
  const fittingsK = bends * K_BEND + valves * K_VALVE + tees * K_TEE;

  const pl = useMemo(() => computePipePressureLoss({
    flowLps: Q,
    innerDiameterMm: dInner,
    lengthM,
    fittingsK,
    roughnessMm: mat.roughnessMm,
  }), [Q, dInner, lengthM, fittingsK, mat.roughnessMm]);

  const advVelocityOk = pl.velocityMs <= DS439_MAX_VELOCITY_MS;
  const hasAdvResult = dInner > 0 && Q > 0 && lengthM > 0;

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const PipeVisual = useMemo(() => {
    const visualSize = Math.min(Math.max(diamMm, 10), 100);
    return (
      <div className="flex flex-col items-center justify-center h-44 bg-info-subtle/50 dark:bg-info-subtle-dark/50 rounded-lg border border-info-border dark:border-info/30 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="w-full h-20 bg-info animate-pulse" />
        </div>
        <div
          className="rounded-full border-4 border-border-dark-strong dark:border-text-dark-tertiary bg-info-subtle dark:bg-info-subtle-dark flex items-center justify-center shadow-xl transition-all duration-500 relative z-10"
          style={{ width: `${visualSize * 2}px`, height: `${visualSize * 2}px` }}
        >
          <div className="text-center">
            <span className="text-xs text-info-strong dark:text-info font-bold block">{diamMm.toFixed(1)} mm</span>
            <span className="text-[8px] text-info-strong dark:text-info">Indvendig</span>
          </div>
        </div>
        <div className="mt-3 text-xs font-mono text-info-strong dark:text-info">
          Q = {flowRate} L/s
        </div>
      </div>
    );
  }, [diamMm, flowRate]);

  const reportData: CalculatorReportData = {
    toolName: 'Rørdimension Beregner',
    category: 'VVS',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Flowhastighed', value: flowRate, unit: 'L/s' },
      { label: 'Vandhastighed', value: velocity, unit: 'm/s' },
      ...(mode === 'advanced' ? [
        { label: 'Rørmateriale', value: MATERIALS[material].label },
        { label: 'Indvendig diameter', value: innerDiameter, unit: 'mm' },
        { label: 'Kredsløbslængde', value: circuitLength, unit: 'm' },
        { label: 'Lokaltab (ΣK)', value: fittingsK.toFixed(1) },
      ] : []),
    ],
    results: [
      { label: 'Beregnet diameter', value: diamMm.toFixed(1), unit: 'mm', highlight: true },
      { label: 'Anbefalet standardrør', value: `${recommendedPipe}`, unit: 'mm' },
      ...(mode === 'advanced' ? [
        { label: 'Faktisk vandhastighed', value: pl.velocityMs.toFixed(2), unit: 'm/s' },
        { label: 'Friktionstab', value: pl.frictionHeadM.toFixed(2), unit: 'm' },
        { label: 'Lokale tab', value: pl.minorHeadM.toFixed(2), unit: 'm' },
        { label: 'Nødvendig løftehøjde', value: pl.totalHeadM.toFixed(2), unit: 'm', highlight: true },
        { label: 'Samlet tryktab', value: pl.pressureLossKPa.toFixed(1), unit: 'kPa' },
      ] : []),
    ],
    formula: mode === 'advanced'
      ? 'Δp = f·(L/d)·½ρv²  +  ΣK·½ρv²   →   H = Δp / (ρ·g)'
      : 'A = Q / v   [m²]\nd = √(4·A / π)   [m → mm]',
    standardsStruktureret: STANDARDS_CATALOG.water,
    safetyDisclaimer: 'VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør. Beregninger er vejledende.',
  };

  return (
    <CalculatorPage
      title="Rørdimension Beregner"
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle toolId="vvs-roerdimension" onChange={handleModeChange} />
      }
    >
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Inputs */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg">Indtast værdier</h3>

            <InputField
              label="Flowhastighed (Q)"
              value={flowRate}
              onChange={e => setFlowRate(e.target.value)}
              unit="L/s"
              info="Vandmængde pr. sekund. En håndvask ≈ 0,1–0,2 L/s, badekar ≈ 0,3 L/s."
            />
            <InputField
              label="Ønsket vandhastighed (v)"
              value={velocity}
              onChange={e => setVelocity(e.target.value)}
              unit="m/s"
              info="DS 439: max 2,0 m/s for at undgå støj og erosion. Anbefalet 1,0–1,5 m/s."
            />

            {mode === 'advanced' && (
              <div className="space-y-4 pt-4 border-t border-border dark:border-border-dark">
                <div className="flex items-center gap-1">
                  <h4 className="text-sm font-bold text-text-primary dark:text-text-dark-primary">Trykfald &amp; pumpehoved</h4>
                  <InfoHint
                    title="Nødvendigt pumpehoved"
                    description="Beregner det samlede tryktab i kredsen. Pumpen eller cirkulationspumpen skal kunne levere mindst denne løftehøjde ved det ønskede flow, ellers når vandet ikke rundt."
                    calculation="H = h_friktion + h_lokal (Darcy–Weisbach + ΣK)"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                    Rørmateriale (ruhed)
                    <InfoHint
                      title="Rørmateriale & ruhed"
                      description="Rørets indvendige ruhed ε bestemmer friktionsfaktoren. Glatte rør (PEX/kobber ≈ 0,007 mm) giver lavere tryktab end stål (≈ 0,045 mm)."
                      calculation="f = Swamee–Jain(Re, ε/d)"
                    />
                  </label>
                  <select
                    aria-label="Rørmateriale"
                    value={material}
                    onChange={e => setMaterial(e.target.value as PipeMaterial)}
                    className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                  >
                    {(Object.keys(MATERIALS) as PipeMaterial[]).map(key => (
                      <option key={key} value={key}>{MATERIALS[key].label} ({MATERIALS[key].roughnessNote})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <InputField
                    label="Indvendig diameter (d)"
                    value={innerDiameter}
                    onChange={e => setInnerDiameter(e.target.value)}
                    unit="mm"
                    info="Rørets indvendige diameter. Brug den anbefalede standarddimension fra basisberegningen som udgangspunkt."
                  />
                  <button
                    type="button"
                    onClick={() => setInnerDiameter(String(recommendedPipe))}
                    className="mt-1.5 text-xs font-medium text-brand-primary hover:underline"
                  >
                    Brug anbefalet Ø {recommendedPipe} mm
                  </button>
                </div>

                <InputField
                  label="Kredsløbslængde (L)"
                  value={circuitLength}
                  onChange={e => setCircuitLength(e.target.value)}
                  unit="m"
                  info="Rørets samlede længde. For en cirkulationskreds regnes frem + retur."
                />

                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-2">
                    Fittings — lokale tab
                    <InfoHint
                      title="Lokale tab (ΣK)"
                      description="Bøjninger, ventiler og T-stykker giver lokale tryktab ud over rørfriktionen. Hvert fitting har en tabskoefficient K, og summen ΣK ganges med hastighedstrykket ½ρv²."
                      calculation={`Δp_lokal = ΣK · ½ρv²  ·  (90° bøjning K≈${K_BEND}, ventil K≈${K_VALVE}, T-stykke K≈${K_TEE})`}
                    />
                  </label>
                  <div className="space-y-2.5 bg-bg-muted dark:bg-bg-dark-muted rounded-lg p-3">
                    <FittingStepper label="90° bøjninger" sub={`K ≈ ${K_BEND} pr. stk`} value={bends} onChange={setBends} />
                    <FittingStepper label="Ventiler" sub={`K ≈ ${K_VALVE} pr. stk`} value={valves} onChange={setValves} />
                    <FittingStepper label="T-stykker" sub={`K ≈ ${K_TEE} pr. stk`} value={tees} onChange={setTees} />
                    <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border-dark">
                      <span className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">Samlet ΣK</span>
                      <span className="text-base font-bold tabular-nums text-text-primary dark:text-text-dark-primary">{fittingsK.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-4">Resultat</h3>

              <ResultDisplay label="Beregnet indv. diameter" value={diamMm} unit="mm" />

              <div className="mt-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">Visualisering</h4>
                {PipeVisual}
              </div>

              <div className="mt-4 p-3 bg-success-subtle dark:bg-success-subtle-dark rounded-lg border border-success-border dark:border-success/30 text-center">
                <p className="text-sm text-success-strong dark:text-success">Nærmeste standard (kobber/stål)</p>
                <p className="text-2xl font-bold text-success">{recommendedPipe} mm</p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                  Vandhastighed vs. DS 439 max (2,0 m/s)
                </p>
                <ComplianceMeter
                  label="Vandhastighed"
                  value={v}
                  limit={DS439_MAX_VELOCITY_MS}
                  min={0}
                  max={Math.max(v * 1.5, 3)}
                  unit=" m/s"
                  decimalPlaces={2}
                />
                <p className={`text-xs mt-1 font-medium ${v <= DS439_MAX_VELOCITY_MS ? 'text-success' : 'text-danger'}`}>
                  {v <= DS439_MAX_VELOCITY_MS
                    ? `Godkendt — ${v.toFixed(2)} m/s er under DS 439 grænse (2,0 m/s)`
                    : `Overskridelse — ${v.toFixed(2)} m/s overskrider DS 439 max 2,0 m/s`}
                </p>
              </div>
            </div>

            {/* Advanced: Trykfald & pumpehoved */}
            {mode === 'advanced' && (
              <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-5">
                <div className="flex items-center gap-1">
                  <h3 className="font-bold text-lg">Trykfald &amp; pumpehoved</h3>
                  <InfoHint
                    title="Darcy–Weisbach"
                    description="Rørfriktionstabet beregnes med Darcy–Weisbach. Friktionsfaktoren f afhænger af Reynolds-tal og relativ ruhed (Swamee–Jain), og tabet vokser med hastigheden i anden potens."
                    calculation="Δp = f · (L/d) · ½ρv²"
                  />
                </div>

                {hasAdvResult ? (
                  <>
                    {/* Verdict card */}
                    <div className={`p-5 rounded-card border-l-4 shadow-sm ${advVelocityOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                      <div className="flex items-start gap-3">
                        {advVelocityOk
                          ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                          : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                        <div className="flex-1">
                          <h4 className={`font-bold ${advVelocityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                            Faktisk hastighed {pl.velocityMs.toFixed(2)} m/s
                          </h4>
                          <p className={`text-sm mt-0.5 ${advVelocityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                            {advVelocityOk
                              ? `Under DS 439-grænsen på 2,0 m/s ved Ø ${dInner.toFixed(0)} mm — OK.`
                              : `Overskrider DS 439 max 2,0 m/s ved Ø ${dInner.toFixed(0)} mm. Vælg større rørdiameter.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                        Faktisk vandhastighed vs. DS 439 max (2,0 m/s)
                      </p>
                      <ComplianceMeter
                        label="Faktisk vandhastighed"
                        value={pl.velocityMs}
                        limit={DS439_MAX_VELOCITY_MS}
                        min={0}
                        max={Math.max(pl.velocityMs * 1.5, 3)}
                        unit=" m/s"
                        decimalPlaces={2}
                      />
                    </div>

                    {/* Head + pressure loss */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
                        <div className="flex items-center justify-center gap-1">
                          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">Nødvendig løftehøjde</p>
                          <InfoHint
                            title="Nødvendigt pumpehoved"
                            description="Det samlede tryktab udtrykt som løftehøjde. Pumpen/cirkulationspumpen SKAL kunne levere mindst denne højde ved det aktuelle flow."
                            calculation="H = Δp / (ρ·g) = h_friktion + h_lokal"
                          />
                        </div>
                        <p className="text-2xl font-bold text-brand-primary dark:text-brand-light tabular-nums">{pl.totalHeadM.toFixed(2)}</p>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">m VS</p>
                      </div>
                      <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">Samlet tryktab</p>
                        <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary tabular-nums">{pl.pressureLossKPa.toFixed(1)}</p>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">kPa ({(pl.pressureLossKPa / 100).toFixed(3)} bar)</p>
                      </div>
                    </div>

                    {/* Friction vs minor split */}
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Tabsfordeling</p>
                        <InfoHint
                          title="Friktions- vs. lokale tab"
                          description="Løftehøjden deles i rørfriktion (Darcy–Weisbach over hele længden) og lokale tab fra fittings (ΣK·½ρv²). Mange bøjninger/ventiler på et kort rør kan dominere tabet."
                          calculation="H = h_friktion + h_lokal"
                        />
                      </div>
                      <div className="space-y-2">
                        {(() => {
                          const total = pl.totalHeadM > 0 ? pl.totalHeadM : 1;
                          const rows = [
                            { label: 'Friktionstab (rør)', v: pl.frictionHeadM, color: 'bg-brand-primary' },
                            { label: 'Lokale tab (ΣK)', v: pl.minorHeadM, color: 'bg-amber-400' },
                          ];
                          return rows.map(row => (
                            <div key={row.label} className="flex items-center gap-2">
                              <span className="w-32 shrink-0 text-xs text-text-secondary dark:text-text-dark-secondary">{row.label}</span>
                              <div className="flex-1 h-3 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                                <div className={`h-full rounded-full ${row.color} transition-all duration-500`} style={{ width: `${Math.min(100, (row.v / total) * 100)}%` }} />
                              </div>
                              <span className="w-16 shrink-0 text-right text-xs font-medium text-text-primary dark:text-text-dark-primary tabular-nums">{row.v.toFixed(3)} m</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Pump note */}
                    <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                      <p className="font-semibold">Dimensionering af pumpe</p>
                      <p>
                        Cirkulationspumpen skal kunne levere mindst <strong>{pl.totalHeadM.toFixed(2)} m</strong> løftehøjde
                        (≈ {pl.pressureLossKPa.toFixed(1)} kPa) ved {Q.toFixed(2)} L/s. Vælg en pumpe hvis kurve ligger over dette arbejdspunkt.
                      </p>
                      <p className="opacity-80">
                        Re = {pl.reynolds.toFixed(0)} · f = {pl.frictionFactor.toFixed(4)} · ε = {mat.roughnessNote} ({mat.label})
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                    Indtast flow, indvendig diameter og kredsløbslængde for at beregne tryktab og nødvendigt pumpehoved.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <SafetyDisclaimer title="VVS-faglig vurdering kræves">
          VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
          Beregninger er vejledende og erstatter ikke et installationsprojekt.
          DS 439 gælder for vandinstallationer — kontrollér altid lokale krav og materialevalg med fagmand.
        </SafetyDisclaimer>
      </div>
    </CalculatorPage>
  );
};

export default PipeSizingCalculator;
