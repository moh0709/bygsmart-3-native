/**
 * EntryModeSheet.tsx
 * Full-screen entry screen for the v3 wizard.
 * Three paths: AI intake (calls ai-gateway), Visual (house), Quick (type → tasks).
 * Staggered fade-up animation per the motion spec (<=300ms, reduced-motion safe).
 */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, Eye, Zap, ChevronRight, AlertCircle, X } from 'lucide-react';
import { Badge, Button, Textarea } from '../../../../components/ui';
import { runIntake } from '../../../ai';
import { useModuleGate } from '../../../../core/entitlements/ModuleGate';
import { getAllZones, PROJECT_TYPES } from '../../data/wizardCatalog';
import type { WizardStoreInstance } from '../../stores/wizardStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntryModeSheetProps {
  store: WizardStoreInstance;
  onClose: () => void;
}

interface EntryCard {
  mode: 'ai' | 'visual' | 'quick';
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  gradient: string;
  textColor: string;
}

// ─── Card data ────────────────────────────────────────────────────────────────

const ENTRY_CARDS: EntryCard[] = [
  {
    mode: 'ai',
    icon: <Sparkles size={24} />,
    title: 'Analysér med AI',
    description: 'Beskriv projektet med dine egne ord — AI foreslår zoner og opgaver',
    badge: 'Hurtigst',
    gradient: 'from-brand-primary to-brand-strong',
    textColor: 'text-white',
  },
  {
    mode: 'visual',
    icon: <Eye size={24} />,
    title: 'Visuel bygning',
    description: 'Peg på husets zoner på en interaktiv illustration',
    gradient: 'from-info to-info-strong',
    textColor: 'text-white',
  },
  {
    mode: 'quick',
    icon: <Zap size={24} />,
    title: 'Lynstart',
    description: 'Vælg projekttype og tilføj opgaver direkte fra listen',
    gradient: 'from-success to-success-strong',
    textColor: 'text-white',
  },
];

// ─── AI Prompt Input ──────────────────────────────────────────────────────────

const AiPromptInput: React.FC<{ store: WizardStoreInstance }> = ({ store }) => {
  const useStore = store;
  const { setAiPrompt, setAiPending, applyAiSuggestions, setProjectType, goNext, setEntryMode } =
    useStore.getState();
  const aiState = useStore((s) => s.ai);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    setError(null);
    setAiPrompt(trimmed);
    setEntryMode('ai');
    setAiPending(true);

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const allZoneIds = getAllZones().map((z) => z.id);
      const allProjectTypeIds = PROJECT_TYPES.map((p) => p.id);

      const res = await runIntake(
        {
          prompt: trimmed,
          availableZoneIds: allZoneIds,
          availableProjectTypes: allProjectTypeIds as never,
        },
        abortRef.current.signal,
      );

      if (!res.ok || !res.result) {
        setError(res.error ?? 'AI-analyse mislykkedes. Prøv igen.');
        setAiPending(false);
        return;
      }

      const { projectType, zoneIds } = res.result;

      // Apply project type if detected
      if (projectType) {
        setProjectType(projectType);
      }

      // Apply zone suggestions to the store
      const zoneSels = zoneIds.map((id) => ({ zoneId: id, source: 'ai' as const, quantity: 1 }));
      applyAiSuggestions(zoneSels, {});

      setAiPending(false);
      // Skip Step 0 (project type already set) and go to step 1 (zones)
      goNext();
    } catch {
      if (abortRef.current?.signal.aborted) return; // cancelled — no error
      setError('Netværksfejl. Tjek forbindelsen og prøv igen.');
      setAiPending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22 }}
      className="px-4 pt-2 pb-4"
    >
      <p className="text-body text-text-secondary dark:text-text-dark-secondary mb-3">
        Beskriv dit projekt — fx <em>"ny badeværelse og køkken på 1. sal"</em>
      </p>
      <Textarea
        autoFocus
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
        placeholder="Hvad skal laves?..."
        rows={3}
        className="resize-none"
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 mt-2 p-2.5 bg-danger-subtle dark:bg-danger-subtle-dark rounded-xl text-label text-danger-strong dark:text-danger"
            role="alert"
          >
            <AlertCircle size={13} className="flex-none mt-0.5" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="primary"
        fullWidth
        className="mt-3 active:scale-[0.98]"
        onClick={handleSubmit}
        disabled={!draft.trim()}
        loading={aiState.pending}
      >
        {aiState.pending ? 'Analyserer...' : 'Analysér projekt →'}
      </Button>
      <p className="text-center text-caption text-text-tertiary dark:text-text-dark-tertiary mt-2">Cmd+Enter for at sende</p>
    </motion.div>
  );
};

// ─── EntryModeSheet ───────────────────────────────────────────────────────────

export const EntryModeSheet: React.FC<EntryModeSheetProps> = ({ store, onClose }) => {
  const shouldReduceMotion = useReducedMotion();
  const useStore = store;
  const { setEntryMode, goNext } = useStore.getState();
  const [expandedAi, setExpandedAi] = useState(false);

  // "Analysér med AI" is an ai-module entry mode — hide it entirely when the
  // org isn't entitled so only the manual/visual modes are offered.
  const aiEnabled = useModuleGate('ai');
  const visibleCards = aiEnabled ? ENTRY_CARDS : ENTRY_CARDS.filter((c) => c.mode !== 'ai');

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.07,
        delayChildren: 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  };

  const handleCardPress = (mode: EntryCard['mode']) => {
    if (mode === 'ai') {
      setExpandedAi((prev) => !prev);
      return;
    }
    setEntryMode(mode);
    goNext();
  };

  return (
    <div className="flex flex-col h-full bg-bg-subtle dark:bg-bg-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 pt-safe">
        <div>
          <h1 className="text-title text-text-primary dark:text-text-dark-primary">
            Nyt projekt
          </h1>
          <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-0.5">
            Vælg hvordan du vil starte
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-bg-muted dark:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary"
          aria-label="Luk"
        >
          <X size={18} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3"
        >
          {visibleCards.map((card) => (
            <motion.div key={card.mode} variants={cardVariants}>
              <button
                type="button"
                onClick={() => handleCardPress(card.mode)}
                className={[
                  'w-full text-left rounded-2xl overflow-hidden transition-transform duration-150 active:scale-[0.98] shadow-sm',
                  expandedAi && card.mode === 'ai' ? 'ring-2 ring-brand-light' : '',
                ].join(' ')}
              >
                <div className={`bg-gradient-to-br ${card.gradient} px-4 py-4 flex items-start gap-3`}>
                  <div className={`mt-0.5 ${card.textColor} opacity-90`}>{card.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-heading ${card.textColor}`}>{card.title}</span>
                      {card.badge && (
                        <Badge variant="warning">{card.badge}</Badge>
                      )}
                    </div>
                    <p className={`text-label mt-0.5 opacity-85 ${card.textColor}`}>{card.description}</p>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`${card.textColor} opacity-60 mt-1 transition-transform duration-200 ${
                      expandedAi && card.mode === 'ai' ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>

              {/* AI prompt expansion */}
              <AnimatePresence>
                {card.mode === 'ai' && expandedAi && (
                  <motion.div
                    key="ai-expand"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-bg dark:bg-bg-dark-surface rounded-b-2xl border border-border dark:border-border-dark border-t-0">
                      <AiPromptInput store={store} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-caption text-text-tertiary dark:text-text-dark-tertiary mt-6"
        >
          Tip: Brug AI-analysen til at komme i gang på under 30 sekunder
        </motion.p>
      </div>
    </div>
  );
};

export default EntryModeSheet;
