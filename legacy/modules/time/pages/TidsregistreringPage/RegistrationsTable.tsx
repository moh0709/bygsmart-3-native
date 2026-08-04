import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, Modal, cn } from '../../../../components/ui';
import { CheckCircleIcon, XIcon, MessageSquareIcon } from '../../../../components/icons';
import { STATUS_BADGE } from './RegistrationDetail';
import {
  formatDateShort,
  formatDayLabel,
  formatHours,
  formatMinutes,
  type RegistrationListRow,
  type RegistrationTask,
} from '../../services/timeRegistrations';

interface TaskLine {
  registration: RegistrationListRow;
  task: RegistrationTask;
  /** Sorted dates this task was worked. */
  dates: string[];
  minutes: number;
  hasNotes: boolean;
  /** First line of a registration carries the rowSpan cells (staff/status/actions). */
  isFirstOfRegistration: boolean;
  registrationLineCount: number;
}

interface RegistrationsTableProps {
  rows: RegistrationListRow[];
  /** Open the full registration detail (row click). */
  onOpen: (row: RegistrationListRow) => void;
  /** Quick actions on submitted registrations. */
  onApprove: (row: RegistrationListRow) => void;
  onReject: (row: RegistrationListRow) => void;
}

const periodLabel = (dates: string[]): string => {
  if (dates.length === 0) return '—';
  if (dates.length === 1) return formatDateShort(dates[0]);
  return `${formatDateShort(dates[0])} – ${formatDateShort(dates[dates.length - 1])}`;
};

const TH: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className }) => (
  <th className={cn('px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary whitespace-nowrap', className)}>
    {children}
  </th>
);

/**
 * Manager/CEO week table — one row per task line of every non-draft
 * registration: Medarbejder · Projekt-ID · Projekt · Opgave · Periode ·
 * Timer · Status · Handlinger. Staff/status/actions cells span all of a
 * registration's task rows (accept/reject decide the WHOLE week). A note
 * icon next to the task opens the notes in a modal.
 */
