import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useOrg } from '../../../../core/org/OrgProvider';
import { useToast } from '../../../../contexts/ToastContext';
import {
  Alert,
  Button,
  ConfirmDialog,
  Skeleton,
  cn,
} from '../../../../components/ui';
import { ChevronRightIcon } from '../../../../components/icons';
import { createRegistrationStore } from '../../stores/registrationStore';
import {
  EMPTY_PAYLOAD,
  deleteMyDraft,
  getMyRegistration,
  isoWeekNumber,
  saveMyDraft,
  shiftWeek,
  submitRegistration,
  totalMinutesOf,
  validateIntervals,
  weekStartOf,
  formatHours,
  type TimeRegistration,
} from '../../services/timeRegistrations';
import { Step1VaelgOpgaver } from './Step1VaelgOpgaver';
import { Step2VaelgDage } from './Step2VaelgDage';
import { Step3IndstilTid } from './Step3IndstilTid';
import { RegistrationSummary } from './RegistrationSummary';

const STEP_TITLES = ['Vælg opgaver', 'Vælg dage', 'Indstil tid', 'Oversigt'] as const;

/**
 * The staff 4-step weekly registration wizard (the delivered design):
 * opgaver → dage → tider → oversigt, with server-persisted drafts (Gem),
 * discard (Annuller) and submission to the responsible (Indsend). A
 * submitted/approved week renders read-only; a rejected week shows the
 * manager's comment and reopens for editing.
 */
