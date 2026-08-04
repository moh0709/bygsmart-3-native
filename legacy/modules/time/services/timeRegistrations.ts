// ─────────────────────────────────────────────────────────────────────────────
// Weekly time registration — draft CRUD against time_registrations, workflow
// RPC wrappers (submit/approve/reject — SECURITY DEFINER server-side), pure
// week/interval helpers and the payload→TimeEntry mapping used for export.
//
// A registration is one row per (org, user, week); the wizard state lives in
// the jsonb payload so drafts survive reloads and device switches. Status
// transitions ONLY happen via the RPCs (a BEFORE UPDATE guard freezes the
// workflow columns for direct writes).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../../services/supabaseClient';
import type { TimeEntry } from '../../../types';

const db = supabase as any;

// ── Payload types (client-shaped, stored as jsonb) ───────────────────────────

export interface RegistrationInterval {
  /** Minutes after midnight, 0–1440, step 30. */
  startMin: number;
  endMin: number;
  note: string;
}

export interface RegistrationTask {
  taskId: string;
  taskTitle: string;
  /** null for quick tasks ("Intern Opgave"). */
  projectId: string | null;
  projectName: string | null;
  /** Human project number (e.g. '26-83421') — added later; absent in early payloads. */
  projectNumber?: string | null;
  /** ISO local date ('YYYY-MM-DD') → intervals worked that day. */
  days: Record<string, RegistrationInterval[]>;
}

export interface RegistrationPayload {
  version: 1;
  /** Wizard step the draft was last saved on (1–4). */
  step: number;
  tasks: RegistrationTask[];
}

export type RegistrationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface TimeRegistration {
  id: string;
  orgId: string;
  userId: string;
  weekStart: string;
  status: RegistrationStatus;
  payload: RegistrationPayload;
  totalMinutes: number;
  responsibleId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionComment: string | null;
  updatedAt: string;
}

export const EMPTY_PAYLOAD: RegistrationPayload = { version: 1, step: 1, tasks: [] };

// ── Week helpers (local-time safe — same convention as getMyTimeEntriesForDay:
//    build calendar-day strings from local components, never toISOString) ─────

export const toLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Monday of the week containing `d` (local time). */
export const weekStartOf = (d: Date): string => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (copy.getDay() + 6) % 7; // Mon=0 … Sun=6
  copy.setDate(copy.getDate() - dow);
  return toLocalDateString(copy);
};

/** The 7 local dates (Mon–Sun) of the week starting at `weekStart`. */
export const weekDates = (weekStart: string): string[] => {
  const [y, m, d] = weekStart.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) =>
    toLocalDateString(new Date(y, m - 1, d + i))
  );
};

/** ISO-8601 week number for a 'YYYY-MM-DD' week start. */
export const isoWeekNumber = (weekStart: string): number => {
  const [y, m, d] = weekStart.split('-').map(Number);
  // Thursday of the same week decides the ISO year/week.
  const thursday = new Date(Date.UTC(y, m - 1, d + 3));
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
};

export const shiftWeek = (weekStart: string, weeks: number): string => {
  const [y, m, d] = weekStart.split('-').map(Number);
  return toLocalDateString(new Date(y, m - 1, d + weeks * 7));
};

export const DAY_LETTERS = ['M', 'T', 'O', 'T', 'F', 'L', 'S'] as const;

export const formatMinutes = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatHours = (totalMinutes: number): string =>
  `${(totalMinutes / 60).toFixed(1).replace('.', ',')} t`;

/** 'man 14/7' for a 'YYYY-MM-DD' local date (compact table cells). */
export const formatDateShort = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).toLocaleDateString('da-DK', { weekday: 'short' }).replace('.', '');
  return `${weekday} ${d}/${m}`;
};

/** 'Mandag 14. juli' for a 'YYYY-MM-DD' local date. */
export const formatDayLabel = (isoDate: string): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// ── Validation (the user's rules) ────────────────────────────────────────────

export interface IntervalConflict {
  date: string;
  /** Danish description of what collides, for the error Alert. */
  message: string;
}

