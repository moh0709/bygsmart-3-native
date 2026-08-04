import React, { useState, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';

type InsulationLevel = 'god' | 'middel' | 'dårlig';

// W/m³ rule-of-thumb
const W_M3: Record<InsulationLevel, number> = {
  god:    30,
  middel: 45,
  dårlig: 65,
};

// Type 22 H600 — standard output ~1600 W/m at ΔT50 (75/65/20)
const TYPE22_H600_W_PER_M = 1600;

// Radiator type catalogue
interface RadiatorType {
  label: string;
  wPerM: number;
  height: number; // mm
}
const RADIATOR_TYPES: RadiatorType[] = [
  { label: 'Type 10, H400', wPerM: 500,  height: 400 },
  { label: 'Type 11, H600', wPerM: 900,  height: 600 },
  { label: 'Type 21, H600', wPerM: 1300, height: 600 },
  { label: 'Type 22, H600', wPerM: 1600, height: 600 },
  { label: 'Type 22, H900', wPerM: 2200, height: 900 },
  { label: 'Type 33, H600', wPerM: 2100, height: 600 },
];

// DS 469 system temperature correction factor — deviation from ΔT50
// Output_actual = Output_rated × (ΔT_actual / 50)^n,  n≈1.30 for panel rads
const N_EXPONENT = 1.30;

const HELP: HelpContent = {
  formaal:
    'Estimerer varmebehov for et enkelt rum og foreslår radiatorlængde (Type 22, H600). ' +
    'Avanceret tilstand tager hensyn til radiatortype og faktisk fremløbstemperatur (DS 469).',
  variabler: [
    { name: 'Rumvolumen', symbol: 'V', unit: 'm³',  description: 'L × B × H — bruges til W/m³-tommelfingerregel.' },
    { name: 'Varmebehov', symbol: 'Q', unit: 'W',   description: 'Beregnet nødvendig varmeydelse.' },
    { name: 'Radiatorlængde', symbol: 'l_rad', unit: 'm', description: 'Nødvendig radiatorlængde givet valgt type.' },
    { name: 'ΔT',         symbol: 'ΔT', unit: 'K',  description: 'Middeltemperaturforskel: (T_frem + T_retur)/2 − T_rum.' },
  ],
  formel:
    'Basis:\n' +
    '  Q [W] = V [m³] × w [W/m³]\n' +
    '  l_rad = Q / (ydelse pr. meter)\n\n' +
    'Avanceret (DS 469 korrektionsfaktor):\n' +
    '  ΔT_actual = (T_frem + T_retur) / 2 − T_rum\n' +
    '  f = (ΔT_actual / 50)^1,30\n' +
    '  l_rad = Q / (ydelse_nominal × f)',
  antagelser:
    'Radiatorydelse er baseret på nominal ΔT50 (fremløb 75 °C, retur 65 °C, rum 20 °C). ' +
    'Lavtemperatursystemer (gulvvarme, fjernvarme med lave temperaturer) skal beregnes særskilt.',
  standarder:
    'DS 469 – Varme- og køleanlæg\n' +
    'DS 418 – Varmetabsberegning\n' +
    'EN 442 – Radiatorer og konvektorer (afprøvning)',
  disclaimer: (
    <span>
      VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
      Beregninger er vejledende og erstatter ikke et installationsprojekt.
    </span>
  ),
};

const RadiatorSizingCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [dims, setDims] = useState({ length: '5', width: '4', height: '2.5' });
  const [insulation, setInsulation] = useState<InsulationLevel>('middel');

  // Advanced
  const [radTypeIdx, setRadTypeIdx] = useState(3); // default Type 22 H600
  const [supplyTemp, setSupplyTemp]   = useState('70');
  const [returnTemp, setReturnTemp]   = useState('50');
  const [roomTemp, setRoomTemp]       = useState('20');

  const handleDimChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof dims) => {
      setDims(prev => ({ ...prev, [field]: e.target.value }));
    },
    []
  );
  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const l = parseFloat(dims.length) || 0;
  const w = parseFloat(dims.width)  || 0;
  const h = parseFloat(dims.height) || 0;
  const volume = l * w * h;

  const requiredWatts = volume * W_M3[insulation];

  const radType = RADIATOR_TYPES[radTypeIdx];

  // DS 469 temperature correction
  const Tsupply = parseFloat(supplyTemp) || 70;
  const Treturn = parseFloat(returnTemp) || 50;
  const Troom   = parseFloat(roomTemp)   || 20;
  const deltaT  = (Tsupply + Treturn) / 2 - Troom;
  const corrFactor = deltaT > 0 ? Math.pow(deltaT / 50, N_EXPONENT) : 1;

  const wPerMCorrected = radType.wPerM * corrFactor;

  const suggestedLength = mode === 'advanced' && wPerMCorrected > 0
    ? requiredWatts / wPerMCorrected
    : requiredWatts > 0
      ? requiredWatts / TYPE22_H600_W_PER_M
      : 0;

  const reportData = useMemo<CalculatorReportData>(() => {
    const basicInputs = [
      { label: 'Rum længde', value: dims.length, unit: 'm' },
      { label: 'Rum bredde', value: dims.width, unit: 'm' },
      { label: 'Rum højde', value: dims.height, unit: 'm' },
      { label: 'Isoleringsstandard', value: insulation },
    ];
    const advancedInputs = mode === 'advanced' ? [
      { label: 'Radiatortype', value: radType.label },
      { label: 'Fremløbstemperatur', value: supplyTemp, unit: '°C' },
      { label: 'Returtemperatur', value: returnTemp, unit: '°C' },
      { label: 'Rumtemperatur', value: roomTemp, unit: '°C' },
    ] : [];
    const results: CalculatorReportData['results'] = [
      { label: 'Samlet varmebehov', value: requiredWatts.toFixed(0), unit: 'W' },
      { label: mode === 'advanced' ? `Foreslået radiatorlængde (${radType.label})` : 'Foreslået radiatorlængde (Type 22, H600)', value: suggestedLength.toFixed(2), unit: 'm', highlight: true },
    ];
    const breakdown: CalculatorReportData['breakdown'] = mode === 'advanced' ? [
      { label: 'Rumvolumen', value: volume.toFixed(2), unit: 'm³' },
      { label: 'ΔT (middeltemperaturforskel)', value: deltaT.toFixed(1), unit: 'K' },
      { label: 'Korrektionsfaktor f (DS 469)', value: corrFactor.toFixed(3) },
      { label: 'Korrigeret radiatorydelse', value: wPerMCorrected.toFixed(0), unit: 'W/m' },
    ] : [
      { label: 'Rumvolumen', value: volume.toFixed(2), unit: 'm³' },
    ];
    return {
      toolName: 'Radiator Dimensionering',
      category: 'VVS',
      mode,
      inputs: [...basicInputs, ...advancedInputs],
      results,
      breakdown,
      formula: 'Basis: Q [W] = V [m³] × w [W/m³]; l_rad = Q / ydelse_pr_meter\nAvanceret (DS 469): ΔT = (T_frem + T_retur)/2 − T_rum; f = (ΔT/50)^1,30; l_rad = Q / (ydelse_nominal × f)',
      standardsStruktureret: [
        { code: 'DS 469', note: 'Varme- og køleanlæg' },
        { code: 'DS 418', note: 'Varmetabsberegning' },
        { code: 'EN 442', note: 'Radiatorer og konvektorer (afprøvning)' },
      ],
      safetyDisclaimer: 'VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør. Beregninger er vejledende og erstatter ikke et installationsprojekt. Præcis dimensionering kræver en varmetabsberegning jf. DS 418 og systemanalyse jf. DS 469.',
    };
  }, [mode, dims, insulation, radType, supplyTemp, returnTemp, roomTemp, requiredWatts, suggestedLength, volume, deltaT, corrFactor, wPerMCorrected]);

  const Diagram = useMemo(() => {
    const winW = 1.2;
    const scale = 100;
    const svgW = 350;
    const radPx = Math.min(suggestedLength * scale, 300);
    const winPx = winW * scale;
    const cx = svgW / 2;

    return (
      <div className="flex flex-col items-center w-full bg-bg-muted dark:bg-bg-dark-muted p-4 rounded-lg border border-border dark:border-border-dark mt-4">
        <h4 className="text-xs font-bold text-text-secondary mb-2 uppercase tracking-wide">
          Visuel størrelse (ift. 1,2 m vindue)
        </h4>
        <svg width={svgW} height="180" viewBox={`0 0 ${svgW} 180`}>
          <rect x="0" y="0" width={svgW} height="180" fill="#f8fafc" />
          <rect x="0" y="160" width={svgW} height="20" fill="#fef3c7" />
          <line x1="0" y1="160" x2={svgW} y2="160" stroke="#9ca3af" strokeWidth="1" />

          {/* Window */}
          <rect x={cx - winPx/2} y="20" width={winPx} height="80" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="2" />
          <line x1={cx} y1="20" x2={cx} y2="100" stroke="#bfdbfe" strokeWidth="1" />
          <line x1={cx - winPx/2} y1="60" x2={cx + winPx/2} y2="60" stroke="#bfdbfe" strokeWidth="1" />

          {/* Radiator */}
          <g transform={`translate(${cx - radPx/2}, 110)`}>
            <rect x="0" y="0" width={radPx} height="40" fill="white" stroke="#9ca3af" rx="2" strokeWidth="1" />
            {Array.from({ length: Math.floor(radPx / 5) }).map((_, i) => (
              <line key={i} x1={i * 5 + 2} y1="2" x2={i * 5 + 2} y2="38" stroke="#e5e7eb" strokeWidth="1" />
            ))}
            <circle cx={radPx + 5} cy="10" r="4" fill="white" stroke="#6b7280" />
            <path d={`M ${radPx} 10 L ${radPx + 10} 10`} stroke="#6b7280" strokeWidth="2" />
          </g>

          {suggestedLength > 0 && (
            <>
              <line x1={cx - radPx/2} y1="155" x2={cx + radPx/2} y2="155" stroke="#2563eb" strokeWidth="1" />
              <text x={cx} y="172" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#2563eb">
                {suggestedLength.toFixed(2)} m
              </text>
            </>
          )}
        </svg>
      </div>
    );
  }, [suggestedLength]);

  return (
    <CalculatorPage
      title="Radiatorstørrelse Beregner"
      helpContent={HELP}
      modeToggle={
        <CalculatorModeToggle toolId="radiator-sizing" onChange={handleModeChange} />
      }
      reportData={reportData}
    >
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Inputs */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <h3 className="font-bold text-lg">Rumdata</h3>

            <InputField label="Rum længde" value={dims.length} onChange={e => handleDimChange(e, 'length')} unit="m" info="Mål rummets fulde indvendige længde." />
            <InputField label="Rum bredde"  value={dims.width}  onChange={e => handleDimChange(e, 'width')}  unit="m" info="Mål rummets fulde indvendige bredde." />
            <InputField label="Rum højde"   value={dims.height} onChange={e => handleDimChange(e, 'height')} unit="m" info="Højden fra gulv til loft." />

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Isoleringsstandard</label>
              <SegmentedControl
                options={[
                  { label: 'God',    value: 'god' },
                  { label: 'Middel', value: 'middel' },
                  { label: 'Dårlig', value: 'dårlig' },
                ]}
                value={insulation}
                onChange={v => setInsulation(v as InsulationLevel)}
              />
            </div>

            {mode === 'advanced' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Radiatortype (EN 442)</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {RADIATOR_TYPES.map((rt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setRadTypeIdx(idx)}
                        className={`flex justify-between items-center py-2 px-3 rounded-lg text-sm border transition-colors ${
                          radTypeIdx === idx
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-bg dark:bg-bg-dark-surface border-border dark:border-border-dark-strong text-text-secondary hover:border-brand-primary'
                        }`}
                      >
                        <span className="font-medium">{rt.label}</span>
                        <span className="text-xs opacity-80">{rt.wPerM} W/m</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-text-secondary">Systemtemperaturer (DS 469)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <InputField label="Fremløb" value={supplyTemp} onChange={e => setSupplyTemp(e.target.value)} unit="°C" info="Fremløbstemperatur fra kedel/fjernvarme." />
                    <InputField label="Retur"   value={returnTemp} onChange={e => setReturnTemp(e.target.value)} unit="°C" info="Returtemperatur til kedel." />
                    <InputField label="Rum"     value={roomTemp}   onChange={e => setRoomTemp(e.target.value)}   unit="°C" info="Ønsket rumtemperatur." />
                  </div>
                  <div className="p-2 bg-bg-muted dark:bg-bg-dark-muted rounded-lg text-xs text-text-secondary">
                    ΔT = {deltaT.toFixed(1)} K · korrektionsfaktor f = {corrFactor.toFixed(3)}
                    <br />
                    Korr. ydelse: {wPerMCorrected.toFixed(0)} W/m ({radType.label})
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <h3 className="font-bold text-lg mb-4">Resultat</h3>
              <ResultDisplay label="Samlet varmebehov" value={requiredWatts} precision={0} unit="W" />

              {requiredWatts > 0 && (
                <div className="mt-6 pt-6 border-t border-border dark:border-border-dark">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-text-secondary">
                      {mode === 'advanced' ? `Forslag (${radType.label})` : 'Forslag (Type 22, H600)'}
                    </span>
                    <span className="text-lg font-bold text-text-primary">
                      <AnimatedNumber value={suggestedLength} precision={2} /> m
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">
                    {mode === 'advanced'
                      ? `Baseret på ${wPerMCorrected.toFixed(0)} W/m ved ΔT ${deltaT.toFixed(1)} K. Ved flere radiatorer, fordel længden.`
                      : 'Baseret på standardydelse ~1 600 W/m ved ΔT50. Ved flere radiatorer, fordel længden.'}
                  </p>
                  {Diagram}
                </div>
              )}
            </div>
          </div>
        </div>

        <SafetyDisclaimer title="VVS-faglig vurdering kræves">
          VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
          Beregninger er vejledende og erstatter ikke et installationsprojekt.
          Præcis dimensionering kræver en varmetabsberegning jf. DS 418 og systemanalyse jf. DS 469.
        </SafetyDisclaimer>
      </div>
    </CalculatorPage>
  );
};

export default RadiatorSizingCalculator;
