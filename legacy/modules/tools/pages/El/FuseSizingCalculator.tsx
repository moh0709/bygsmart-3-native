import React, { useState, useEffect, useMemo, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import { STANDARDS_CATALOG, computeCableAmpacity } from '../../catalog';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { InfoHint } from '../../../../components/ui';
import { CheckCircleIcon, AlertTriangleIcon } from '../../../../components/icons';

const STANDARD_FUSES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];

const INSTALLATION_METHODS: { id: string; label: string; factor: number }[] = [
  { id: 'A1', label: 'A1 – Ét kabel i rørkanal (loft/væg)', factor: 1.0 },
  { id: 'B1', label: 'B1 – Ét kabel i rørkanal (mur)', factor: 0.9 },
  { id: 'C',  label: 'C – Kabel på overflade (fri luft)', factor: 1.05 },
  { id: 'E',  label: 'E – Kabel i fri luft (perforeret bakke)', factor: 1.15 },
];

// Wire cross-sections with approx. Cu current ratings (method A1 reference)
const WIRE_SECTIONS: { mm2: number; ratingA: number }[] = [
  { mm2: 1.5, ratingA: 15.5 },
  { mm2: 2.5, ratingA: 21 },
  { mm2: 4,   ratingA: 28 },
  { mm2: 6,   ratingA: 36 },
  { mm2: 10,  ratingA: 50 },
  { mm2: 16,  ratingA: 68 },
];

// Ambient-temperature correction factors k_temp (PVC insulation, Table B.52.14)
const AMBIENT_FACTORS: { id: string; label: string; factor: number }[] = [
  { id: '30', label: '30 °C – reference (ingen reduktion)', factor: 1.0 },
  { id: '40', label: '40 °C', factor: 0.87 },
  { id: '50', label: '50 °C', factor: 0.71 },
];

// Grouping/bundling correction factors k_samling (Table B.52.17)
const GROUPING_FACTORS: { id: string; label: string; factor: number }[] = [
  { id: '1',   label: '1 kredsløb – ingen samling', factor: 1.0 },
  { id: '2',   label: '2 kredsløb samlet', factor: 0.8 },
  { id: '3',   label: '3 kredsløb samlet', factor: 0.7 },
  { id: '4-6', label: '4–6 kredsløb samlet', factor: 0.65 },
];

