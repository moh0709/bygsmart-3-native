import React, { useEffect, useMemo, useState } from 'react';
import { Project, Task, PurchaseItem, TimeEntry, ProjectBudgetSummary } from '../../../types';
import { getProjectBudgetSummary } from '../../budget';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';
import {
  computeIntelligenceIndex,
  generateIndexFeedback,
  IndexFeedback,
  IntelligenceDimension,
  DimensionId,
} from '../services/projectIntelligence';
import { Badge, Button, Card, ProgressBar, ProgressRing, Skeleton, cn } from '../../../components/ui';
import type { ProgressTone } from '../../../components/ui';
import { AlertTriangleIcon, ChevronDownIcon, RefreshCwIcon, SparklesIcon } from '../../../components/icons';

interface IntelligenceIndexCardProps {
  project: Project;
  tasks: Task[];
  purchases: PurchaseItem[];
  timeEntries?: TimeEntry[];
  className?: string;
}

/** Health tone: success ≥75, warning 40–74, danger <40. */
const healthTone = (score: number): ProgressTone =>
  score >= 75 ? 'success' : score >= 40 ? 'warning' : 'danger';

/** Short labels for the 5 mini metric bars. */
const SHORT_LABELS: Record<DimensionId, string> = {
  planning: 'Plan',
  budget: 'Budget',
  schedule: 'Tid',
  quality: 'Kvalitet',
  staffing: 'Folk',
};

/** Lowercase names used in the "X og Y trækker ned" caption. */
const CAPTION_NAMES: Record<DimensionId, string> = {
  planning: 'planlægning',
  budget: 'budget',
  schedule: 'tidsplan',
  quality: 'dokumentation',
  staffing: 'bemanding',
};