export const StaffWizard: React.FC = () => {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const { showToast } = useToast();

  const storeRef = useRef(createRegistrationStore());
  const useStore = storeRef.current;

  const weekStart = useStore((s) => s.weekStart);
  const step = useStore((s) => s.step);
  const tasks = useStore((s) => s.tasks);
  const hydrated = useStore((s) => s.hydrated);
  const hydrate = useStore((s) => s.hydrate);
  const setWeek = useStore((s) => s.setWeek);
  const setStep = useStore((s) => s.setStep);
  const markSaved = useStore((s) => s.markSaved);
  const reset = useStore((s) => s.reset);
  const toPayload = useStore((s) => s.toPayload);

  const [registration, setRegistration] = useState<TimeRegistration | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingRejected, setEditingRejected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const orgId = activeOrg?.id ?? null;
  const userId = user?.id ?? null;

  // ── Load (or start) the week's registration whenever the week changes ──────
  const loadWeek = useCallback(async () => {
    if (!orgId || !userId) return;
    try {
      const reg = await getMyRegistration(orgId, userId, weekStart);
      setRegistration(reg);
      setEditingRejected(false);
      hydrate(weekStart, reg?.payload ?? { ...EMPTY_PAYLOAD });
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Kunne ikke hente registreringen.');
    }
  }, [orgId, userId, weekStart, hydrate]);

  useEffect(() => {
    loadWeek();
  }, [loadWeek]);

  const conflicts = useMemo(() => validateIntervals(tasks), [tasks]);
  const totalMinutes = totalMinutesOf(tasks);

  // ── Step gating ─────────────────────────────────────────────────────────────
  const tasksWithoutDays = tasks.filter((t) => Object.keys(t.days).length === 0);
  const canProceed =
    step === 1 ? tasks.length > 0
    : step === 2 ? tasks.length > 0 && tasksWithoutDays.length === 0
    : step === 3 ? conflicts.length === 0 && totalMinutes > 0
    : true;

  const persistDraft = useCallback(async (silent: boolean) => {
    if (!orgId || !userId) return null;
    setIsSaving(true);
    try {
      const saved = await saveMyDraft(orgId, userId, weekStart, toPayload());
      setRegistration(saved);
      markSaved();
      if (!silent) showToast('Kladde gemt — du kan fortsætte senere.', 'success');
      return saved;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Kunne ikke gemme kladden.', 'error');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [orgId, userId, weekStart, toPayload, markSaved, showToast]);

  const handleNext = async () => {
    if (!canProceed) return;
    const nextStep = (step + 1) as 1 | 2 | 3 | 4;
    setStep(nextStep);
    await persistDraft(true); // silent crash-safe save on every transition
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4);
  };

  const handleCancel = async () => {
    setConfirmCancel(false);
    try {
      if (registration && registration.status === 'draft') {
        await deleteMyDraft(registration.id);
      }
      setRegistration(registration && registration.status !== 'draft' ? registration : null);
      reset();
      if (registration && registration.status === 'rejected') setEditingRejected(false);
      showToast('Registreringen er annulleret.', 'info');
      await loadWeek();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Kunne ikke annullere.', 'error');
    }
  };

  const handleSubmit = async () => {
    if (conflicts.length > 0 || totalMinutes === 0) {
      showToast('Ret fejlene i registreringen, før du indsender.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await persistDraft(true);
      const regId = saved?.id ?? registration?.id;
      if (!regId) throw new Error('Kladden kunne ikke gemmes.');
      await submitRegistration(regId);
      showToast('Tidsregistreringen er indsendt til godkendelse.', 'success');
      await loadWeek();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Kunne ikke indsende registreringen.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Week switcher (shared across states) ────────────────────────────────────
  const weekBar = (
    <div className="flex items-center justify-center gap-3 py-1">
      <button
        type="button"
        aria-label="Forrige uge"
        onClick={() => setWeek(shiftWeek(weekStart, -1))}
        className="flex w-9 h-9 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary transition-colors"
      >
        <ChevronRightIcon className="w-4 h-4 rotate-180" />
      </button>
      <span className="text-label font-bold text-text-primary dark:text-text-dark-primary min-w-24 text-center">
        Uge {isoWeekNumber(weekStart)}
      </span>
      <button
        type="button"
        aria-label="Næste uge"
        disabled={weekStart >= weekStartOf(new Date())}
        onClick={() => setWeek(shiftWeek(weekStart, 1))}
        className="flex w-9 h-9 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary transition-colors"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </div>
  );

  if (!hydrated) {
    return (
      <div className="space-y-3 pt-2">
        {weekBar}
        {loadError
          ? <Alert variant="danger" title="Kunne ikke hente registreringen">{loadError}</Alert>
          : <><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></>}
      </div>
    );
  }

  // ── Locked states: submitted / approved (read-only), rejected (banner) ─────
  const locked = registration && (registration.status === 'submitted' || registration.status === 'approved');
  if (locked) {
    return (
      <div className="space-y-4 pt-2">
        {weekBar}
        {registration.status === 'submitted' ? (
          <Alert variant="info" title="Indsendt — afventer godkendelse">
            Din registrering på {formatHours(registration.totalMinutes)} er sendt til godkendelse.
            Du får besked, når den er behandlet.
          </Alert>
        ) : (
          <Alert variant="success" title="Godkendt">
            Din registrering på {formatHours(registration.totalMinutes)} er godkendt
            {registration.decisionComment ? ` — “${registration.decisionComment}”` : ''}.
          </Alert>
        )}
        <RegistrationSummary tasks={registration.payload.tasks} weekStart={weekStart} />
      </div>
    );
  }

  const rejected = registration?.status === 'rejected';
  if (rejected && !editingRejected) {
    return (
      <div className="space-y-4 pt-2">
        {weekBar}
        <Alert
          variant="warning"
          title="Afvist — kræver rettelser"
          action={<Button size="sm" onClick={() => setEditingRejected(true)}>Redigér</Button>}
        >
          {registration?.decisionComment
            ? `Kommentar: “${registration.decisionComment}”`
            : 'Din registrering blev afvist. Ret den og indsend igen.'}
        </Alert>
        <RegistrationSummary tasks={registration?.payload.tasks ?? []} weekStart={weekStart} />
      </div>
    );
  }

  // ── The wizard ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-2">
      {weekBar}

      {/* Step indicator */}
      <div className="flex items-center gap-1.5" aria-label={`Trin ${step} af 4: ${STEP_TITLES[step - 1]}`}>
        {STEP_TITLES.map((title, i) => (
          <div key={title} className="flex-1">
            <div className={cn('h-1.5 rounded-full', i < step ? 'bg-brand-primary' : 'bg-bg-muted dark:bg-bg-dark-muted')} />
            <p className={cn(
              'mt-1 text-caption text-center truncate',
              i === step - 1 ? 'font-bold text-brand-primary dark:text-brand-light' : 'text-text-tertiary dark:text-text-dark-tertiary'
            )}>
              {title}
            </p>
          </div>
        ))}
      </div>

      {rejected && (
        <Alert variant="warning" title="Du retter en afvist registrering">
          {registration?.decisionComment ? `Kommentar: “${registration.decisionComment}”` : undefined}
        </Alert>
      )}

      {step === 1 && <Step1VaelgOpgaver useStore={useStore} />}
      {step === 2 && <Step2VaelgDage useStore={useStore} />}
      {step === 3 && <Step3IndstilTid useStore={useStore} />}
      {step === 4 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-title text-text-primary dark:text-text-dark-primary">Oversigt</h2>
            <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
              Gennemgå din registrering, før du indsender den til godkendelse.
            </p>
          </div>
          <RegistrationSummary tasks={tasks} weekStart={weekStart} />
        </div>
      )}

      {step === 2 && tasksWithoutDays.length > 0 && (
        <Alert variant="warning">
          Vælg mindst én dag for: {tasksWithoutDays.map((t) => t.taskTitle).join(', ')} — eller gå
          tilbage og fravælg opgaven.
        </Alert>
      )}

      {/* Sticky action bar (above the floating phone nav) */}
      <div className="sticky bottom-24 md:bottom-6 z-30 pt-2">
        <div className="rounded-card border border-border dark:border-border-dark bg-bg/95 dark:bg-bg-dark-surface/95 backdrop-blur-md shadow-raised p-3 flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} className="shrink-0">
              Tilbage
            </Button>
          )}
          <Button variant="ghost" onClick={() => persistDraft(false)} loading={isSaving} className="shrink-0">
            Gem
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmCancel(true)}
            className="shrink-0 text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark"
          >
            Annuller
          </Button>
          <div className="grow" />
          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed} iconRight={<ChevronRightIcon className="w-4 h-4" />}>
              Næste
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={isSubmitting} disabled={conflicts.length > 0 || totalMinutes === 0}>
              Indsend
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        title="Annullér registrering"
        message="Er du sikker? Alle indtastninger for denne uge slettes, og kladden fjernes."
        confirmLabel="Annullér registrering"
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
};