const helpContent: HelpContent = {
  formaal:
    'Beregner anbefalet sikringsstørrelse for et enkeltfaset 230 V kredsløb baseret på den installerede effekt. ' +
    'Sikringen vælges ud fra belastningsstrømmen ganget med en sikkerhedsfaktor på 125 % (In ≥ IB × 1.25) og rundes op til næste standardstørrelse.',
  variabler: [
    { name: 'Effekt', symbol: 'P', unit: 'W', description: 'Samlet aftagende effekt på kredsløbet (summen af alle apparater).' },
    { name: 'Strøm', symbol: 'IB', unit: 'A', description: 'Beregnet belastningsstrøm: IB = P / 230.' },
    { name: 'Sikringsfaktor', symbol: 'k', unit: '–', description: '125 % = 1.25 – DS/HD 60364 krav til dimensionering (In ≥ IB × 1.25).' },
    { name: 'Nominel strøm', symbol: 'In', unit: 'A', description: 'Mindste standardsikring ≥ IB × k.' },
    { name: 'Reference-strømevne', symbol: 'Iz,ref', unit: 'A', description: 'Kablets tabulerede strømbelastningsevne ved referenceforhold (30 °C, ét kredsløb).' },
    { name: 'Temperaturfaktor', symbol: 'k_temp', unit: '–', description: 'Reduktion pga. omgivelsestemperatur (PVC): 30 °C→1,0; 40 °C→0,87; 50 °C→0,71.' },
    { name: 'Samlingsfaktor', symbol: 'k_samling', unit: '–', description: 'Reduktion pga. samling/bundtning: 1→1,0; 2→0,8; 3→0,7; 4–6→0,65.' },
    { name: 'Korrigeret strømevne', symbol: 'Iz', unit: 'A', description: 'Iz = Iz,ref × k_metode × k_temp × k_samling. Kablet er OK når In ≤ Iz.' },
  ],
  formel:
    'IB = P / 230\n' +
    'In_min = IB × 1.25 → vælg næste standardsikring ≥ In_min\n' +
    'Iz = Iz,ref × k_metode × k_temp × k_samling\n' +
    'Kabelkrav: In ≤ Iz',
  antagelser:
    'Enkeltfaset 230 V forsyning, kosinusPhi = 1 (rent aktiv last). ' +
    'I avanceret tilstand korrigeres kablets strømevne for installationsmetode, omgivelsestemperatur ' +
    'og samling/bundtning af kabler (Iz = Iz,ref × k_metode × k_temp × k_samling), og kravet In ≤ Iz kontrolleres. ' +
    'Kortslutningsbeskyttelse (Icc/Icu) og jordfejlsbeskyttelse indgår ikke i beregningen.',
  standarder:
    'DS/HD 60364-5-52 – Kabelvalg og strømbelastningsevne (derating: temperatur & samling)\n' +
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

const FuseSizingCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [power, setPower] = useState('2300');
  const [selectedSection, setSelectedSection] = useState('2.5');
  const [installMethod, setInstallMethod] = useState('A1');
  const [ambientKey, setAmbientKey] = useState('30');
  const [groupingKey, setGroupingKey] = useState('1');

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const I = useMemo(() => (parseFloat(power) || 0) / 230, [power]);
  const requiredCurrent = I * 1.25;

  const methodFactor = useMemo(
    () => INSTALLATION_METHODS.find(m => m.id === installMethod)?.factor ?? 1.0,
    [installMethod]
  );

  const ambientFactor = useMemo(
    () => AMBIENT_FACTORS.find(a => a.id === ambientKey)?.factor ?? 1.0,
    [ambientKey]
  );

  const groupingFactor = useMemo(
    () => GROUPING_FACTORS.find(g => g.id === groupingKey)?.factor ?? 1.0,
    [groupingKey]
  );

  const wireSection = useMemo(
    () => WIRE_SECTIONS.find(s => s.mm2 === parseFloat(selectedSection)),
    [selectedSection]
  );

  // Reference ampacity adjusted for installation method (before temp/grouping derating)
  const methodAdjustedRating = useMemo(
    () => (wireSection ? wireSection.ratingA * methodFactor : 0),
    [wireSection, methodFactor]
  );

  const recommendedFuse = useMemo(() => {
    if (I <= 0) return null;
    const fuse = STANDARD_FUSES.find(f => f >= requiredCurrent);
    return fuse ?? null;
  }, [I, requiredCurrent]);

  // Derated cable ampacity per DS/HD 60364-5-52: Iz = Iz,ref × k_metode × k_temp × k_samling,
  // then the design rule In ≤ Iz is checked by the shared catalog function.
  const ampacity = useMemo(
    () => computeCableAmpacity({
      baseAmpacityA: methodAdjustedRating,
      ambientFactor,
      groupingFactor,
      protectiveDeviceA: recommendedFuse ?? 0,
    }),
    [methodAdjustedRating, ambientFactor, groupingFactor, recommendedFuse]
  );

  // Wire is adequate if its derated ampacity Iz ≥ fuse rating In (In ≤ Iz)
  const wireOk = recommendedFuse !== null && ampacity.passed;

  const reportData: CalculatorReportData = {
    toolName: 'Sikringsberegner',
    category: 'El',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Installeret effekt', value: power, unit: 'W' },
      ...(mode === 'advanced' ? [
        { label: 'Kabeltværsnit', value: selectedSection, unit: 'mm²' },
        { label: 'Installationsmetode', value: installMethod },
        { label: 'Omgivelsestemperatur', value: `${ambientKey} °C (k=${ambientFactor})` },
        { label: 'Samling/bundtning', value: `${groupingKey} (k=${groupingFactor})` },
      ] : []),
    ],
    results: [
      { label: 'Belastningsstrøm IB', value: I.toFixed(2), unit: 'A' },
      { label: 'Anbefalet sikring', value: recommendedFuse !== null ? `${recommendedFuse}` : 'Ingen', unit: 'A', highlight: true },
      ...(mode === 'advanced' ? [
        { label: 'Korrigeret kabelkapacitet Iz', value: ampacity.deratedAmpacityA.toFixed(1), unit: 'A' },
        { label: 'Kabel OK (In ≤ Iz)', value: wireOk ? 'Ja' : 'Nej – kabel underdimensioneret' },
      ] : []),
    ],
    formula: 'IB = P / 230\nIn_min = IB × 1,25 → næste standardsikring\nIz = Iz,ref × k_metode × k_temp × k_samling ; In ≤ Iz',
    standardsStruktureret: STANDARDS_CATALOG.electrical,
    safetyDisclaimer: 'Elektriske installationer SKAL udføres og godkendes af en autoriseret el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet.',
  };

  const modeToggle = (
    <CalculatorModeToggle toolId="el-sikring" onChange={handleModeChange} />
  );

  return (
    <CalculatorPage
      title="Sikringsberegner"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={modeToggle}
      stickyResult={
        recommendedFuse !== null ? (
          <><AnimatedNumber value={recommendedFuse} precision={0} /> A</>
        ) : undefined
      }
      stickyResultLabel="Anbefalet sikring"
      shareValue={
        recommendedFuse !== null
          ? `Sikring: ${recommendedFuse} A · Strøm: ${I.toFixed(2)} A`
          : undefined
      }
    >
      <SafetyDisclaimer className="mb-4">
        Elektriske installationer <strong>SKAL</strong> udføres og godkendes af en autoriseret
        el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet. Beregninger er
        vejledende og erstatter ikke et elinstallationsprojekt.
      </SafetyDisclaimer>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Input card */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Kredsløbsdata</h3>

          <InputField
            label="Total Effekt på Kredsløbet"
            value={power}
            onChange={e => setPower(e.target.value)}
            unit="W"
            info="Summen af den maksimale effekt for alle apparater, der er tilsluttet kredsløbet samtidigt."
          />

          {mode === 'advanced' && (
            <>
              {/* Wire cross-section selector */}
              <div>
                <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Kabeltværsnit (Cu)
                </label>
                <select
                  value={selectedSection}
                  onChange={e => setSelectedSection(e.target.value)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {WIRE_SECTIONS.map(s => (
                    <option key={s.mm2} value={String(s.mm2)}>
                      {s.mm2} mm² — maks. {s.ratingA} A (ref. A1)
                    </option>
                  ))}
                </select>
              </div>

              {/* Installation method selector */}
              <div>
                <label className="block text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Installationsmetode (IEC 60364-5-52)
                </label>
                <select
                  value={installMethod}
                  onChange={e => setInstallMethod(e.target.value)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {INSTALLATION_METHODS.map(m => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Ambient-temperature derating selector */}
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Omgivelsestemperatur (k_temp)
                  <InfoHint
                    title="Temperaturkorrektion (k_temp)"
                    description="Højere omgivelsestemperatur reducerer kablets brugbare strømevne. Faktorerne gælder PVC-isolerede kabler (DS/HD 60364-5-52, Tabel B.52.14) og ganges på reference-strømevnen Iz,ref."
                    calculation="Iz = Iz,ref × k_metode × k_temp × k_samling"
                  />
                </label>
                <select
                  aria-label="Omgivelsestemperatur"
                  value={ambientKey}
                  onChange={e => setAmbientKey(e.target.value)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {AMBIENT_FACTORS.map(a => (
                    <option key={a.id} value={a.id}>{a.label} — k = {a.factor}</option>
                  ))}
                </select>
              </div>

              {/* Grouping/bundling derating selector */}
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                  Samling / bundtning (k_samling)
                  <InfoHint
                    title="Samlingskorrektion (k_samling)"
                    description="Når flere belastede kredsløb samles eller bundtes, ophober varmen sig og kablets brugbare strømevne falder. Faktorerne følger DS/HD 60364-5-52, Tabel B.52.17."
                    calculation="Iz = Iz,ref × k_metode × k_temp × k_samling"
                  />
                </label>
                <select
                  aria-label="Samling og bundtning"
                  value={groupingKey}
                  onChange={e => setGroupingKey(e.target.value)}
                  className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {GROUPING_FACTORS.map(g => (
                    <option key={g.id} value={g.id}>{g.label} — k = {g.factor}</option>
                  ))}
                </select>
              </div>

              {/* Short-circuit note */}
              <div className="bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-xl p-3 text-xs text-warning-strong dark:text-warning leading-snug">
                <strong>Kortslutningsbeskyttelse:</strong> Denne beregner tager <em>ikke</em> højde
                for kortslutningsstrøm (Icc) eller kortslutningsselektivitet. I praksis kræver
                DS/HD 60364-4-43, at sikringens effektbrydningsevne (Icu) er ≥ Icc ved
                installationsstedet. Kontakt din el-installatør.
              </div>
            </>
          )}
        </div>

        {/* Results column */}
        <div className="space-y-4">
          {/* Recommended fuse */}
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-lg mb-3 text-text-primary dark:text-text-dark-primary">Anbefalet Sikring</h3>

            <div className="text-center bg-success-subtle dark:bg-success-subtle-dark p-5 rounded-xl border-2 border-success-border dark:border-success/30 mb-4">
              <p className="text-xs font-bold text-success-strong dark:text-success uppercase tracking-wider mb-1">
                Standardsikring (IEC 60898 / DS/HD 60364)
              </p>
              <div className="flex items-baseline justify-center gap-1">
                {recommendedFuse !== null ? (
                  <>
                    <span className="text-5xl font-extrabold text-success-strong dark:text-success">
                      <AnimatedNumber value={recommendedFuse} precision={0} />
                    </span>
                    <span className="text-2xl font-bold text-success-strong dark:text-success"> A</span>
                  </>
                ) : (
                  <span className="text-2xl font-semibold text-text-secondary dark:text-text-dark-secondary">Angiv effekt</span>
                )}
              </div>
            </div>

            {/* Breakdown info */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div className="bg-bg-subtle dark:bg-bg-dark-muted rounded-lg p-3 text-center">
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-1">Belastningsstrøm</p>
                <p className="font-bold text-text-primary dark:text-text-dark-primary">
                  {I.toFixed(2)} A
                </p>
              </div>
              <div className="bg-bg-subtle dark:bg-bg-dark-muted rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-xs text-text-secondary dark:text-text-dark-secondary">Krav inkl. 125 %</p>
                  <InfoHint
                    title="Sikringskrav (In ≥ IB × 1,25)"
                    description="Sikringens nominelle strøm In skal mindst svare til belastningsstrømmen IB ganget med en sikkerhedsfaktor på 125 %. Herefter rundes op til nærmeste standardsikring."
                    calculation="In ≥ IB × 1,25 (DS/HD 60364-4-43)"
                  />
                </div>
                <p className="font-bold text-text-primary dark:text-text-dark-primary">
                  {requiredCurrent.toFixed(2)} A
                </p>
              </div>
            </div>

            {/* Compliance meter: current vs fuse rating */}
            {recommendedFuse !== null && I > 0 && (
              <div>
                <p className="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">Strøm vs. Sikring</p>
                <ComplianceMeter
                  label="Belastningsstrøm"
                  value={parseFloat(I.toFixed(2))}
                  limit={recommendedFuse}
                  unit="A"
                  max={Math.max(recommendedFuse * 1.5, I * 1.5)}
                />
              </div>
            )}
          </div>

          {/* Advanced: derated cable-ampacity check (In ≤ Iz) */}
          {mode === 'advanced' && wireSection && recommendedFuse !== null && (
            <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Kabelkapacitet (In ≤ Iz)</h3>
                <InfoHint
                  title="Kabelbelastning (In ≤ Iz)"
                  description="Sikringens nominelle strøm In skal være mindre end eller lig kablets korrigerede strømevne Iz. Iz reduceres af installationsmetode, omgivelsestemperatur og samling/bundtning af kabler — derfor kan et kabel, der er OK ved referenceforhold, blive underdimensioneret i praksis."
                  calculation="Iz = Iz,ref × k_metode × k_temp × k_samling ; In ≤ Iz (DS/HD 60364-5-52)"
                />
              </div>

              {/* Verdict card */}
              <div className={`p-5 rounded-card border-l-4 shadow-sm ${wireOk ? 'bg-success-subtle border-success dark:bg-success-subtle-dark' : 'bg-danger-subtle border-danger dark:bg-danger-subtle-dark'}`}>
                <div className="flex items-start gap-3">
                  {wireOk
                    ? <CheckCircleIcon className="w-6 h-6 text-success flex-shrink-0" />
                    : <AlertTriangleIcon className="w-6 h-6 text-danger flex-shrink-0" />}
                  <div className="flex-1">
                    <h4 className={`font-bold ${wireOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {wireOk ? 'In ≤ Iz OK' : 'Kabel underdimensioneret'}
                    </h4>
                    <p className={`text-sm mt-0.5 ${wireOk ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger'}`}>
                      {wireOk
                        ? `Korrigeret kabelkapacitet Iz = ${ampacity.deratedAmpacityA.toFixed(1)} A ≥ sikring ${recommendedFuse} A.`
                        : `Korrigeret kabelkapacitet Iz = ${ampacity.deratedAmpacityA.toFixed(1)} A < sikring ${recommendedFuse} A. Vælg større tværsnit eller reducér temperatur/samling.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Compliance meter: fuse In vs derated cable Iz */}
              <div>
                <p className="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">Sikring In vs. korrigeret kabelkapacitet Iz</p>
                <ComplianceMeter
                  label="Sikring In"
                  value={recommendedFuse}
                  limit={parseFloat(ampacity.deratedAmpacityA.toFixed(1))}
                  unit="A"
                  decimalPlaces={1}
                  max={Math.max(ampacity.deratedAmpacityA * 1.5, recommendedFuse * 1.5, 1)}
                />
              </div>

              {/* Derating breakdown */}
              <div className="bg-info-subtle dark:bg-info-subtle-dark p-3 rounded-lg text-xs text-info-strong dark:text-info space-y-1">
                <p className="font-semibold">Deratingsfaktorer (DS/HD 60364-5-52)</p>
                <p>Reference Iz,ref = {wireSection.ratingA} A · metode {installMethod} (k={methodFactor}) → {methodAdjustedRating.toFixed(1)} A</p>
                <p>× temperatur (k={ambientFactor}) × samling (k={groupingFactor}) → Iz = {ampacity.deratedAmpacityA.toFixed(1)} A</p>
                <p>Udnyttelse In/Iz = {isFinite(ampacity.utilization) ? `${(ampacity.utilization * 100).toFixed(0)} %` : '–'}</p>
              </div>
            </div>
          )}

          {/* Standards reference */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30">
            <p className="text-xs text-info-strong dark:text-info font-semibold mb-1">Referencestandarder</p>
            <p className="text-xs text-info-strong dark:text-info leading-relaxed font-mono">
              DS/HD 60364-4-43 · DS/HD 60364-5-52<br />
              IEC 60898 (Installationssikringer)<br />
              Stærkstrømsreglementet
            </p>
          </div>
        </div>
      </div>
    </CalculatorPage>
  );
};

export default FuseSizingCalculator;
