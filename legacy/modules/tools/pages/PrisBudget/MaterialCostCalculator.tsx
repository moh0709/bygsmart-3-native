import React, { useState, useCallback, useMemo, useRef } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import CalculatorModeToggle, { type CalcMode } from '../../components/CalculatorModeToggle';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import BreakdownBar from '../../components/viz/BreakdownBar';
import { PlusIcon, TrashIcon } from '../../../../components/icons';
import { computeMaterialCost } from '../../catalog';
import type { HelpContent, CalculatorReportData } from '../../components/CalculatorPage';
import { useToolAccess } from '../../../../contexts/ToolAccessProvider';
import { useSubscription } from '../../../../contexts/SubscriptionContext';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';

const HELP: HelpContent = {
  formaal:
    'Beregner den samlede materialeomkostning for en liste af varer. ' +
    'Avanceret tilstand tilføjer spildfaktor og beregner moms separat.',
  variabler: [
    { name: 'Antal', symbol: 'Q', unit: 'stk./m/m²', description: 'Den bestilte eller forbrugte mængde.' },
    { name: 'Enhedspris', symbol: 'P', unit: 'kr.', description: 'Pris per enhed ekskl. moms.' },
    { name: 'Spild', symbol: 's', unit: '%', description: 'Typisk 5–10% for gipsplader, fliser m.m.' },
  ],
  formel:
    'Subtotal = Σ (Q × P)\n' +
    'Spild = Subtotal × s%\n' +
    'Total ekskl. moms = Subtotal + Spild\n' +
    'Moms = Total ekskl. moms × 0,25\n' +
    'Total = Total ekskl. moms + Moms',
  antagelser:
    'Priser er ekskl. moms — moms beregnes separat som 25%. ' +
    'Spildfaktor dækker kap-, klipp- og montagesvind.',
  standarder: 'Momsloven § 4 — 25% moms. Spildfaktorer iht. leverandøranbefalinger.',
};

interface MaterialItem {
  id: number;
  name: string;
  qty: string;
  price: string;
}

