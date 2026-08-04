import React, { useState, useMemo, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import { STANDARDS_CATALOG, computeVoltageDrop, computeCableAmpacity } from '../../catalog';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import CalculatorHero from '../../components/CalculatorHero';
import { SettingsIcon, CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const STANDARD_CABLES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

// Installation method correction factors per IEC 60364-5-52 table B.52 (simplified)
const INSTALL_METHODS: { id: string; label: string; factor: number }[] = [
  { id: 'A1', label: 'A1 – Isoleret kabel i isoleret væg', factor: 0.77 },
  { id: 'B1', label: 'B1 – Kabel i muret kanal', factor: 0.86 },
  { id: 'C',  label: 'C – Kabel på overflade',   factor: 1.0 },
  { id: 'E',  label: 'E – Kabel i fri luft (bakke)', factor: 1.12 },
  { id: 'F',  label: 'F – Kabel i jord', factor: 0.92 },
];

// Ambient-temperature correction Ca (PVC insulation, 30 °C reference) — DS/HD 60364-5-52 Tabel B.52.14
const AMBIENT_FACTORS: { id: string; label: string; factor: number }[] = [
  { id: '30', label: '30 °C (reference)', factor: 1.0 },
  { id: '35', label: '35 °C', factor: 0.94 },
  { id: '40', label: '40 °C', factor: 0.87 },
  { id: '45', label: '45 °C', factor: 0.79 },
  { id: '50', label: '50 °C', factor: 0.71 },
];

// Grouping/bundling correction Cg (samlede kredsløb, metode C berøring) — DS/HD 60364-5-52 Tabel B.52.17
const GROUPING_FACTORS: { id: string; label: string; factor: number }[] = [
  { id: '1', label: '1 kredsløb (ingen samling)', factor: 1.0 },
  { id: '2', label: '2 kredsløb samlet', factor: 0.85 },
  { id: '3', label: '3 kredsløb samlet', factor: 0.79 },
  { id: '4', label: '4 kredsløb samlet', factor: 0.75 },
  { id: '6', label: '6 kredsløb samlet', factor: 0.72 },
];

const helpContent: HelpContent = {
  formaal:
    'Beregner det mindste tilladt kabeltværsnit (mm²) for en kobberledning baseret på belastningsstrøm, ' +
    'kabellængde og maksimalt acceptabelt spændingsfald. DS/HD 60364 tillader max 4 % spændingsfald ' +
    'fra fordelingstransformer til brugsgenstand (3 % anbefalet til boliger). Avanceret tilstand tilføjer ' +
    '3-faset 400 V, lederens driftstemperatur (worst-case) samt kontrol af strømevne (In ≤ Iz) med derating.',
  variabler: [
    { name: 'Strøm',           symbol: 'I / In', unit: 'A',   description: 'Dimensionerende belastningsstrøm / beskyttelsesorganets mærkestrøm.' },
    { name: 'Kabellængde',     symbol: 'L',   unit: 'm',   description: 'Ensidig afstand fra tavle til brugsgenstand (ikke sløjfelængde).' },
    { name: 'Max spændingsfald', symbol: 'ΔU', unit: '%',  description: 'DS/HD 60364 max 4 %, 3 % anbefales for boliger.' },
    { name: 'Resistivitet Cu', symbol: 'ρ',   unit: 'Ω·mm²/m', description: '0,0175 Ω·mm²/m ved 20 °C; stiger ~20 % ved 70 °C drift.' },
    { name: 'Tværsnit',        symbol: 'A',   unit: 'mm²', description: 'Minimumsareal der opfylder spændingsfaldbetingelsen.' },
    { name: 'Deratet strømevne', symbol: 'Iz', unit: 'A', description: 'Iz = Iz,ref × Ca × Cg. Skal opfylde In ≤ Iz.' },
  ],
  formel:
    'ΔU = (ρ · k · L · I) / A          [k = 2 for 1-faset, √3 for 3-faset]\n' +
    'ρ(T) = ρ20 · (1 + α·(T − 20))     [α_Cu ≈ 0,00393/°C]\n' +
    'A_min = (ρ · k · L · I) / ΔU_tilladt ; ΔU_tilladt = U × (ΔU% / 100)\n' +
    'Iz = Iz,ref × Ca × Cg ; krav: In ≤ Iz',
  antagelser:
    'Kobberledning, cosφ = 1, kun spændingsfald er dimensionsgivende for tværsnitsvalget. Basis regner ' +
    '1-faset 230 V ved 20 °C. Avanceret understøtter 3-faset 400 V, driftstemperatur (20 °C reference / 70 °C ' +
    'worst-case for PVC) samt strømevne-derating (installationsmetode, omgivelsestemperatur, samling). ' +
    'Reaktans, kortslutningsstrøm og jordfejlsbeskyttelse indgår ikke.',
  standarder:
    'DS/HD 60364-5-52 – Kabelvalg og strømbelastningsevne (derating Ca, Cg)\n' +
    'DS/HD 60364-4-43 – Beskyttelse mod overstrøm (In ≤ Iz)\n' +
    'DS/HD 60364-4-41 – Beskyttelse mod elektrisk stød\n' +
    'DS/HD 60364 – Max. spændingsfald ≤ 4% for boliger og kontor\n' +
    'Stærkstrømsreglementet – Autoriseret installation påkrævet',
  disclaimer: (
    <span>
      Elektriske installationer <strong>SKAL</strong> udføres og godkendes af en autoriseret
      el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet. Beregninger er
      vejledende og erstatter ikke et elinstallationsprojekt.
    </span>
  ),
};

const TOOL_ID = 'el-kabel';

const CableSizingCalculator: React.FC = () => {
  const { allowed, advancedAllowed } = useToolAccess(TOOL_ID);
  const [mode, setMode] = useState<CalcMode>('basic');
  const [inputs, setInputs] = useState({ current: '16', length: '25', voltageDrop: '4' });
  const [installMethod, setInstallMethod] = useState('C');
  // Advanced-gated engineering options
  const [system, setSystem] = useState<'1' | '3'>('1');   // single- vs three-phase
  const [tempC, setTempC] = useState<'20' | '70'>('20');  // reference vs worst-case operating temp
  const [ambientId, setAmbientId] = useState('30');
  const [groupingId, setGroupingId] = useState('1');

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const isAdvanced = mode === 'advanced';

  const I = parseFloat(inputs.current) || 0;
  const L = parseFloat(inputs.length) || 0;
  const maxDropPct = parseFloat(inputs.voltageDrop) || 0;

  // ── Phase / voltage reference / conductor temperature (Advanced-gated) ──────
  const phases: 1 | 3 = isAdvanced && system === '3' ? 3 : 1;
  const voltageRef = phases === 3 ? 400 : 230;              // line-to-line 400 V for 3-phase
  const conductorTempC = isAdvanced ? Number(tempC) : 20;   // 20 °C reference / 70 °C worst-case PVC

  // Minimum theoretical cross-section from voltage drop formula.
  // computeVoltageDrop is linear in 1/crossSectionMm2, so the drop at a unit
  // (1 mm²) cross-section gives us the constant needed to solve for the area
  // that hits the allowed drop — without duplicating the shared ρ constant.
  const theoreticalArea = useMemo(() => {
    if (I > 0 && L > 0 && maxDropPct > 0) {
      const vDropAllowed = voltageRef * (maxDropPct / 100);
      const { voltageDropV: dropAtUnitArea } = computeVoltageDrop({
        currentA: I,
        lengthM: L,
        crossSectionMm2: 1,
        voltageV: voltageRef,
        conductorTempC,
        phases,
      });
      return dropAtUnitArea / vDropAllowed;
    }
    return 0;
  }, [I, L, maxDropPct, voltageRef, conductorTempC, phases]);

  const recommendedCable = STANDARD_CABLES.find(s => s >= theoreticalArea) ?? STANDARD_CABLES[STANDARD_CABLES.length - 1];

  // Actual voltage drop for the selected standard cable (shared computeVoltageDrop)
  const actualDropPct = useMemo(() => {
    if (recommendedCable > 0 && I > 0 && L > 0) {
      return computeVoltageDrop({
        currentA: I,
        lengthM: L,
        crossSectionMm2: recommendedCable,
        voltageV: voltageRef,
        conductorTempC,
        phases,
      }).voltageDropPct;
    }
    return 0;
  }, [recommendedCable, I, L, voltageRef, conductorTempC, phases]);

  const dropOk = actualDropPct <= maxDropPct;

  // ── Advanced: current-carrying capacity / derating (In ≤ Iz) ────────────────
  const methodFactor = useMemo(
    () => INSTALL_METHODS.find(m => m.id === installMethod)?.factor ?? 1.0,
    [installMethod]
  );
  const ambientFactor = useMemo(
    () => AMBIENT_FACTORS.find(a => a.id === ambientId)?.factor ?? 1.0,
    [ambientId]
  );
  const groupingFactor = useMemo(
    () => GROUPING_FACTORS.find(g => g.id === groupingId)?.factor ?? 1.0,
    [groupingId]
  );

  // Tabulated base ampacity (method-C reference, Cu). Reused for baseAmpacityA.
  const BASE_RATINGS: Record<number, number> = {
    1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85, 25: 112, 35: 138, 50: 168,
  };
  const baseRating = BASE_RATINGS[recommendedCable] ?? 0;

  // Iz = (Iz,ref × installationsmetode) × Ca × Cg ; krav In ≤ Iz
  const ampacity = useMemo(
    () => computeCableAmpacity({
      baseAmpacityA: baseRating * methodFactor,
      ambientFactor,
      groupingFactor,
      protectiveDeviceA: I,
    }),
    [baseRating, methodFactor, ambientFactor, groupingFactor, I]
  );
  const izDerated = ampacity.deratedAmpacityA;
  const ampacityOk = ampacity.passed;

  // Cable cross-section SVG illustration (preserved viz)
  const CableIllustration = useMemo(() => {
    const preview = STANDARD_CABLES.filter(s => s <= 16);
    return (
      <svg viewBox="0 0 200 100" className="w-full max-h-[92px]">
        <text x="100" y="12" textAnchor="middle" fontSize="8" fill="#64748b">Kabeltværsnit sammenligning (mm²)</text>
        {preview.map((size, i) => {
          const r = Math.sqrt(size / Math.PI) * 5.5;
          const isRec = size === recommendedCable;
          const x = 16 + i * 26;
          const y = 52;
          return (
            <g key={size}>
              <circle cx={x} cy={y} r={r + 3.5} fill={isRec ? '#fef9c3' : '#f1f5f9'} stroke={isRec ? '#eab308' : '#cbd5e1'} strokeWidth={isRec ? 1.5 : 0.8} />
              <circle cx={x} cy={y} r={r + 1.5} fill={isRec ? '#fde68a' : '#e2e8f0'} />
              <circle cx={x} cy={y} r={r} fill={isRec ? '#b45309' : '#94a3b8'} />
              <text x={x} y={y + r + 12} textAnchor="middle" fontSize="7" fill={isRec ? '#b45309' : '#94a3b8'} fontWeight={isRec ? 'bold' : 'normal'}>
                {size}
              </text>
            </g>
          );
        })}
        <text x="100" y="95" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="bold">
          Anbefalet: {recommendedCable} mm²
        </text>
      </svg>
    );
  }, [recommendedCable]);

  const reportData: CalculatorReportData = {
    toolName: 'Kabeldimensionering',
    category: 'El',
    mode: isAdvanced ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Strøm (In)', value: inputs.current, unit: 'A' },
      { label: 'Kabellængde', value: inputs.length, unit: 'm' },
      { label: 'Max spændingsfald', value: inputs.voltageDrop, unit: '%' },
      ...(isAdvanced ? [
        { label: 'Systemtype', value: phases === 3 ? '3-faset (400 V)' : '1-faset (230 V)' },
        { label: 'Ledertemperatur', value: `${conductorTempC}`, unit: '°C' },
        { label: 'Installationsmetode', value: installMethod },
        { label: 'Omgivelsestemperatur (Ca)', value: `${ambientFactor.toFixed(2)}` },
        { label: 'Samling (Cg)', value: `${groupingFactor.toFixed(2)}` },
      ] : []),
    ],
    results: [
      { label: 'Anbefalet tværsnit', value: `${recommendedCable}`, unit: 'mm²', highlight: true },
      { label: 'Faktisk spændingsfald', value: actualDropPct.toFixed(2), unit: '%' },
      { label: 'Spændingsfald godkendt', value: dropOk ? 'Ja' : 'Nej' },
      ...(isAdvanced && baseRating > 0 ? [
        { label: 'Deratet strømevne Iz', value: izDerated.toFixed(1), unit: 'A' },
        { label: 'In ≤ Iz godkendt', value: ampacityOk ? 'Ja' : 'Nej' },
      ] : []),
    ],
    formula: 'A_min = (ρ·k·L·I) / ΔU ; ΔU = U × (ΔU%/100)\nIz = Iz,ref × Ca × Cg ; In ≤ Iz',
    standardsStruktureret: STANDARDS_CATALOG.electrical,
    safetyDisclaimer: 'Elektriske installationer SKAL udføres og godkendes af en autoriseret el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet.',
  };

  if (!allowed) return null;

  const modeToggle = (
    <CalculatorModeToggle toolId={TOOL_ID} advancedLocked={!advancedAllowed} onChange={handleModeChange} />
  );

  const selectCls =
    'w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary';

  return (
    <CalculatorPage
      title="Kabeldimensionering"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={modeToggle}
      stickyResultLabel="Min. tværsnit"
      stickyResult={<><AnimatedNumber value={recommendedCable} precision={1} /> mm²</>}
      shareValue={
        recommendedCable > 0
          ? `Kabel: ${recommendedCable} mm² · Spændingsfald: ${actualDropPct.toFixed(2)} % (${phases === 3 ? '3-faset 400 V' : '1-faset 230 V'})`
          : undefined
      }
    >
      <SafetyDisclaimer className="mb-4">
        Elektriske installationer <strong>SKAL</strong> udføres og godkendes af en autoriseret
        el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet. Beregninger er
        vejledende og erstatter ikke et elinstallationsprojekt.
      </SafetyDisclaimer>

      {/* Cable illustration hero */}
      <CalculatorHero
        illustration={CableIllustration}
        hint="Beregner mindste tilladt kabeltværsnit baseret på strøm og spændingsfald ved kobberledning (Cu). Avanceret tilstand tilføjer 3-faset 400 V, driftstemperatur og strømevne-derating (In ≤ Iz)."
        complianceRef="DS/HD 60364-5-52 (Kap. 52) · Max 4 % spændingsfald · In ≤ Iz"
        accentFrom="#eab308"
        accentTo="#a16207"
        className="mb-4"
      />

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Input card */}
        <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-brand-primary" />
            <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Indtast Data</h3>
          </div>

          <InputField
            label="Maksimal Strøm (I / In)"
            value={inputs.current}
            onChange={e => setInputs(p => ({ ...p, current: e.target.value }))}
            unit="A"
            info="Dimensionerende strøm: typisk sikringsstørrelsen (In) eller belastningsstrømmen (IB)."
          />
          <InputField
            label="Kabellængde (L)"
            value={inputs.length}
            onChange={e => setInputs(p => ({ ...p, length: e.target.value }))}
            unit="m"
            info="Ensidig afstand fra tavle til brugsgenstand (ikke sløjfe)."
          />
          <InputField
            label="Max Spændingsfald"
            value={inputs.voltageDrop}
            onChange={e => setInputs(p => ({ ...p, voltageDrop: e.target.value }))}
            unit="%"
            info="DS/HD 60364 max 4 % for installationer fra fordelingstransformer. 3 % anbefales."
          />

          {/* Advanced: system type + conductor temperature */}
          {isAdvanced && (
            <>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Systemtype
                  <InfoHint
                    title="1-faset vs. 3-faset"
                    description="Systemtypen bestemmer både referencespændingen (230 V mellem fase og nul, 400 V mellem faser) og geometrifaktoren i spændingsfaldet: 2 for enkeltfaset (frem- og returleder) og √3 for symmetrisk 3-faset."
                    calculation="ΔU = ρ·k·L·I / A → k = 2 (1-faset) / √3 (3-faset), U = 230 / 400 V"
                  />
                </label>
                <select aria-label="Systemtype" value={system} onChange={e => setSystem(e.target.value as '1' | '3')} className={selectCls}>
                  <option value="1">1-faset (230 V)</option>
                  <option value="3">3-faset (400 V)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Ledertemperatur
                  <InfoHint
                    title="Driftstemperatur & spændingsfald"
                    description="DS/HD 60364-5-52 regner det værste spændingsfald ved lederens driftstemperatur — ca. 70 °C for PVC-isolerede kabler — i stedet for 20 °C-referencen. Fordi kobbers resistivitet stiger med temperaturen (~0,4 %/°C), giver 70 °C ca. 20–30 % højere spændingsfald end 20 °C-referencen."
                    calculation="ρ(T) = ρ20 · (1 + α·(T − 20)) → ρ70/ρ20 ≈ 1,20 for Cu"
                  />
                </label>
                <select aria-label="Ledertemperatur" value={tempC} onChange={e => setTempC(e.target.value as '20' | '70')} className={selectCls}>
                  <option value="20">20 °C (reference)</option>
                  <option value="70">70 °C (worst-case, PVC drift)</option>
                </select>
              </div>
            </>
          )}

          {/* Advanced: installation method + derating */}
          {isAdvanced && (
            <>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Installationsmetode (Tabel B.52)
                  <InfoHint
                    title="Installationsmetode"
                    description="Installationsmetoden bestemmer hvor godt kablet kan afgive varme og dermed dets tabellagte strømevne. Kabler i isoleret væg (A1) køles dårligere end kabler i fri luft (E)."
                    calculation="Iz,ref korrigeres med metodefaktor (DS/HD 60364-5-52 Tabel B.52)"
                  />
                </label>
                <select aria-label="Installationsmetode" value={installMethod} onChange={e => setInstallMethod(e.target.value)} className={selectCls}>
                  {INSTALL_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                    Omgivelse (Ca)
                    <InfoHint
                      title="Omgivelsestemperatur Ca"
                      description="Korrektionsfaktor for omgivelsestemperatur (reference 30 °C for PVC). Højere omgivelsestemperatur reducerer den tilladte strømevne."
                      calculation="Iz = Iz,ref × Ca (Tabel B.52.14)"
                    />
                  </label>
                  <select aria-label="Omgivelsestemperatur" value={ambientId} onChange={e => setAmbientId(e.target.value)} className={selectCls}>
                    {AMBIENT_FACTORS.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                    Samling (Cg)
                    <InfoHint
                      title="Samlingsfaktor Cg"
                      description="Korrektionsfaktor for kabler der ligger samlet/bundtet. Flere kredsløb ved siden af hinanden reducerer den tilladte strømevne pga. gensidig opvarmning."
                      calculation="Iz = Iz,ref × Ca × Cg (Tabel B.52.17)"
                    />
                  </label>
                  <select aria-label="Samlingsfaktor" value={groupingId} onChange={e => setGroupingId(e.target.value)} className={selectCls}>
                    {GROUPING_FACTORS.map(g => (
                      <option key={g.id} value={g.id}>{g.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Results column */}
        <div className="space-y-4">
          {/* Main cable recommendation */}
          <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-base mb-3 text-text-primary dark:text-text-dark-primary">Anbefalet Standardkabel</h3>

            <div className="text-center bg-success-subtle dark:bg-success-subtle-dark p-5 rounded-xl border-2 border-success-border dark:border-success/30 mb-4">
              <p className="text-xs font-bold text-success-strong dark:text-success uppercase tracking-wider mb-1">
                Minimum Tværsnit
              </p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-success-strong dark:text-success">
                  <AnimatedNumber value={recommendedCable} precision={1} />
                </span>
                <span className="text-2xl font-bold text-success-strong dark:text-success">mm²</span>
              </div>
              {theoreticalArea > 0 && (
                <p className="text-xs text-success-strong dark:text-success mt-1">
                  Beregnet minimum: {theoreticalArea.toFixed(2)} mm² · {phases === 3 ? '3-faset 400 V' : '1-faset 230 V'} @ {conductorTempC} °C
                </p>
              )}
            </div>

            {/* Voltage drop compliance meter */}
            <h4 className="flex items-center gap-1 font-bold text-sm text-text-secondary dark:text-text-dark-secondary mb-2">
              Spændingsfald Check
              <InfoHint
                title="Spændingsfald-grænse (ΔU ≤ 4 %)"
                description="DS/HD 60364 tillader maksimalt 4 % spændingsfald fra fordelingstransformer til brugsgenstand (3 % anbefales for boliger). For stort spændingsfald giver lav klemspænding, dårlig drift og øget effekttab i kablet."
                calculation="ΔU% = (ρ·k·L·I)/(A·U) × 100 ≤ 4 %"
              />
            </h4>
            <ComplianceMeter
              label="Spændingsfald"
              value={parseFloat(actualDropPct.toFixed(2))}
              limit={maxDropPct}
              unit="%"
              max={Math.max(maxDropPct * 2.5, actualDropPct * 1.5, 10)}
            />
          </div>

          {/* Voltage-drop verdict card */}
          <div className={`p-5 rounded-card border-l-4 shadow-sm ${dropOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
            <div className="flex items-start gap-3">
              {dropOk
                ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
              <div className="flex-1">
                <h4 className={`font-bold ${dropOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                  Spændingsfald {actualDropPct.toFixed(2)} %
                </h4>
                <p className={`text-sm mt-0.5 ${dropOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                  {dropOk
                    ? `Under grænsen på ${maxDropPct} %. Kabeltværsnittet er tilstrækkeligt til at holde spændingsfaldet nede.`
                    : `Overstiger grænsen på ${maxDropPct} %. Vælg større tværsnit eller reducér kabellængde/strøm.`}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced: current-carrying capacity check (In ≤ Iz) */}
          {isAdvanced && baseRating > 0 && (
            <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-card shadow-sm border border-border dark:border-border-dark space-y-3">
              <h4 className="flex items-center gap-1 font-bold text-sm text-text-secondary dark:text-text-dark-secondary">
                Strømevne-check (In ≤ Iz)
                <InfoHint
                  title="Overstrømsbeskyttelse (In ≤ Iz)"
                  description="Kablets deratede strømevne Iz skal være mindst lige så stor som beskyttelsesorganets mærkestrøm In, ellers kan kablet overophede før sikringen/afbryderen udløser. Iz findes ved at korrigere den tabellagte strømevne for installationsmetode, omgivelsestemperatur og samling."
                  calculation="Iz = Iz,ref × Ca × Cg ; krav: In ≤ Iz (DS/HD 60364-4-43)"
                />
              </h4>

              <ComplianceMeter
                label="Belastning In vs. strømevne Iz"
                value={parseFloat(I.toFixed(1))}
                limit={parseFloat(izDerated.toFixed(1))}
                unit="A"
                decimalPlaces={1}
                max={Math.max(izDerated * 1.4, I * 1.3, 10)}
              />

              <div className={`p-4 rounded-card border-l-4 ${ampacityOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                <div className="flex items-start gap-3">
                  {ampacityOk
                    ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                    : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className={`font-bold ${ampacityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {ampacityOk ? 'Strømevne tilstrækkelig' : 'Strømevne utilstrækkelig'}
                    </h4>
                    <p className={`text-sm mt-0.5 ${ampacityOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      In = {I.toFixed(0)} A {ampacityOk ? '≤' : '>'} Iz = {izDerated.toFixed(1)} A
                      {ampacityOk
                        ? ` — ${recommendedCable} mm² Cu er OK.`
                        : ' — vælg større tværsnit, anden installationsmetode eller reducér belastning.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-0.5">
                <p className="font-semibold">Derating af strømevne</p>
                <p>Iz,ref ({recommendedCable} mm² Cu, metode {installMethod}) = {(baseRating * methodFactor).toFixed(1)} A</p>
                <p>× Ca (omgivelse) {ambientFactor.toFixed(2)} × Cg (samling) {groupingFactor.toFixed(2)}</p>
                <p className="font-semibold">= Iz = {izDerated.toFixed(1)} A</p>
              </div>
            </div>
          )}

          {/* Project save hint */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xs text-info-strong dark:text-info leading-snug">
              Gem kabelvalget som indkøb i projektet og brug det direkte i tilbud via <strong>Gem til Projekt</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Limitations note */}
      <div className="mt-4 p-3 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-xl text-xs text-warning-strong dark:text-warning leading-snug">
        <strong>Beregningsforudsætninger:</strong> Tværsnitsvalget bygger på spændingsfald for Cu-kabel.
        Avanceret tilstand medtager 3-faset 400 V, driftstemperatur og strømevne-derating (metode, omgivelse, samling),
        men kortslutningsniveau, jordfejlsbeskyttelse og samtidighedsfaktor kræver supplerende beregning af
        autoriseret el-installatør.
      </div>
    </CalculatorPage>
  );
};

export default CableSizingCalculator;
