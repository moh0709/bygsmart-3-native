import React from 'react';
import { Badge, Card, cn } from '../../../../components/ui';
import type { RegistrationStoreHook } from '../../stores/registrationStore';
import { DAY_LETTERS, isoWeekNumber, weekDates } from '../../services/timeRegistrations';

/**
 * Trin 2 — "Vælg Dage": per selected task, the week's M/T/O/T/F/L/S round
 * day-toggles (design's v_lg_dage mockup). Toggling a day on seeds a default
 * 07:00–16:00 interval for step 3.
 */
export const Step2VaelgDage: React.FC<{ useStore: RegistrationStoreHook }> = ({ useStore }) => {
  const tasks = useStore((s) => s.tasks);
  const weekStart = useStore((s) => s.weekStart);
  const toggleDay = useStore((s) => s.toggleDay);
  const dates = weekDates(weekStart);
  const weekNo = isoWeekNumber(weekStart);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title text-text-primary dark:text-text-dark-primary">Trin 2: Vælg dage</h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          Marker de dage, du arbejdede på de valgte opgaver.
        </p>
      </div>

      {tasks.map((task) => (
        <Card key={task.taskId} padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
            <span className="text-label font-bold text-brand-primary dark:text-brand-light truncate">{task.taskTitle}</span>
            {task.projectName ? (
              <Badge variant="info" className="shrink-0">Projekt: {task.projectName}</Badge>
            ) : (
              <Badge variant="neutral" className="shrink-0">Intern Opgave</Badge>
            )}
          </div>
          <div className="p-4">
            <p className="text-label font-bold text-text-primary dark:text-text-dark-primary mb-3">Uge {weekNo}</p>
            <div className="flex justify-between gap-0.5 max-w-md" role="group" aria-label={`Vælg dage for ${task.taskTitle}`}>
              {dates.map((date, i) => {
                const selected = !!task.days[date];
                const [, month, day] = date.split('-').map(Number);
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => toggleDay(task.taskId, date)}
                    aria-pressed={selected}
                    aria-label={`${task.taskTitle} — ${date}`}
                    className="flex flex-col items-center gap-1 shrink-0 py-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <span
                      className={cn(
                        'w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-label font-bold border transition-colors',
                        selected
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-bg text-text-primary border-border hover:bg-bg-subtle dark:bg-bg-dark-surface dark:text-text-dark-primary dark:border-border-dark dark:hover:bg-bg-dark-muted'
                      )}
                    >
                      {DAY_LETTERS[i]}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] leading-none tabular-nums transition-colors',
                        selected
                          ? 'font-semibold text-brand-primary dark:text-brand-light'
                          : 'text-text-tertiary dark:text-text-dark-tertiary'
                      )}
                    >
                      {day}/{month}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