const ITEM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const MaterialCostCalculator: React.FC = () => {
  const { advancedAllowed } = useToolAccess('materialeomkostning');
  const { upgradeTo } = useSubscription();
  const [mode, setMode] = useState<CalcMode>('basic');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<MaterialItem[]>([
    { id: 1, name: 'Gipsplader', qty: '20', price: '89' },
  ]);
  const [wastagePct, setWastagePct] = useState('5');
  const [includeVat, setIncludeVat] = useState(true);

  const addItem = useCallback(() =>
    setItems(prev => [...prev, { id: Date.now(), name: '', qty: '', price: '' }]), []);
  const removeItem = useCallback((id: number) =>
    setItems(prev => prev.filter(i => i.id !== id)), []);
  const updateItem = useCallback((id: number, field: keyof MaterialItem, val: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i)), []);

  const result = useMemo(() => computeMaterialCost({
    items: items.map(i => ({
      name: i.name || 'Vare',
      qty: parseFloat(i.qty) || 0,
      unitPrice: parseFloat(i.price) || 0,
    })).filter(i => i.qty > 0 && i.unitPrice > 0),
    wastagePct: mode === 'advanced' ? (parseFloat(wastagePct) || 0) : 0,
    includeVat,
  }), [items, wastagePct, includeVat, mode]);

  const lineItems = useMemo(() =>
    items
      .map(i => ({ name: i.name || 'Vare', value: (parseFloat(i.qty) || 0) * (parseFloat(i.price) || 0) }))
      .filter(i => i.value > 0),
    [items]);

  const barSegments = lineItems.map((item, idx) => ({
    label: item.name,
    value: item.value,
    color: ITEM_COLORS[idx % ITEM_COLORS.length],
  }));

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'Materialomkostninger',
    category: 'Pris & Budget',
    mode: mode === 'advanced' ? 'Avanceret' : 'Basis',
    inputs: [
      ...items.map(item => ({
        label: item.name || 'Vare',
        value: `${item.qty || '0'} × ${item.price || '0'}`,
        unit: 'kr.',
      })),
      ...(mode === 'advanced' ? [{ label: 'Spildfaktor', value: wastagePct, unit: '%' }] : []),
      { label: 'Inkl. moms', value: includeVat ? 'Ja' : 'Nej' },
    ],
    results: [
      { label: 'Varekost', value: result.subtotal.toFixed(0), unit: 'kr.' },
      ...(result.wastage > 0 ? [{ label: `Spild (${wastagePct}%)`, value: result.wastage.toFixed(0), unit: 'kr.' }] : []),
      { label: 'I alt ekskl. moms', value: result.totalExVat.toFixed(0), unit: 'kr.' },
      ...(result.vat > 0 ? [{ label: 'Moms 25%', value: result.vat.toFixed(0), unit: 'kr.' }] : []),
      { label: 'Total', value: result.total.toFixed(0), unit: 'kr.', highlight: true },
    ],
    breakdown: lineItems.map(item => ({
      label: item.name,
      value: item.value.toFixed(0),
      unit: 'kr.',
    })),
    formula: 'Subtotal = Σ (Q × P)\nSpild = Subtotal × s%\nTotal ekskl. moms = Subtotal + Spild\nMoms = Total ekskl. moms × 0,25\nTotal = Total ekskl. moms + Moms',
    standardsStruktureret: [
      { code: 'Momsloven', clause: '§ 4', note: '25% moms' },
    ],
    infographicRef,
  }), [mode, items, wastagePct, includeVat, result, lineItems]);

  const shareText = result.total > 0
    ? `Materialeomkostning: ${result.total.toLocaleString('da-DK', { maximumFractionDigits: 0 })} kr.`
    : undefined;

  return (
    <>
    <CalculatorPage
      title="Materialeomkostning"
      stickyResultLabel="Total"
      stickyResult={<><AnimatedNumber value={result.total} precision={0} /> kr.</>}
      shareValue={shareText}
      helpContent={HELP}
      reportData={reportData}
      modeToggle={
        <CalculatorModeToggle
          toolId="materialeomkostning"
          advancedLocked={!advancedAllowed}
          onChange={setMode}
          onLockedClick={() => setShowUpgradeDialog(true)}
        />
      }
    >
      <div className="space-y-5 p-2">
        {/* Items table */}
        <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-base text-text-primary dark:text-text-dark-primary">Materialeliste</h3>
            <div className="text-xl font-bold text-brand-primary dark:text-brand-light">
              <AnimatedNumber value={result.total} precision={0} /> kr.
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-2 px-1">
            <div className="col-span-5">Navn</div>
            <div className="col-span-2 text-right">Antal</div>
            <div className="col-span-3 text-right">Stk. pris</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  <input
                    type="text"
                    placeholder="Vare"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    className="w-full border border-border dark:border-border-dark rounded-lg px-2 py-2 text-sm bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    placeholder="0"
                    value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    className="w-full border border-border dark:border-border-dark rounded-lg px-2 py-2 text-sm text-right bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    placeholder="0"
                    value={item.price}
                    onChange={e => updateItem(item.id, 'price', e.target.value)}
                    className="w-full border border-border dark:border-border-dark rounded-lg px-2 py-2 text-sm text-right bg-bg dark:bg-bg-dark-surface text-text-primary dark:text-text-dark-primary min-h-[44px]"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <span className="text-xs font-bold text-text-primary dark:text-text-dark-primary">
                    {((parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0)).toLocaleString('da-DK', { maximumFractionDigits: 0 })}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    aria-label="Slet"
                    className="text-danger p-1 hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addItem}
            className="mt-4 flex items-center gap-2 text-brand-primary font-semibold text-sm min-h-[44px]"
          >
            <PlusIcon className="w-4 h-4" /> Tilføj linje
          </button>

          {/* Advanced options */}
          <div className="mt-4 pt-4 border-t border-border dark:border-border-dark flex flex-wrap gap-4 items-center">
            {mode === 'advanced' && (
              <div className="w-40">
                <InputField
                  label="Spildfaktor"
                  value={wastagePct}
                  onChange={e => setWastagePct(e.target.value)}
                  unit="%"
                  info="Typisk 5–10% for kap og klip."
                />
              </div>
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

        {/* Results breakdown */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark space-y-2">
            <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-3">Opgørelse</h4>
            {[
              { label: 'Varekost', value: result.subtotal },
              ...(result.wastage > 0 ? [{ label: `Spild (${wastagePct}%)`, value: result.wastage }] : []),
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
              <span><AnimatedNumber value={result.total} precision={0} /> kr.</span>
            </div>
          </div>

          {barSegments.length > 1 && (
            <div ref={infographicRef} className="bg-bg dark:bg-bg-dark-surface p-5 rounded-xl border border-border dark:border-border-dark">
              <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-3">Varefordeling</h4>
              <BreakdownBar segments={barSegments} unit="kr." showLegend />
            </div>
          )}
        </div>

        {/* Project hint */}
        <div className="bg-info-subtle dark:bg-info-subtle-dark rounded-xl p-3 border border-info-border dark:border-info/30 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-info-strong dark:text-info mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-xs text-info-strong dark:text-info leading-snug">
            Gem materialeomkostningen som indkøb og brug den direkte i dit tilbud via <strong>Gem til Projekt</strong>.
          </p>
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

export default MaterialCostCalculator;
