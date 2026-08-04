/**
 * NytProjektWizardPage.tsx
 * v3 wizard entry point — mounted behind ?wizard=v3 feature flag.
 * Creates a fresh Zustand store per mount (BUG_001 fix).
 * Opens on the visual building selector, then renders the remaining steps.
 * On Step4 submit: inserts project + tasks into Supabase with typed payloads.
 */

import React, { useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { createWizardStore } from '../stores/wizardStore';
import { WizardShell } from '../components/wizard/WizardShell';
import { Step0_ProjectType } from '../components/wizard/Step0_ProjectType';
import { Button } from '../../../components/ui';
import { supabase } from '../../../services/supabaseClient';
import type { Database } from '../../../services/database.types';
import { getZoneById, TASKS_BY_ZONE } from '../data/wizardCatalog';
import { createProjectBudgetBaseline } from '../../budget';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
type TaskInsert   = Database['public']['Tables']['tasks']['Insert'];

// Lazy-load heavier steps to keep initial bundle small
const Step1_VaelgOmraade = lazy(() => import('../components/wizard/Step1_VaelgOmraade'));
const Step2_VaelgOpgaver = lazy(() => import('../components/wizard/Step2_VaelgOpgaver'));
const Step3_Detaljer     = lazy(() => import('../components/wizard/Step3_Detaljer'));
const Step4_Gennemse     = lazy(() => import('../components/wizard/Step4_Gennemse'));
const CreateQuickTaskModal = lazy(() =>
  import('../../tasks').then((m) => m.loadCreateQuickTaskModal()),
);

// ─── Step loading fallback ────────────────────────────────────────────────────

const StepSkeleton: React.FC = () => (
  <div className="px-4 pt-6 space-y-4 animate-pulse">
    <div className="h-6 w-40 bg-bg-muted dark:bg-bg-dark-muted rounded-lg" />
    <div className="h-4 w-60 bg-bg-muted dark:bg-bg-dark-surface rounded-lg" />
    <div className="grid grid-cols-2 gap-3 mt-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-28 bg-bg-muted dark:bg-bg-dark-surface rounded-2xl" />
      ))}
    </div>
  </div>
);

// ─── Next button config per step ──────────────────────────────────────────────

function useStepFooterProps(
  store: ReturnType<typeof createWizardStore>,
  isSubmitting: boolean,
) {
  const useStore = store;
  const currentStep  = useStore((s) => s.currentStep);
  const projectType  = useStore((s) => s.projectType);
  const selectedZones = useStore((s) => s.selectedZones);
  const totalTasks   = useStore((s) => s.totalSelectedTasks());
  const details      = useStore((s) => s.details);

  switch (currentStep) {
    case 0: return { nextDisabled: !projectType,                nextLabel: 'Vælg områder →' };
    case 1: return { nextDisabled: selectedZones.length === 0,  nextLabel: 'Vælg opgaver →' };
    case 2: return { nextDisabled: totalTasks === 0,            nextLabel: 'Projektoversigt →' };
    case 3: return { nextDisabled: !details.name.trim(),        nextLabel: 'Gennemse projekt →' };
    case 4: return {
      nextDisabled: isSubmitting,
      nextLabel: isSubmitting ? 'Opretter...' : 'Opret projekt ✓',
    };
    default: return { nextDisabled: false, nextLabel: 'Næste' };
  }
}

// ─── NytProjektWizardPage ─────────────────────────────────────────────────────

