/**
 * wizardStore.ts
 * Per-mount Zustand store factory for the v3 wizard.
 * FIX BUG_001: each wizard mount gets its own fresh store instance,
 * eliminating stale selectedComponents/selectedZones from previous sessions.
 *
 * Usage:
 *   const storeRef = useRef(createWizardStore());
 *   const useStore = storeRef.current;
 *   const step = useStore(s => s.currentStep);
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ProjectTypeId, ZoneSelection } from '../data/wizardCatalog';

// ─── State & Actions ──────────────────────────────────────────────────────────

export interface WizardStore {
  // ── Core step state ──
  entryMode: 'ai' | 'visual' | 'quick' | null;
  currentStep: 0 | 1 | 2 | 3 | 4;
  projectType: ProjectTypeId | null;

  // ── Step 1: Zone selection ──
  selectedZones: ZoneSelection[];
  activeFloorId: 'stueetage' | 'overetage' | 'kaelder';
  activeAreaTab: 'exterior' | 'interior' | 'apartment';

  // ── Step 2: Task selection ──
  selectedTasks: Record<string, string[]>; // zoneId → taskId[]
  taskQuantities: Record<string, number>;   // taskId → quantity (default 1)
  activeZoneTab: string | null;

  // ── Step 3: Project details ──
  details: {
    name: string;
    address: string;
    team: string[];
    startDate: string;
    notes: string;
    budgetKr: number | null;
  };

  // ── AI state ──
  ai: {
    pending: boolean;
    lastPrompt: string;
    suggestedZones: ZoneSelection[];
    suggestedTasks: Record<string, string[]>;
    error: string | null;
  };

  // ── Actions ──
  setEntryMode: (mode: 'ai' | 'visual' | 'quick') => void;
  setStep: (step: 0 | 1 | 2 | 3 | 4) => void;
  goNext: () => void;
  goBack: () => void;
  setProjectType: (id: ProjectTypeId) => void;

  // Zone selection
  toggleZone: (zoneId: string, floorId?: string) => void;
  setZoneQuantity: (zoneId: string, qty: number) => void;
  applyAiZones: (zones: ZoneSelection[]) => void;
  clearZones: () => void;
  setActiveFloor: (floorId: 'stueetage' | 'overetage' | 'kaelder') => void;
  setActiveAreaTab: (tab: 'exterior' | 'interior' | 'apartment') => void;

  // Task selection
  toggleTask: (zoneId: string, taskId: string) => void;
  setTaskQuantity: (taskId: string, qty: number) => void;
  applyBundle: (zoneId: string, taskIds: string[]) => void;
  removeTask: (zoneId: string, taskId: string) => void;
  setActiveZoneTab: (zoneId: string | null) => void;

  // Details
  setDetails: (patch: Partial<WizardStore['details']>) => void;

  // AI
  setAiPending: (pending: boolean) => void;
  setAiError: (err: string | null) => void;
  applyAiSuggestions: (zones: ZoneSelection[], tasks: Record<string, string[]>) => void;
  setAiPrompt: (prompt: string) => void;

  // Computed helpers
  totalSelectedTasks: () => number;
  selectedZoneIds: () => string[];
  isZoneSelected: (zoneId: string) => boolean;
  tasksForZone: (zoneId: string) => string[];
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWizardStore() {
  return create<WizardStore>()(
    immer((set, get) => ({
      // ── Initial state (fresh per mount — BUG_001 fix) ──
      entryMode: null,
      currentStep: 0,
      projectType: null,

      selectedZones: [],
      activeFloorId: 'stueetage',
      activeAreaTab: 'exterior',

      selectedTasks: {},
      taskQuantities: {},
      activeZoneTab: null,

      details: {
        name: '',
        address: '',
        team: [],
        startDate: '',
        notes: '',
        budgetKr: null,
      },

      ai: {
        pending: false,
        lastPrompt: '',
        suggestedZones: [],
        suggestedTasks: {},
        error: null,
      },

      // ── Step navigation ──
      setEntryMode: (mode) =>
        set((s) => {
          s.entryMode = mode;
        }),

      setStep: (step) =>
        set((s) => {
          s.currentStep = step;
        }),

      goNext: () =>
        set((s) => {
          if (s.currentStep < 4) s.currentStep = (s.currentStep + 1) as WizardStore['currentStep'];
        }),

      goBack: () =>
        set((s) => {
          if (s.currentStep > 0) s.currentStep = (s.currentStep - 1) as WizardStore['currentStep'];
        }),

      setProjectType: (id) =>
        set((s) => {
          s.projectType = id;
          // Clear zone/task selections when project type changes
          s.selectedZones = [];
          s.selectedTasks = {};
          s.taskQuantities = {};
          s.activeZoneTab = null;
        }),

      // ── Zone selection ──
      toggleZone: (zoneId, floorId) =>
        set((s) => {
          const idx = s.selectedZones.findIndex((z) => z.zoneId === zoneId);
          if (idx >= 0) {
            s.selectedZones.splice(idx, 1);
            // Also clear tasks for this zone
            delete s.selectedTasks[zoneId];
          } else {
            s.selectedZones.push({ zoneId, floorId, quantity: 1, source: 'user' });
          }
          // Auto-set active zone tab to last toggled zone
          s.activeZoneTab = idx >= 0 ? (s.selectedZones[0]?.zoneId ?? null) : zoneId;
        }),

      setZoneQuantity: (zoneId, qty) =>
        set((s) => {
          const zone = s.selectedZones.find((z) => z.zoneId === zoneId);
          if (zone) zone.quantity = Math.max(1, qty);
        }),

      applyAiZones: (zones) =>
        set((s) => {
          // Merge AI zones — keep existing user selections, add new AI ones
          for (const aiZone of zones) {
            const existing = s.selectedZones.find((z) => z.zoneId === aiZone.zoneId);
            if (!existing) {
              s.selectedZones.push({ ...aiZone, source: 'ai' });
            }
          }
        }),

      clearZones: () =>
        set((s) => {
          s.selectedZones = [];
          s.selectedTasks = {};
          s.taskQuantities = {};
          s.activeZoneTab = null;
        }),

      setActiveFloor: (floorId) =>
        set((s) => {
          s.activeFloorId = floorId;
        }),

      setActiveAreaTab: (tab) =>
        set((s) => {
          s.activeAreaTab = tab;
        }),

      // ── Task selection ──
      toggleTask: (zoneId, taskId) =>
        set((s) => {
          if (!s.selectedTasks[zoneId]) s.selectedTasks[zoneId] = [];
          const idx = s.selectedTasks[zoneId].indexOf(taskId);
          if (idx >= 0) {
            s.selectedTasks[zoneId].splice(idx, 1);
            if (s.selectedTasks[zoneId].length === 0) delete s.selectedTasks[zoneId];
          } else {
            s.selectedTasks[zoneId].push(taskId);
            if (!s.taskQuantities[taskId]) s.taskQuantities[taskId] = 1;
          }
        }),

      setTaskQuantity: (taskId, qty) =>
        set((s) => {
          s.taskQuantities[taskId] = Math.max(1, qty);
        }),

      applyBundle: (zoneId, taskIds) =>
        set((s) => {
          if (!s.selectedTasks[zoneId]) s.selectedTasks[zoneId] = [];
          for (const taskId of taskIds) {
            if (!s.selectedTasks[zoneId].includes(taskId)) {
              s.selectedTasks[zoneId].push(taskId);
              if (!s.taskQuantities[taskId]) s.taskQuantities[taskId] = 1;
            }
          }
        }),

      removeTask: (zoneId, taskId) =>
        set((s) => {
          if (!s.selectedTasks[zoneId]) return;
          const idx = s.selectedTasks[zoneId].indexOf(taskId);
          if (idx >= 0) {
            s.selectedTasks[zoneId].splice(idx, 1);
            if (s.selectedTasks[zoneId].length === 0) delete s.selectedTasks[zoneId];
          }
        }),

      setActiveZoneTab: (zoneId) =>
        set((s) => {
          s.activeZoneTab = zoneId;
        }),

      // ── Details ──
      setDetails: (patch) =>
        set((s) => {
          Object.assign(s.details, patch);
        }),

      // ── AI ──
      setAiPending: (pending) =>
        set((s) => {
          s.ai.pending = pending;
          if (pending) s.ai.error = null;
        }),

      setAiError: (err) =>
        set((s) => {
          s.ai.error = err;
          s.ai.pending = false;
        }),

      applyAiSuggestions: (zones, tasks) =>
        set((s) => {
          s.ai.pending = false;
          s.ai.error = null;
          s.ai.suggestedZones = zones;
          s.ai.suggestedTasks = tasks;
          // Auto-apply zones and tasks from AI
          for (const z of zones) {
            if (!s.selectedZones.find((x) => x.zoneId === z.zoneId)) {
              s.selectedZones.push({ ...z, source: 'ai' });
            }
          }
          for (const [zoneId, taskIds] of Object.entries(tasks)) {
            if (!s.selectedTasks[zoneId]) s.selectedTasks[zoneId] = [];
            for (const tid of taskIds) {
              if (!s.selectedTasks[zoneId].includes(tid)) {
                s.selectedTasks[zoneId].push(tid);
                if (!s.taskQuantities[tid]) s.taskQuantities[tid] = 1;
              }
            }
          }
        }),

      setAiPrompt: (prompt) =>
        set((s) => {
          s.ai.lastPrompt = prompt;
        }),

      // ── Computed helpers ──
      totalSelectedTasks: () => {
        const { selectedTasks } = get();
        return Object.values(selectedTasks).reduce((sum, ids) => sum + ids.length, 0);
      },

      selectedZoneIds: () => get().selectedZones.map((z) => z.zoneId),

      isZoneSelected: (zoneId) => get().selectedZones.some((z) => z.zoneId === zoneId),

      tasksForZone: (zoneId) => get().selectedTasks[zoneId] ?? [],
    }))
  );
}

export type WizardStoreInstance = ReturnType<typeof createWizardStore>;
