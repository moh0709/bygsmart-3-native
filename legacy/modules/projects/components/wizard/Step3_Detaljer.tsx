/**
 * Step3_Detaljer.tsx
 * Project details form:
 *  - Project name (required)
 *  - Address with DAWA autocomplete (api.dataforsyningen.dk)
 *  - Budget (DKK)
 *  - Start date
 *  - Team member tag input
 *  - Notes
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, DollarSign, Calendar, Users, FileText } from 'lucide-react';
import { Button, Input, Textarea } from '../../../../components/ui';
import type { WizardStoreInstance } from '../../stores/wizardStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { store: WizardStoreInstance }

interface DawaResult {
  tekst: string;
  adresse: { id: string };
}

// ─── DAWA address autocomplete ────────────────────────────────────────────────

const AddressInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<DawaResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced DAWA fetch
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(query)}&per_side=6&caretpos=${query.length}&fuzzy=`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('DAWA error');
        const data: DawaResult[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = useCallback((tekst: string) => {
    setQuery(tekst);
    onChange(tekst);
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      select(suggestions[activeIdx].tekst);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none z-10" />
        <Input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Søg dansk adresse..."
          autoComplete="off"
          spellCheck={false}
          className="pl-9 pr-9"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 animate-spin text-brand-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={() => { setQuery(''); onChange(''); setSuggestions([]); setOpen(false); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary transition-colors"
            aria-label="Ryd adresse"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full bg-bg dark:bg-bg-dark-surface rounded-xl border border-border dark:border-border-dark shadow-raised overflow-hidden"
            role="listbox"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.adresse.id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); select(s.tekst); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={[
                  'flex items-center gap-2.5 px-3 py-2.5 min-h-11 text-label cursor-pointer transition-colors',
                  i === activeIdx
                    ? 'bg-brand-primary/8 text-brand-primary dark:bg-brand-primary/15'
                    : 'text-text-primary dark:text-text-dark-primary hover:bg-bg-muted dark:hover:bg-bg-dark-muted',
                ].join(' ')}
              >
                <MapPin size={13} className={i === activeIdx ? 'text-brand-primary' : 'text-text-tertiary dark:text-text-dark-tertiary'} />
                <span className="leading-tight">{s.tekst}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Team member tag input ────────────────────────────────────────────────────

const TeamInput: React.FC<{
  team: string[];
  onChange: (team: string[]) => void;
}> = ({ team, onChange }) => {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !team.includes(trimmed)) {
      onChange([...team, trimmed]);
    }
    setInput('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 min-h-[36px] mb-2">
        <AnimatePresence mode="popLayout">
          {team.map((member) => (
            <motion.span
              key={member}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-label font-medium"
            >
              {member}
              <button
                type="button"
                onClick={() => onChange(team.filter((m) => m !== member))}
                className="ml-0.5 p-1.5 -m-1 opacity-60 hover:opacity-100 transition-opacity"
                aria-label={`Fjern ${member}`}
              >
                <X size={11} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            }}
            placeholder="Tilføj navn og tryk Enter..."
          />
        </div>
        <Button
          variant="primary"
          onClick={add}
          disabled={!input.trim()}
          aria-label="Tilføj teammedlem"
          className="flex-none"
        >
          +
        </Button>
      </div>
    </div>
  );
};

// ─── Field wrapper ────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, required, icon, children }) => (
  <div>
    <label className="flex items-center gap-1.5 text-caption font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-1.5">
      <span className="text-text-tertiary dark:text-text-dark-tertiary">{icon}</span>
      {label}
      {required && <span className="text-danger normal-case font-normal tracking-normal">*</span>}
    </label>
    {children}
  </div>
);

// ─── Step3_Detaljer ───────────────────────────────────────────────────────────

const Step3_Detaljer: React.FC<Props> = ({ store }) => {
  const useStore = store;
  const details = useStore((s) => s.details);
  const { setDetails } = useStore.getState();

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div>
        <h2 className="text-heading text-text-primary dark:text-text-dark-primary">
          Projektdetaljer
        </h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          Giv projektet et navn og udfyld adressen
        </p>
      </div>

      {/* Project name */}
      <Field label="Projektnavn" required icon={<FileText size={13} />}>
        <div className="relative">
          <Input
            type="text"
            value={details.name}
            onChange={(e) => setDetails({ name: e.target.value })}
            placeholder="fx Renovering Søgade 12"
          />
          {!details.name.trim() && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-text-tertiary dark:text-text-dark-tertiary pointer-events-none">
              Påkrævet
            </span>
          )}
        </div>
      </Field>

      {/* Address (DAWA) */}
      <Field label="Adresse" icon={<MapPin size={13} />}>
        <AddressInput
          value={details.address}
          onChange={(v) => setDetails({ address: v })}
        />
      </Field>

      {/* Budget */}
      <Field label="Budget (DKK)" icon={<DollarSign size={13} />}>
        <div className="relative">
          <Input
            type="number"
            min={0}
            step={1000}
            value={details.budgetKr ?? ''}
            onChange={(e) => setDetails({ budgetKr: e.target.value ? Number(e.target.value) : null })}
            placeholder="0"
            className="pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption text-text-tertiary dark:text-text-dark-tertiary font-medium pointer-events-none">kr.</span>
        </div>
        {details.budgetKr != null && details.budgetKr > 0 && (
          <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-1">
            {details.budgetKr.toLocaleString('da-DK')} kr.
          </p>
        )}
      </Field>

      {/* Start date */}
      <Field label="Startdato" icon={<Calendar size={13} />}>
        <Input
          type="date"
          value={details.startDate}
          onChange={(e) => setDetails({ startDate: e.target.value })}
          aria-label="Startdato"
        />
      </Field>

      {/* Team */}
      <Field label="Teammedlemmer" icon={<Users size={13} />}>
        <TeamInput
          team={details.team}
          onChange={(team) => setDetails({ team })}
        />
      </Field>

      {/* Notes */}
      <Field label="Noter" icon={<FileText size={13} />}>
        <Textarea
          value={details.notes}
          onChange={(e) => setDetails({ notes: e.target.value })}
          placeholder="Særlige forhold, ønsker til håndværkere..."
          rows={3}
          className="resize-none"
        />
      </Field>
    </div>
  );
};

export default Step3_Detaljer;