/**
 * One side of a cross-task overlap, keyed to the exact interval that collides.
 * Both intervals of an overlapping pair get their own entry so each task card
 * can highlight the clash and name the other task.
 */
export interface IntervalConflictDetail {
  taskId: string;
  date: string;
  intervalIndex: number;
  otherTaskId: string;
  otherTaskTitle: string;
}

interface DayInterval {
  task: RegistrationTask;
  intervalIndex: number;
  iv: RegistrationInterval;
}

/** Two intervals overlap when they share an open minute (touching ≠ overlap). */
const intervalsOverlap = (a: RegistrationInterval, b: RegistrationInterval): boolean =>
  a.startMin < b.endMin && b.startMin < a.endMin;

/** Valid (end > start) intervals grouped by calendar day, across all tasks. */
const validIntervalsByDay = (tasks: RegistrationTask[]): Map<string, DayInterval[]> => {
  const byDay = new Map<string, DayInterval[]>();
  for (const task of tasks) {
    for (const [date, intervals] of Object.entries(task.days)) {
      intervals.forEach((iv, intervalIndex) => {
        if (iv.endMin <= iv.startMin) return;
        const list = byDay.get(date) ?? [];
        list.push({ task, intervalIndex, iv });
        byDay.set(date, list);
      });
    }
  }
  return byDay;
};

/**
 * Per-interval details of every CROSS-TASK overlap on the same day — one entry
 * per side, so both task cards can highlight the clash and name the other task
 * ("man kan ikke være på to opgaver samtidig"). Same-task split-shift overlaps
 * are a data error surfaced by validateIntervals, not reported here.
 */
export const findIntervalConflicts = (tasks: RegistrationTask[]): IntervalConflictDetail[] => {
  const out: IntervalConflictDetail[] = [];
  for (const [date, list] of validIntervalsByDay(tasks)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.task.taskId === b.task.taskId) continue;
        if (!intervalsOverlap(a.iv, b.iv)) continue;
        out.push({
          taskId: a.task.taskId,
          date,
          intervalIndex: a.intervalIndex,
          otherTaskId: b.task.taskId,
          otherTaskTitle: b.task.taskTitle,
        });
        out.push({
          taskId: b.task.taskId,
          date,
          intervalIndex: b.intervalIndex,
          otherTaskId: a.task.taskId,
          otherTaskTitle: a.task.taskTitle,
        });
      }
    }
  }
  return out;
};

/**
 * Wizard gate: every interval must have end after start, and no two intervals
 * on the same calendar day may overlap — across ALL tasks (same-task split
 * shifts OR two tasks at once). Returns {date,message} conflicts (empty array =
 * valid) for the step-3 Alert and the Næste/Indsend gating. Shares its overlap
 * detection with findIntervalConflicts.
 */
export const validateIntervals = (tasks: RegistrationTask[]): IntervalConflict[] => {
  const conflicts: IntervalConflict[] = [];

  // (a) end must be after start
  for (const task of tasks) {
    for (const [date, intervals] of Object.entries(task.days)) {
      for (const iv of intervals) {
        if (iv.endMin <= iv.startMin) {
          conflicts.push({
            date,
            message: `${task.taskTitle} (${formatDayLabel(date)}): sluttid skal være efter starttid.`,
          });
        }
      }
    }
  }

  // (b) no two intervals overlap on the same day (across all tasks)
  for (const [date, list] of validIntervalsByDay(tasks)) {
    const sorted = [...list].sort((a, b) => a.iv.startMin - b.iv.startMin);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        if (!intervalsOverlap(a.iv, b.iv)) continue;
        conflicts.push({
          date,
          message: `${formatDayLabel(date)}: ${a.task.taskTitle} (${formatMinutes(a.iv.startMin)}–${formatMinutes(a.iv.endMin)}) overlapper ${b.task.taskTitle} (${formatMinutes(b.iv.startMin)}–${formatMinutes(b.iv.endMin)}).`,
        });
      }
    }
  }

  return conflicts;
};

// ── Range-slider helpers ─────────────────────────────────────────────────────

