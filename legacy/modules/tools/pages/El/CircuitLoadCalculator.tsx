import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import { STANDARDS_CATALOG } from '../../catalog';
import InputField from '../../components/InputField';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import SafetyDisclaimer from '../../components/SafetyDisclaimer';
import { ComplianceMeter } from '../../components/viz';
import { PlusIcon, TrashIcon } from '../../../../components/icons';

interface Appliance {
  id: number;
  name: string;
  power: string;
  /** Advanced mode: simultaneous usage factor 0–100 % */
  usageFactor: string;
}

const STANDARD_FUSES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];

const helpContent: HelpContent = {
  formaal:
    'Beregner den samlede effekt og strøm for alle apparater på et kredsløb. ' +
    'I avanceret tilstand kan du angive en samtidighedsfaktor per apparat, der ' +
    'afspejler at ikke alle apparater er tændt på samme tid. ' +
    'Resultatet bruges til at dimensionere sikring og kabel.',
  variabler: [
    { name: 'Effekt', symbol: 'P', unit: 'W', description: 'Nominel effektforbrug for hvert apparat.' },
    { name: 'Samtidighedsfaktor', symbol: 'kd', unit: '%', description: 'Andel af tiden apparatet er aktivt (100 % = altid tændt).' },
    { name: 'Korrigeret effekt', symbol: 'Pkd', unit: 'W', description: 'P × kd/100 — bruges til dimensionering.' },
    { name: 'Total strøm', symbol: 'IB', unit: 'A', description: 'IB = ΣPkd / 230.' },
  ],
  formel:
    'IB = Σ(Pi × kdi / 100) / 230\n' +
    'Anbefalet sikring: næste standardsikring ≥ IB × 1.25 (DS 60364)',
  antagelser:
    'Enkeltfaset 230 V, kosinusPhi = 1 (rent aktiv last). ' +
    'Fase- og neutralledning dimensioneres med samme strøm. ' +
    'Reaktiv last, harmoniske og spændingsfald indgår ikke.',
  standarder:
    'DS/HD 60364-5-52 – Kabelvalg og strømbelastningsevne\n' +
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

const CircuitLoadCalculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const [appliances, setAppliances] = useState<Appliance[]>([
    { id: 1, name: 'Køleskab', power: '200', usageFactor: '100' },
  ]);

  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const handleAdd = () => {
    setAppliances(prev => [...prev, { id: Date.now(), name: '', power: '', usageFactor: '100' }]);
  };

  const handleRemove = (id: number) => {
    setAppliances(prev => prev.filter(app => app.id !== id));
  };

  const handleChange = (id: number, field: keyof Omit<Appliance, 'id'>, value: string) => {
    setAppliances(prev => prev.map(app => (app.id === id ? { ...app, [field]: value } : app)));
  };

  // Corrected total power (applying simultaneous usage factor in advanced mode)
  const totalPower = useMemo(
    () =>
      appliances.reduce((sum, app) => {
        const p = parseFloat(app.power) || 0;
        const kd = mode === 'advanced' ? (parseFloat(app.usageFactor) || 100) / 100 : 1;
        return sum + p * kd;
      }, 0),
    [appliances, mode]
  );

  const rawTotalPower = useMemo(
    () => appliances.reduce((sum, app) => sum + (parseFloat(app.power) || 0), 0),
    [appliances]
  );

  const totalCurrent = totalPower / 230;
  const requiredFuseCurrent = totalCurrent * 1.25;
  const recommendedFuse = STANDARD_FUSES.find(f => f >= requiredFuseCurrent) ?? null;

  const reportData: CalculatorReportData = {
    toolName: 'Kredsløbsbelastning',
    category: 'El',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: appliances.map(app => ({
      label: app.name || 'Apparat',
      value: app.power,
      unit: 'W',
    })),
    results: [
      { label: 'Samlet effekt', value: totalPower.toFixed(0), unit: 'W', highlight: true },
      { label: 'Belastningsstrøm IB', value: totalCurrent.toFixed(2), unit: 'A' },
      { label: 'Anbefalet sikring', value: recommendedFuse !== null ? `${recommendedFuse}` : 'Ingen', unit: 'A' },
    ],
    formula: 'IB = ΣP / 230\nIn_min = IB × 1,25 → næste standardsikring',
    standardsStruktureret: STANDARDS_CATALOG.electrical,
    safetyDisclaimer: 'Elektriske installationer SKAL udføres og godkendes af en autoriseret el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet.',
  };

  const modeToggle = (
    <CalculatorModeToggle toolId="el-kredslobsbelastning" onChange={handleModeChange} />
  );

  return (
    <CalculatorPage
      title="Kredsløbsbelastning"
      helpContent={helpContent}
      reportData={reportData}
      modeToggle={modeToggle}
      stickyResultLabel="Samlet strøm"
      stickyResult={<><AnimatedNumber value={totalCurrent} precision={2} /> A</>}
      shareValue={
        totalPower > 0
          ? `Belastning: ${totalPower.toFixed(0)} W · ${totalCurrent.toFixed(2)} A · Sikring: ${recommendedFuse ?? '>'} A`
          : undefined
      }
    >
      <SafetyDisclaimer className="mb-4">
        Elektriske installationer <strong>SKAL</strong> udføres og godkendes af en autoriseret
        el-installatør i henhold til DS/HD 60364 og stærkstrømsreglementet. Beregninger er
        vejledende og erstatter ikke et elinstallationsprojekt.
      </SafetyDisclaimer>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Appliance list */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-3">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Apparater på Kredsløbet</h3>

          {appliances.map((app, index) => (
            <div key={app.id} className="space-y-2 pb-3 border-b border-border dark:border-border-dark last:border-0 last:pb-0">
              <div className={`grid gap-2 items-end ${mode === 'advanced' ? 'grid-cols-12' : 'grid-cols-12'}`}>
                {/* Name */}
                <div className={mode === 'advanced' ? 'col-span-5' : 'col-span-6'}>
                  <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
                    Apparat {index + 1}
                  </label>
                  <input
                    type="text"
                    value={app.name}
                    onChange={e => handleChange(app.id, 'name', e.target.value)}
                    placeholder="F.eks. Ovn"
                    className="w-full mt-1 border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                  />
                </div>

                {/* Power */}
                <div className={mode === 'advanced' ? 'col-span-4' : 'col-span-5'}>
                  <InputField
                    label="Effekt"
                    value={app.power}
                    onChange={e => handleChange(app.id, 'power', e.target.value)}
                    unit="W"
                    info="Nominel effekt for apparatet i Watt."
                  />
                </div>

                {/* Advanced: usage factor */}
                {mode === 'advanced' && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Samti-%</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={app.usageFactor}
                      onChange={e => handleChange(app.id, 'usageFactor', e.target.value)}
                      className="w-full mt-1 border border-border-strong dark:border-border-dark-strong rounded-lg px-2 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    />
                  </div>
                )}

                {/* Remove */}
                <div className="col-span-1">
                  <button
                    onClick={() => handleRemove(app.id)}
                    className="w-full h-11 flex items-center justify-center text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark rounded-lg transition-colors"
                    aria-label={`Fjern apparat ${index + 1}`}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Advanced: show corrected power per appliance */}
              {mode === 'advanced' && app.power && (
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary pl-1">
                  Korrigeret: {((parseFloat(app.power) || 0) * ((parseFloat(app.usageFactor) || 100) / 100)).toFixed(0)} W
                </p>
              )}
            </div>
          ))}

          <button
            onClick={handleAdd}
            className="w-full mt-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-border-strong dark:border-border-dark-strong rounded-lg text-text-secondary dark:text-text-dark-secondary font-semibold hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors"
          >
            <PlusIcon className="w-5 h-5" /> Tilføj Apparat
          </button>
        </div>

        {/* Results column */}
        <div className="space-y-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark">
            <h3 className="font-bold text-lg mb-4 text-text-primary dark:text-text-dark-primary">Total Belastning</h3>

            <div className="space-y-3">
              {/* Advanced: show raw vs corrected */}
              {mode === 'advanced' && rawTotalPower !== totalPower && (
                <div className="text-center bg-warning-subtle dark:bg-warning-subtle-dark p-3 rounded-lg border border-warning-border dark:border-warning/30">
                  <p className="text-xs font-medium text-warning-strong dark:text-warning">Nominel effekt (ingen kd-faktor)</p>
                  <div className="text-2xl font-bold text-warning-strong dark:text-warning mt-0.5">
                    <AnimatedNumber value={rawTotalPower} precision={0} />
                    <span className="text-xl ml-1">W</span>
                  </div>
                </div>
              )}

              <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-lg">
                <p className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">
                  {mode === 'advanced' ? 'Korrigeret Effekt (med kd)' : 'Samlet Effekt'}
                </p>
                <div className="text-3xl font-bold text-brand-primary mt-1">
                  <AnimatedNumber value={totalPower} precision={0} />
                  <span className="text-2xl ml-1">W</span>
                </div>
              </div>

              <div className="text-center bg-bg-subtle dark:bg-bg-dark-muted p-3 rounded-lg">
                <p className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">Samlet Strøm (ved 230 V)</p>
                <div className="text-3xl font-bold text-brand-primary mt-1">
                  <AnimatedNumber value={totalCurrent} precision={2} />
                  <span className="text-2xl ml-1">A</span>
                </div>
              </div>
            </div>

            {/* Fuse recommendation */}
            {totalCurrent > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-bold text-text-secondary dark:text-text-dark-secondary mb-2">
                  Anbefalet sikring (IB × 1.25)
                </h4>
                <div className={`text-center p-3 rounded-xl border-2 ${
                  recommendedFuse
                    ? 'bg-success-subtle dark:bg-success-subtle-dark border-success-border dark:border-success/30'
                    : 'bg-danger-subtle dark:bg-danger-subtle-dark border-danger-border dark:border-danger/30'
                }`}>
                  {recommendedFuse !== null ? (
                    <>
                      <span className="text-4xl font-extrabold text-success-strong dark:text-success">
                        <AnimatedNumber value={recommendedFuse} precision={0} />
                      </span>
                      <span className="text-2xl font-bold text-success-strong dark:text-success"> A</span>
                      <p className="text-xs text-success-strong dark:text-success mt-1">
                        Krav: {requiredFuseCurrent.toFixed(2)} A (IB × 1.25)
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-danger">Belastning for høj til standardsikring ≤ 63 A</p>
                  )}
                </div>
              </div>
            )}

            {/* Compliance meter: current vs fuse */}
            {totalCurrent > 0 && recommendedFuse !== null && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                  Strøm vs. Sikring
                </p>
                <ComplianceMeter
                  label="Belastningsstrøm"
                  value={parseFloat(totalCurrent.toFixed(2))}
                  limit={recommendedFuse}
                  unit="A"
                  max={Math.max(recommendedFuse * 1.5, totalCurrent * 1.5, 20)}
                />
              </div>
            )}
          </div>

          {/* Standards note */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30">
            <p className="text-xs text-info-strong dark:text-info font-semibold mb-1">Næste skridt</p>
            <p className="text-xs text-info-strong dark:text-info leading-relaxed">
              Brug den beregnede strøm i <strong>Kabeldimensionering</strong> for at finde
              korrekt kabeltværsnit og kontrollere spændingsfald (DS/HD 60364-5-52).
            </p>
          </div>
        </div>
      </div>
    </CalculatorPage>
  );
};

export default CircuitLoadCalculator;
