import React, { useMemo, useState } from 'react';
import { Badge, Card, SegmentedControl, cn } from '../../../../components/ui';
import {
  DAY_LETTERS,
  formatDayLabel,
  formatHours,
  formatMinutes,
  totalMinutesOf,
  weekDates,
  weekStartOf,
  type RegistrationInterval,
  type RegistrationTask,
} from '../../services/timeRegistrations';

type SummaryView = 'task' | 'day' | 'calendar';

/** Calendar chip color per task (cycled by task index). */
const TASK_CHIP_COLORS = [
  'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light',
  'bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success',
  'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning',
  'bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info',
  'bg-danger-subtle text-danger-strong dark:bg-danger-subtle-dark dark:text-danger',
];

interface DayLine {
  task: RegistrationTask;
  taskIndex: number;
  interval: RegistrationInterval;
}

/**
 * Read-only breakdown of a registration with three views: grouped per task
 * (default), grouped per day, and a week-calendar view. Shared by wizard
 * step 4 (Oversigt), the post-submit status view and the manager/CEO detail.
 */
export const RegistrationSummary: React.FC<{ tasks: RegistrationTask[]; weekStart?: string }> = ({
  tasks,
  weekStart,
}) => {
  const [view, setView] = useState<SummaryView>('task');
  const grandTotal = totalMinutesOf(tasks);

  const allDates = useMemo(
    () => [...new Set(tasks.flatMap((t) => Object.keys(t.days)))].sort(),
    [tasks]
  );

  // Week anchor for the calendar — explicit prop, else derived from the data.
  const resolvedWeekStart = useMemo(() => {
    if (weekStart) return weekStart;
    if (allDates.length === 0) return weekStartOf(new Date());
    const [y, m, d] = allDates[0].split('-').map(Number);
    return weekStartOf(new Date(y, m - 1, d));
  }, [weekStart, allDates]);

  const linesByDate = useMemo(() => {
    const map = new Map<string, DayLine[]>();
    tasks.forEach((task, taskIndex) => {
      for (const [date, intervals] of Object.entries(task.days)) {
        for (const interval of intervals) {
          const list = map.get(date) ?? [];
          list.push({ task, taskIndex, interval });
          map.set(date, list);
        }
      }
    });
    for (const list of map.values()) list.sort((a, b) => a.interval.startMin - b.interval.startMin);
    return map;
  }, [tasks]);

  // ── View: grouped per task (default) ────────────────────────────────────────
  const taskView = tasks.map((task) => {
    const dayEntries = Object.entries(task.days).sort(([a], [b]) => a.localeCompare(b));
    const taskTotal = dayEntries.reduce(
      (s, [, ivs]) => s + ivs.reduce((x, iv) => x + Math.max(0, iv.endMin - iv.startMin), 0),
      0
    );
    if (dayEntries.length === 0) return null;
    return (
      <Card key={task.taskId} padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
          <span className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{task.taskTitle}</span>
          {task.projectName ? (
            <Badge variant="info" className="shrink-0">{task.projectName}</Badge>
          ) : (
            <Badge variant="neutral" className="shrink-0">Intern Opgave</Badge>
          )}
        </div>
        <div className="divide-y divide-border dark:divide-border-dark">
          {dayEntries.map(([date, intervals]) => (
            <div key={date} className="px-4 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{formatDayLabel(date)}</p>
                {intervals.map((iv, i) => (
                  <p key={i} className="text-caption text-text-secondary dark:text-text-dark-secondary tabular-nums">
                    {formatMinutes(iv.startMin)}–{formatMinutes(iv.endMin)}
                    {iv.note ? ` · ${iv.note}` : ''}
                  </p>
                ))}
              </div>
              <span className="shrink-0 text-label font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">
                {formatHours(intervals.reduce((s, iv) => s + Math.max(0, iv.endMin - iv.startMin), 0))}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-end px-4 py-2 border-t border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
          <span className="text-label font-bold text-text-secondary dark:text-text-dark-secondary">
            Opgave i alt: <span className="text-brand-primary dark:text-brand-light ml-1">{formatHours(taskTotal)}</span>
          </span>
        </div>
      </Card>
    );
  });

  // ── View: grouped per day ────────────────────────────────────────────────────
  const dayView = allDates.map((date) => {
    const lines = linesByDate.get(date) ?? [];
    const dayTotal = lines.reduce((s, l) => s + Math.max(0, l.interval.endMin - l.interval.startMin), 0);
    return (
      <Card key={date} padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted">
          <span className="text-label font-bold text-text-primary dark:text-text-dark-primary">{formatDayLabel(date)}</span>
          <span className="text-label font-bold text-brand-primary dark:text-brand-light tabular-nums">{formatHours(dayTotal)}</span>
        </div>
        <div className="divide-y divide-border dark:divide-border-dark">
          {lines.map((l, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{l.task.taskTitle}</p>
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary tabular-nums">
                  {formatMinutes(l.interval.startMin)}–{formatMinutes(l.interval.endMin)}
                  {l.interval.note ? ` · ${l.interval.note}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-label font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">
                {formatHours(Math.max(0, l.interval.endMin - l.interval.startMin))}
              </span>
            </div>
          ))}
        </div>
      </Card>
    );
  });

  // ── View: week calendar ─────────────────────────────────────────────────────
  const calendarView = (
    <Card padding="none" className="overflow-x-auto">
      <div className="min-w-[600px] grid grid-cols-7 divide-x divide-border dark:divide-border-dark">
        {weekDates(resolvedWeekStart).map((date, i) => {
          const lines = linesByDate.get(date) ?? [];
          const dayTotal = lines.reduce((s, l) => s + Math.max(0, l.interval.endMin - l.interval.startMin), 0);
          return (
            <div key={date} className="min-h-36 flex flex-col">
              <div className="px-2 py-1.5 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted text-center">
                <p className="text-caption font-bold text-text-primary dark:text-text-dark-primary">{DAY_LETTERS[i]}</p>
                <p className="text-[10px] text-text-tertiary dark:text-text-dark-tertiary">{date.slice(8)}/{Number(date.slice(5, 7))}</p>
              </div>
              <div className="p-1.5 space-y-1 grow">
                {lines.map((l, j) => (
                  <div
                    key={j}
                    className={cn('rounded-control px-1.5 py-1', TASK_CHIP_COLORS[l.taskIndex % TASK_CHIP_COLORS.length])}
                    title={`${l.task.taskTitle} ${formatMinutes(l.interval.startMin)}–${formatMinutes(l.interval.endMin)}`}
                  >
                    <p className="text-[10px] font-bold tabular-nums leading-tight">
                      {formatMinutes(l.interval.startMin)}–{formatMinutes(l.interval.endMin)}
                    </p>
                    <p className="text-[10px] leading-tight truncate">{l.task.taskTitle}</p>
                  </div>
                ))}
              </div>
              {dayTotal > 0 && (
                <p className="px-2 py-1 text-[10px] font-bold text-right text-text-secondary dark:text-text-dark-secondary tabular-nums border-t border-border dark:border-border-dark">
                  {formatHours(dayTotal)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      <SegmentedControl<SummaryView>
        label="Skift oversigtsvisning"
        value={view}
        onChange={setView}
        options={[
          { label: 'Pr. opgave', value: 'task' },
          { label: 'Pr. dag', value: 'day' },
          { label: 'Kalender', value: 'calendar' },
        ]}
      />

      {view === 'task' && taskView}
      {view === 'day' && dayView}
      {view === 'calendar' && calendarView}

      <Card padding="md" className="flex items-center justify-between">
        <span className="text-heading text-text-primary dark:text-text-dark-primary">Uge i alt</span>
        <span className="text-heading font-bold text-brand-primary dark:text-brand-light tabular-nums">{formatHours(grandTotal)}</span>
      </Card>
    </div>
  );
};
