import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button, Input, Select, Badge } from '../../../components/ui';
import { SearchIcon, CalculatorIcon, ChevronRightIcon } from '../../../components/icons';
import {
  listCalculators,
  computeCalculator,
  CalculatorMeta,
  CalculatorResult,
} from '../catalog';

export interface CalculatorPickerResult {
  calculatorId: string;
  calculatorName: string;
  inputs: Record<string, string>;
  result: number;
  unit: string;
  summary: string;
  breakdown?: { label: string; value: number; unit: string }[];
}

interface CalculatorPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user confirms a computed result. */
  onResult: (result: CalculatorPickerResult) => void;
}

/**
 * Lets the user search/pick a calculator (grouped by category), fill its inputs
 * inline and confirm the computed result. Calculators without an extracted
 * formula are shown as links to the full calculator page.
 */
const CalculatorPickerModal: React.FC<CalculatorPickerModalProps> = ({ open, onClose, onResult }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CalculatorMeta | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const calculators = useMemo(() => listCalculators(), []);

  // Reset when (re)opened
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(null);
      setInputValues({});
    }
  }, [open]);

  const handleSelect = (calc: CalculatorMeta) => {
    setSelected(calc);
    const defaults: Record<string, string> = {};
    (calc.inputs ?? []).forEach((def) => {
      defaults[def.id] = def.defaultValue;
    });
    setInputValues(defaults);
  };

  const liveResult: CalculatorResult | null = useMemo(() => {
    if (!selected?.computable) return null;
    try {
      return computeCalculator(selected.id, inputValues);
    } catch {
      return null;
    }
  }, [selected, inputValues]);

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = term
      ? calculators.filter(
          (c) => c.name.toLowerCase().includes(term) || c.category.toLowerCase().includes(term)
        )
      : calculators;

    const groups = new Map<string, CalculatorMeta[]>();
    matching.forEach((c) => {
      const list = groups.get(c.category) ?? [];
      list.push(c);
      groups.set(c.category, list);
    });
    // Computable first within each category
    groups.forEach((list) => list.sort((a, b) => Number(b.computable) - Number(a.computable)));
    return Array.from(groups.entries());
  }, [calculators, search]);

  const visibleInputs = useMemo(() => {
    if (!selected?.inputs) return [];
    return selected.inputs.filter((def) => {
      if (!def.visibleWhen) return true;
      return Object.entries(def.visibleWhen).every(([key, value]) => {
        const current = inputValues[key] ?? selected.inputs?.find((d) => d.id === key)?.defaultValue;
        // For the concrete calculator: length/width hidden only for columns, diameter only for columns.
        if (key === 'shape' && value === 'slab') return current !== 'column';
        return current === value;
      });
    });
  }, [selected, inputValues]);

  const handleConfirm = () => {
    if (!selected || !liveResult) return;
    onResult({
      calculatorId: selected.id,
      calculatorName: selected.name,
      inputs: { ...inputValues },
      result: liveResult.value,
      unit: liveResult.unit,
      summary: liveResult.summary,
      breakdown: liveResult.breakdown,
    });
    onClose();
  };

  const inputSummaryText = (calc: CalculatorMeta, values: Record<string, string>): string =>
    (calc.inputs ?? [])
      .filter((def) => values[def.id] !== undefined && values[def.id] !== '')
      .map((def) => {
        if (def.type === 'select') {
          const opt = def.options?.find((o) => o.value === values[def.id]);
          return `${def.label}: ${opt?.label ?? values[def.id]}`;
        }
        return `${def.label}: ${values[def.id]}${def.unit ? ` ${def.unit}` : ''}`;
      })
      .join(', ');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={selected ? selected.name : 'Vælg beregner'}
      description={
        selected
          ? selected.category
          : 'Beregn mængden direkte, eller åbn den fulde beregnerside.'
      }
      size="md"
      data-ref-id="calculator-picker-modal"
      footer={
        selected ? (
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Tilbage
            </Button>
            {selected.computable && (
              <Button onClick={handleConfirm} disabled={!liveResult || liveResult.value <= 0}>
                Brug resultat
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!selected ? (
        <div className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg efter beregner..."
              className="pl-9"
              aria-label="Søg efter beregner"
            />
          </div>

          {filteredGroups.length === 0 && (
            <p className="text-sm text-text-secondary dark:text-text-dark-secondary text-center py-8">
              Ingen beregnere matcher din søgning.
            </p>
          )}

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {filteredGroups.map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-2">
                  {category}
                </h3>
                <div className="space-y-1.5">
                  {items.map((calc) =>
                    calc.computable ? (
                      <button
                        key={calc.id}
                        type="button"
                        onClick={() => handleSelect(calc)}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-control border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface hover:border-brand-primary transition-colors text-left"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <CalculatorIcon className="w-4 h-4 text-brand-primary shrink-0" />
                          <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary truncate">
                            {calc.name}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <Badge variant="brand">Hurtig beregning</Badge>
                          <ChevronRightIcon className="w-4 h-4 text-text-tertiary" />
                        </span>
                      </button>
                    ) : (
                      <Link
                        key={calc.id}
                        to={calc.route}
                        onClick={onClose}
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-control border border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface hover:border-brand-primary transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <CalculatorIcon className="w-4 h-4 text-text-tertiary shrink-0" />
                          <span className="text-sm font-medium text-text-primary dark:text-text-dark-primary truncate">
                            {calc.name}
                          </span>
                        </span>
                        <Badge variant="neutral">Åbn beregner</Badge>
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {visibleInputs.map((def) =>
              def.type === 'select' ? (
                <Select
                  key={def.id}
                  label={def.label}
                  value={inputValues[def.id] ?? def.defaultValue}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                >
                  {(def.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  key={def.id}
                  type="number"
                  inputMode="decimal"
                  label={def.unit ? `${def.label} (${def.unit})` : def.label}
                  hint={def.info}
                  value={inputValues[def.id] ?? def.defaultValue}
                  onChange={(e) => setInputValues((prev) => ({ ...prev, [def.id]: e.target.value }))}
                />
              )
            )}
          </div>

          {/* Live result */}
          <div
            className="rounded-card border border-border dark:border-border-dark bg-bg-muted dark:bg-bg-dark-muted p-4"
            aria-live="polite"
          >
            <p className="text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary mb-1">
              Resultat
            </p>
            {liveResult && liveResult.value > 0 ? (
              <>
                <p className="text-3xl font-extrabold text-brand-primary dark:text-brand-light">
                  {liveResult.value.toLocaleString('da-DK')}{' '}
                  <span className="text-lg font-bold">{liveResult.unit}</span>
                </p>
                {liveResult.breakdown && liveResult.breakdown.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {liveResult.breakdown.map((line) => (
                      <li
                        key={line.label}
                        className="flex justify-between text-sm text-text-secondary dark:text-text-dark-secondary"
                      >
                        <span>{line.label}</span>
                        <span className="font-semibold text-text-primary dark:text-text-dark-primary">
                          {line.value.toLocaleString('da-DK')} {line.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-text-tertiary dark:text-text-dark-tertiary">
                  {inputSummaryText(selected, inputValues)}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
                Udfyld felterne for at se resultatet.
              </p>
            )}
          </div>

          <Link
            to={selected.route}
            onClick={onClose}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline"
          >
            Åbn den fulde beregner <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>
      )}
    </Modal>
  );
};

export default CalculatorPickerModal;
