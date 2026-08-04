
import React, { useState, useMemo, useCallback } from 'react';
import CalculatorPage from '../../components/CalculatorPage';
import type { CalculatorReportData } from '../../components/CalculatorPage';
import type { HelpContent } from '../../components/HelpDrawer';
import InputField from '../../components/InputField';
import ResultDisplay from '../../components/ResultDisplay';
import AnimatedNumber from '../../components/AnimatedNumber';
import CalculatorModeToggle from '../../components/CalculatorModeToggle';
import type { CalcMode } from '../../components/CalculatorModeToggle';
import { TrashIcon, PlusIcon } from '../../../../components/icons';

// ── Types ─────────────────────────────────────────────────────────────────────

type LifecyclePhase = 'A1-A3' | 'A4' | 'B1-B7' | 'C3-C4';

interface MaterialEntry {
  id: number;
  materialName: string;
  weightKg: string;
  factor: number;         // kg CO2e / kg  (A1-A3)
  isWood: boolean;
  // Advanced: per-phase multipliers relative to A1-A3
  a4Factor: number;       // transport
  b1b7Factor: number;     // use-stage
  c3c4Factor: number;     // end-of-life
  activePhases: LifecyclePhase[];
}

// ── Material database ─────────────────────────────────────────────────────────

const MATERIALS = [
  { name: 'Beton (Standard)',       factor: 0.13,  isWood: false, a4: 0.005, b: 0.00, c: 0.02 },
  { name: 'Armeret Beton',          factor: 0.16,  isWood: false, a4: 0.005, b: 0.00, c: 0.02 },
  { name: 'Konstruktionstræ',       factor: 0.20,  isWood: true,  a4: 0.008, b: 0.00, c: 0.05 },
  { name: 'KL-Træ (CLT)',           factor: 0.22,  isWood: true,  a4: 0.010, b: 0.00, c: 0.05 },
  { name: 'Stål (Jomfrueligt)',     factor: 1.80,  isWood: false, a4: 0.015, b: 0.01, c: 0.08 },
  { name: 'Stål (Genanvendt 30%)',  factor: 1.26,  isWood: false, a4: 0.015, b: 0.01, c: 0.08 },
  { name: 'Stål (Genanvendt 90%)',  factor: 0.54,  isWood: false, a4: 0.015, b: 0.01, c: 0.08 },
  { name: 'Mursten (Tegl)',         factor: 0.25,  isWood: false, a4: 0.006, b: 0.00, c: 0.01 },
  { name: 'Mineraluld (Glasuld)',   factor: 1.40,  isWood: false, a4: 0.012, b: 0.00, c: 0.04 },
  { name: 'EPS Polystyren',         factor: 3.29,  isWood: false, a4: 0.008, b: 0.00, c: 0.05 },
  { name: 'PIR Isolering',          factor: 3.80,  isWood: false, a4: 0.010, b: 0.00, c: 0.05 },
  { name: 'Gipsplade',              factor: 0.25,  isWood: false, a4: 0.005, b: 0.00, c: 0.02 },
  { name: 'Aluminium (Jomfru.)',    factor: 8.00,  isWood: false, a4: 0.020, b: 0.01, c: 0.10 },
  { name: 'Aluminium (Genanv.)',    factor: 1.20,  isWood: false, a4: 0.020, b: 0.01, c: 0.05 },
  { name: 'Glas (Float)',           factor: 0.86,  isWood: false, a4: 0.010, b: 0.00, c: 0.03 },
  { name: 'PVC (rør/vinduer)',      factor: 2.41,  isWood: false, a4: 0.012, b: 0.01, c: 0.08 },
];

// Biogenic carbon storage factor for wood: −1.65 kg CO2e per kg dry wood (EN 16449)
const BIOGENIC_FACTOR = -1.65;

const PHASE_LABELS: Record<LifecyclePhase, string> = {
  'A1-A3': 'A1-A3 Produktion',
  'A4':    'A4 Transport',
  'B1-B7': 'B1-B7 Drift',
  'C3-C4': 'C3-C4 Bortskaffelse',
};

// ── Help content ──────────────────────────────────────────────────────────────

