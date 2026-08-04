import React, { useState, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { computeDrainDrop } from '../../catalog';

// DS 432 minimum slope is 1:40 = 25‰ = 2,5 % for gravity drainage
const DS432_MIN_SLOPE_PCT = 2.5;
// DS 432 minimum self-cleaning velocity (gravity drainage) 0.7 m/s
const DS432_MIN_VELOCITY_MS = 0.7;

type PipeType = 'pvc' | 'pe' | 'cast-iron';

const PIPE_TYPES: { value: PipeType; label: string; minSlope: number }[] = [
  { value: 'pvc',       label: 'PVC',         minSlope: 2.0 },
  { value: 'pe',        label: 'PE',           minSlope: 2.0 },
  { value: 'cast-iron', label: 'Støbejern',    minSlope: 1.5 },
];

const HELP: HelpContent = {
  formaal:
    'Beregner det samlede fald for en afløbsledning ud fra rørlængden og den valgte hældningsprocent. ' +
    'Bruges til at kontrollere om afløbet opfylder DS 432-kravene til selvrensning ved naturlig tyngdekraft.',
  variabler: [
    { name: 'Rørlængde', symbol: 'L', unit: 'm',  description: 'Horisontal længde af afløbsledningen.' },
    { name: 'Hældning',  symbol: 'i', unit: '%',  description: 'Faldet udtrykt i procent (‰ × 0,1). DS 432 kræver min. 25 ‰ = 2,5 %.' },
    { name: 'Fald',      symbol: 'h', unit: 'cm', description: 'Samlet højdeforskel h = L × i / 100 × 100 cm.' },
  ],
  formel: 'h [cm] = L [m] × (i [%] / 100) × 100\ni [‰]  = i [%] × 10',
  antagelser:
    'Beregningen forudsætter jævn hældning over hele rørlængden og fyldt rør. ' +
    'Lokal modstand (samlinger, bøjninger) er ikke medregnet.',
  standarder:
    'DS 432 – Afløbsinstallationer, min. fald 1:40 (25 ‰ = 2,5 %)\n' +
    'DS 439 – Vandinstallationer\n' +
    'DS 469 – Varme- og køleanlæg',
  disclaimer: (
    <span>
      VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
      Beregninger er vejledende og erstatter ikke et installationsprojekt.
    </span>
  ),
};

const DrainSlopeCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [inputs, setInputs] = useState({ length: '5', slope: '2' });
  const [pipeDiamMm, setPipeDiamMm] = useState('110');
  const [pipeType, setPipeType] = useState<PipeType>('pvc');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, field: 'length' | 'slope' | 'pipeDiamMm') => {
      if (field === 'pipeDiamMm') {
        setPipeDiamMm(e.target.value);
      } else {
        setInputs(prev => ({ ...prev, [field]: e.target.value }));
      }
    },
    []
  );

  const length = parseFloat(inputs.length) || 0;
  const slope  = parseFloat(inputs.slope)  || 0;
  const diam   = parseFloat(pipeDiamMm)    || 110;

  const selectedPipe = PIPE_TYPES.find(p => p.value === pipeType)!;
  const minSlope = selectedPipe.minSlope;

  const result = computeDrainDrop({ lengthM: length, slopePct: slope, minSlopePct: minSlope });

  // Advanced: estimate mean velocity via Manning (n=0.013 for PVC/PE, 0.015 for cast-iron)
  const n = pipeType === 'cast-iron' ? 0.015 : 0.013;
  const r = (diam / 1000) / 4; // hydraulic radius for full circle = D/4 [m]
  const slopeM = slope / 100;  // dimensionless slope
  const velocity = r > 0 && slopeM > 0
    ? (1 / n) * Math.pow(r, 2 / 3) * Math.pow(slopeM, 0.5)
    : 0;

  const reportData = useMemo<CalculatorReportData>(() => {
    const reportInputs: CalculatorReportData['inputs'] = [
      { label: 'Rørlængde', value: length.toFixed(2), unit: 'm' },
      { label: 'Fald / Hældning', value: slope.toFixed(2), unit: '%' },
    ];
    if (mode === 'advanced') {
      reportInputs.push({ label: 'Rørdiameter (indvendig)', value: diam.toFixed(0), unit: 'mm' });
      reportInputs.push({ label: 'Rørmateriale', value: selectedPipe.label });
    }

    const reportResults: CalculatorReportData['results'] = [
      { label: 'Samlet fald', value: result.dropCm.toFixed(2), unit: 'cm', highlight: true },
      { label: 'Hældning', value: result.slopePromille.toFixed(1), unit: '‰' },
      {
        label: 'DS 432 godkendt',
        value: result.compliant ? 'Ja' : 'Nej',
      },
    ];
    if (mode === 'advanced' && velocity > 0) {
      reportResults.push({ label: 'Estimeret middelhastighed (Manning)', value: velocity.toFixed(2), unit: 'm/s' });
      reportResults.push({ label: 'Selvrensning OK', value: velocity >= DS432_MIN_VELOCITY_MS ? 'Ja' : 'Nej' });
    }

    return {
      toolName: 'Afloebshaeldning',
      category: 'VVS',
      mode,
      inputs: reportInputs,
      results: reportResults,
      formula: 'h [cm] = L [m] × (i [%] / 100) × 100\ni [‰] = i [%] × 10',
      standardsStruktureret: [
        { code: 'DS 432', note: 'Afløbsinstallationer — min. fald 1:40 (25 ‰ = 2,5 %)' },
        { code: 'DS 439', note: 'Vandinstallationer' },
        { code: 'DS 469', note: 'Varme- og køleanlæg' },
      ],
      safetyDisclaimer:
        'VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør. ' +
        'Beregninger er vejledende og erstatter ikke et installationsprojekt. ' +
        'DS 432 gælder for afløbsinstallationer — kontrollér altid lokale myndighedskrav.',
    };
  }, [length, slope, diam, pipeType, selectedPipe, mode, result, velocity]);

  return (
    <CalculatorPage
      title="Afløbsfald Beregner"
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle toolId="drain-slope" onChange={setMode} />
      }
    >
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Inputs */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg">Indtast værdier</h3>

            <InputField
              label="Rørlængde"
              value={inputs.length}
              onChange={e => handleChange(e, 'length')}
              unit="m"
              info="Horisontal længde af afløbsledningen."
            />
            <InputField
              label="Fald / Hældning"
              value={inputs.slope}
              onChange={e => handleChange(e, 'slope')}
              unit="%"
              info="DS 432 kræver mindst 2,5 % (25 ‰) for gravitationsafløb."
            />

            {mode === 'advanced' && (
              <>
                <InputField
                  label="Rørdiameter (indvendig)"
                  value={pipeDiamMm}
                  onChange={e => handleChange(e, 'pipeDiamMm')}
                  unit="mm"
                  info="Rørets indvendige diameter. Almindelige størrelser: 75, 110, 160, 200 mm."
                />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Rørmateriale</label>
                  <div className="flex gap-2">
                    {PIPE_TYPES.map(pt => (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setPipeType(pt.value)}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          pipeType === pt.value
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-bg dark:bg-bg-dark-surface border-border dark:border-border-dark-strong text-text-secondary hover:border-brand-primary'
                        }`}
                      >
                        {pt.label}
                        <span className="block text-xs opacity-70">min {pt.minSlope} %</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-4">Resultat</h3>
              <ResultDisplay label="Samlet fald" value={result.dropCm} unit="cm" />
              <div className="mt-2 text-sm text-text-secondary">
                Hældning: <span className="font-mono font-bold">{result.slopePromille.toFixed(1)} ‰</span>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                  Hældning vs. DS 432 minimum ({minSlope} %)
                </p>
                <ComplianceMeter
                  label="Hældning"
                  value={slope}
                  limit={minSlope}
                  min={0}
                  max={Math.max(slope * 1.5, minSlope * 2, 6)}
                  unit="%"
                  decimalPlaces={1}
                />
                <p className={`text-xs mt-1 font-medium ${result.compliant ? 'text-success' : 'text-danger'}`}>
                  {result.compliant
                    ? `Godkendt — hældning opfylder DS 432 (≥ ${minSlope} %)`
                    : `Ikke godkendt — hældning er under DS 432 minimum (${minSlope} %)`}
                </p>
              </div>

              {mode === 'advanced' && velocity > 0 && (
                <div className="mt-6 pt-4 border-t border-border dark:border-border-dark">
                  <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                    Estimeret middelhastighed (Manning) vs. 0,7 m/s (selvrensning)
                  </p>
                  <ComplianceMeter
                    label="Vandhastighed"
                    value={velocity}
                    limit={DS432_MIN_VELOCITY_MS}
                    min={0}
                    max={Math.max(velocity * 1.5, 1.5)}
                    unit=" m/s"
                    decimalPlaces={2}
                  />
                  <p className={`text-xs mt-1 font-medium ${velocity >= DS432_MIN_VELOCITY_MS ? 'text-success' : 'text-danger'}`}>
                    {velocity >= DS432_MIN_VELOCITY_MS
                      ? `Selvrensning OK — estimeret ${velocity.toFixed(2)} m/s ≥ 0,7 m/s`
                      : `Selvrensning ikke opfyldt — estimeret ${velocity.toFixed(2)} m/s < 0,7 m/s`}
                  </p>
                  <p className="text-xs text-text-secondary mt-2">
                    Manning-koefficient n = {n} ({selectedPipe.label}). Forudsætter fuld strøm.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <SafetyDisclaimer title="VVS-faglig vurdering kræves">
          VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
          Beregninger er vejledende og erstatter ikke et installationsprojekt.
          DS 432 gælder for afløbsinstallationer — kontrollér altid lokale myndighedskrav.
        </SafetyDisclaimer>
      </div>
    </CalculatorPage>
  );
};

export default DrainSlopeCalculator;
