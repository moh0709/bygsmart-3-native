import React, { useState, useEffect, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { computeVentilationFlow, STANDARDS_CATALOG } from '../../catalog';
import type { CalculatorReportData } from '../../components/CalculatorPage';

// ── BR18 room-type presets (advanced mode) ──────────────────────────────────
interface RoomPreset {
  label: string;
  achFactor: number;      // ACH rate for volume-based cross-check
  minFlowLps: number;     // BR18 minimum L/s for the room type
  note: string;
}

const ROOM_PRESETS: RoomPreset[] = [
  { label: 'Bolig (generel)',     achFactor: 0.5,  minFlowLps: 0,  note: 'BR18 §425: min. 0,3 L/s pr. m² + 7 L/s pr. person' },
  { label: 'Badeværelse',         achFactor: 8,    minFlowLps: 15, note: 'BR18 §427: min. 15 L/s mekanisk udsugning' },
  { label: 'Køkken',              achFactor: 10,   minFlowLps: 20, note: 'BR18 §427: min. 20 L/s fra emhætte/udsugning' },
  { label: 'Kontor',              achFactor: 4,    minFlowLps: 0,  note: 'DS/EN 16798-1: kategori II, 10 L/s pr. person' },
  { label: 'Undervisningslokale', achFactor: 6,    minFlowLps: 0,  note: 'BR18 §428: øget krav pga. høj personbelastning' },
  { label: 'Industrihal',         achFactor: 20,   minFlowLps: 0,  note: 'Projektspecifik vurdering påkrævet' },
];

// ── Help content ─────────────────────────────────────────────────────────────
const helpContent: HelpContent = {
  formaal:
    'Beregner det minimale ventilationsflow for en bolig eller erhvervslokale efter BR18 §425. ' +
    'Resultatet angiver det nødvendige luftflow i L/s og m³/h for at overholde bygningsreglementets mindstekrav.',
  variabler: [
    { name: 'Boligareal',    symbol: 'A',    unit: 'm²',     description: 'Boligens bruttoareal (alle rum inkl. gangarealer).' },
    { name: 'Antal personer', symbol: 'n',   unit: 'pers.',  description: 'Normalt antal occupanter som anlægget dimensioneres for (sovepladser + 1 er typisk BR18-praksis).' },
    { name: 'Flow (L/s)',    symbol: 'q',    unit: 'L/s',    description: 'Beregnet minimalt luftflow i liter pr. sekund.' },
    { name: 'Flow (m³/h)',   symbol: 'Q',    unit: 'm³/h',   description: 'Samme flow omregnet til kubikmeter pr. time.' },
  ],
  formel:
    'q [L/s] = 0,3 × A [m²] + 7 × n [pers.]\nQ [m³/h] = q × 3,6',
  antagelser:
    'Formlen er den forenklede BR18-formel for boliger. For erhvervslokaler, institutioner og ' +
    'vådrum kan strengere krav gælde – brug rumtype-presets i Avanceret tilstand for vejledende værdier.',
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
const VentilationFlowCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [inputs, setInputs] = useState({ area: '100', occupants: '4' });
  const [selectedPreset, setSelectedPreset] = useState<RoomPreset>(ROOM_PRESETS[0]);
  const [results, setResults] = useState({ lps: 0, m3h: 0, calculatedLps: 0, areaBasedLps: 0, personBasedLps: 0 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof inputs) => {
    setInputs(prev => ({ ...prev, [field]: e.target.value }));
  };

  useEffect(() => {
    const area = parseFloat(inputs.area) || 0;
    const persons = parseInt(inputs.occupants) || 0;
    const { flowLps, areaBasedLps, personBasedLps } = computeVentilationFlow({ areaM2: area, persons });

    // The room-type's absolute BR18 minimum (e.g. 20 L/s for Køkken) must be able to
    // raise the dimensionerende flow, not just flag a compliance warning on-screen.
    const dimensioneretLps = Math.max(flowLps, selectedPreset.minFlowLps);

    setResults({
      lps: dimensioneretLps,
      m3h: dimensioneretLps * 3.6,
      calculatedLps: flowLps,
      areaBasedLps,
      personBasedLps,
    });
  }, [inputs, selectedPreset]);

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  // Room-type's fixed BR18 minimum (0 = no fixed minimum beyond the §425 formula)
  const roomMinLps = selectedPreset.minFlowLps;
  const roomFloorRaisesFlow = roomMinLps > results.calculatedLps;

  const reportData: CalculatorReportData = {
    toolName: 'Ventilationsflow Beregner',
    category: 'HVAC / Ventilation',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Boligareal', value: inputs.area, unit: 'm²' },
      { label: 'Antal personer', value: inputs.occupants, unit: 'pers.' },
      ...(mode === 'advanced' ? [{ label: 'Rumtype', value: selectedPreset.label }] : []),
    ],
    results: [
      { label: 'Minimum luftflow', value: results.lps.toFixed(1), unit: 'L/s', highlight: true },
      { label: 'Luftflow', value: results.m3h.toFixed(0), unit: 'm³/h' },
    ],
    formula: 'q [L/s] = 0,3 × A [m²] + 7 × n [pers.]\nQ [m³/h] = q × 3,6',
    standardsStruktureret: STANDARDS_CATALOG.ventilation,
    safetyDisclaimer: 'Ventilationsanlæg skal projekteres og installeres i overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.',
  };

  const modeToggle = (
    <CalculatorModeToggle toolId="ventilation-flow" onChange={handleModeChange} />
  );

  return (
    <CalculatorPage
      title="Ventilationsflow Beregner"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={modeToggle}
      stickyResult={
        results.lps > 0 ? (
          <>
            <AnimatedNumber value={results.lps} precision={1} /> L/s
          </>
        ) : undefined
      }
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* ── Input card ──────────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
            Indtast Data
          </h3>

          <InputField
            label="Boligareal"
            value={inputs.area}
            onChange={e => handleInputChange(e, 'area')}
            unit="m²"
          />
          <InputField
            label="Antal personer"
            value={inputs.occupants}
            onChange={e => handleInputChange(e, 'occupants')}
            unit="personer"
            info="Antal personer anlægget dimensioneres efter. BR18-praksis: antal sovepladser + 1."
          />

          {/* Advanced: room-type presets */}
          {mode === 'advanced' && (
            <div className="pt-2 border-t border-border dark:border-border-dark">
              <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-2">
                Rumtype (BR18-preset)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROOM_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setSelectedPreset(preset)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors leading-snug ${
                      selectedPreset.label === preset.label
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                        : 'bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark-strong hover:border-brand-primary'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {selectedPreset && (
                <p className="mt-2 text-xs text-brand-primary pl-1 leading-snug">
                  {selectedPreset.note}
                </p>
              )}

              {/* Advanced: CO2-based note */}
              <div className="mt-4 p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-xl border border-info-border dark:border-info/30 text-xs text-info-strong dark:text-info leading-snug">
                <strong>CO₂-baseret dimensionering (avanceret):</strong> EN 16798-1 anbefaler
                kategori II: 550 ppm CO₂ over udeniveauet. For detaljeret CO₂-beregning kræves
                rumvolumen og opholdstid – brug Luftskifte Beregneren.
              </div>
            </div>
          )}
        </div>

        {/* ── Results card ─────────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-5">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
            Minimum Luftflow (BR18)
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-xl">
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Liter pr. sekund</p>
              <div className="text-3xl font-bold text-brand-primary mt-1">
                <AnimatedNumber value={results.lps} precision={1} />
                <span className="text-xl ml-1">L/s</span>
              </div>
            </div>
            <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-xl">
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Kubikmeter pr. time</p>
              <div className="text-3xl font-bold text-brand-primary mt-1">
                <AnimatedNumber value={results.m3h} precision={0} />
                <span className="text-xl ml-1">m³/h</span>
              </div>
            </div>
          </div>

          {/* Compliance meter: value must be >= BR18 min → show min as the "value" (needle) and
              the raw calculated (pre-floor) flow as the "limit" (green-zone ceiling) */}
          {results.lps > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                Beregnet flow (§425) vs. rumtypens minimum
              </p>
              <ComplianceMeter
                label="Flow vs. rumtype-min."
                value={roomMinLps}
                limit={results.calculatedLps}
                max={Math.max(results.calculatedLps * 1.5, roomMinLps * 1.5, 20)}
                unit=" L/s"
                decimalPlaces={1}
              />
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                {roomFloorRaisesFlow
                  ? `⚠ Beregnet flow (${results.calculatedLps.toFixed(1)} L/s) er under rumtypens BR18-minimum (${roomMinLps.toFixed(0)} L/s). Dimensionerende (anvendt) flow er derfor hævet til ${results.lps.toFixed(1)} L/s.`
                  : '✓ Beregnet flow opfylder BR18 minimumskravet.'}
              </p>
            </div>
          )}

          {/* Advanced: per-room type breakdown */}
          {mode === 'advanced' && (
            <div className="pt-3 border-t border-border dark:border-border-dark space-y-2">
              <h4 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Komponentbidrag (BR18 §425)
              </h4>
              <div className="flex justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
                <span>Areal-bidrag ({inputs.area} m² × 0,3)</span>
                <span className="font-mono">
                  {((parseFloat(inputs.area) || 0) * 0.3).toFixed(1)} L/s
                </span>
              </div>
              <div className="flex justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
                <span>Person-bidrag ({inputs.occupants} pers. × 7)</span>
                <span className="font-mono">
                  {((parseInt(inputs.occupants) || 0) * 7).toFixed(1)} L/s
                </span>
              </div>
              {selectedPreset.minFlowLps > 0 && (
                <div className="flex justify-between text-xs text-warning-strong dark:text-warning pt-1 border-t border-border dark:border-border-dark">
                  <span>Rumtype minimumsgrænse ({selectedPreset.label})</span>
                  <span className="font-mono">{selectedPreset.minFlowLps.toFixed(0)} L/s</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-text-primary dark:text-text-dark-primary pt-1 border-t border-border dark:border-border-dark-strong">
                <span>Dimensionerende flow</span>
                <span className="font-mono">{results.lps.toFixed(1)} L/s</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Safety disclaimer */}
      <SafetyDisclaimer
        title="Vejledende Ventilationsberegning"
        className="mt-6"
      >
        Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i
        overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.
      </SafetyDisclaimer>
    </CalculatorPage>
  );
};

export default VentilationFlowCalculator;