const helpContent: HelpContent = {
  formaal:
    'Estimerer CO₂-aftryk for byggematerialer i produktionsfasen (A1-A3) baseret på GWP-faktorer fra EPD\'er. ' +
    'Avanceret tilstand tilføjer livscyklusfaser A4 (transport), B1-B7 (drift) og C3-C4 (bortskaffelse) samt biogent kulstoflag i træmaterialer.',
  variabler: [
    { name: 'GWP-faktor', symbol: 'f_GWP', unit: 'kg CO₂e/kg', description: 'Globalt opvarmningspotentiale pr. kg materiale (fra EPD eller gennemsnitsdatabase).' },
    { name: 'Masse', symbol: 'm', unit: 'kg', description: 'Total masse af materialet i konstruktionen.' },
    { name: 'CO₂-bidrag', symbol: 'E', unit: 'kg CO₂e', description: 'E = m × f_GWP for hvert materiale.' },
    { name: 'Biogent kulstof', symbol: 'C_bio', unit: 'kg CO₂e', description: 'Midlertidigt lagret CO₂ i træmaterialer: −1,65 kg CO₂e/kg tørtræ (EN 16449).' },
  ],
  formel:
    'A1-A3: E_i = m_i × f_GWP,i\n' +
    'Total (A1-A3): Σ E_i\n\n' +
    'Med biogent kulstof (avanceret):\nC_bio = −1,65 × m_træ  [kg CO₂e lagret]\n\n' +
    'Total livscyklus (avanceret):\nE_total = Σ(E_A1-A3 + E_A4 + E_B + E_C) + C_bio',
  antagelser:
    'GWP-faktorer er afrundede gennemsnitsværdier fra generiske databaser (Ökobaudat, ICE Database). ' +
    'Præcise beregninger kræver produktspecifikke EPD\'er. Biogent kulstof er kun optaget som midlertidigt lager og tilbageregnes ved bortskaffelse medmindre materialet genanvendes.',
  standarder:
    'DS/EN 15978 – Bæredygtighedsvurdering af bygninger (LCA)\n' +
    'DS/EN ISO 14040/14044 – Livscyklusvurdering\n' +
    'DS/EN 16449 – Træ og træbaserede produkter – Biogent kulstof\n' +
    'EPD-faktorer fra certifikat­udstedere (f.eks. EPD-Danmark, IBU)',
  disclaimer: (
    <span>
      LCA Light er kun vejledende (orden-af-størrelse). En certificeret LCA kræver produktspecifikke EPD'er og verificeret beregningssoftware.
    </span>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const newId = () => Date.now() + Math.floor(Math.random() * 10000);

const defaultEntry = (): MaterialEntry => {
  const mat = MATERIALS[0];
  return {
    id: newId(),
    materialName: mat.name,
    weightKg: '1000',
    factor: mat.factor,
    isWood: mat.isWood,
    a4Factor: mat.a4,
    b1b7Factor: mat.b,
    c3c4Factor: mat.c,
    activePhases: ['A1-A3'],
  };
};

// ── Main component ────────────────────────────────────────────────────────────

const Co2Calculator: React.FC = () => {
  const [mode, setMode] = useState<CalcMode>('basic');
  const handleModeChange = useCallback((m: CalcMode) => setMode(m), []);

  const [items, setItems] = useState<MaterialEntry[]>([defaultEntry()]);
  const [includeBiogenic, setIncludeBiogenic] = useState(true);

  // ── CRUD ──
  const addItem = () => {
    setItems(prev => [...prev, defaultEntry()]);
  };
  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: number, patch: Partial<MaterialEntry>) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const handleMaterialChange = (id: number, name: string) => {
    const mat = MATERIALS.find(m => m.name === name);
    if (mat) updateItem(id, { materialName: mat.name, factor: mat.factor, isWood: mat.isWood, a4Factor: mat.a4, b1b7Factor: mat.b, c3c4Factor: mat.c });
  };

  const togglePhase = (id: number, phase: LifecyclePhase) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const active = i.activePhases.includes(phase)
        ? i.activePhases.filter(p => p !== phase)
        : [...i.activePhases, phase];
      // A1-A3 always active
      return { ...i, activePhases: active.includes('A1-A3') ? active : ['A1-A3', ...active] };
    }));
  };

  // ── Calculations ──
  const itemResults = useMemo(() => {
    return items.map(item => {
      const w = parseFloat(item.weightKg) || 0;
      const a1a3 = w * item.factor;
      const a4 = w * item.a4Factor;
      const b = w * item.b1b7Factor;
      const c = w * item.c3c4Factor;
      const biogenic = (item.isWood && includeBiogenic) ? w * BIOGENIC_FACTOR : 0;

      const phaseSum = (mode === 'advanced')
        ? a1a3 +
          (item.activePhases.includes('A4') ? a4 : 0) +
          (item.activePhases.includes('B1-B7') ? b : 0) +
          (item.activePhases.includes('C3-C4') ? c : 0) +
          biogenic
        : a1a3;

      return { a1a3, a4, b, c, biogenic, total: phaseSum };
    });
  }, [items, mode, includeBiogenic]);

  const totals = useMemo(() => {
    const a1a3 = itemResults.reduce((s, r) => s + r.a1a3, 0);
    const total = itemResults.reduce((s, r) => s + r.total, 0);
    const biogenic = itemResults.reduce((s, r) => s + r.biogenic, 0);
    return { a1a3, total, biogenic };
  }, [itemResults]);

  const reportData = useMemo<CalculatorReportData>(() => ({
    toolName: 'CO2 Beregner',
    category: 'Energi & Klima',
    mode: mode === 'advanced' ? 'Avanceret (livscyklus)' : 'Basis (A1-A3)',
    inputs: items.map((item, idx) => ({
      label: `Materiale ${idx + 1}: ${item.materialName}`,
      value: (parseFloat(item.weightKg) || 0).toFixed(0),
      unit: 'kg',
    })),
    results: [
      {
        label: 'Total CO₂ – A1-A3 (produktion)',
        value: totals.a1a3.toFixed(1),
        unit: 'kg CO₂e',
        highlight: true,
      },
      ...(mode === 'advanced' && totals.total !== totals.a1a3
        ? [
            ...(totals.biogenic !== 0
              ? [{ label: 'Biogent kulstof (lagret)', value: totals.biogenic.toFixed(1), unit: 'kg CO₂e' }]
              : []),
            { label: 'Total livscyklus (valgte faser)', value: totals.total.toFixed(1), unit: 'kg CO₂e' },
          ]
        : []),
    ],
    breakdown: items.map((item, idx) => ({
      label: `${item.materialName} (${item.weightKg} kg)`,
      value: itemResults[idx].a1a3.toFixed(1),
      unit: 'kg CO₂e',
    })),
    formula:
      'A1-A3: E_i = m_i × f_GWP,i | Total (A1-A3): Σ E_i | Biogent: C_bio = −1,65 × m_træ | Total livscyklus: E_total = Σ(E_A1-A3 + E_A4 + E_B + E_C) + C_bio',
    standardsStruktureret: [
      { code: 'DS/EN 15978', note: 'Bæredygtighedsvurdering af bygninger (LCA)' },
      { code: 'DS/EN ISO 14040', note: 'Livscyklusvurdering' },
      { code: 'DS/EN 16449', note: 'Træ og træbaserede produkter – Biogent kulstof' },
    ],
    safetyDisclaimer:
      'LCA Light er kun vejledende (orden-af-størrelse). En certificeret LCA kræver produktspecifikke EPD\'er og verificeret beregningssoftware.',
  }), [mode, items, itemResults, totals]);

  const modeToggle = (
    <CalculatorModeToggle toolId="co2-calculator" onChange={handleModeChange} className="w-56" />
  );

  return (
    <CalculatorPage
      title="CO₂-Aftryk (LCA Light)"
      helpContent={helpContent}
      modeToggle={modeToggle}
      stickyResultLabel="CO₂ A1-A3"
      stickyResult={<><AnimatedNumber value={totals.a1a3} precision={1} /> kg CO₂e</>}
      reportData={reportData}
    >
      <div className="space-y-6">
        {/* Advanced global options */}
        {mode === 'advanced' && (
          <div className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-sm border border-border dark:border-border-dark flex flex-wrap gap-4 items-center">
            <p className="text-sm font-bold text-text-primary dark:text-text-dark-primary">Livscyklusindstillinger:</p>
            <label className="flex items-center gap-2 text-sm text-text-primary dark:text-text-dark-primary cursor-pointer">
              <input
                type="checkbox"
                checked={includeBiogenic}
                onChange={e => setIncludeBiogenic(e.target.checked)}
                className="accent-brand-primary"
              />
              Inkludér biogent kulstof (træ lagrer CO₂)
            </label>
          </div>
        )}

        {/* Material list */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Materialeliste</h3>
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                {mode === 'basic' ? 'A1-A3: Materialeproduktion' : 'Vælg livscyklusfaser pr. materiale'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {items.map((item, idx) => {
              const res = itemResults[idx];
              const w = parseFloat(item.weightKg) || 0;

              return (
                <div key={item.id} className="bg-bg-subtle dark:bg-bg-dark-surface p-4 rounded-lg border border-border dark:border-border-dark relative">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-3 right-3 text-text-tertiary dark:text-text-dark-tertiary hover:text-danger"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>

                  <div className="grid gap-3">
                    {/* Material select */}
                    <div>
                      <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Materiale</label>
                      <select
                        value={item.materialName}
                        onChange={e => handleMaterialChange(item.id, e.target.value)}
                        className="w-full mt-1 border-border-strong dark:border-border-dark-strong rounded-md p-2 text-sm bg-bg dark:bg-bg-dark-muted dark:text-text-dark-primary"
                      >
                        {MATERIALS.map(m => (
                          <option key={m.name} value={m.name}>
                            {m.name} ({m.factor} kg CO₂e/kg)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <InputField
                        label="Vægt (kg)"
                        value={item.weightKg}
                        onChange={e => updateItem(item.id, { weightKg: e.target.value })}
                        unit="kg"
                        info="Total masse af materialet. 1 ton = 1.000 kg."
                      />
                      <div>
                        <label className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
                          CO₂ Bidrag (A1-A3)
                        </label>
                        <div className="mt-1 py-2 px-3 bg-bg dark:bg-bg-dark-muted rounded border border-border dark:border-border-dark text-right text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                          {res.a1a3.toFixed(1)} kg
                        </div>
                      </div>
                    </div>

                    {/* Advanced: phase toggles + biogenic */}
                    {mode === 'advanced' && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-text-secondary dark:text-text-dark-secondary">Aktive faser:</p>
                        <div className="flex flex-wrap gap-2">
                          {(['A1-A3', 'A4', 'B1-B7', 'C3-C4'] as LifecyclePhase[]).map(phase => {
                            const active = item.activePhases.includes(phase);
                            const disabled = phase === 'A1-A3';
                            return (
                              <button
                                key={phase}
                                onClick={() => !disabled && togglePhase(item.id, phase)}
                                className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                                  active
                                    ? 'bg-brand-primary text-white border-brand-primary'
                                    : 'bg-bg dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary border-border-strong dark:border-border-dark-strong'
                                } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
                              >
                                {PHASE_LABELS[phase]}
                              </button>
                            );
                          })}
                        </div>

                        {/* Per-phase breakdown */}
                        <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                          {item.activePhases.includes('A4') && (
                            <div className="flex justify-between bg-bg dark:bg-bg-dark-muted px-2 py-1 rounded border border-border dark:border-border-dark">
                              <span className="text-text-secondary dark:text-text-dark-secondary">A4 Transport</span>
                              <span className="font-bold text-text-primary dark:text-text-dark-primary">{res.a4.toFixed(1)} kg</span>
                            </div>
                          )}
                          {item.activePhases.includes('B1-B7') && (
                            <div className="flex justify-between bg-bg dark:bg-bg-dark-muted px-2 py-1 rounded border border-border dark:border-border-dark">
                              <span className="text-text-secondary dark:text-text-dark-secondary">B1-B7 Drift</span>
                              <span className="font-bold text-text-primary dark:text-text-dark-primary">{res.b.toFixed(1)} kg</span>
                            </div>
                          )}
                          {item.activePhases.includes('C3-C4') && (
                            <div className="flex justify-between bg-bg dark:bg-bg-dark-muted px-2 py-1 rounded border border-border dark:border-border-dark">
                              <span className="text-text-secondary dark:text-text-dark-secondary">C3-C4 Bortsk.</span>
                              <span className="font-bold text-text-primary dark:text-text-dark-primary">{res.c.toFixed(1)} kg</span>
                            </div>
                          )}
                          {item.isWood && includeBiogenic && (
                            <div className="flex justify-between bg-success-subtle dark:bg-success-subtle-dark px-2 py-1 rounded border border-success-border dark:border-success/30">
                              <span className="text-success-strong dark:text-success">Biogent lager</span>
                              <span className="font-bold text-success-strong dark:text-success">{res.biogenic.toFixed(1)} kg</span>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-between bg-bg-muted dark:bg-bg-dark-muted px-3 py-1.5 rounded text-sm">
                          <span className="font-medium text-text-primary dark:text-text-dark-primary">Total (valgte faser)</span>
                          <span className={`font-bold ${res.total < 0 ? 'text-success-strong dark:text-success' : 'text-text-primary dark:text-text-dark-primary'}`}>
                            {res.total.toFixed(1)} kg CO₂e
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={addItem} className="flex items-center text-brand-primary font-bold text-sm">
            <PlusIcon className="w-4 h-4 mr-1" /> Tilføj Materiale
          </button>
        </div>

        {/* Results summary */}
        <div className="bg-bg dark:bg-bg-dark-surface p-6 rounded-card shadow-sm border border-border dark:border-border-dark space-y-4">
          <h3 className="font-bold text-lg text-text-primary dark:text-text-dark-primary">Samlet CO₂-Aftryk</h3>
          <ResultDisplay
            label="Total CO₂ – A1-A3 (produktion)"
            value={totals.a1a3}
            precision={1}
            unit={<>kg CO<sub>2</sub>e</>}
          />
          {mode === 'advanced' && totals.total !== totals.a1a3 && (
            <>
              {totals.biogenic !== 0 && (
                <div className="flex justify-between items-center p-3 bg-success-subtle dark:bg-success-subtle-dark rounded-lg border border-success-border dark:border-success/30">
                  <span className="text-sm font-medium text-success-strong dark:text-success">Biogent kulstof (lagret)</span>
                  <span className="font-bold text-success-strong dark:text-success">{totals.biogenic.toFixed(1)} kg CO₂e</span>
                </div>
              )}
              <ResultDisplay
                label="Total livscyklus (valgte faser)"
                value={totals.total}
                precision={1}
                unit={<>kg CO<sub>2</sub>e</>}
              />
              <div className="p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-lg text-xs text-info-strong dark:text-info">
                Svarende til {(totals.total / 1000).toFixed(2)} t CO₂e ·{' '}
                {totals.total > 0
                  ? (totals.a1a3 !== 0
                      ? `${((totals.total - totals.a1a3) / Math.abs(totals.a1a3) * 100).toFixed(0)}% forskel fra A1-A3 alene`
                      : '– forskel fra A1-A3 alene (A1-A3 er 0)')
                  : 'netto CO₂-neutral eller positiv (biogent lager overstiger udledning)'}
              </div>
            </>
          )}
        </div>

        {/* Disclaimer */}
        <div className="p-4 bg-warning-subtle dark:bg-warning-subtle-dark border border-warning-border dark:border-warning/30 rounded-lg text-sm text-warning-strong dark:text-warning">
          <strong>Bemærk:</strong> Dette er en grov forenkling (LCA Light) baseret på generiske EPD-gennemsnit.
          En fuld certificeret LCA kræver produktspecifikke EPD'er og verificeret beregningssoftware (f.eks. LCAbyg eller One Click LCA).
          Faktorer er vejledende og bør ikke bruges til officiel BR18 energirammedokumentation.
        </div>
      </div>
    </CalculatorPage>
  );
};

export default Co2Calculator;
