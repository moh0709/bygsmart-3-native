// ─────────────────────────────────────────────────────────────────────────────
// demoFacts — the single bridge between the storefront demos and the real app.
//
// WHY THIS FILE EXISTS
// The first version of the demos hardcoded invented labels ("Tjek ind", a
// 3-column kanban, "Udbedret"/"Godkendt" punch statuses). They looked right and
// were wrong, so the storefront promised a product that did not exist.
//
// Everything a demo displays as if it came from the app is re-exported here
// FROM THE MODULE THAT OWNS IT. Rename a status in the app and this file stops
// compiling — the storefront can no longer drift silently.
//
// RULE: a demo may not hardcode a status, column, tab, category or action label
// that the real UI also renders. Import it from here instead. Sample content
// (project names, amounts, file names) is illustrative and may be invented.
// ─────────────────────────────────────────────────────────────────────────────

import type { TaskStatus, PunchListItemStatus, ProjectBudgetCategory, QuotationStatus } from '../../../../types';
import { STATUS_VARIANT, statusLabel } from '../../../../modules/tasks';
import { QUICK_STATUS_OPTIONS } from '../../../../modules/tasks/components/taskCards';
import { BUDGET_CATEGORIES } from '../../../../modules/budget/services/budget';
import {
    STEPPER_STAGES, HANDOVER_STEPS, WORKSPACE_TABS, AUTO_WARN_SECONDS,
} from '../../../../modules/field/pages/TaskDetailPage/constants';
import { formatElapsed } from '../../../../modules/field/pages/TaskDetailPage/helpers';

// ── Opgaver ──────────────────────────────────────────────────────────────────

/** The four kanban columns, exactly as TaskKanbanView renders them. */
export const KANBAN_COLUMNS: ReadonlyArray<{ value: TaskStatus; label: string }> =
    QUICK_STATUS_OPTIONS.map((o) => ({ value: o.value as TaskStatus, label: o.label }));

export { STATUS_VARIANT, statusLabel };

// ── Udførelse ────────────────────────────────────────────────────────────────

export { STEPPER_STAGES, HANDOVER_STEPS, WORKSPACE_TABS, AUTO_WARN_SECONDS, formatElapsed };

/**
 * Bottom action-bar copy, mirroring TaskWorkspaceContent. The real bar says
 * "Check ind"/"Check ud" — not "Tjek ind".
 */
export const FIELD_BAR = {
    checkIn: 'Check ind',
    checkOut: 'Check ud',
    faerdigmeld: 'Færdigmeld',
    godkend: 'Godkend',
    checkedIn: 'Du er checket ind',
    nobodyCheckedIn: 'Ingen er checket ind på denne opgave',
    longSession: 'Lang session — husk at checke ud',
} as const;

// ── KS & Aflevering ──────────────────────────────────────────────────────────

/** Punch statuses in the order the real Select offers them. */
export const PUNCH_STATUSES: readonly PunchListItemStatus[] = [
    'Åben', 'I gang', 'Kræver Supervisor', 'Løst',
];

/** Mirrors STATUS_BADGE / PIN_COLOR in PunchListTabContent. */
export const PUNCH_TONE: Record<PunchListItemStatus, 'warning' | 'info' | 'danger' | 'success'> = {
    'Åben': 'warning',
    'I gang': 'info',
    'Løst': 'success',
    'Kræver Supervisor': 'danger',
};

/** Hex mirrors of the DS tokens the punch pins use, for SVG fills. */
export const PUNCH_PIN_HEX: Record<PunchListItemStatus, string> = {
    'Åben': '#F5A524',            // --color-warning
    'I gang': '#2E90FA',          // --color-info
    'Løst': '#1BB55C',            // --color-success
    'Kræver Supervisor': '#E5484D', // --color-danger
};

// ── Tidsregistrering ─────────────────────────────────────────────────────────

/** FloatingTimer's activity list (modules/time/components/FloatingTimer.tsx). */
export const TIME_ACTIVITY_TYPES = [
    'Planlægning', 'Indkøb', 'Udførelse', 'Møde', 'Kørsel', 'Dokumentation', 'Andet',
] as const;

export const TIMER_UI = {
    start: 'Start tid',
    running: 'Aktiv',
    paused: 'Pauset',
    saveAndStop: 'Gem & Stop',
    total: 'Total tid registreret',
    exportExcel: 'Eksporter Excel',
} as const;

