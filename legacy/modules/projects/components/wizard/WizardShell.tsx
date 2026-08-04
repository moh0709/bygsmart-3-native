/**
 * WizardShell.tsx
 * Outer frame for the v3 5-step wizard.
 * - Animated progress bar
 * - Step-to-step slide transitions (Framer Motion)
 * - Sticky header + scrollable body + fixed footer
 * - prefers-reduced-motion safe
 */

import React, { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { Button, ProgressBar } from '../../../../components/ui';
import type { WizardStoreInstance } from '../../stores/wizardStore';

// motion-wrapped kit button so the press animation survives the kit swap
const MotionButton = motion(Button);

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardShellProps {
  store: WizardStoreInstance;
  onClose: () => void;
  children: React.ReactNode;
  /** Label shown in the progress bar header */
  stepLabels?: string[];
  /** Override footer content (replaces default Næste button) */
  footer?: React.ReactNode;
  /** Hide the back arrow on step 0 */
  hideBack?: boolean;
  /** Optional action rendered in the top-right header group */
  headerAction?: React.ReactNode;
  /** Force the dark, edge-to-edge presentation used by the 3D building step */
  immersive?: boolean;
  /** Disable the Næste button */
  nextDisabled?: boolean;
  onNext?: () => void;
  nextLabel?: string;
}

const DEFAULT_STEP_LABELS = [
  'Projekttype',
  'Vælg område',
  'Vælg opgaver',
  'Detaljer',
  'Gennemse',
];

const TOTAL_STEPS = 5; // steps 0-4

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const StepProgress: React.FC<{ step: number; labels: string[] }> = ({ step, labels }) => {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="px-4 pb-3">
      {/* Step label row */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-caption font-medium text-text-secondary dark:text-text-dark-secondary">
          Trin {step + 1} / {TOTAL_STEPS}
        </span>
        <span className="text-caption font-semibold text-brand-primary truncate max-w-[60%] text-right">
          {labels[step] ?? ''}
        </span>
      </div>
      {/* Bar */}
      <ProgressBar value={pct} size="sm" label={`Trin ${step + 1} af ${TOTAL_STEPS}`} />
    </div>
  );
};

// ─── Slide variants ───────────────────────────────────────────────────────────

const makeSlideVariants = (shouldReduceMotion: boolean) => ({
  enter: (dir: number) => ({
    x: shouldReduceMotion ? 0 : dir > 0 ? '100%' : '-100%',
    opacity: shouldReduceMotion ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: shouldReduceMotion ? 0 : dir > 0 ? '-100%' : '100%',
    opacity: shouldReduceMotion ? 0 : 1,
  }),
});

// ─── WizardShell ──────────────────────────────────────────────────────────────

export const WizardShell: React.FC<WizardShellProps> = ({
  store,
  onClose,
  children,
  stepLabels = DEFAULT_STEP_LABELS,
  footer,
  hideBack = false,
  headerAction,
  immersive = false,
  nextDisabled = false,
  onNext,
  nextLabel = 'Næste',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const useStore = store;
  const currentStep = useStore((s) => s.currentStep);
  const { goBack, goNext } = useStore.getState();

  // Track direction for slide animation
  const prevStepRef = useRef(currentStep);
  const dirRef = useRef(1);
  if (currentStep !== prevStepRef.current) {
    dirRef.current = currentStep > prevStepRef.current ? 1 : -1;
    prevStepRef.current = currentStep;
  }

  const slideVariants = makeSlideVariants(shouldReduceMotion ?? false);

  const handleBack = () => goBack();
  const handleNext = onNext ?? goNext;

  return (
    <div
      className={[
        'flex h-full flex-col',
        immersive ? 'dark bg-[#06101a]' : 'bg-bg-subtle dark:bg-bg-dark',
      ].join(' ')}
    >
      {/* ── Header ── */}
      <div className="flex-none bg-bg dark:bg-bg-dark-surface border-b border-border dark:border-border-dark pt-safe">
        {/* Top row: back + title + close */}
        <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 px-4 py-2">
          {/* Back */}
          {currentStep > 0 && !hideBack ? (
            <button
              type="button"
              onClick={handleBack}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors"
              aria-label="Gå tilbage"
            >
              <ArrowLeft size={20} className="text-text-primary dark:text-text-dark-primary" />
            </button>
          ) : (
            <div className="w-11" />
          )}

          {/* Title */}
          <h1 className="truncate text-center text-heading text-text-primary dark:text-text-dark-primary">
            Nyt Projekt
          </h1>

          <div className="flex items-center justify-end gap-1.5">
            {headerAction}
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors"
              aria-label="Luk"
            >
              <X size={20} className="text-text-secondary dark:text-text-dark-secondary" />
            </button>
          </div>
        </div>

        {/* Progress */}
        <StepProgress step={currentStep} labels={stepLabels} />
      </div>

      {/* ── Scrollable Body (animated) ── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="popLayout" custom={dirRef.current} initial={false}>
          <motion.div
            key={currentStep}
            custom={dirRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={[
              'absolute inset-0 overscroll-contain',
              immersive ? 'overflow-hidden' : 'overflow-y-auto',
            ].join(' ')}
          >
            <div className={immersive ? 'h-full' : 'min-h-full pb-32'}>
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="flex-none bg-bg dark:bg-bg-dark-surface border-t border-border dark:border-border-dark px-4 py-3 pb-safe">
        {footer ?? (
          <MotionButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleNext}
            disabled={nextDisabled}
            whileTap={shouldReduceMotion || nextDisabled ? undefined : { scale: 0.98 }}
          >
            {nextLabel}
          </MotionButton>
        )}
      </div>
    </div>
  );
};

export default WizardShell;
