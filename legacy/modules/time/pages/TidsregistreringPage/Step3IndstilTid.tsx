import React, { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, ConfirmDialog, Textarea, cn } from '../../../../components/ui';
import { CalendarIcon, PlusIcon, TrashIcon, XIcon } from '../../../../components/icons';
import { TimeRangeSlider } from '../../components/TimeRangeSlider';
import type { RegistrationStoreHook } from '../../stores/registrationStore';
import {
  blockedRangesFor,
  findIntervalConflicts,
  formatDayLabel,
  formatHours,
  validateIntervals,
} from '../../services/timeRegistrations';

/** "Noter" row with an on/off switch — the input only renders when toggled
 *  on (default off; auto-on when the interval already carries a note).
 *  Toggling off clears the note so the oversigt never shows hidden text. */
const IntervalNote: React.FC<{ value: string; onChange: (note: string) => void }> = ({ value, onChange }) => {
  // A non-empty note ALWAYS renders (survives interval reordering);
  // manualOpen only covers the empty-note editing state.
  const [manualOpen, setManualOpen] = useState(false);
  const open = manualOpen || !!value;

  const toggle = () => {
    if (open) {
      onChange('');
      setManualOpen(false);
    } else {
      setManualOpen(true);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-label text-text-secondary dark:text-text-dark-secondary">Noter</span>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-label="Tilføj note"
          onClick={toggle}
          className={cn(
            'relative w-11 h-6 shrink-0 rounded-full transition-colors duration-150',
            open ? 'bg-brand-primary' : 'bg-bg-muted dark:bg-bg-dark-muted border border-border dark:border-border-dark'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition-transform duration-150',
              open ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {open && (
        <Textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tilføj note eller kommentar…"
          aria-label="Note"
          className="mt-2"
        />
      )}
    </div>
  );
};

/**
 * Trin 3 — "Indstil tid": one card per task+day with a dual-handle time range
 * slider, optional note (toggle), per-card total and "+ Tilføj periode" for
 * split shifts (design's indstil_tid mockups). Time occupied by other tasks the
 * same day is tinted on the track but can still be selected; an overlap is then
 * highlighted (red block + badge naming the other task) and blocks "Næste".
 * Sluttid can never precede starttid (the handles clamp against each other).
 */
export const Step3IndstilTid: React.FC<{ useStore: RegistrationStoreHook }> = ({ useStore }) => {
  const tasks = useStore((s) => s.tasks);
  const updateInterval = useStore((s) => s.updateInterval);
  const addInterval = useStore((s) => s.addInterval);
  const removeInterval = useStore((s) => s.removeInterval);
  const toggleDay = useStore((s) => s.toggleDay);

  // Which (task, day) card is pending deletion — drives a single shared
  // ConfirmDialog (removing a day wipes all its periods + notes).
  const [pendingDelete, setPendingDelete] = useState<{
    taskId: string;
    date: string;
    taskTitle: string;
  } | null>(null);

  const conflicts = useMemo(() => validateIntervals(tasks), [tasks]);

  // Per-interval cross-task overlaps → the other task title(s), keyed by
  // taskId|date|intervalIndex, for the red highlight + badge on each side.
  const conflictMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of findIntervalConflicts(tasks)) {
      const key = `${c.taskId}|${c.date}|${c.intervalIndex}`;
      const titles = map.get(key) ?? [];
      if (!titles.includes(c.otherTaskTitle)) titles.push(c.otherTaskTitle);
      map.set(key, titles);
    }
    return map;
  }, [tasks]);

  // One card per (date, task), ordered chronologically like the mockups.
  const cards = useMemo(
    () =>
      tasks
        .flatMap((task) =>
          Object.keys(task.days).map((date) => ({ task, date }))
        )
        .sort((a, b) => a.date.localeCompare(b.date) || a.task.taskTitle.localeCompare(b.task.taskTitle)),
    [tasks]
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title text-text-primary dark:text-text-dark-primary">Trin 3: Indstil tid</h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          Træk i de to greb for at sætte start- og sluttid. Rød tid på skalaen er
          allerede optaget af en anden opgave — du kan godt vælge den, men et
          overlap skal rettes, før du kan fortsætte. Tilføj en ekstra periode,
          hvis du har arbejdet på opgaven flere gange samme dag.
        </p>
      </div>

      {conflicts.length > 0 && (
        <Alert variant="danger" title="Tiderne overlapper">
          <ul className="list-disc pl-4 space-y-1">
            {conflicts.slice(0, 4).map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
            {conflicts.length > 4 && <li>… og {conflicts.length - 4} mere.</li>}
          </ul>
        </Alert>
      )}

      {cards.map(({ task, date }) => {
        const intervals = task.days[date] ?? [];
        const cardTotal = intervals.reduce((s, iv) => s + Math.max(0, iv.endMin - iv.startMin), 0);
        return (
          <Card key={`${task.taskId}-${date}`} padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
              <span className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="w-4 h-4 shrink-0 text-brand-primary dark:text-brand-light" />
                <span className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">
                  {formatDayLabel(date)}
                </span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Badge variant="info" className="shrink-0">{task.taskTitle}</Badge>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ taskId: task.taskId, date, taskTitle: task.taskTitle })}
                  aria-label={`Fjern ${task.taskTitle} – ${formatDayLabel(date)}`}
                  className="p-3 -my-2 -mr-1 shrink-0 text-danger hover:text-danger-strong transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </span>
            </div>

            <div className="p-4 space-y-5">
              {intervals.map((iv, index) => {
                const blocked = blockedRangesFor(tasks, task.taskId, date, index);
                const conflictTitles = conflictMap.get(`${task.taskId}|${date}|${index}`);
                const conflicting = !!conflictTitles?.length;
                return (
                  <div
                    key={index}
                    className={cn(
                      'space-y-2',
                      conflicting
                        ? 'rounded-control border border-danger bg-danger-subtle dark:bg-danger-subtle-dark p-3'
                        : index > 0 && 'pt-3 border-t border-dashed border-border dark:border-border-dark'
                    )}
                  >
                    {(intervals.length > 1 || conflicting) && (
                      <div className="flex items-start justify-between gap-2 -mb-1">
                        <span className="flex items-center gap-2 min-w-0 pt-0.5">
                          {intervals.length > 1 && (
                            <span className="text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary shrink-0">
                              Periode {index + 1}
                            </span>
                          )}
                          {conflicting && (
                            <Badge variant="danger" className="min-w-0">
                              <span className="truncate">Overlapper: {conflictTitles!.join(', ')}</span>
                            </Badge>
                          )}
                        </span>
                        {intervals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInterval(task.taskId, date, index)}
                            aria-label={`Fjern periode ${index + 1}`}
                            className="p-2.5 -mt-2 -mr-2 shrink-0 text-danger hover:text-danger-strong transition-colors"
                          >
                            <XIcon className="w-5 h-5 stroke-[2.5]" />
                          </button>
                        )}
                      </div>
                    )}
                    <TimeRangeSlider
                      startMin={iv.startMin}
                      endMin={iv.endMin}
                      blockedRanges={blocked}
                      onChange={({ startMin, endMin }) =>
                        updateInterval(task.taskId, date, index, { startMin, endMin })
                      }
                    />
                    <IntervalNote
                      value={iv.note}
                      onChange={(note) => updateInterval(task.taskId, date, index, { note })}
                    />
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                iconLeft={<PlusIcon className="w-4 h-4" />}
                onClick={() => addInterval(task.taskId, date)}
              >
                Tilføj periode
              </Button>
            </div>

            <div className="flex justify-end px-4 py-2.5 border-t border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
              <span className="text-label font-bold text-text-secondary dark:text-text-dark-secondary">
                Total: <span className="text-brand-primary dark:text-brand-light ml-1">{formatHours(cardTotal)}</span>
              </span>
            </div>
          </Card>
        );
      })}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Fjern registrering?"
        message={
          pendingDelete
            ? `Fjern «${pendingDelete.taskTitle}» for ${formatDayLabel(pendingDelete.date)}? Alle perioder og noter for denne dag slettes.`
            : ''
        }
        confirmLabel="Fjern"
        cancelLabel="Annuller"
        danger
        onConfirm={() => {
          if (pendingDelete) toggleDay(pendingDelete.taskId, pendingDelete.date);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
