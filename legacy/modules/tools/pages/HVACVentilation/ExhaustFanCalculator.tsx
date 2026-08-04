import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import { computeHeatRecoveryVentilation } from '../../catalog';

// ── Room type config ──────────────────────────────────────────────────────────
type RoomType = 'badeværelse' | 'køkken' | 'wc' | 'bryggers' | 'andet';

interface RoomConfig {
  label: string;
  ach: number;
  br18MinLps: number;  // BR18 absolute minimum in L/s (0 = no fixed minimum, use ACH)
  br18Note: string;
}

const ROOM_CONFIGS: Record<RoomType, RoomConfig> = {
  badeværelse: { label: 'Badeværelse', ach: 8,  br18MinLps: 15, br18Note: 'BR18 §427: min. 15 L/s mekanisk udsugning' },
  køkken:      { label: 'Køkken',      ach: 15, br18MinLps: 20, br18Note: 'BR18 §427: min. 20 L/s fra emhætte/udsugning' },
  wc:          { label: 'WC',          ach: 6,  br18MinLps: 10, br18Note: 'BR18 §427: min. 10 L/s udsugning fra WC' },
  bryggers:    { label: 'Bryggers',    ach: 6,  br18MinLps: 15, br18Note: 'Typisk behandles som vådrum. Min. 15 L/s anbefales.' },
  andet:       { label: 'Andet rum',   ach: 6,  br18MinLps: 0,  br18Note: 'Ingen fast BR18-grænse – beregn efter ACH og rumtype' },
};

const ROOM_TYPE_OPTIONS = (Object.keys(ROOM_CONFIGS) as RoomType[]).map(k => ({
  label: ROOM_CONFIGS[k].label,
  value: k,
}));

// ── Heat-recovery (VGV) config ─────────────────────────────────────────────────
// Temperature efficiency η presets for balanced ventilation with a heat exchanger.
const EFFICIENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '0.85', label: 'Modstrømsveksler (moderne) – η 0,85' },
  { value: '0.80', label: 'Roterende veksler – η 0,80' },
  { value: '0.60', label: 'Krydsveksler – η 0,60' },
  { value: '0.50', label: 'Ældre/simpel veksler – η 0,50' },
];

// BR18 guidance for SFP (specific fan power) on balanced systems with heat recovery.
const SFP_LIMIT = 1800; // J/m³

/** parseFloat that keeps a valid 0 but falls back to a default on empty/NaN input. */
const numOr = (s: string, d: number): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : d;
};

