/**
 * registrationStore.ts
 * Per-mount Zustand store factory for the weekly time-registration wizard
 * (same fresh-instance pattern as modules/projects/stores/wizardStore.ts —
 * each mount starts clean; the server-side draft is the persistence layer).
 *
 * Usage:
 *   const storeRef = useRef(createRegistrationStore());
 *   const useStore = storeRef.current;
 *   const step = useStore(s => s.step);
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  EMPTY_PAYLOAD,
  weekStartOf,
  type RegistrationInterval,
  type RegistrationPayload,
  type RegistrationTask,
} from '../services/timeRegistrations';

export interface RegistrationStore {
  weekStart: string;
  step: 1 | 2 | 3 | 4;
  tasks: RegistrationTask[];
  /** Set after the server draft has been loaded for the current week. */
  hydrated: boolean;
  /** Unsaved local edits since the last Gem/Næste save. */
  dirty: boolean;

  // ── Hydration / week ──
  hydrate: (weekStart: string, payload: RegistrationPayload) => void;
  setWeek: (weekStart: string) => void;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  markSaved: () => void;
  reset: () => void;

  // ── Step 1: task selection ──
  toggleTask: (task: Omit<RegistrationTask, 'days'>) => void;
  isTaskSelected: (taskId: string) => boolean;

  // ── Step 2: day selection ──
  toggleDay: (taskId: string, date: string) => void;

  // ── Step 3: intervals ──
  updateInterval: (taskId: string, date: string, index: number, patch: Partial<RegistrationInterval>) => void;
  addInterval: (taskId: string, date: string) => void;
  removeInterval: (taskId: string, date: string, index: number) => void;

  // ── Derived ──
  toPayload: () => RegistrationPayload;
}

const DEFAULT_INTERVAL: RegistrationInterval = { startMin: 420, endMin: 960, note: '' }; // 07:00–16:00

export const createRegistrationStore = () =>
  create<RegistrationStore>()(
    immer((set, get) => ({
      weekStart: weekStartOf(new Date()),
      step: 1,
      tasks: [],
      hydrated: false,
      dirty: false,

      hydrate: (weekStart, payload) =>
        set((s) => {
          s.weekStart = weekStart;
          s.step = (payload.step >= 1 && payload.step <= 4 ? payload.step : 1) as 1 | 2 | 3 | 4;
          s.tasks = payload.tasks ?? [];
          s.hydrated = true;
          s.dirty = false;
        }),

      setWeek: (weekStart) =>
        set((s) => {
          // Week switch re-hydrates from the server — clear local state.
          s.weekStart = weekStart;
          s.step = 1;
          s.tasks = [];
          s.hydrated = false;
          s.dirty = false;
        }),

      setStep: (step) =>
        set((s) => {
          s.step = step;
        }),

      markSaved: () =>
        set((s) => {
          s.dirty = false;
        }),

      reset: () =>
        set((s) => {
          s.step = 1;
          s.tasks = [];
          s.dirty = false;
        }),

      toggleTask: (task) =>
        set((s) => {
          const idx = s.tasks.findIndex((t) => t.taskId === task.taskId);
          if (idx >= 0) s.tasks.splice(idx, 1);
          else s.tasks.push({ ...task, days: {} });
          s.dirty = true;
        }),

      isTaskSelected: (taskId) => get().tasks.some((t) => t.taskId === taskId),

      toggleDay: (taskId, date) =>
        set((s) => {
          const task = s.tasks.find((t) => t.taskId === taskId);
          if (!task) return;
          if (task.days[date]) delete task.days[date];
          else task.days[date] = [{ ...DEFAULT_INTERVAL }];
          s.dirty = true;
        }),

      updateInterval: (taskId, date, index, patch) =>
        set((s) => {
          const intervals = s.tasks.find((t) => t.taskId === taskId)?.days[date];
          if (!intervals || !intervals[index]) return;
          Object.assign(intervals[index], patch);
          s.dirty = true;
        }),

      addInterval: (taskId, date) =>
        set((s) => {
          const intervals = s.tasks.find((t) => t.taskId === taskId)?.days[date];
          if (!intervals) return;
          // Start the new period after the latest existing one (split shift).
          const lastEnd = Math.max(...intervals.map((iv) => iv.endMin), 0);
          const startMin = Math.min(lastEnd + 60, 1380);
          intervals.push({ startMin, endMin: Math.min(startMin + 60, 1440), note: '' });
          s.dirty = true;
        }),

      removeInterval: (taskId, date, index) =>
        set((s) => {
          const task = s.tasks.find((t) => t.taskId === taskId);
          const intervals = task?.days[date];
          if (!task || !intervals) return;
          intervals.splice(index, 1);
          if (intervals.length === 0) delete task.days[date];
          s.dirty = true;
        }),

      toPayload: () => ({
        ...EMPTY_PAYLOAD,
        step: get().step,
        tasks: get().tasks,
      }),
    }))
  );

export type RegistrationStoreHook = ReturnType<typeof createRegistrationStore>;
