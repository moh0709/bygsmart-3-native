import React, { useState, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import CalculatorModeToggle, { type CalcMode } from '../../components/CalculatorModeToggle';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import BreakdownDonut from '../../components/viz/BreakdownDonut';
import { computeLaborCost } from '../../catalog';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { useSubscription } from '../../../../contexts/SubscriptionContext';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

const HELP: HelpContent = {
  formaal:
    'Beregner den samlede lønudgift baseret på antal håndværkere, dage, timer og timepris. ' +
    'Avanceret tilstand tilføjer labor burden (feriepenge, pension, forsikring).',
  variabler: [
    { name: 'Håndværkere', symbol: 'W', unit: 'pers.', description: 'Antal personer på opgaven.' },
    { name: 'Dage', symbol: 'D', unit: 'dage', description: 'Estimeret varighed.' },
    { name: 'Timer/dag', symbol: 'H', unit: 't', description: 'Standard dansk arbejdsdag er 7,4 t (overenskomst).' },
    { name: 'Timepris', symbol: 'R', unit: 'kr./t', description: 'Typisk 400–750 kr./t ekskl. moms for faglærte.' },
    { name: 'Labor burden', symbol: 'LB', unit: '%', description: 'Feriepenge (12,5%), pension (ca. 8%), forsikring m.m. Typisk 25–35% oveni.' },
  ],
  formel:
    'Timer i alt = W × D × H\n' +
    'Basislønudgift = Timer × R\n' +
    'Labor burden = Basis × LB%\n' +
    'Total ekskl. moms = Basis + Burden\n' +
    'Moms = Total ekskl. moms × 0,25',
  antagelser:
    '7,4 timer er normal arbejdsdag iht. overenskomst; 8 timer bruges til budgettering. ' +
    'Labor burden dækker feriepenge, pension, ATP, arbejdsgiverforsikring.',
  standarder:
    'Ferieloven — feriepenge 12,5%. Overenskomst pension 8–12%. ' +
    'Momsloven § 4 — 25% moms på håndværksydelser.',
};

const LaborCostCalculator: React.FC = () => {
  const { advancedAllowed } = useToolAccess('arbejdsloen');
  const { upgradeTo } = useSubscription();
  const [mode, setMode] = useState<CalcMode>('basic');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);
  const [workers, setWorkers] = useState('2');
  const [days, setDays] = useState('5');
  const [hours, setHours] = useState('8');
  const [rate, setRate] = useState('550');
  const [burden, setBurden] = useState('30');
  const [includeVat, setIncludeVat] = useState(true);

  const result = useMemo(() => computeLaborCost({
    workers: parseFloat(workers) || 0,
    hoursPerDay: parseFloat(hours) || 0,
    days: parseFloat(days) || 0,
    hourlyRate: parseFloat(rate) || 0,
    laborBurdenPct: mode === 'advanced' ? (parseFloat(burden) || 0) : 0,
    includeVat,
  }), [workers, hours, days, rate, burden, includeVat, mode]);

  const donutSegments = [
    { label: 'Basislønudgift', value: result.baseCost, color: '#10b981' },
    ...(result.burden > 0 ? [{ label: 'Labor burden', value: result.burden, color: '#f59e0b' }] : []),
    ...(result.vat > 0 ? [{ label: 'Moms (25%)', value: result.vat, color: '#f97316' }] : []),
  ].filter(s => s.value > 0);

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Arbejdsomkostninger',
    category: 'Pris & Budget',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      { label: 'Antal håndværkere', value: workers, unit: 'pers.' },
      { label: 'Antal dage', value: days, unit: 'dage' },
      { label: 'Timer pr. dag', value: hours, unit: 't' },
      { label: 'Timepris (ekskl. moms)', value: rate, unit: 'kr./t' },
      ...(mode === 'advanced' ? [{ label: 'Labor burden', value: burden, unit: '%' }] : []),
      { label: 'Inkl. 25% moms', value: includeVat ? 'Ja' : 'Nej' },
    ],
    results: [
      { label: 'Total lønudgift', value: result.total.toFixed(0), unit: 'kr.', highlight: true },
      { label: 'Timer i alt', value: result.totalHours.toFixed(0), unit: 't' },
      { label: 'Ekskl. moms', value: result.totalExVat.toFixed(0), unit: 'kr.' },
    ],
    breakdown: [
      { label: 'Basislønudgift', value: result.baseCost.toFixed(0), unit: 'kr.' },
      ...(result.burden > 0 ? [{ label: `Labor burden (${burden}%)`, value: result.burden.toFixed(0), unit: 'kr.' }] : []),
      { label: 'I alt ekskl. moms', value: result.totalExVat.toFixed(0), unit: 'kr.' },
      ...(result.vat > 0 ? [{ label: 'Moms 25%', value: result.vat.toFixed(0), unit: 'kr.' }] : []),
    ],
    formula: 'Timer i alt = W × D × H\nBasislønudgift = Timer × R\nLabor burden = Basis × LB%\nTotal ekskl. moms = Basis + Burden\nMoms = Total ekskl. moms × 0,25',
    infographicRef,
  }), [mode, workers, days, hours, rate, burden, includeVat, result]);

  const shareText = result.total > 0
    ? `Arbejdsløn: ${result.total.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr. (${result.totalHours.toFixed(0)} timer)`
    : undefined;

  return (
    <>
    <CalculatorPage
      title="Arbejdsløn Beregner"
      stickyResultLabel="Lønudgift"
      stickyResult={<><AnimatedNumber value={result.total} precision={0} /> kr.</>}
      shareValue={shareText}
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle
          toolId="arbejdsloen"
          advancedLocked={!advancedAllowed}
          onChange={setMode}
          onLockedClick={() => setShowUpgradeDialog(true)}
        />
      }
    >
      <div className="grid md:grid-cols-2 gap-6 items-start p-2">
        {/* ── Inputs ── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Opgavedata</h3>

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Antal håndværkere"
              value={workers}
              onChange={e => setWorkers(e.target.value)}
              unit="pers."
              info="Antal personer på opgaven."
            />
            <InputField
              label="Antal dage"
              value={days}
              onChange={e => setDays(e.target.value)}
              unit="dage"
              info="Estimeret antal arbejdsdage."
            />
          </div>

          <InputField
            label="Timer pr. dag"
            value={hours}
            onChange={e => setHours(e.target.value)}
            unit="t"
            info="Standard dansk arbejdsdag er 7,4 t (overenskomst). 8 t bruges til budgettering."
          />
          <InputField
            label="Timepris (ekskl. moms)"
            value={rate}
            onChange={e => setRate(e.target.value)}
            unit="kr./t"
            info="Faglærte håndværkere: typisk 400–750 kr./t ekskl. moms."
          />

          {mode === 'advanced' && (
            <InputField
              label="Labor burden"
              value={burden}
              onChange={e => setBurden(e.target.value)}
              unit="%"
              info="Feriepenge (12,5%) + pension (8–12%) + forsikring. Typisk 25–35%."
            />
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-border dark:border-border-dark">
            <label className="text-sm font-medium text-text-primary dark:text-text-dark-primary">Inkl. 25% moms</label>
            <button
              type="button"
              onClick={() => setIncludeVat(v => !v)}
              aria-label="Inkl. 25% moms"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeVat ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong'}`}
              aria-pressed={includeVat ? 'true' : 'false'}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-bg shadow transition-transform ${includeVat ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          <ResultDisplay label="Estimeret Lønudgift" value={result.total} unit="kr." />

          {/* Hours summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-success-subtle dark:bg-success-subtle-dark p-4 rounded-xl border border-success-border dark:border-success/30 text-center">
              <p className="text-xs text-success-strong dark:text-success font-medium mb-1">Timer i alt</p>
              <div className="text-2xl font-extrabold text-success-strong dark:text-success">
                <AnimatedNumber value={result.totalHours} precision={0} />
                <span className="text-sm ml-1">t</span>
              </div>
            </div>
            <div className="bg-info-subtle dark:bg-info-subtle-dark p-4 rounded-xl border border-info-border dark:border-info/30 text-center">
              <p className="text-xs text-info-strong dark:text-info font-medium mb-1">Ekskl. moms</p>
              <div className="text-2xl font-extrabold text-info-strong dark:text-info">
                <AnimatedNumber value={result.totalExVat} precision={0} />
                <span className="text-sm ml-1">kr.</span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-2">
            <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-3">Opgørelse</h4>
            {[
              { label: 'Basislønudgift', value: result.baseCost },
              ...(result.burden > 0 ? [{ label: `Labor burden (${burden}%)`, value: result.burden }] : []),
              { label: 'I alt ekskl. moms', value: result.totalExVat },
              ...(result.vat > 0 ? [{ label: 'Moms 25%', value: result.vat }] : []),
            ].map(row => (
              <div key={row.label} className="flex justify-between text-sm border-b border-border dark:border-border-dark pb-1 last:border-0">
                <span className="text-text-secondary dark:text-text-dark-secondary">{row.label}</span>
                <span className="font-semibold text-text-primary dark:text-text-dark-primary">
                  {row.value.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.
                </span>
              </div>
            ))}
          </div>

          {/* Donut */}
          {donutSegments.length > 0 && (
            <div ref={infographicRef} className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark flex justify-center">
              <BreakdownDonut
                segments={donutSegments}
                centerLabel={`${Math.round(result.total / 1000)}k`}
                centerSubLabel="kr."
                size={140}
                className="w-36 h-36"
              />
              <div className="ml-4 self-center space-y-1">
                {donutSegments.map(s => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                    <span className="text-text-secondary dark:text-text-dark-secondary">{s.label}</span>
                    <span className="font-semibold text-text-primary dark:text-text-dark-primary ml-auto">
                      {s.value.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project hint */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-xs text-info-strong dark:text-info leading-snug">
              Gem lønudgiften som opgave og brug den direkte i dit tilbud via <strong>Gem til Projekt</strong>.
            </p>
          </div>
        </div>
      </div>
    </CalculatorPage>
    <ConfirmDialog
      isOpen={showUpgradeDialog}
      title="Pro-funktion"
      message="Avanceret tilstand kræver Pro-abonnement. Vil du opgradere nu?"
      confirmLabel="Opgrader til Pro"
      onConfirm={() => { upgradeTo('PRO'); setShowUpgradeDialog(false); }}
      onCancel={() => setShowUpgradeDialog(false)}
    />
    </>
  );
};

export default LaborCostCalculator;
