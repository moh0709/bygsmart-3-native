import React, { useState, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import SegmentedControl from '../../components/SegmentedControl';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import type { HelpContent } from '../../components/HelpDrawer';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';
import { computeHeatPumpSizing } from '../../catalog';

type InsulationLevel = 'god' | 'middel' | 'dårlig';

// W/m² by insulation (rule-of-thumb basis)
const BASE_W_M2: Record<InsulationLevel, number> = {
  god:    50,
  middel: 75,
  dårlig: 100,
};

// DS 418 transmission heat loss coefficients (W/m²·K) — simplified
const U_WALL:    Record<InsulationLevel, number> = { god: 0.15, middel: 0.25, dårlig: 0.40 };
const U_ROOF:    Record<InsulationLevel, number> = { god: 0.10, middel: 0.15, dårlig: 0.25 };
const U_FLOOR:   Record<InsulationLevel, number> = { god: 0.10, middel: 0.20, dårlig: 0.30 };
const U_WINDOWS: Record<InsulationLevel, number> = { god: 0.80, middel: 1.40, dårlig: 2.80 };

// Infiltration factor (n50 air change) in h⁻¹
const INFILTRATION_ACH: Record<InsulationLevel, number> = { god: 0.5, middel: 1.0, dårlig: 2.0 };

const DESIGN_OUTDOOR_TEMP = -12; // °C (Danish design winter, DS 418)
const DESIGN_INDOOR_TEMP  =  20; // °C
const RHO_CP_AIR = 0.34; // Wh/m³·K (ρ × cp for air)

// ── Heat-pump capability ─────────────────────────────────────────────────────
type Capability = 'kedel' | 'varmepumpe';

type HeatPumpTypeKey = 'luft-vand' | 'luft-luft' | 'jordvarme';
const HEAT_PUMP_TYPES: Record<HeatPumpTypeKey, { label: string; scop: number }> = {
  'luft-vand': { label: 'Luft-til-vand', scop: 3.2 },
  'luft-luft': { label: 'Luft-til-luft', scop: 3.5 },
  'jordvarme': { label: 'Jordvarme (væske-vand)', scop: 4.2 },
};

type OldFuelKey = 'ingen' | 'olie' | 'gas' | 'el';
// CO₂ intensity of the delivered heat from the old source [kg CO₂/kWh varme]
const OLD_FUELS: Record<OldFuelKey, { label: string; co2: number | undefined }> = {
  'ingen': { label: 'Ingen sammenligning', co2: undefined },
  'olie':  { label: 'Oliefyr',              co2: 0.27 },
  'gas':   { label: 'Naturgasfyr',          co2: 0.20 },
  'el':    { label: 'Elvarme (direkte)',    co2: 0.12 },
};

const FULL_LOAD_HOURS = 2000; // DK single-family rule-of-thumb (varmebehov ≈ designeffekt × timer)
const GRID_CO2_KG_PER_KWH = 0.12; // DK el-net (kg CO₂/kWh)

const daNum = (n: number): string => Math.round(n).toLocaleString('da-DK');

const HELP: HelpContent = {
  formaal:
    'Estimerer nødvendig kedelkapacitet (kW) til rumopvarmning baseret på arealets varmetab. ' +
    'Basis-tilstand anvender tommelfingerregel (W/m²). ' +
    'Avanceret tilstand beregner transmissions- og infiltrationstab jf. DS 418. ' +
    'Varmepumpe-tilstand dimensionerer en varmepumpe efter det samme varmetab og ' +
    'beregner årligt elforbrug, driftsomkostning samt besparelse/CO₂ vs. den nuværende varmekilde.',
  variabler: [
    { name: 'Opvarmet areal',    symbol: 'A',    unit: 'm²',    description: 'Nettoareal der skal opvarmes.' },
    { name: 'Loftshøjde',        symbol: 'h',    unit: 'm',     description: 'Gennemsnitlig rumhøjde (avanceret).' },
    { name: 'Vindueareal',       symbol: 'A_w',  unit: 'm²',    description: 'Samlet vindueareal (avanceret).' },
    { name: 'U-ydervæg',         symbol: 'U_vg', unit: 'W/m²K', description: 'Varmetransmissionskoefficient for ydervæg (DS 418).' },
    { name: 'Årsvarmefaktor',    symbol: 'SCOP', unit: '–',     description: 'Sæson-COP for varmepumpen: afgivet varme / forbrugt el over året.' },
    { name: 'Årligt varmebehov', symbol: 'Q_år', unit: 'kWh',   description: 'Årlig varmeenergi til opvarmning (evt. + varmt brugsvand).' },
  ],
  formel:
    'Basis:\n  P [kW] = A × w [W/m²] / 1000\n\n' +
    'Avanceret (DS 418):\n' +
    '  ΔT = T_inde − T_ude\n' +
    '  Q_trans = (U_vg·A_vg + U_loft·A_loft + U_gulv·A_gulv + U_vindue·A_vindue) × ΔT\n' +
    '  Q_inf   = n50 × V × ρCp × ΔT\n' +
    '  P_total = (Q_trans + Q_inf) / 1000  [kW]\n\n' +
    'Varmepumpe:\n' +
    '  Kapacitet [kW] = dimensionerende varmetab\n' +
    '  Elforbrug [kWh/år] = Q_år / SCOP\n' +
    '  Driftsomkostning [kr/år] = Elforbrug × elpris',
  antagelser:
    'Beregningen forudsætter enfamiliehus med simple geometri. ' +
    'Varmelagring, solindstråling og indre varmekilder er ikke medregnet. ' +
    'U-værdier er vejledende gns. for isoleringsklassen. ' +
    'SCOP, varmebehov og priser er vejledende og varierer med klima, anlæg og brug.',
  standarder:
    'DS 418 – Varmetabsberegning for bygninger\n' +
    'DS 439 – Vandinstallationer\n' +
    'DS 469 – Varme- og køleanlæg\n' +
    'EN 14825 – SCOP, sæsonvarmefaktor for varmepumper',
  disclaimer: (
    <span>
      VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
      Beregninger er vejledende og erstatter ikke et installationsprojekt.
    </span>
  ),
};

const BoilerSizingCalculator: React.FC = () => {
  const [capability, setCapability] = useState<Capability>('kedel');
  const [mode, setMode] = useState<CalcMode>('basic');
  const [area, setArea]           = useState('150');
  const [insulation, setInsulation] = useState<InsulationLevel>('middel');

  // Advanced fields
  const [ceilingHeight, setCeilingHeight] = useState('2.5');
  const [windowArea, setWindowArea]       = useState('20');
  const [wallArea, setWallArea]           = useState('80');

  // Heat-pump fields
  const [hpType, setHpType]                     = useState<HeatPumpTypeKey>('luft-vand');
  const [hpDesignLoadOverride, setHpDesignLoadOverride] = useState('');
  const [hpDemandOverride, setHpDemandOverride] = useState('');
  const [hpElPrice, setHpElPrice]               = useState('2.5');
  const [hpOldFuel, setHpOldFuel]               = useState<OldFuelKey>('ingen');
  const [hpOldCost, setHpOldCost]               = useState('18000');

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const areaM2    = parseFloat(area)          || 0;
  const heightM   = parseFloat(ceilingHeight) || 2.5;
  const windowM2  = parseFloat(windowArea)    || 0;
  const wallM2    = parseFloat(wallArea)      || 0;
  const roofM2    = areaM2;
  const floorM2   = areaM2;
  const deltaT    = DESIGN_INDOOR_TEMP - DESIGN_OUTDOOR_TEMP;

  // Basic
  const basicKw = (areaM2 * BASE_W_M2[insulation]) / 1000;

  // Advanced DS 418
  const qTrans =
    U_WALL[insulation]    * wallM2   * deltaT +
    U_ROOF[insulation]    * roofM2   * deltaT +
    U_FLOOR[insulation]   * floorM2  * deltaT +
    U_WINDOWS[insulation] * windowM2 * deltaT;

  const volume = areaM2 * heightM;
  const qInf   = INFILTRATION_ACH[insulation] * volume * RHO_CP_AIR * deltaT;

  const advancedKw = (qTrans + qInf) / 1000;

  // Building design heat load [kW] — reused as the heat-pump sizing basis.
  const capacity = mode === 'advanced' ? advancedKw : basicKw;

  // ── Heat-pump derived inputs ───────────────────────────────────────────────
  const scop = HEAT_PUMP_TYPES[hpType].scop;
  const oldFuel = OLD_FUELS[hpOldFuel];
  const compareFuelSelected = hpOldFuel !== 'ingen';
  const oldCostNum = parseFloat(hpOldCost) || 0;
  const hasCostComparison = compareFuelSelected && oldCostNum > 0;

  // Design load: pre-filled from the boiler calc above, but editable.
  const hpDesignLoadKW = hpDesignLoadOverride.trim() !== ''
    ? (parseFloat(hpDesignLoadOverride) || 0)
    : capacity;

  // Annual heat demand: estimate = design load × full-load hours, editable.
  const estimatedDemandKwh = Math.max(0, Math.round(hpDesignLoadKW * FULL_LOAD_HOURS));
  const hpAnnualDemandKwh = hpDemandOverride.trim() !== ''
    ? (parseFloat(hpDemandOverride) || 0)
    : estimatedDemandKwh;

  const hp = useMemo(() => computeHeatPumpSizing({
    designHeatLoadKW: hpDesignLoadKW,
    annualHeatDemandKwh: hpAnnualDemandKwh,
    scop,
    electricityPriceDKK: parseFloat(hpElPrice) || 0,
    oldAnnualHeatingCostDKK: hasCostComparison ? oldCostNum : undefined,
    gridCo2KgPerKwh: GRID_CO2_KG_PER_KWH,
    oldHeatCo2KgPerKwh: compareFuelSelected ? oldFuel.co2 : undefined,
  }), [hpDesignLoadKW, hpAnnualDemandKwh, scop, hpElPrice, hasCostComparison, oldCostNum, compareFuelSelected, oldFuel.co2]);

  const savings = hp.annualSavingsDKK ?? 0;
  const savingsPositive = savings > 0;
  const costBarMax = Math.max(oldCostNum, hp.annualElectricityCostDKK, 1);

  const reportData = useMemo<CalculatorReportData>(() => {
    if (capability === 'varmepumpe') {
      const inputs: CalculatorReportData['inputs'] = [
        { label: 'Varmepumpetype', value: HEAT_PUMP_TYPES[hpType].label },
        { label: 'Årsvarmefaktor (SCOP)', value: scop.toFixed(1) },
        { label: 'Dimensionerende varmetab', value: hpDesignLoadKW.toFixed(1), unit: 'kW' },
        { label: 'Årligt varmebehov', value: String(Math.round(hpAnnualDemandKwh)), unit: 'kWh' },
        { label: 'Elpris', value: (parseFloat(hpElPrice) || 0).toFixed(2), unit: 'kr/kWh' },
        ...(compareFuelSelected ? [{ label: 'Nuværende varmekilde', value: oldFuel.label }] : []),
        ...(hasCostComparison ? [{ label: 'Nuværende årlig varmeudgift', value: String(Math.round(oldCostNum)), unit: 'kr' }] : []),
      ];
      const results: CalculatorReportData['results'] = [
        { label: 'Anbefalet varmepumpe-kapacitet', value: hp.recommendedCapacityKW.toFixed(1), unit: 'kW', highlight: true },
        { label: 'Årligt elforbrug', value: String(Math.round(hp.annualElectricityKwh)), unit: 'kWh' },
        { label: 'Årlig elomkostning', value: String(Math.round(hp.annualElectricityCostDKK)), unit: 'kr' },
        ...(hp.annualSavingsDKK !== undefined ? [{ label: 'Årlig besparelse', value: String(Math.round(hp.annualSavingsDKK)), unit: 'kr' }] : []),
        ...(hp.annualCo2ReductionKg !== undefined ? [{ label: 'Årlig CO₂-reduktion', value: String(Math.round(hp.annualCo2ReductionKg)), unit: 'kg' }] : []),
      ];
      return {
        toolName: 'Varmepumpe (COP & drift)',
        category: 'VVS',
        mode: 'Varmepumpe',
        inputs,
        results,
        formula: 'Kapacitet [kW] = dimensionerende varmetab; Elforbrug [kWh/år] = Q_år / SCOP; Drift [kr/år] = Elforbrug × elpris',
        standardsStruktureret: [
          { code: 'DS 469', note: 'Varme- og køleanlæg' },
          { code: 'EN 14825', note: 'SCOP – sæsonvarmefaktor for varmepumper' },
        ],
        safetyDisclaimer:
          'Varmepumpeberegninger er vejledende. SCOP, varmebehov og energipriser varierer. ' +
          'Endelig dimensionering og valg af anlæg skal foretages af en autoriseret VVS-installatør / energirådgiver.',
      };
    }

    const inputs: CalculatorReportData['inputs'] = [
      { label: 'Opvarmet areal', value: areaM2.toFixed(1), unit: 'm²' },
      { label: 'Isoleringsstandard', value: insulation },
    ];
    if (mode === 'advanced') {
      inputs.push(
        { label: 'Loftshøjde', value: heightM.toFixed(2), unit: 'm' },
        { label: 'Ydervægareal (eks. vinduer)', value: wallM2.toFixed(1), unit: 'm²' },
        { label: 'Samlet vindueareal', value: windowM2.toFixed(1), unit: 'm²' },
      );
    }

    const results: CalculatorReportData['results'] = [
      { label: 'Anbefalet kedelkapacitet', value: capacity.toFixed(2), unit: 'kW', highlight: true },
    ];

    const breakdown: CalculatorReportData['breakdown'] = mode === 'advanced'
      ? [
          { label: 'Transmissionstab', value: (qTrans / 1000).toFixed(2), unit: 'kW' },
          { label: 'Infiltrationstab', value: (qInf / 1000).toFixed(2), unit: 'kW' },
        ]
      : undefined;

    return {
      toolName: 'Kedel Dimensionering',
      category: 'VVS',
      mode,
      inputs,
      results,
      breakdown,
      formula: mode === 'advanced'
        ? 'P [kW] = (Q_trans + Q_inf) / 1000; Q_trans = Σ(U·A)·ΔT; Q_inf = n50·V·ρCp·ΔT'
        : 'P [kW] = A × w [W/m²] / 1000',
      standardsStruktureret: [
        { code: 'DS 418', note: 'Varmetabsberegning for bygninger' },
        { code: 'DS 439', note: 'Vandinstallationer' },
        { code: 'DS 469', note: 'Varme- og køleanlæg' },
      ],
      safetyDisclaimer:
        'VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør. ' +
        'Beregninger er vejledende og erstatter ikke et installationsprojekt.',
    };
  }, [
    capability, mode, areaM2, insulation, heightM, wallM2, windowM2, capacity, qTrans, qInf,
    hpType, scop, hpDesignLoadKW, hpAnnualDemandKwh, hpElPrice, compareFuelSelected, hasCostComparison,
    oldFuel.label, oldCostNum, hp,
  ]);

  return (
    <CalculatorPage
      title="Kedelstørrelse Beregner"
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        capability === 'kedel'
          ? <CalculatorModeToggle toolId="boiler-sizing" onChange={handleModeChange} />
          : undefined
      }
    >
      <div className="space-y-6">
        {/* Capability switch: boiler sizing vs. heat-pump running cost */}
        <div>
          <SegmentedControl
            options={[
              { label: 'Kedel',      value: 'kedel' },
              { label: 'Varmepumpe', value: 'varmepumpe' },
            ]}
            value={capability}
            onChange={v => setCapability(v as Capability)}
          />
        </div>

        {capability === 'kedel' && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* Inputs */}
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
              <h3 className="font-bold text-lg">Bygningsdata</h3>
              {mode === 'basic' && (
                <p className="text-sm text-text-secondary -mt-1">Giver et groft estimat baseret på tommelfingerregel (W/m²).</p>
              )}
              {mode === 'advanced' && (
                <p className="text-sm text-text-secondary -mt-1">Beregner transmission + infiltrationstab jf. DS 418.</p>
              )}

              <InputField
                label="Opvarmet areal"
                value={area}
                onChange={e => setArea(e.target.value)}
                unit="m²"
                info="Samlet nettoareal der skal opvarmes."
              />

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
                  <InputField
                    label="Loftshøjde"
                    value={ceilingHeight}
                    onChange={e => setCeilingHeight(e.target.value)}
                    unit="m"
                    info="Gennemsnitlig fri rumhøjde fra gulv til loft."
                  />
                  <InputField
                    label="Ydervægareal (eks. vinduer)"
                    value={wallArea}
                    onChange={e => setWallArea(e.target.value)}
                    unit="m²"
                    info="Samlet areal af ydervægge eksklusiv vinduernes areal."
                  />
                  <InputField
                    label="Samlet vindueareal"
                    value={windowArea}
                    onChange={e => setWindowArea(e.target.value)}
                    unit="m²"
                    info="Samlet glasareal for alle vinduer og glasdøre."
                  />
                  <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg text-xs text-text-secondary space-y-1">
                    <p className="font-semibold">DS 418 designdata ({insulation} isolering)</p>
                    <p>U-ydervæg: {U_WALL[insulation]} W/m²K · U-loft: {U_ROOF[insulation]} W/m²K</p>
                    <p>U-gulv: {U_FLOOR[insulation]} W/m²K · U-vindue: {U_WINDOWS[insulation]} W/m²K</p>
                    <p>Infiltration n₅₀: {INFILTRATION_ACH[insulation]} h⁻¹ · ΔT: {deltaT} K</p>
                  </div>
                </>
              )}
            </div>

            {/* Results */}
            <div className="space-y-4">
              <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                <h3 className="font-bold text-lg mb-4">Resultat</h3>
                <ResultDisplay label="Anbefalet kedelkapacitet" value={capacity} unit="kW" />

                {mode === 'advanced' && (
                  <div className="mt-6 pt-4 border-t border-border dark:border-border-dark space-y-3">
                    <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Fordeling (DS 418)</h4>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                        <p className="text-xs text-text-secondary">Transmission</p>
                        <p className="text-lg font-bold text-text-primary">{(qTrans / 1000).toFixed(2)}</p>
                        <p className="text-xs text-text-secondary">kW</p>
                      </div>
                      <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                        <p className="text-xs text-text-secondary">Infiltration</p>
                        <p className="text-lg font-bold text-text-primary">{(qInf / 1000).toFixed(2)}</p>
                        <p className="text-xs text-text-secondary">kW</p>
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Designtemperaturer: inde {DESIGN_INDOOR_TEMP} °C / ude {DESIGN_OUTDOOR_TEMP} °C (DS 418, DK)
                    </p>
                  </div>
                )}

                <div className="mt-6 p-3 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-lg text-sm text-warning-strong dark:text-warning">
                  <strong>Bemærk:</strong> Tillæg 20–25 % til beregnet effekt for brugsvand og systemtab.
                  {mode === 'basic' && ' Brug avanceret tilstand for DS 418-baseret beregning.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {capability === 'varmepumpe' && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            {/* ── Inputs ── */}
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
              <h3 className="font-bold text-lg">Varmepumpe-data</h3>
              <p className="text-sm text-text-secondary -mt-1">Dimensionerer varmepumpen efter varmetabet og beregner elforbrug, drift og besparelse.</p>

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Varmepumpetype (SCOP)
                  <InfoHint
                    title="Årsvarmefaktor (SCOP)"
                    description="SCOP = Seasonal Coefficient of Performance, dvs. årsvarmefaktoren: hvor meget varme anlægget afgiver pr. kWh el over en hel fyringssæson (varme ud / el ind). Højere SCOP = lavere elforbrug. Jordvarme ligger typisk højere end luft-til-vand."
                    calculation="SCOP = afgivet varme [kWh] / forbrugt el [kWh]"
                  />
                </label>
                <select
                  aria-label="Varmepumpetype"
                  value={hpType}
                  onChange={e => setHpType(e.target.value as HeatPumpTypeKey)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                >
                  {(Object.keys(HEAT_PUMP_TYPES) as HeatPumpTypeKey[]).map(k => (
                    <option key={k} value={k}>{HEAT_PUMP_TYPES[k].label} (SCOP {HEAT_PUMP_TYPES[k].scop.toFixed(1)})</option>
                  ))}
                </select>
              </div>

              <InputField
                label="Dimensionerende varmetab (designeffekt)"
                value={hpDesignLoadOverride === '' ? capacity.toFixed(1) : hpDesignLoadOverride}
                onChange={e => setHpDesignLoadOverride(e.target.value)}
                unit="kW"
                info="Bygningens dimensionerende varmetab. Forudfyldt fra kedelberegningen — kan overskrives."
                hint={hpDesignLoadOverride === '' ? `Forudfyldt fra beregningen (${capacity.toFixed(1)} kW).` : undefined}
              />

              <InputField
                label="Årligt varmebehov"
                value={hpDemandOverride === '' ? String(estimatedDemandKwh) : hpDemandOverride}
                onChange={e => setHpDemandOverride(e.target.value)}
                unit="kWh/år"
                info="Årlig varmeenergi til rumopvarmning (evt. inkl. varmt brugsvand)."
                hint={hpDemandOverride === '' ? `Estimat: designeffekt × ${FULL_LOAD_HOURS} fuldlasttimer.` : undefined}
              />

              <InputField
                label="Elpris (inkl. afgifter)"
                value={hpElPrice}
                onChange={e => setHpElPrice(e.target.value)}
                unit="kr/kWh"
                info="Samlet elpris inkl. afgifter, tariffer og moms."
              />

              <div>
                <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Nuværende varmekilde (til sammenligning)
                </label>
                <select
                  aria-label="Nuværende varmekilde"
                  value={hpOldFuel}
                  onChange={e => setHpOldFuel(e.target.value as OldFuelKey)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-white dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
                >
                  {(Object.keys(OLD_FUELS) as OldFuelKey[]).map(k => (
                    <option key={k} value={k}>{OLD_FUELS[k].label}</option>
                  ))}
                </select>
              </div>

              {compareFuelSelected && (
                <InputField
                  label="Nuværende årlig varmeudgift"
                  value={hpOldCost}
                  onChange={e => setHpOldCost(e.target.value)}
                  unit="kr/år"
                  info="Din nuværende samlede årlige udgift til opvarmning — bruges til at beregne besparelsen."
                />
              )}
            </div>

            {/* ── Results ── */}
            <div className="space-y-4">
              {/* Savings verdict (only when a cost comparison is available) */}
              {hp.annualSavingsDKK !== undefined && (
                <div className={`p-5 rounded-card border-l-4 shadow-sm ${savingsPositive ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-warning-subtle dark:bg-warning-subtle-dark border-warning-border dark:border-warning/30'}`}>
                  <div className="flex items-start gap-3">
                    {savingsPositive
                      ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                      : <AlertTriangleIcon className="w-6 h-6 text-warning flex-shrink-0" />}
                    <div className="flex-1">
                      <h4 className={`font-bold ${savingsPositive ? 'text-success-strong dark:text-success' : 'text-warning-strong dark:text-warning'}`}>
                        {savingsPositive ? `Årlig besparelse ${daNum(savings)} kr` : 'Ingen driftsbesparelse'}
                      </h4>
                      <p className={`text-sm mt-0.5 ${savingsPositive ? 'text-success-strong dark:text-success' : 'text-warning-strong dark:text-warning'}`}>
                        {savingsPositive
                          ? `Varmepumpen er billigere i drift end ${oldFuel.label.toLowerCase()}.${hp.annualCo2ReductionKg !== undefined ? ` CO₂-udledningen reduceres med ca. ${daNum(hp.annualCo2ReductionKg)} kg/år.` : ''}`
                          : 'Med de indtastede priser er varmepumpen ikke billigere i drift. Kontrollér elpris, SCOP og den nuværende varmeudgift.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
                <div className="flex items-center gap-1 mb-4">
                  <h3 className="font-bold text-lg">Varmepumpe-resultat</h3>
                  <InfoHint
                    title="Dimensionering til varmetab"
                    description="Varmepumpen dimensioneres efter bygningens dimensionerende varmetab (designeffekt). Ved meget lave udetemperaturer eller stort behov for varmt brugsvand kan der være behov for supplerende varme (elpatron/backup) eller en større enhed."
                    calculation="Anbefalet kapacitet [kW] = dimensionerende varmetab"
                  />
                </div>

                <ResultDisplay label="Anbefalet varmepumpe-kapacitet" value={hp.recommendedCapacityKW} precision={1} unit="kW" />

                <div className="mt-6 pt-4 border-t border-border dark:border-border-dark space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                      <div className="flex items-center justify-center gap-1">
                        <p className="text-xs text-text-secondary">Årligt elforbrug</p>
                        <InfoHint
                          title="Årligt elforbrug"
                          description="Varmepumpens elforbrug findes ved at dividere det årlige varmebehov med årsvarmefaktoren (SCOP). En højere SCOP giver et lavere elforbrug for samme varmemængde."
                          calculation="Elforbrug [kWh/år] = varmebehov / SCOP"
                        />
                      </div>
                      <p className="text-lg font-bold text-text-primary">{daNum(hp.annualElectricityKwh)}</p>
                      <p className="text-xs text-text-secondary">kWh/år</p>
                    </div>
                    <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                      <p className="text-xs text-text-secondary">Årlig elomkostning</p>
                      <p className="text-lg font-bold text-text-primary">{daNum(hp.annualElectricityCostDKK)}</p>
                      <p className="text-xs text-text-secondary">kr/år</p>
                    </div>
                  </div>

                  {(hp.annualSavingsDKK !== undefined || hp.annualCo2ReductionKg !== undefined) && (
                    <div className="grid grid-cols-2 gap-3 text-center">
                      {hp.annualSavingsDKK !== undefined && (
                        <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                          <p className="text-xs text-text-secondary">Årlig besparelse</p>
                          <p className={`text-lg font-bold ${savingsPositive ? 'text-success-strong dark:text-success' : 'text-danger'}`}>{daNum(hp.annualSavingsDKK)}</p>
                          <p className="text-xs text-text-secondary">kr/år</p>
                        </div>
                      )}
                      {hp.annualCo2ReductionKg !== undefined && (
                        <div className="p-3 bg-bg-muted dark:bg-bg-dark-muted rounded-lg">
                          <p className="text-xs text-text-secondary">CO₂-reduktion</p>
                          <p className="text-lg font-bold text-success-strong dark:text-success">{daNum(hp.annualCo2ReductionKg)}</p>
                          <p className="text-xs text-text-secondary">kg/år</p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-text-secondary">
                    {HEAT_PUMP_TYPES[hpType].label} · SCOP {scop.toFixed(1)} · elpris {(parseFloat(hpElPrice) || 0).toFixed(2)} kr/kWh
                  </p>
                </div>
              </div>

              {/* Running-cost comparison bars (old vs. heat pump) */}
              {hasCostComparison && (
                <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark">
                  <h4 className="text-sm font-semibold mb-3 text-text-secondary dark:text-text-dark-secondary">Årlig driftsomkostning: nu vs. varmepumpe</h4>
                  <div className="space-y-2">
                    {[
                      { label: `Nu (${oldFuel.label})`, v: oldCostNum, color: 'bg-slate-400' },
                      { label: 'Varmepumpe', v: hp.annualElectricityCostDKK, color: savingsPositive ? 'bg-success' : 'bg-danger' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 text-xs text-text-secondary dark:text-text-dark-secondary truncate">{row.label}</span>
                        <div className="flex-1 h-4 rounded-full bg-bg-muted dark:bg-bg-dark-muted overflow-hidden">
                          <div className={`h-full rounded-full ${row.color} transition-all duration-500`} style={{ width: `${Math.min(100, (row.v / costBarMax) * 100)}%` }} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs font-medium text-text-primary dark:text-text-dark-primary">{daNum(row.v)} kr</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-lg text-sm text-warning-strong dark:text-warning">
                <strong>Bemærk:</strong> SCOP, varmebehov og priser er vejledende gennemsnit. Overvej supplerende varme
                (elpatron/backup) og varmt brugsvand ved den endelige dimensionering.
              </div>
            </div>
          </div>
        )}

        <SafetyDisclaimer title="VVS-faglig vurdering kræves">
          VVS-installationer skal udføres og godkendes af en autoriseret VVS-installatør.
          Beregninger er vejledende og erstatter ikke et installationsprojekt.
          En præcis energiberegning jf. DS 418 og BR18 skal foretages af en rådgivende ingeniør
          inden kedel- eller varmepumpevalg og installation.
        </SafetyDisclaimer>
      </div>
    </CalculatorPage>
  );
};

export default BoilerSizingCalculator;
