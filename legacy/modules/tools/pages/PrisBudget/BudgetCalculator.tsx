import React, { useState, useCallback, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import CalculatorModeToggle, { type CalcMode } from '../../components/CalculatorModeToggle';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import BreakdownDonut from '../../components/viz/BreakdownDonut';
import BreakdownBar from '../../components/viz/BreakdownBar';
import { PlusIcon, TrashIcon, AlertTriangleIcon } from '../../../../components/icons';
import { computeBudget, computeStagedCashflow, type BudgetLineItem } from '../../catalog';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { useSubscription } from '../../../../contexts/SubscriptionContext';
import { InfoHint } from '../../../../components/ui';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

const HELP: HelpContent = {
  formaal:
    'Beregner det samlede projektbudget ud fra budgetposter (materialer, arbejdsløn, øvrige). ' +
    'Basis-tilstand inkluderer buffer og moms. Avanceret tilstand tilføjer overhead-procent.',
  variabler: [
    { name: 'Subtotal', symbol: 'Σ', unit: 'kr.', description: 'Sum af alle budgetposter ekskl. overhead og buffer.' },
    { name: 'Overhead', symbol: 'OH', unit: '%', description: 'Administration, forsikring og profit-margen (kun avanceret).' },
    { name: 'Buffer', symbol: 'B', unit: '%', description: '10–15% anbefales for renovering; 5–10% for nybyggeri.' },
    { name: 'Moms', symbol: 'moms', unit: '25%', description: 'Dansk moms er 25% på momspligtige ydelser og materialer.' },
  ],
  formel:
    'Subtotal = Σ poster\n' +
    'Overhead = Subtotal × OH%\n' +
    'Buffer = (Subtotal + Overhead) × B%\n' +
    'Total ekskl. moms = Subtotal + Overhead + Buffer\n' +
    'Moms = Total ekskl. moms × 0,25\n' +
    'Total inkl. moms = Total ekskl. moms + Moms',
  antagelser:
    'Moms 25% gælder for momspligtige ydelser og materialer. ' +
    'Buffer dækker uforudsete udgifter og prisstigninger. ' +
    'Overhead dækker ikke direkte produktionsomkostninger.',
  standarder: 'Momsloven § 4 — 25% moms på de fleste varer og ydelser i Danmark.',
};

interface BudgetItem {
  id: number;
  name: string;
  cost: string;
  type: 'material' | 'labor' | 'other';
}

const TYPE_LABELS: Record<BudgetItem['type'], string> = {
  material: 'Materiale',
  labor: 'Arbejdsløn',
  other: 'Øvrige',
};

const TYPE_COLORS: Record<BudgetItem['type'], string> = {
  material: '#3b82f6',
  labor: '#10b981',
  other: '#f59e0b',
};

// ── Staged-payment / cash-flow (Advanced) ────────────────────────────────────
interface CashflowPhase {
  id: number;
  name: string;
  pct: string;
}

// Typiske danske byggefaser med standardandele der summer til 100%.
const DEFAULT_PHASES: Array<Omit<CashflowPhase, 'id'>> = [
  { name: 'Jordarbejde / fundament', pct: '15' },
  { name: 'Råhus (bærende)', pct: '30' },
  { name: 'Lukket / tæt (tag, facade, vinduer)', pct: '25' },
  { name: 'Aptering (indvendig)', pct: '20' },
  { name: 'Færdiggørelse / finish', pct: '10' },
];

// Faste farver til fase-søjlen og fase-prikker (cykler ved flere faser).
const PHASE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

const fmtDKK = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 });