export interface BlockedRange {
  startMin: number;
  endMin: number;
}

/**
 * Every OTHER interval on the same date (across all tasks) — rendered as tinted
 * segments on the range slider so the user can see time already occupied by
 * another task. Informational only: the handles are NOT clamped out of these
 * (overlap is surfaced as a conflict highlight instead of being blocked).
 */
export const blockedRangesFor = (
  tasks: RegistrationTask[],
  taskId: string,
  date: string,
  intervalIndex: number
): BlockedRange[] => {
  const out: BlockedRange[] = [];
  for (const t of tasks) {
    (t.days[date] ?? []).forEach((iv, i) => {
      if (t.taskId === taskId && i === intervalIndex) return;
      if (iv.endMin > iv.startMin) out.push({ startMin: iv.startMin, endMin: iv.endMin });
    });
  }
  return out.sort((a, b) => a.startMin - b.startMin);
};

/**
 * Clamp a START value into a valid position: never below 0, never later than
 * end − step. This is the 30-minute mutual gap that keeps sluttid after
 * starttid (the only hard block the range slider enforces).
 */
export const clampStartMin = (value: number, endMin: number, step = 30): number =>
  Math.max(0, Math.min(value, endMin - step));

/** Clamp an END value: never above 1440, never earlier than start + step. */
export const clampEndMin = (value: number, startMin: number, step = 30): number =>
  Math.min(1440, Math.max(value, startMin + step));

export const totalMinutesOf = (tasks: RegistrationTask[]): number =>
  tasks.reduce(
    (sum, t) =>
      sum +
      Object.values(t.days).reduce(
        (daySum, ivs) => daySum + ivs.reduce((s, iv) => s + Math.max(0, iv.endMin - iv.startMin), 0),
        0
      ),
    0
  );

// ── Payload → TimeEntry mapping (for Excel export via modules/reporting) ─────

export const payloadToTimeEntries = (
  registration: Pick<TimeRegistration, 'id' | 'userId' | 'payload'>,
  userName: string
): TimeEntry[] => {
  const entries: TimeEntry[] = [];
  for (const task of registration.payload.tasks ?? []) {
    for (const [date, intervals] of Object.entries(task.days ?? {})) {
      for (const iv of intervals) {
        entries.push({
          id: `${registration.id}-${task.taskId}-${date}-${iv.startMin}`,
          projectId: task.projectId ?? '',
          taskId: task.taskId,
          userId: registration.userId,
          userName,
          hours: Math.round(((iv.endMin - iv.startMin) / 60) * 100) / 100,
          date,
          description: `${task.taskTitle} · ${formatMinutes(iv.startMin)}–${formatMinutes(iv.endMin)}${iv.note ? ` · ${iv.note}` : ''}`,
        });
      }
    }
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date));
};

// ── Row mapping + draft CRUD ─────────────────────────────────────────────────

const mapRegistration = (row: any): TimeRegistration => ({
  id: row.id,
  orgId: row.org_id,
  userId: row.user_id,
  weekStart: row.week_start,
  status: row.status,
  payload: (row.payload && Array.isArray(row.payload.tasks))
    ? (row.payload as RegistrationPayload)
    : { ...EMPTY_PAYLOAD },
  totalMinutes: row.total_minutes ?? 0,
  responsibleId: row.responsible_id ?? null,
  submittedAt: row.submitted_at ?? null,
  decidedAt: row.decided_at ?? null,
  decidedBy: row.decided_by ?? null,
  decisionComment: row.decision_comment ?? null,
  updatedAt: row.updated_at,
});

const REGISTRATION_COLUMNS =
  'id, org_id, user_id, week_start, status, payload, total_minutes, responsible_id, submitted_at, decided_at, decided_by, decision_comment, updated_at';

/** The caller's own registration for a week, or null. */
export const getMyRegistration = async (
  orgId: string,
  userId: string,
  weekStart: string
): Promise<TimeRegistration | null> => {
  const { data, error } = await db
    .from('time_registrations')
    .select(REGISTRATION_COLUMNS)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRegistration(data) : null;
};

