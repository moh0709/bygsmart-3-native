/**
 * Step0_ProjectType.tsx
 * 2×3 grid of project type cards.
 * Spring-animated selection ring per the motion spec.
 * prefers-reduced-motion safe.
 */

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PROJECT_TYPES } from '../../data/wizardCatalog';
import type { ProjectTypeId } from '../../data/wizardCatalog';
import type { WizardStoreInstance } from '../../stores/wizardStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step0Props {
  store: WizardStoreInstance;
}

// ─── Project Type Card ────────────────────────────────────────────────────────

interface TypeCardProps {
  id: ProjectTypeId;
  label: string;
  icon: string;
  description: string;
  isSelected: boolean;
  onSelect: (id: ProjectTypeId) => void;
  shouldReduceMotion: boolean;
}

const TypeCard: React.FC<TypeCardProps> = ({
  id,
  label,
  icon,
  description,
  isSelected,
  onSelect,
  shouldReduceMotion,
}) => {
  return (
    <motion.button
      onClick={() => onSelect(id)}
      whileTap={shouldReduceMotion ? {} : { scale: 0.96 }}
      className={[
        'relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-colors duration-150 text-center min-h-[110px]',
        isSelected
          ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10'
          : 'border-border dark:border-border-dark bg-bg dark:bg-bg-dark-surface active:bg-bg-muted dark:active:bg-bg-dark-muted',
      ].join(' ')}
      aria-pressed={isSelected ? 'true' : 'false'}
    >
      {/* Selection ring */}
      {isSelected && (
        <motion.div
          layoutId="selection-ring"
          className="absolute inset-0 rounded-2xl border-2 border-brand-primary"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        />
      )}

      {/* Check badge */}
      {isSelected && (
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center"
        >
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 3.5L3.8 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      )}

      {/* Icon */}
      <span className="text-3xl leading-none" role="img" aria-label={label}>
        {icon}
      </span>

      {/* Label */}
      <span
        className={[
          'text-label font-semibold leading-tight',
          isSelected
            ? 'text-brand-primary'
            : 'text-text-primary dark:text-text-dark-primary',
        ].join(' ')}
      >
        {label}
      </span>
    </motion.button>
  );
};

// ─── Step0_ProjectType ────────────────────────────────────────────────────────

export const Step0_ProjectType: React.FC<Step0Props> = ({ store }) => {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const useStore = store;
  const projectType = useStore((s) => s.projectType);
  const { setProjectType, goNext } = useStore.getState();

  const handleSelect = (id: ProjectTypeId) => {
    setProjectType(id);
    // Auto-advance after spring animation completes
    const delay = shouldReduceMotion ? 100 : 300;
    setTimeout(() => goNext(), delay);
  };

  // Container stagger
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Heading */}
      <div className="mb-6">
        <h2 className="text-heading text-text-primary dark:text-text-dark-primary">
          Hvad slags projekt er det?
        </h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          Vælg den kategori der passer bedst
        </p>
      </div>

      {/* 2-column grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3"
      >
        {PROJECT_TYPES.map((pt) => (
          <motion.div key={pt.id} variants={itemVariants}>
            <TypeCard
              id={pt.id}
              label={pt.label}
              icon={pt.icon}
              description={pt.description}
              isSelected={projectType === pt.id}
              onSelect={handleSelect}
              shouldReduceMotion={shouldReduceMotion}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Description blurb for selected type */}
      {projectType && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 p-3 rounded-xl bg-brand-primary/5 dark:bg-brand-primary/10 border border-brand-primary/20"
        >
          <p className="text-label text-brand-primary font-medium">
            {PROJECT_TYPES.find((p) => p.id === projectType)?.description}
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Step0_ProjectType;