const BudgetCalculator: React.FC = () => {
  const { advancedAllowed } = useToolAccess('projektbudget');
  const { upgradeTo } = useSubscription();
  const [mode, setMode] = useState<CalcMode>('basic');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<BudgetItem[]>([
    { id: 1, name: 'Materialer', cost: '50000', type: 'material' },
    { id: 2, name: 'Arbejdsløn', cost: '30000', type: 'labor' },
  ]);
  const [contingency, setContingency] = useState('10');
  const [overhead, setOverhead] = useState('0');
  const [includeVat, setIncludeVat] = useState(true);
  // Betalingsplan / byggefaser (kun avanceret tilstand)
  const [cashflowVatMode, setCashflowVatMode] = useState<'incl' | 'excl'>('incl');
  const [phases, setPhases] = useState<CashflowPhase[]>(() =>
    DEFAULT_PHASES.map((p, i) => ({ id: i + 1, ...p })));

  const addItem = useCallback(() =>
    setItems(prev => [...prev, { id: Date.now(), name: '', cost: '', type: 'material' }]), []);
  const removeItem = useCallback((id: number) =>
    setItems(prev => prev.filter(i => i.id !== id)), []);
  const updateItem = useCallback((id: number, field: keyof BudgetItem, value: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i)), []);

  const addPhase = useCallback(() =>
    setPhases(prev => [...prev, { id: Date.now(), name: '', pct: '' }]), []);
  const removePhase = useCallback((id: number) =>
    setPhases(prev => prev.filter(p => p.id !== id)), []);
  const updatePhase = useCallback((id: number, field: 'name' | 'pct', value: string) =>
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p)), []);

  const result = useMemo(() => {
    const lineItems: BudgetLineItem[] = items.map(i => ({
      name: i.name || 'Post',
      amount: parseFloat(i.cost) || 0,
      type: i.type,
    }));
    return computeBudget({
      items: lineItems,
      contingencyPct: parseFloat(contingency) || 0,
      overheadPct: mode === 'advanced' ? (parseFloat(overhead) || 0) : 0,
      includeVat,
    });
  }, [items, contingency, overhead, includeVat, mode]);

  // Grundlag for betalingsplanen — uafhængigt af "Inkl. moms"-toggle ovenfor.
  const cashflowBaseDKK = cashflowVatMode === 'incl'
    ? result.totalExVat * 1.25
    : result.totalExVat;

  const cashflow = useMemo(() => computeStagedCashflow({
    totalBudgetDKK: cashflowBaseDKK,
    phases: phases.map(p => ({ name: p.name || 'Fase', pct: parseFloat(p.pct) || 0 })),
  }), [cashflowBaseDKK, phases]);

  const donutSegments = useMemo(() => {
    const segs = [
      { label: 'Materialer', value: result.materialTotal, color: TYPE_COLORS.material },
      { label: 'Arbejdsløn', value: result.laborTotal, color: TYPE_COLORS.labor },
      { label: 'Øvrige', value: result.otherTotal, color: TYPE_COLORS.other },
      ...(result.overhead > 0 ? [{ label: 'Overhead', value: result.overhead, color: '#8b5cf6' }] : []),
      ...(result.contingency > 0 ? [{ label: 'Buffer', value: result.contingency, color: '#64748b' }] : []),
      ...(result.vat > 0 ? [{ label: 'Moms', value: result.vat, color: '#f97316' }] : []),
    ].filter(s => s.value > 0);
    return segs;
  }, [result]);

  const barSegments = donutSegments.map(s => ({ ...s }));

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Budget Beregner',
    category: 'Pris & Budget',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      ...items.map(item => ({
        label: item.name || 'Post',
        value: (parseFloat(item.cost) || 0).toFixed(0),
        unit: 'kr.',
      })),
      { label: 'Buffer', value: contingency, unit: '%' },
      ...(mode === 'advanced' ? [{ label: 'Overhead', value: overhead, unit: '%' }] : []),
      { label: 'Inkl. moms', value: includeVat ? 'Ja' : 'Nej' },
    ],
    results: [
      { label: 'Total', value: result.total.toFixed(0), unit: 'kr.', highlight: true },
      { label: 'Subtotal', value: result.subtotal.toFixed(0), unit: 'kr.' },
      { label: 'Buffer', value: result.contingency.toFixed(0), unit: 'kr.' },
      { label: 'I alt ekskl. moms', value: result.totalExVat.toFixed(0), unit: 'kr.' },
      ...(result.vat > 0 ? [{ label: 'Moms 25%', value: result.vat.toFixed(0), unit: 'kr.' }] : []),
    ],
    breakdown: [
      { label: 'Materialer', value: result.materialTotal.toFixed(0), unit: 'kr.' },
      { label: 'Arbejdsløn', value: result.laborTotal.toFixed(0), unit: 'kr.' },
      { label: 'Øvrige', value: result.otherTotal.toFixed(0), unit: 'kr.' },
      ...(result.overhead > 0 ? [{ label: 'Overhead', value: result.overhead.toFixed(0), unit: 'kr.' }] : []),
      // Betalingsplan / byggefaser — kun i avanceret tilstand.
      ...(mode === 'advanced'
        ? [
            { label: `— Betalingsplan (${cashflowVatMode === 'incl' ? 'inkl.' : 'ekskl.'} moms)`, value: fmtDKK(cashflowBaseDKK), unit: 'kr.' },
            ...cashflow.phases.map((p, i) => ({
              label: `Fase ${i + 1}: ${p.name} (${p.pct}%) — akk. ${fmtDKK(p.cumulativeDKK)} kr.`,
              value: p.amountDKK.toFixed(0),
              unit: 'kr.',
            })),
          ]
        : []),
    ],
    formula: HELP.formel,
    standardsStruktureret: [
      { code: 'Momsloven § 4', note: '25% moms på de fleste varer og ydelser i Danmark.' },
    ],
    infographicRef,
  }), [mode, items, contingency, overhead, includeVat, result, cashflow, cashflowBaseDKK, cashflowVatMode]);

  const shareText = result.total > 0
    ? `Projektbudget: ${result.total.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.${includeVat ? ' inkl. moms' : ' ekskl. moms'}`
    : undefined;

  return (
    <>
    <CalculatorPage
      title="Projektbudget"
      stickyResultLabel="Total"
      stickyResult={
        <><AnimatedNumber value={result.total} precision={0} /> kr.</>
      }
      shareValue={shareText}
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle
          toolId="projektbudget"
          advancedLocked={!advancedAllowed}
          onChange={setMode}
          onLockedClick={() => setShowUpgradeDialog(true)}
        />
      }
    >
      <div className="grid md:grid-cols-2 gap-6 items-start p-2">
        {/* ── Inputs ── */}
        <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Budgetposter</h3>

          {items.map(item => (
            <div key={item.id} className="flex gap-2 items-end">
              <div className="flex-grow min-w-0">
                <label className="text-xs text-text-secondary dark:text-text-dark-secondary mb-1 block">Post</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  className="w-full border border-border dark:border-border-dark rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                  placeholder="Navn"
                />
              </div>
              <div className="w-32 shrink-0">
                <InputField
                  label="Beløb"
                  value={item.cost}
                  onChange={e => updateItem(item.id, 'cost', e.target.value)}
                  unit="kr."
                />
              </div>
              <div className="shrink-0">
                <label className="text-xs text-text-secondary dark:text-text-dark-secondary mb-1 block">Type</label>
                <select
                  value={item.type}
                  onChange={e => updateItem(item.id, 'type', e.target.value)}
                  aria-label="Budgettype"
                  className="border border-border dark:border-border-dark rounded-lg px-2 py-2 text-xs bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                >
                  {(Object.keys(TYPE_LABELS) as BudgetItem['type'][]).map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => removeItem(item.id)}
                aria-label="Slet post"
                className="h-11 w-10 flex items-center justify-center text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark rounded-lg shrink-0"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}

          <button
            onClick={addItem}
            className="flex items-center text-brand-primary font-semibold text-sm min-h-[44px]"
          >
            <PlusIcon className="w-4 h-4 mr-1" /> Tilføj Post
          </button>

          <div className="pt-4 border-t border-border dark:border-border-dark space-y-3">
            <InputField
              label="Uforudsete udgifter (buffer)"
              value={contingency}
              onChange={e => setContingency(e.target.value)}
              unit="%"
              info="10–15% anbefales til renovering. 5–10% til nybyggeri."
            />
            {mode === 'advanced' && (
              <InputField
                label="Overhead"
                value={overhead}
                onChange={e => setOverhead(e.target.value)}
                unit="%"
                info="Administration, forsikring og profit-margen."
              />
            )}
            <div className="flex items-center gap-3">
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
        </div>

        {/* ── Results ── */}
        <div className="space-y-4">
          <ResultDisplay label="Estimeret Total" value={result.total} precision={0} unit="kr." />

          {/* Summary rows */}
          <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-2">
            <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-3">Opgørelse</h4>
            {[
              { label: 'Subtotal', value: result.subtotal },
              ...(result.overhead > 0 ? [{ label: `Overhead (${overhead}%)`, value: result.overhead }] : []),
              { label: `Buffer (${contingency}%)`, value: result.contingency },
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
            <div className="flex justify-between text-base font-extrabold text-brand-primary dark:text-brand-light pt-2">
              <span>TOTAL</span>
              <AnimatedNumber value={result.total} precision={0} /> <span className="ml-1">kr.</span>
            </div>
          </div>

          {/* Donut breakdown */}
          {donutSegments.length > 0 && (
            <div ref={infographicRef} className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark">
              <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-3">Fordeling</h4>
              <div className="flex gap-4 items-center">
                <div className="w-32 shrink-0">
                  <BreakdownDonut
                    segments={donutSegments}
                    centerLabel={`${Math.round(result.total / 1000)}k`}
                    centerSubLabel="kr."
                    size={128}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <BreakdownBar segments={barSegments} unit="kr." showLegend />
                </div>
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
              Gem budgettet som indkøb og brug det direkte i dit tilbud via <strong>Gem til Projekt</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Betalingsplan / byggefaser (kun avanceret tilstand) ── */}
      {mode === 'advanced' && (
        <div className="mt-6 bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-4">
          <div className="flex items-center gap-1">
            <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Betalingsplan / byggefaser</h3>
            <InfoHint
              title="Betalingsplan / byggefaser"
              description="Fordeler projektets samlede budget ud på typiske byggefaser og giver en betalings-/trækplan (draw-down): hvor meget der udbetales i hver fase, og hvad der er akkumuleret undervejs."
              calculation="Beløb pr. fase = total × fase% ; Akkumuleret = løbende sum af faserne"
            />
          </div>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary -mt-2">
            Fordel <strong>{fmtDKK(cashflowBaseDKK)} kr.</strong> ({cashflowVatMode === 'incl' ? 'inkl.' : 'ekskl.'} moms) på byggefaser.
          </p>

          {/* Fordelingsgrundlag: ex/incl moms */}
          <div>
            <label className="flex items-center gap-1 text-sm font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
              Fordelingsgrundlag
              <InfoHint
                title="Fordelingsgrundlag"
                description="Vælg om betalingsplanen skal fordele projektets total inkl. eller ekskl. moms. Dette er uafhængigt af 'Inkl. 25% moms'-indstillingen for budgettet ovenfor."
                calculation="Inkl. moms = total ekskl. moms × 1,25"
              />
            </label>
            <select
              aria-label="Fordelingsgrundlag"
              value={cashflowVatMode}
              onChange={e => setCashflowVatMode(e.target.value as 'incl' | 'excl')}
              className="w-full border border-border-strong dark:border-border-dark-strong rounded-lg px-3 py-2 bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary focus:ring-2 focus:ring-brand-primary/50 focus:outline-none"
            >
              <option value="incl">Total inkl. moms ({fmtDKK(result.totalExVat * 1.25)} kr.)</option>
              <option value="excl">Total ekskl. moms ({fmtDKK(result.totalExVat)} kr.)</option>
            </select>
          </div>

          {/* Fase-editor: navn + andel + slet */}
          <div className="space-y-2">
            {phases.map((p, idx) => (
              <div key={p.id} className="flex gap-2 items-end">
                <span
                  className="mb-3 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length] }}
                  aria-hidden="true"
                />
                <div className="flex-grow min-w-0">
                  <label className="text-xs text-text-secondary dark:text-text-dark-secondary mb-1 block">Fase</label>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updatePhase(p.id, 'name', e.target.value)}
                    className="w-full border border-border dark:border-border-dark rounded-lg px-3 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                    placeholder="Fasenavn"
                  />
                </div>
                <div className="w-24 shrink-0">
                  <InputField
                    label="Andel"
                    value={p.pct}
                    onChange={e => updatePhase(p.id, 'pct', e.target.value)}
                    unit="%"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePhase(p.id)}
                  aria-label="Slet fase"
                  className="h-11 w-10 flex items-center justify-center text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark rounded-lg shrink-0"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPhase}
              className="flex items-center text-brand-primary font-semibold text-sm min-h-[44px]"
            >
              <PlusIcon className="w-4 h-4 mr-1" /> Tilføj fase
            </button>
          </div>

          {/* Advarsel hvis faserne ikke summer til 100% */}
          {!cashflow.balanced && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning bg-warning-subtle p-3 dark:bg-warning-subtle-dark">
              <AlertTriangleIcon className="w-5 h-5 text-warning shrink-0" />
              <p className="text-xs text-warning-strong dark:text-warning leading-snug">
                Faserne summer til <strong>{cashflow.totalPct.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%</strong> — ikke 100%.
                {cashflow.totalPct < 100
                  ? ' En del af budgettet er ikke fordelt.'
                  : ' Faserne overstiger budgettet.'} Juster andelene, så de giver 100%.
              </p>
            </div>
          )}

          {/* Stablet søjle over fasernes beløb */}
          {cashflowBaseDKK > 0 && cashflow.totalPct > 0 && (
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-bg-muted dark:bg-bg-dark-muted">
              {cashflow.phases.map((p, idx) => {
                const denom = Math.max(cashflow.totalPct, 100);
                const w = denom > 0 ? (p.pct / denom) * 100 : 0;
                if (w <= 0) return null;
                return (
                  <div
                    key={idx}
                    className="h-full"
                    style={{ width: `${w}%`, backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length] }}
                    title={`${p.name}: ${fmtDKK(p.amountDKK)} kr. (${p.pct}%)`}
                  />
                );
              })}
            </div>
          )}

          {/* Tabel: fase · % · beløb · akkumuleret (trækplan) */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary border-b border-border dark:border-border-dark">
                  <th className="py-2 pr-2 font-semibold">Fase</th>
                  <th className="py-2 px-2 font-semibold text-right">%</th>
                  <th className="py-2 px-2 font-semibold text-right">Beløb</th>
                  <th className="py-2 pl-2 font-semibold text-right">
                    <span className="inline-flex items-center gap-1">
                      Akkumuleret
                      <InfoHint
                        title="Akkumuleret (trækplan)"
                        description="Den løbende sum af faserne — altså hvor meget der samlet er udbetalt, når hver fase er afsluttet. Bruges som træk-/betalingsplan gennem byggeriet."
                        calculation="Akkumuleret = sum af beløb til og med denne fase"
                      />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {cashflow.phases.map((p, idx) => (
                  <tr key={idx} className="border-b border-border dark:border-border-dark last:border-0">
                    <td className="py-2 pr-2 text-text-primary dark:text-text-dark-primary">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PHASE_COLORS[idx % PHASE_COLORS.length] }} aria-hidden="true" />
                        {p.name}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-text-secondary dark:text-text-dark-secondary">{p.pct}%</td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold text-text-primary dark:text-text-dark-primary">{fmtDKK(p.amountDKK)} kr.</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-text-secondary dark:text-text-dark-secondary">{fmtDKK(p.cumulativeDKK)} kr.</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-text-primary dark:text-text-dark-primary">
                  <td className="py-2 pr-2">I alt</td>
                  <td className="py-2 px-2 text-right tabular-nums">{cashflow.totalPct.toLocaleString('da-DK', { maximumFractionDigits: 1 })}%</td>
                  <td className="py-2 px-2 text-right tabular-nums">{fmtDKK(cashflow.phases.reduce((s, p) => s + p.amountDKK, 0))} kr.</td>
                  <td className="py-2 pl-2" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Planlægnings-note / juridisk disclaimer */}
          <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="flex-1 text-xs text-info-strong dark:text-info leading-snug">
              Ratebetalinger bør følge byggeriets faktiske stade. Dette er et planlægningsværktøj — ikke en juridisk bindende betalingsplan.
              Aftal de reelle vilkår i entrepriseaftalen (fx AB-Forbruger).
            </p>
            <InfoHint
              title="Betalingsplan i praksis"
              description="Fordelingen her er vejledende. Ratebetalinger skal følge byggeriets faktiske fremdrift/stade, og de bindende vilkår aftales i entrepriseaftalen. For forbrugeraftaler henvises til AB-Forbruger."
            />
          </div>
        </div>
      )}
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

export default BudgetCalculator;