// ── Help content ─────────────────────────────────────────────────────────────
const helpContent: HelpContent = {
  formaal:
    'Beregner den anbefalede kapacitet for en udsugningsventilator baseret på rumvolumen, rumtype ' +
    'og luftskiftekoefficient (ACH). Resultatet verificeres mod BR18 §427 absolutte minimumskrav for vådrum.',
  variabler: [
    { name: 'Rumvolumen',  symbol: 'V',   unit: 'm³',     description: 'Rummets indhold i kubikmeter (Længde × Bredde × Højde).' },
    { name: 'ACH',         symbol: 'n',   unit: 'gange/t', description: 'Luftskifterate typisk for rumtypen.' },
    { name: 'Kapacitet',   symbol: 'Q',   unit: 'm³/h',   description: 'Nødvendig ventilatorkapacitet = V × ACH.' },
    { name: 'Min. flow',   symbol: 'q',   unit: 'L/s',    description: 'BR18 absolut minimum for rumtypen (badeværelse: 15 L/s, køkken: 20 L/s).' },
    { name: 'Virkningsgrad', symbol: 'η', unit: '–',      description: 'Avanceret (VGV): varmevekslerens temperaturvirkningsgrad. Moderne modstrøm ≈ 0,85, krydsveksler ≈ 0,60.' },
    { name: 'SFP',         symbol: 'SFP', unit: 'J/m³',   description: 'Avanceret (VGV): specifikt ventilatoreffektforbrug = ventilatoreffekt / luftmængde. BR18-vejledning ≈ 1800 J/m³.' },
  ],
  formel:
    'Q [m³/h] = V [m³] × ACH [gange/t]\nq [L/s]  = Q / 3,6\nDimensionerende = max(Q, BR18 min.)\n\nVGV (avanceret):\nGenvundet effekt = η · flow · ρcp · ΔT   (ρcp ≈ 1200 J/m³·K)\nSFP = ventilatoreffekt / luftmængde   [J/m³]\nGenvundet varme [kWh/år] = genvundet effekt · driftstimer / 1000',
  antagelser:
    'ACH-værdier er typiske anbefaling for rumtypen. Vælg altid en ventilator med kapacitet lig med ' +
    'eller højere end det beregnede resultat. BR18 angiver minimumskrav; komfort og fugtnedbringelse kan kræve højere kapacitet.',
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
const ExhaustFanCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [roomType, setRoomType] = useState<RoomType>('badeværelse');
  const [volume, setVolume] = useState('10');
  const [capacity, setCapacity] = useState(0);       // m³/h
  const [capacityLps, setCapacityLps] = useState(0); // L/s

  // ── Advanced VGV (heat recovery) inputs ──────────────────────────────────────
  const [efficiency, setEfficiency] = useState('0.85');    // η (0–1)
  const [fanPowerW, setFanPowerW] = useState('90');        // total supply+extract fan power [W]
  const [deltaT, setDeltaT] = useState('12');              // mean indoor–outdoor ΔT [K]
  const [operatingHours, setOperatingHours] = useState('8760'); // annual runtime [h]
  const [elPrice, setElPrice] = useState('2.5');           // electricity price [DKK/kWh]

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const config = ROOM_CONFIGS[roomType];

  useEffect(() => {
    const vol = parseFloat(volume) || 0;
    const raw = vol * config.ach;              // m³/h from ACH
    const rawLps = raw / 3.6;                  // convert to L/s

    // Dimensionerende = max of ACH-based flow and BR18 absolute minimum
    const dimLps  = Math.max(rawLps, config.br18MinLps);
    const dimM3h  = dimLps * 3.6;

    setCapacity(dimM3h);
    setCapacityLps(dimLps);
  }, [volume, config]);

  // BR18 minimum for compliance meter
  const br18MinM3h = config.br18MinLps * 3.6;

  // ── Advanced VGV: heat recovery, SFP and annual savings ──────────────────────
  // Reuse the page's dimensioning flow (m³/h) as the balanced supply/extract flow.
  const vgv = useMemo(() => computeHeatRecoveryVentilation({
    flowM3h: capacity,
    efficiency: numOr(efficiency, 0.85),
    fanPowerW: numOr(fanPowerW, 90),
    deltaTMeanK: numOr(deltaT, 12),
    operatingHoursYr: numOr(operatingHours, 8760),
    electricityPriceDKK: numOr(elPrice, 2.5),
  }), [capacity, efficiency, fanPowerW, deltaT, operatingHours, elPrice]);

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Udsugningsventilator',
    category: 'HVAC & Ventilation',
    mode: mode,
    inputs: [
      { label: 'Rumtype', value: config.label },
      { label: 'Rumvolumen', value: volume, unit: 'm³' },
      { label: 'Luftskifterate (ACH)', value: String(config.ach), unit: 'gange/t' },
      ...(config.br18MinLps > 0
        ? [{ label: 'BR18 absolut minimum', value: String(config.br18MinLps), unit: 'L/s' }]
        : []),
      ...(mode === 'advanced'
        ? [
            { label: 'Varmeveksler-virkningsgrad η', value: (numOr(efficiency, 0.85) * 100).toFixed(0), unit: '%' },
            { label: 'Samlet ventilatoreffekt', value: fanPowerW, unit: 'W' },
            { label: 'Middel ΔT (sæson)', value: deltaT, unit: 'K' },
            { label: 'Driftstimer', value: operatingHours, unit: 't/år' },
            { label: 'Elpris', value: elPrice, unit: 'kr/kWh' },
          ]
        : []),
    ],
    results: [
      { label: 'Anbefalet kapacitet', value: capacity.toFixed(0), unit: 'm³/h', highlight: true },
      { label: 'Anbefalet kapacitet', value: capacityLps.toFixed(1), unit: 'L/s' },
      ...(mode === 'advanced'
        ? [
            { label: 'Årlig genvundet varme', value: vgv.annualHeatRecoveredKwh.toFixed(0), unit: 'kWh/år', highlight: true },
            { label: 'Genvundet varmeeffekt', value: vgv.recoveredPowerW.toFixed(0), unit: 'W' },
            { label: 'SFP', value: vgv.sfpJperM3.toFixed(0), unit: 'J/m³' },
            { label: 'SFP-status', value: vgv.sfpOk ? `OK (≤ ${SFP_LIMIT})` : `Over grænse (> ${SFP_LIMIT})` },
            { label: 'Ventilator-elforbrug', value: vgv.annualFanElectricityKwh.toFixed(0), unit: 'kWh/år' },
            { label: 'Ventilator-eldrift', value: vgv.annualFanCostDKK.toFixed(0), unit: 'kr/år' },
          ]
        : []),
    ],
    formula: 'Q [m³/h] = V [m³] × ACH [gange/t]\nq [L/s] = Q / 3,6\nDimensionerende = max(Q, BR18 min.)',
    standardsStruktureret: [
      { code: 'BR18', clause: '§425–§445', note: 'Ventilationskrav for boliger og erhverv' },
      { code: 'DS 447', note: 'Ventilationsanlæg og kanaldimensionering' },
    ],
    safetyDisclaimer:
      'Ventilationsberegninger er vejledende. Ventilationsanlæg skal projekteres og installeres i overensstemmelse med BR18 §425–§445 og DS 447. Kontakt en autoriseret ventilationsentreprenør.',
  }), [mode, config, volume, capacity, capacityLps, efficiency, fanPowerW, deltaT, operatingHours, elPrice, vgv]);

  return (
    <CalculatorPage
      title="Udsugningsventilator Beregner"
      helpContent={helpContent}
      modeToggle={<CalculatorModeToggle toolId="exhaust-fan" onChange={handleModeChange} />}
      stickyResult={
        mode === 'advanced'
          ? (vgv.annualHeatRecoveredKwh > 0 ? <>{Math.round(vgv.annualHeatRecoveredKwh)} kWh/år</> : undefined)
          : (capacity > 0 ? <>{Math.round(capacity)} m³/h</> : undefined)
      }
      reportData={reportData}
    >
      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* ── Input column (room data + optional VGV) ─────────────────── */}
        <div className="space-y-6">
        {/* ── Room input card ─────────────────────────────────────────── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
            Indtast Rumdata
          </h3>

          <InputField
            label="Rumvolumen"
            value={volume}
            onChange={e => setVolume(e.target.value)}
            unit="m³"
            info="Rummets indhold i kubikmeter (Længde × Bredde × Højde)."
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
              Rumtype
            </label>
            {mode === 'basic' ? (
              <SegmentedControl
                options={[
                  { label: 'Badeværelse', value: 'badeværelse' },
                  { label: 'Køkken',      value: 'køkken'      },
                  { label: 'Andet',       value: 'andet'        },
                ]}
                value={roomType}
                onChange={v => setRoomType(v as RoomType)}
              />
            ) : (
              // Advanced: full room type grid
              <div className="grid grid-cols-2 gap-2">
                {ROOM_TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRoomType(opt.value as RoomType)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors leading-snug ${
                      roomType === opt.value
                        ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
                        : 'bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary border-border dark:border-border-dark-strong hover:border-brand-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-text-secondary dark:text-text-dark-secondary pl-1 leading-snug">
              {config.br18Note}
            </p>
          </div>

          {/* Advanced: show ACH factor used */}
          {mode === 'advanced' && (
            <div className="pt-2 border-t border-border dark:border-border-dark">
              <div className="flex justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
                <span>Luftskifte for {config.label}</span>
                <span className="font-mono font-semibold">{config.ach} ACH</span>
              </div>
              {config.br18MinLps > 0 && (
                <div className="flex justify-between text-xs text-warning-strong dark:text-warning mt-1">
                  <span>BR18 absolut minimum</span>
                  <span className="font-mono font-semibold">{config.br18MinLps} L/s = {br18MinM3h.toFixed(0)} m³/h</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold text-text-primary dark:text-text-dark-primary mt-1 pt-1 border-t border-border dark:border-border-dark">
                <span>Dimensionerende kapacitet</span>
                <span className="font-mono">{capacity.toFixed(0)} m³/h ({capacityLps.toFixed(1)} L/s)</span>
              </div>
            </div>
          )}
        </div>

        {/* ── VGV (varmegenvinding) input card — Advanced only ─────────── */}
        {mode === 'advanced' && (
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
            <div className="flex items-center gap-1">
              <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">
                Varmegenvinding (VGV)
              </h3>
              <InfoHint
                title="Varmegenvinding (VGV)"
                description="Et balanceret anlæg med varmeveksler genvinder varme fra den varme fraluft og overfører den til den kolde tilluft. Det reducerer varmetabet fra ventilationen markant sammenlignet med ren udsugning."
                calculation="Genvundet effekt = η · flow · ρcp · ΔT   (ρcp ≈ 1200 J/m³·K)"
              />
            </div>
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mt-1">
              Balanceret til-/fraluft med varmeveksler. Beregner genvundet varme, SFP og årlig eldrift.
            </p>

            <div>
              <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                Varmeveksler-virkningsgrad η
                <InfoHint
                  title="Temperaturvirkningsgrad η"
                  description="Hvor stor en del af temperaturforskellen veksleren overfører fra fraluft til tilluft. Moderne modstrømsvekslere ligger på 0,80–0,90; ældre krydsvekslere lavere."
                  calculation="η = (T_tilluft − T_ude) / (T_inde − T_ude)"
                />
              </label>
              <select
                aria-label="Varmeveksler-virkningsgrad"
                value={efficiency}
                onChange={e => setEfficiency(e.target.value)}
                className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
              >
                {EFFICIENCY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <InputField
              label="Samlet ventilatoreffekt (til + fra)"
              value={fanPowerW}
              onChange={e => setFanPowerW(e.target.value)}
              unit="W"
              info="Det samlede elforbrug for både tilluft- og fraluftsventilator. Bruges til SFP og årlig eldrift."
            />

            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Middel ΔT (fyringssæson)"
                value={deltaT}
                onChange={e => setDeltaT(e.target.value)}
                unit="K"
                info="Gennemsnitlig temperaturforskel inde–ude over fyringssæsonen. Typisk ca. 12 K i Danmark."
              />
              <InputField
                label="Driftstimer"
                value={operatingHours}
                onChange={e => setOperatingHours(e.target.value)}
                unit="t/år"
                info="Antal driftstimer pr. år. Kontinuerlig drift ≈ 8760 t/år."
              />
            </div>

            <InputField
              label="Elpris"
              value={elPrice}
              onChange={e => setElPrice(e.target.value)}
              unit="kr/kWh"
              info="Elpris til beregning af ventilatorernes årlige driftsomkostning."
            />

            <div className="pt-2 border-t border-border dark:border-border-dark">
              <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
                <span className="flex items-center gap-1">
                  Luftmængde (tilluft/fraluft)
                  <InfoHint
                    title="Luftmængde"
                    description="VGV-beregningen genbruger den dimensionerende kapacitet fra rumdata ovenfor som den balancerede til-/fraluftsmængde."
                    calculation="flow = dimensionerende kapacitet [m³/h]"
                  />
                </span>
                <span className="font-mono font-semibold text-text-primary dark:text-text-dark-primary">{capacity.toFixed(0)} m³/h</span>
              </div>
              <p className="text-[11px] text-text-tertiary dark:text-text-dark-tertiary mt-1 leading-snug">
                Genbruger den beregnede kapacitet fra rumdata ovenfor.
              </p>
            </div>
          </div>
        )}
        </div>

        {/* ── Result column ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Basic mode: room-based exhaust sizing (unchanged) */}
          {mode === 'basic' && (<>
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <ResultDisplay
              label="Anbefalet Kapacitet"
              value={capacity}
              precision={0}
              unit={<>m<sup>3</sup>/h</>}
            />

            {/* ComplianceMeter: actual capacity vs BR18 minimum */}
            {config.br18MinLps > 0 && capacity > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Kapacitet vs. BR18 minimum ({config.br18MinLps} L/s)
                </p>
                <ComplianceMeter
                  label="Ventilatorkapacitet"
                  value={capacityLps}
                  limit={config.br18MinLps * 2}
                  max={Math.max(capacityLps * 1.5, config.br18MinLps * 3, 30)}
                  unit=" L/s"
                  decimalPlaces={1}
                />
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                  {capacityLps >= config.br18MinLps
                    ? `✓ ${capacityLps.toFixed(1)} L/s opfylder BR18-kravet (min. ${config.br18MinLps} L/s).`
                    : `⚠ Kapacitet er under BR18 absolutminimum på ${config.br18MinLps} L/s.`}
                </p>
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="p-4 bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark rounded-xl text-sm text-text-secondary dark:text-text-dark-secondary">
            <h4 className="font-bold text-sm text-text-primary dark:text-text-dark-primary mb-1">Info</h4>
            <p className="text-xs leading-relaxed">
              Beregningen er baseret på anbefalede luftskiftehastigheder (ACH) for rumtypen samt BR18
              absolutte minimumskrav. Vælg en ventilator med kapacitet lig med eller højere end det
              beregnede resultat. Husk at medregne kanaltab ved lange kanalsystemer.
            </p>
          </div>
          </>)}

          {/* Advanced mode: balanced ventilation with heat recovery (VGV) */}
          {mode === 'advanced' && (<>
            {/* SFP verdict */}
            <div className={`p-5 rounded-card border-l-4 shadow-sm ${vgv.sfpOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
              <div className="flex items-start gap-3">
                {vgv.sfpOk
                  ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                  : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <h4 className={`font-bold ${vgv.sfpOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      SFP {vgv.sfpJperM3.toFixed(0)} J/m³
                    </h4>
                    <InfoHint
                      title="Specifikt ventilatoreffektforbrug (SFP)"
                      description="SFP er ventilatorernes elforbrug pr. transporteret luftmængde. Lav SFP = energieffektivt anlæg. BR18 anbefaler ca. 1800 J/m³ for balancerede anlæg med varmegenvinding."
                      calculation="SFP = ventilatoreffekt / luftmængde   [J/m³ = W / (m³/s)]"
                    />
                  </div>
                  <p className={`text-sm mt-0.5 ${vgv.sfpOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                    {vgv.sfpOk
                      ? `Anlægget overholder BR18-vejledningen (≤ ${SFP_LIMIT} J/m³).`
                      : `SFP overskrider BR18-vejledningen på ${SFP_LIMIT} J/m³. Vælg mere effektive ventilatorer eller øg luftmængden.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Emphasised: annual heating energy saved by the heat exchanger */}
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
                  Årlig genvundet varme (sparet opvarmning)
                </p>
                <InfoHint
                  title="Årlig genvundet varme"
                  description="Den mængde opvarmningsenergi varmeveksleren sparer på et år ved at genbruge varmen fra fraluften. Jo højere virkningsgrad, luftmængde og ΔT, jo mere spares."
                  calculation="Genvundet varme = η · flow · ρcp · ΔT · driftstimer"
                />
              </div>
              <ResultDisplay
                label="Genvundet varmeenergi"
                value={vgv.annualHeatRecoveredKwh}
                precision={0}
                unit="kWh/år"
              />
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-2">
                Genvundet varmeeffekt: {vgv.recoveredPowerW.toFixed(0)} W ved η {(numOr(efficiency, 0.85) * 100).toFixed(0)}% og ΔT {numOr(deltaT, 12)} K.
              </p>
            </div>

            {/* SFP compliance meter vs BR18 guidance */}
            <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
              <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                SFP vs. BR18-vejledning ({SFP_LIMIT} J/m³)
              </p>
              <ComplianceMeter
                label="SFP"
                value={vgv.sfpJperM3}
                limit={SFP_LIMIT}
                min={0}
                max={Math.max(vgv.sfpJperM3 * 1.2, SFP_LIMIT * 2)}
                unit=" J/m³"
                decimalPlaces={0}
              />
            </div>

            {/* Fan running energy + cost */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                <ResultDisplay
                  label="Ventilator-elforbrug"
                  value={vgv.annualFanElectricityKwh}
                  precision={0}
                  unit="kWh/år"
                />
              </div>
              <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                <ResultDisplay
                  label="Ventilator-eldrift"
                  value={vgv.annualFanCostDKK}
                  precision={0}
                  unit="kr/år"
                />
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark rounded-xl text-sm text-text-secondary dark:text-text-dark-secondary">
              <h4 className="font-bold text-sm text-text-primary dark:text-text-dark-primary mb-1">Om VGV</h4>
              <p className="text-xs leading-relaxed">
                Varmegenvinding (VGV) genbruger varmen fra den udsugede luft og reducerer varmetabet fra
                ventilationen. Den genvundne varme afhænger af veksler-virkningsgraden η, luftmængden og
                temperaturforskellen inde–ude. Hold SFP lav for et energieffektivt anlæg.
              </p>
            </div>
          </>)}
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

export default ExhaustFanCalculator;