const NytProjektWizardPage: React.FC = () => {
  const navigate = useNavigate();

  // BUG_001 fix: store is created once per mount, never shared between mounts.
  // New projects now open directly on the existing visual building selector.
  const [store] = useState(() => {
    const wizardStore = createWizardStore();
    const { setEntryMode, setStep } = wizardStore.getState();
    setEntryMode('visual');
    setStep(1);
    return wizardStore;
  });
  const useStore = store;

  const currentStep = useStore((s) => s.currentStep);

  // Budget baseline auto-creation on submit is a budget-module write — don't
  // write it for orgs that aren't entitled to the budget module.
  const budgetEnabled = useModuleGate('budget');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);

  const footerProps = useStepFooterProps(store, isSubmitting);

  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/projects');
  };

  // ── Step 4 submit ─────────────────────────────────────────────────────────

  const handleFinalSubmit = async () => {
    const state = store.getState();
    const { projectType, selectedZones, selectedTasks, details } = state;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // ── Insert project row ──
      const projectPayload: ProjectInsert = {
        name: details.name,
        owner_id: user?.id ?? '',
        status: 'I gang',
        progress: 0,
        address: details.address || null,
        start_date: details.startDate || null,
        description: details.notes || null,
        team: details.team.length ? details.team : undefined,
        milestone: projectType ? { projectType } : undefined,
      };

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert(projectPayload)
        .select('id')
        .single();

      if (projectError || !project) {
        setSubmitError(projectError?.message ?? 'Kunne ikke oprette projekt');
        setIsSubmitting(false);
        return;
      }

      // Budget is created as an approved baseline (single "other" category —
      // the owner refines the material/labor/subcontractor split later in the
      // Budget tab) rather than written directly onto the project row, so it
      // gets a revision history from day one.
      if (details.budgetKr && budgetEnabled) {
        try {
          await createProjectBudgetBaseline(project.id, [
            { category: 'other', amountKr: details.budgetKr, note: 'Indtastet i opret-projekt-guiden' },
          ]);
        } catch (budgetError) {
          console.warn('[Wizard] Budget baseline creation warning:', budgetError);
        }
      }

      // ── Bulk-insert task rows ──
      const taskRows: TaskInsert[] = [];

      for (const [zoneId, taskIds] of Object.entries(
        selectedTasks as Record<string, string[]>,
      )) {
        const zone      = getZoneById(zoneId);
        const zoneTasks = zone ? (TASKS_BY_ZONE[zone.tasksKey] ?? []) : [];

        for (const tid of taskIds) {
          const def = zoneTasks.find((t) => t.id === tid);
          if (def) {
            taskRows.push({
              project_id: project.id,
              title: def.label,
              status: 'To Do',
              step: zoneId,
              description: `${def.durationDaysMin}–${def.durationDaysMax} arbejdsdage`,
            });
          }
        }
      }

      if (taskRows.length > 0) {
        const { error: tasksError } = await supabase.from('tasks').insert(taskRows);
        if (tasksError) {
          // Non-fatal — project was created; log and proceed
          console.warn('[Wizard] Tasks insert warning:', tasksError.message);
        }
      }

      navigate(`/projects/${project.id}`);
    } catch (err) {
      console.error('[Wizard] handleFinalSubmit error:', err);
      setSubmitError('Uventet fejl — prøv igen');
      setIsSubmitting(false);
    }
  };

  const handleNext = currentStep === 4 ? handleFinalSubmit : undefined;

  // ── Step shell ──
  const renderStep = () => {
    switch (currentStep) {
      case 0: return <Step0_ProjectType store={store} />;
      case 1: return <Suspense fallback={<StepSkeleton />}><Step1_VaelgOmraade store={store} /></Suspense>;
      case 2: return <Suspense fallback={<StepSkeleton />}><Step2_VaelgOpgaver store={store} /></Suspense>;
      case 3: return <Suspense fallback={<StepSkeleton />}><Step3_Detaljer store={store} /></Suspense>;
      case 4: return <Suspense fallback={<StepSkeleton />}><Step4_Gennemse store={store} /></Suspense>;
      default: return null;
    }
  };

  return (
    <div className="h-below-topbar flex flex-col bg-bg-subtle dark:bg-bg-dark overflow-hidden">
      {submitError && (
        <div className="bg-danger text-white text-label px-4 py-2.5 text-center font-medium" role="alert">
          {submitError}
        </div>
      )}
      <WizardShell
        store={store}
        onClose={handleClose}
        onNext={handleNext}
        immersive={currentStep === 1}
        headerAction={(
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQuickTaskOpen(true)}
            className="whitespace-nowrap"
          >
            <Zap size={15} aria-hidden="true" />
            Opret Hurtig Opgave
          </Button>
        )}
        {...footerProps}
      >
        {renderStep()}
      </WizardShell>
      {quickTaskOpen && (
        <Suspense fallback={null}>
          <CreateQuickTaskModal
            onClose={() => setQuickTaskOpen(false)}
            onCreated={() => setQuickTaskOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default NytProjektWizardPage;
