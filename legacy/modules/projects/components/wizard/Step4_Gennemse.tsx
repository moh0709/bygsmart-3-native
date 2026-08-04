/**
 * Step4_Gennemse.tsx
 * Review + create screen.
 *  - Calls runPlanReview on mount (non-blocking, shows skeleton)
 *  - Renders AI findings cards (error/warning/info) with dismiss
 *  - Shows zone-task breakdown, project details summary
 *  - Local duration estimate (sum of task durations)
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, AlertTriangle, AlertCircle, Info,
  ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { PROJECT_TYPES, getZoneById, TASKS_BY_ZONE } from '../../data/wizardCatalog';
import { runPlanReview } from '../../../ai';
import type { Finding } from '../../../ai';
import { useModuleGate } from '../../../../core/entitlements/ModuleGate';
import type { WizardStoreInstance } from '../../stores/wizardStore';

interface Props { store: WizardStoreInstance }

// ─── Finding card ─────────────────────────────────────────────────────────────

const FINDING_ICON: Record<string, React.ReactNode> = {
  error:   <AlertCircle size={14} className="text-danger flex-none mt-0.5" />,
  warning: <AlertTriangle size={14} className="text-warning flex-none mt-0.5" />,
  info:    <Info size={14} className="text-info flex-none mt-0.5" />,
};

const FINDING_BG: Record<string, string> = {
  error:   'bg-danger-subtle dark:bg-danger-subtle-dark border-danger-border dark:border-danger/30',
  warning: 'bg-warning-subtle dark:bg-warning-subtle-dark border-warning-border dark:border-warning/30',
  info:    'bg-info-subtle dark:bg-info-subtle-dark border-info-border dark:border-info/30',
};

const FindingCard: React.FC<{ finding: Finding; onDismiss: () => void }> = ({ finding, onDismiss }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: -4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
    transition={{ duration: 0.18 }}
    className={`flex items-start gap-2.5 p-3 rounded-xl border ${FINDING_BG[finding.severity]} mb-2`}
  >
    {FINDING_ICON[finding.severity]}
    <p className="flex-1 text-label text-text-primary dark:text-text-dark-primary leading-relaxed">
      {finding.messageDa}
    </p>
    <button
      type="button"
      onClick={onDismiss}
      className="text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary transition-colors flex-none text-caption p-2 -m-2 mt-0.5"
      aria-label="Afvis"
    >
      ✕
    </button>
  </motion.div>
);

// ─── Summary row ──────────────────────────────────────────────────────────────

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between px-4 py-3 gap-2">
    <span className="text-label text-text-secondary dark:text-text-dark-secondary font-medium flex-none">
      {label}
    </span>
    <span className="text-body text-text-primary dark:text-text-dark-primary text-right truncate">
      {value}
    </span>
  </div>
);

// ─── Step4_Gennemse ───────────────────────────────────────────────────────────

const Step4_Gennemse: React.FC<Props> = ({ store }) => {
  const useStore = store;
  const projectType  = useStore((s) => s.projectType);
  const selectedZones = useStore((s) => s.selectedZones);
  const selectedTasks = useStore((s) => s.selectedTasks);
  const details      = useStore((s) => s.details);

  const ptLabel = PROJECT_TYPES.find((p) => p.id === projectType)?.label ?? '—';
  const totalTasks = Object.values(selectedTasks as Record<string, string[]>)
    .reduce((n, ids) => n + ids.length, 0);

  // "AI-vurdering" (runPlanReview) is an ai-module feature — skip the call and
  // hide the review summary/findings sections entirely when ai isn't entitled.
  const aiEnabled = useModuleGate('ai');

  // ── AI plan review ──
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [reviewSummary, setReviewSummary] = useState<string>('');
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!aiEnabled) {
      setReviewLoading(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setReviewLoading(true);
    setDismissed(new Set());

    runPlanReview(
      {
        projectTypeId: projectType,
        selectedZoneIds: selectedZones.map((z) => z.zoneId),
        selectedTaskIds: selectedTasks as Record<string, string[]>,
        details: { name: details.name, address: details.address || undefined },
      },
      abortRef.current.signal,
    ).then((res) => {
      if (abortRef.current?.signal.aborted) return;
      if (res.ok && res.result) {
        setFindings(res.result.findings);
        setQualityScore(res.result.overallQualityScore);
        setReviewSummary(res.result.summaryDa);
      }
      setReviewLoading(false);
    });

    return () => abortRef.current?.abort();
  }, [aiEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Local duration estimate ──
  const localDays = (() => {
    let min = 0, max = 0;
    Object.entries(selectedTasks as Record<string, string[]>).forEach(([zoneId, taskIds]) => {
      const zone = getZoneById(zoneId);
      const zoneTasks = TASKS_BY_ZONE[zone?.tasksKey ?? ''] ?? [];
      taskIds.forEach((tid) => {
        const t = zoneTasks.find((task) => task.id === tid);
        if (t) { min += t.durationDaysMin; max += t.durationDaysMax; }
      });
    });
    return { min, max };
  })();

  // ── Zone breakdown expand/collapse ──
  const [expandedZones, setExpandedZones] = useState(false);

  const visibleFindings = findings.filter((_, i) => !dismissed.has(i));
  const errorCount = visibleFindings.filter((f) => f.severity === 'error').length;
  const warnCount  = visibleFindings.filter((f) => f.severity === 'warning').length;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Heading + quality score */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-heading text-text-primary dark:text-text-dark-primary">
            Gennemse projekt
          </h2>
          <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
            Kontrollér og opret projektet
          </p>
        </div>
        {qualityScore != null && (
          <div
            className={[
              'flex flex-col items-center px-3 py-2 rounded-xl border',
              qualityScore >= 70
                ? 'bg-success-subtle border-success-border dark:bg-success-subtle-dark dark:border-success/30'
                : qualityScore >= 40
                ? 'bg-warning-subtle border-warning-border dark:bg-warning-subtle-dark dark:border-warning/30'
                : 'bg-danger-subtle border-danger-border dark:bg-danger-subtle-dark dark:border-danger/30',
            ].join(' ')}
          >
            <span className="text-title text-text-primary dark:text-text-dark-primary">
              {qualityScore}
            </span>
            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">/ 100</span>
          </div>
        )}
      </div>

      {/* AI review summary */}
      {aiEnabled && reviewSummary && (
        <div className="bg-brand-subtle dark:bg-brand-subtle-dark border border-brand-border dark:border-brand-border-dark rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-caption">✨</span>
            <span className="text-label font-semibold text-brand-primary dark:text-brand-light">
              AI-vurdering
            </span>
          </div>
          <p className="text-label text-text-primary dark:text-text-dark-primary leading-relaxed">
            {reviewSummary}
          </p>
        </div>
      )}

      {/* AI findings */}
      {!aiEnabled ? null : reviewLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 bg-bg-muted dark:bg-bg-dark-muted rounded-xl animate-pulse" />
          ))}
          <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary text-center">AI gennemgår planen...</p>
        </div>
      ) : visibleFindings.length > 0 ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
              Bemærkninger
            </span>
            {errorCount > 0 && (
              <span className="text-caption px-1.5 py-0.5 rounded-full bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger font-medium">
                {errorCount} fejl
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-caption px-1.5 py-0.5 rounded-full bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning font-medium">
                {warnCount} advarsler
              </span>
            )}
          </div>
          <AnimatePresence mode="popLayout">
            {visibleFindings.map((f, i) => (
              <FindingCard
                key={i}
                finding={f}
                onDismiss={() => setDismissed((prev) => new Set([...prev, findings.indexOf(f)]))}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        !reviewLoading && (
          <div className="flex items-center gap-2 p-3 bg-success-subtle dark:bg-success-subtle-dark border border-success-border dark:border-success/30 rounded-xl">
            <CheckCircle size={14} className="text-success flex-none" />
            <span className="text-label text-success-strong dark:text-success">
              Ingen bemærkninger — planen ser god ud!
            </span>
          </div>
        )
      )}

      {/* Project summary card */}
      <div className="bg-bg dark:bg-bg-dark-surface rounded-2xl border border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
        <Row label="Projektnavn" value={details.name || '—'} />
        <Row label="Type" value={ptLabel} />
        <Row label="Adresse" value={details.address || '—'} />
        <Row label="Startdato" value={details.startDate || '—'} />
        {details.budgetKr && (
          <Row label="Budget" value={`${details.budgetKr.toLocaleString('da-DK')} kr.`} />
        )}
        <Row
          label="Valgte områder"
          value={`${selectedZones.length} ${selectedZones.length === 1 ? 'område' : 'områder'}`}
        />
        <Row
          label="Valgte opgaver"
          value={`${totalTasks} ${totalTasks === 1 ? 'opgave' : 'opgaver'}`}
        />
      </div>

      {/* Duration estimate */}
      {localDays.max > 0 && (
        <div className="flex items-center gap-3 p-3 bg-info-subtle dark:bg-info-subtle-dark border border-info-border dark:border-info/30 rounded-xl">
          <Clock size={16} className="text-info flex-none" />
          <div>
            <span className="text-label font-semibold text-info-strong dark:text-info">
              Estimeret varighed
            </span>
            <p className="text-body text-text-primary dark:text-text-dark-primary">
              {localDays.min}–{localDays.max} arbejdsdage
            </p>
          </div>
        </div>
      )}

      {/* Zone + task breakdown (collapsible) */}
      {selectedZones.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpandedZones((v) => !v)}
            className="w-full flex items-center justify-between py-2 min-h-11 text-text-primary dark:text-text-dark-primary"
          >
            <h3 className="text-body font-semibold">
              Opgaveoversigt
            </h3>
            {expandedZones ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {expandedZones && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden space-y-2"
              >
                {selectedZones.map((sel) => {
                  const zone = getZoneById(sel.zoneId);
                  const taskIds = (selectedTasks as Record<string, string[]>)[sel.zoneId] ?? [];
                  const allTasks = TASKS_BY_ZONE[zone?.tasksKey ?? ''] ?? [];
                  const taskLabels = taskIds.map((tid) => allTasks.find((t) => t.id === tid)?.label ?? tid);

                  return (
                    <div
                      key={sel.zoneId}
                      className="bg-bg dark:bg-bg-dark-surface rounded-xl border border-border dark:border-border-dark p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{zone?.icon ?? '📍'}</span>
                        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                          {zone?.label ?? sel.zoneId}
                        </span>
                        {sel.source === 'ai' && (
                          <span className="text-caption bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light px-1.5 py-0.5 rounded-full">
                            AI
                          </span>
                        )}
                        <span className="ml-auto text-caption text-text-tertiary dark:text-text-dark-tertiary">
                          {taskIds.length} opgaver
                        </span>
                      </div>
                      {taskLabels.length > 0 ? (
                        <ul className="space-y-1">
                          {taskLabels.map((label, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 text-label text-text-secondary dark:text-text-dark-secondary"
                            >
                              <CheckCircle size={11} className="text-success flex-none" />
                              {label}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary italic">Ingen opgaver valgt</p>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Notes */}
      {details.notes && (
        <div className="bg-warning-subtle dark:bg-warning-subtle-dark rounded-xl p-3 border border-warning-border dark:border-warning/30">
          <p className="text-label font-medium text-warning-strong dark:text-warning mb-1">Noter</p>
          <p className="text-body text-text-primary dark:text-text-dark-primary">{details.notes}</p>
        </div>
      )}

      {/* Team */}
      {details.team.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {details.team.map((member) => (
            <span
              key={member}
              className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-label font-medium"
            >
              {member}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default Step4_Gennemse;