export const RegistrationsTable: React.FC<RegistrationsTableProps> = ({ rows, onOpen, onApprove, onReject }) => {
  const [notesFor, setNotesFor] = useState<TaskLine | null>(null);

  const lines = useMemo<TaskLine[]>(() => {
    const out: TaskLine[] = [];
    for (const registration of rows) {
      const tasks = (registration.payload.tasks ?? []).filter((t) => Object.keys(t.days).length > 0);
      tasks.forEach((task, i) => {
        const dates = Object.keys(task.days).sort();
        out.push({
          registration,
          task,
          dates,
          minutes: dates.reduce(
            (s, d) => s + task.days[d].reduce((x, iv) => x + Math.max(0, iv.endMin - iv.startMin), 0),
            0
          ),
          hasNotes: dates.some((d) => task.days[d].some((iv) => iv.note.trim().length > 0)),
          isFirstOfRegistration: i === 0,
          registrationLineCount: tasks.length,
        });
      });
    }
    return out;
  }, [rows]);

  if (lines.length === 0) return null;

  return (
    <>
      <Card padding="none" className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-label">
          <thead className="bg-bg-subtle dark:bg-bg-dark-muted border-b border-border dark:border-border-dark">
            <tr>
              <TH>Medarbejder</TH>
              <TH>Projekt-ID</TH>
              <TH>Projekt</TH>
              <TH>Opgave</TH>
              <TH>Periode</TH>
              <TH className="text-right">Timer</TH>
              <TH>Status</TH>
              <TH className="text-right">Handlinger</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-border-dark">
            {lines.map((line) => {
              const { registration: reg, task } = line;
              const badge = STATUS_BADGE[reg.status] ?? STATUS_BADGE.draft;
              const clickable = { onClick: () => onOpen(reg), role: 'button' as const, tabIndex: 0 };
              return (
                <tr
                  key={`${reg.id}-${task.taskId}`}
                  className="hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 cursor-pointer transition-colors"
                >
                  {line.isFirstOfRegistration && (
                    <td
                      rowSpan={line.registrationLineCount}
                      className="px-3 py-2.5 align-top font-semibold text-text-primary dark:text-text-dark-primary whitespace-nowrap"
                      {...clickable}
                    >
                      {reg.staffName}
                      <span className="block text-caption font-normal text-text-tertiary dark:text-text-dark-tertiary tabular-nums">
                        {formatHours(reg.totalMinutes)} i alt
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-text-secondary dark:text-text-dark-secondary whitespace-nowrap tabular-nums" {...clickable}>
                    {task.projectNumber ? `#${task.projectNumber}` : task.projectId ? '—' : 'Intern'}
                  </td>
                  {/* Truncation caps stay tight on mobile (protects the 820px floor)
                      but relax on md+ where the wide AppScreen gives the table room. */}
                  <td className="px-3 py-2.5 text-text-primary dark:text-text-dark-primary max-w-44 md:max-w-72 truncate" {...clickable}>
                    {task.projectName ?? 'Intern Opgave'}
                  </td>
                  <td className="px-3 py-2.5 text-text-primary dark:text-text-dark-primary max-w-52 md:max-w-96" {...clickable}>
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{task.taskTitle}</span>
                      {line.hasNotes && (
                        <button
                          type="button"
                          aria-label={`Se noter for ${task.taskTitle}`}
                          title="Se noter"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotesFor(line);
                          }}
                          className="shrink-0 p-1 -m-1 text-brand-primary dark:text-brand-light hover:bg-brand-subtle dark:hover:bg-brand-subtle-dark rounded-control transition-colors"
                        >
                          <MessageSquareIcon className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary dark:text-text-dark-secondary whitespace-nowrap" {...clickable}>
                    {periodLabel(line.dates)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-text-primary dark:text-text-dark-primary whitespace-nowrap tabular-nums" {...clickable}>
                    {formatHours(line.minutes)}
                  </td>
                  {line.isFirstOfRegistration && (
                    <>
                      <td rowSpan={line.registrationLineCount} className="px-3 py-2.5 align-top" {...clickable}>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td rowSpan={line.registrationLineCount} className="px-3 py-2.5 align-top">
                        {reg.status === 'submitted' ? (
                          <span className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`Godkend ${reg.staffName}s registrering`}
                              title="Godkend"
                              onClick={() => onApprove(reg)}
                              className="p-1.5 rounded-control text-success-strong dark:text-success hover:bg-success-subtle dark:hover:bg-success-subtle-dark transition-colors"
                            >
                              <CheckCircleIcon className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Afvis ${reg.staffName}s registrering`}
                              title="Afvis"
                              onClick={() => onReject(reg)}
                              className="p-1.5 rounded-control text-danger-strong dark:text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors"
                            >
                              <XIcon className="w-5 h-5" />
                            </button>
                          </span>
                        ) : (
                          <span className="block text-right text-text-tertiary dark:text-text-dark-tertiary">—</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Notes modal */}
      <Modal
        open={notesFor !== null}
        onClose={() => setNotesFor(null)}
        size="sm"
        title={notesFor ? `Noter — ${notesFor.task.taskTitle}` : 'Noter'}
        footer={<Button variant="ghost" onClick={() => setNotesFor(null)}>Luk</Button>}
      >
        <div className="space-y-3">
          {notesFor?.dates.flatMap((date) =>
            notesFor.task.days[date]
              .filter((iv) => iv.note.trim().length > 0)
              .map((iv, i) => (
                <div key={`${date}-${i}`} className="rounded-control border border-border dark:border-border-dark p-3">
                  <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary tabular-nums">
                    {formatDayLabel(date)} · {formatMinutes(iv.startMin)}–{formatMinutes(iv.endMin)}
                  </p>
                  <p className="text-body text-text-primary dark:text-text-dark-primary mt-1 whitespace-pre-wrap">{iv.note}</p>
                </div>
              ))
          )}
        </div>
      </Modal>
    </>
  );
};