/** Upserts the caller's draft payload for a week ("Gem"). */
export const saveMyDraft = async (
  orgId: string,
  userId: string,
  weekStart: string,
  payload: RegistrationPayload
): Promise<TimeRegistration> => {
  const { data, error } = await db
    .from('time_registrations')
    .upsert(
      { org_id: orgId, user_id: userId, week_start: weekStart, payload },
      { onConflict: 'org_id,user_id,week_start' }
    )
    .select(REGISTRATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapRegistration(data);
};

/** "Annuller" — discards the caller's draft entirely (RLS: drafts only). */
export const deleteMyDraft = async (registrationId: string): Promise<void> => {
  const { error } = await db.from('time_registrations').delete().eq('id', registrationId);
  if (error) throw new Error(error.message);
};

// ── Workflow RPCs ────────────────────────────────────────────────────────────

export const submitRegistration = async (registrationId: string): Promise<void> => {
  const { error } = await db.rpc('submit_time_registration', { p_registration_id: registrationId });
  if (error) throw new Error(error.message);
};

export const approveRegistration = async (registrationId: string, comment?: string): Promise<void> => {
  const { error } = await db.rpc('approve_time_registration', {
    p_registration_id: registrationId,
    p_comment: comment?.trim() || null,
  });
  if (error) throw new Error(error.message);
};

export const rejectRegistration = async (registrationId: string, comment: string): Promise<void> => {
  const { error } = await db.rpc('reject_time_registration', {
    p_registration_id: registrationId,
    p_comment: comment.trim(),
  });
  if (error) throw new Error(error.message);
};

// ── Overview queries (manager/CEO — RLS scopes what each caller can see) ─────

export interface RegistrationListRow extends TimeRegistration {
  staffName: string;
  staffInitials: string;
}

export const listRegistrationsForWeek = async (
  orgId: string,
  weekStart: string
): Promise<RegistrationListRow[]> => {
  const { data, error } = await db
    .from('time_registrations')
    .select(`${REGISTRATION_COLUMNS}, profiles!time_registrations_user_id_fkey(name, initials)`)
    .eq('org_id', orgId)
    .eq('week_start', weekStart)
    .neq('status', 'draft')
    .order('submitted_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    ...mapRegistration(row),
    staffName: row.profiles?.name ?? 'Ukendt',
    staffInitials: row.profiles?.initials ?? '–',
  }));
};

// ── Responsible mapping (CEO-managed) ────────────────────────────────────────

export interface TimeResponsible {
  staffUserId: string;
  responsibleUserId: string;
}

export const listTimeResponsibles = async (orgId: string): Promise<TimeResponsible[]> => {
  const { data, error } = await db
    .from('org_time_responsibles')
    .select('staff_user_id, responsible_user_id')
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    staffUserId: r.staff_user_id,
    responsibleUserId: r.responsible_user_id,
  }));
};

export const setTimeResponsible = async (
  orgId: string,
  staffUserId: string,
  responsibleUserId: string | null,
  updatedBy: string
): Promise<void> => {
  if (responsibleUserId === null) {
    const { error } = await db
      .from('org_time_responsibles')
      .delete()
      .eq('org_id', orgId)
      .eq('staff_user_id', staffUserId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await db
    .from('org_time_responsibles')
    .upsert(
      {
        org_id: orgId,
        staff_user_id: staffUserId,
        responsible_user_id: responsibleUserId,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,staff_user_id' }
    );
  if (error) throw new Error(error.message);
};

/** True when the caller is the assigned responsible for ≥1 staff member. */
export const amIResponsibleForAnyone = async (orgId: string, userId: string): Promise<boolean> => {
  const { data, error } = await db
    .from('org_time_responsibles')
    .select('staff_user_id')
    .eq('org_id', orgId)
    .eq('responsible_user_id', userId)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
};

/** True when the caller leads any org work-crew (Teams V2). */
export const amIOrgTeamLeader = async (orgId: string, userId: string): Promise<boolean> => {
  const { data, error } = await db
    .from('org_teams')
    .select('id')
    .eq('org_id', orgId)
    .eq('leader_id', userId)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
};