/** One-line caption naming the weakest sub-metric(s). */
const weakestCaption = (dimensions: IntelligenceDimension[]): string => {
  const weak = [...dimensions]
    .sort((a, b) => a.score - b.score)
    .filter(d => d.score < 60)
    .slice(0, 2);
  if (weak.length === 0) return 'Alle områder ser fornuftige ud';
  const names = weak.map(d => CAPTION_NAMES[d.id]);
  const sentence =
    names.length === 2 ? `${names[0]} og ${names[1]} trækker ned` : `${names[0]} trækker ned`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

const IMPACT_VARIANT: Record<IndexFeedback['topActions'][number]['impact'], 'danger' | 'warning' | 'neutral'> = {
  høj: 'danger',
  mellem: 'warning',
  lav: 'neutral',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const getCachedFeedback = (projectId: string, overall: number): IndexFeedback | null => {
  try {
    const raw = localStorage.getItem(`bygSmart-intelligence-${projectId}-${overall}`);
    if (!raw) return null;
    const { feedback, ts } = JSON.parse(raw) as { feedback: IndexFeedback; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(`bygSmart-intelligence-${projectId}-${overall}`);
      return null;
    }
    return feedback;
  } catch {
    return null;
  }
};

const setCachedFeedback = (projectId: string, overall: number, data: IndexFeedback): void => {
  try {
    localStorage.setItem(
      `bygSmart-intelligence-${projectId}-${overall}`,
      JSON.stringify({ feedback: data, ts: Date.now() })
    );
  } catch {
    // localStorage full or unavailable — skip silently
  }
};

/**
 * "Projekt-sundhed" — compact health card: score ring + weakest-metric caption,
 * expandable to the 5 sub-metric bars, AI feedback (lazily loaded) and PDF export.
 * The score itself is deterministic (computeIntelligenceIndex, no AI).
 */
const IntelligenceIndexCard: React.FC<IntelligenceIndexCardProps> = ({
  project,
  tasks,
  purchases,
  timeEntries,
  className,
}) => {
  const budgetEnabled = useModuleGate('budget');
  const [budgetSummary, setBudgetSummary] = useState<ProjectBudgetSummary | null>(null);

  // `budget` sub-dependency: only fetched when the budget module is entitled.
  // computeIntelligenceIndex falls back to the legacy project.budget calc for
  // its "budget" dimension when budgetSummary stays null.
  useEffect(() => {
    if (!budgetEnabled) {
      setBudgetSummary(null);
      return;
    }
    let cancelled = false;
    getProjectBudgetSummary(project.id).then(summary => {
      if (!cancelled) setBudgetSummary(summary);
    });
    return () => { cancelled = true; };
  }, [project.id, budgetEnabled]);

  const index = useMemo(
    () => computeIntelligenceIndex({ project, tasks, purchases, timeEntries, budgetSummary }),
    [project, tasks, purchases, timeEntries, budgetSummary]
  );

  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<IndexFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const caption = useMemo(() => weakestCaption(index.dimensions), [index.dimensions]);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { generateIntelligenceReport } = await import('../../reporting');
      const doc = generateIntelligenceReport({ project, tasks, purchases, index, feedback, budgetSummary });
      const date = new Date().toISOString().slice(0, 10);
      doc.save(`Intelligensrapport_${project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}_${date}.pdf`);
    } catch (err) {
      console.error('[IntelligenceIndexCard] PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Load from cache when project or score changes; clear stale feedback
  useEffect(() => {
    setFeedback(null);
    const cached = getCachedFeedback(project.id, index.overall);
    if (cached) setFeedback(cached);
  }, [project.id, index.overall]);

  // Trigger AI call only when the refresh button is clicked (refreshKey > 0)
  useEffect(() => {
    if (refreshKey === 0) return;

    let cancelled = false;
    setIsLoadingFeedback(true);
    setFeedback(null);

    generateIndexFeedback(index, { project, tasks, purchases })
      .then(result => {
        if (!cancelled) {
          setFeedback(result);
          setCachedFeedback(project.id, index.overall, result);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFeedback(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <Card padding="md" className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full min-h-11 items-center gap-3 text-left"
      >
        <ProgressRing
          value={index.overall}
          tone={healthTone(index.overall)}
          diameter={44}
          label={`Projekt-sundhed: ${index.overall} ud af 100`}
        >
          {null}
        </ProgressRing>
        <span className="min-w-0 grow">
          <span className="block text-label font-bold text-text-primary dark:text-text-dark-primary">
            Projekt-sundhed · {index.overall}
          </span>
          <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
            {caption}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            'w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-150',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-border dark:border-border-dark animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3">
            {index.dimensions.map(dim => (
              <div key={dim.id} title={dim.drivers.join(' · ')}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">
                    {SHORT_LABELS[dim.id]}
                  </span>
                  <span className="text-caption font-bold tabular-nums text-text-primary dark:text-text-dark-primary">
                    {dim.score}
                  </span>
                </div>
                <ProgressBar
                  value={dim.score}
                  tone={healthTone(dim.score)}
                  size="sm"
                  label={`${dim.label}: ${dim.score} ud af 100`}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border dark:border-border-dark">
            <h4 className="text-label font-semibold text-text-primary dark:text-text-dark-primary flex items-center gap-1.5 mb-2">
              <SparklesIcon className="w-4 h-4 text-brand-primary dark:text-brand-light" aria-hidden="true" />
              Feedback og anbefalinger
            </h4>

            {isLoadingFeedback ? (
              <div className="space-y-2" role="status" aria-label="Indlæser AI-feedback">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <span className="sr-only">Indlæser AI-feedback…</span>
              </div>
            ) : feedback ? (
              <div className="space-y-4">
                <p className="text-body text-text-secondary dark:text-text-dark-secondary">{feedback.summary}</p>

                {feedback.topActions.length > 0 && (
                  <ul className="space-y-2">
                    {feedback.topActions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge variant={IMPACT_VARIANT[action.impact]} className="mt-0.5 shrink-0">
                          {action.impact}
                        </Badge>
                        <div>
                          <p className="text-label font-medium text-text-primary dark:text-text-dark-primary">
                            {action.title}
                          </p>
                          {action.why && (
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                              {action.why}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {feedback.risks.length > 0 && (
                  <div>
                    <h5 className="text-caption font-bold uppercase tracking-wide text-danger flex items-center gap-1 mb-1.5">
                      <AlertTriangleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      Risici
                    </h5>
                    <ul className="space-y-1">
                      {feedback.risks.map((risk, i) => (
                        <li
                          key={i}
                          className="text-caption text-text-secondary dark:text-text-dark-secondary flex items-start gap-1.5"
                        >
                          <span className="mt-1.5 w-1 h-1 rounded-full bg-danger shrink-0" aria-hidden="true" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.source === 'fallback' && (
                  <p className="text-caption italic text-text-secondary dark:text-text-dark-secondary">
                    AI-feedback var ikke tilgængelig — viser automatisk genereret opsummering.
                  </p>
                )}
              </div>
            ) : refreshKey === 0 ? (
              <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                Klik Genberegn for at analysere projektet med AI.
              </p>
            ) : (
              <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                Ingen feedback tilgængelig. Prøv at genberegne.
              </p>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRefreshKey(k => k + 1)}
                loading={isLoadingFeedback}
                iconLeft={<RefreshCwIcon className="w-4 h-4" />}
                aria-label="Genberegn AI-feedback"
              >
                Genberegn
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadPdf}
                loading={isGeneratingPdf}
                aria-label="Download sundhedsrapport som PDF"
              >
                PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default IntelligenceIndexCard;