// ── Budget ───────────────────────────────────────────────────────────────────

export { BUDGET_CATEGORIES };

/** Mirrors CATEGORY_LABELS in modules/budget/components/BudgetTabContent.tsx. */
export const BUDGET_CATEGORY_LABELS: Record<ProjectBudgetCategory, string> = {
    materials: 'Materialer',
    labor: 'Arbejdsløn',
    subcontractors: 'Underleverandører',
    other: 'Andet',
};

// ── Tilbud ───────────────────────────────────────────────────────────────────

/** Mirrors the status map in modules/quotations/components/QuotationsTabContent.tsx. */
export const QUOTATION_STATUS: Record<QuotationStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }> = {
    DRAFT: { label: 'Kladde', tone: 'neutral' },
    SENT: { label: 'Sendt', tone: 'info' },
    ACCEPTED: { label: 'Accepteret', tone: 'success' },
    REJECTED: { label: 'Afvist', tone: 'danger' },
};

// ── Partnere ─────────────────────────────────────────────────────────────────

/** Mirrors modules/partners/components/NegotiationThread.tsx. */
export const NEGOTIATION_UI = {
    offer: 'Tilbud',
    counter: 'Modtilbud',
    newCounter: 'Nyt modtilbud',
    accepted: 'Accepteret',
    accept: 'Accepter',
    openingOffer: 'Åbningstilbud (DKK)',
    scopeNote: 'Partneren får kun adgang til de valgte opgaver — aldrig budget eller øvrige opgaver.',
} as const;

// ── Indkøb ───────────────────────────────────────────────────────────────────

/** The suppliers actually shipped in modules/purchasing/services/staticData.ts. */
export const SUPPLIERS = ['Silvan', 'Bauhaus', 'Stark', 'XL-Byg'] as const;

// ── Kunde-portal ─────────────────────────────────────────────────────────────

/**
 * What CLIENT actually resolves to. core/shell/projectTabAccess.ts sends the
 * CLIENT role down a fixed branch; projectTabAccess.test.ts asserts exactly
 * these two tabs regardless of the project's visibility setting.
 */
export const CLIENT_TABS = ['Overblik', 'Dokumenter'] as const;

// ── Projekter ────────────────────────────────────────────────────────────────

/**
 * Mirrors DESTINATION_DEFS + SUB_LABELS in
 * modules/projects/pages/ProjectDetailPage.tsx (module-local, not exported).
 * Five destinations — "Mere" opens a bottom sheet with the rest.
 */
export const PROJECT_DESTINATIONS = [
    { id: 'overblik', label: 'Overblik', subs: ['Overblik'] },
    { id: 'opgaver', label: 'Opgaver', subs: ['Opgaver', 'Punch'] },
    { id: 'plan', label: 'Plan', subs: ['Tid & Plan', 'Påmindelser'] },
    { id: 'okonomi', label: 'Økonomi', subs: ['Budget', 'Indkøb', 'Tilbud & Rapport'] },
    { id: 'mere', label: 'Mere', subs: ['Partnere', 'Opfølgning', 'Dokumenter', 'Detaljer'] },
] as const;

// ── Plan & Kalender ──────────────────────────────────────────────────────────

/** GanttZoomLevel order in components/planning/GanttView.tsx. */
export const GANTT_ZOOM = [
    { level: 'quarter', label: 'Kvartal', pixelsPerDay: 3 },
    { level: 'month', label: 'Måned', pixelsPerDay: 10 },
    { level: 'week', label: 'Uge', pixelsPerDay: 30 },
] as const;

// ── Integrationer ────────────────────────────────────────────────────────────

/** Mirrors IntegrationsSettingsSection's provider list (ProviderId order). */
export const CLOUD_PROVIDERS = [
    { id: 'google', name: 'Google Drive' },
    { id: 'dropbox', name: 'Dropbox' },
    { id: 'onedrive', name: 'OneDrive' },
    { id: 'box', name: 'Box' },
] as const;

// ── Beregnere ────────────────────────────────────────────────────────────────

export const CALCULATOR_UI = {
    exportPdf: 'Eksporter PDF',
    saveToProject: 'Gem til projekt',
} as const;
