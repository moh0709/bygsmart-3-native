// ─── Shared icon-button classes (44px touch target, semantic tokens) ─────────

export const ICON_BTN =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-text-secondary transition-colors duration-150 hover:bg-bg-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed dark:text-text-dark-secondary dark:hover:bg-bg-dark-muted dark:hover:text-text-dark-primary';

// ─── Status stepper (To Do → I gang → Review → Udført) ───────────────────────

export const STEPPER_STAGES = ['To Do', 'I gang', 'Review', 'Udført'] as const;

// ─── HandoverActionCard — guided handover sequence ───────────────────────────

export const HANDOVER_STEPS = [
    { title: 'Færdigmeld', desc: 'Udføreren bekræfter med underskrift' },
    { title: 'Godkendelse', desc: 'Mesteren gennemgår og underskriver' },
    { title: 'Rapport', desc: 'Afleveringsrapport genereres og fastgøres' },
];

// ─── Tab IDs ─────────────────────────────────────────────────────────────────
// "Indstillinger" is no longer a tab — its content (ReportSettingsPanel) moved
// into the header settings gear's "Rapport" sub-tab (TaskSettingsModal).

export type TabId = 'overblik' | 'filer' | 'chat' | 'dokumentation' | 'team';

export const WORKSPACE_TABS = [
    { id: 'overblik',       label: 'Overblik' },
    { id: 'filer',          label: 'Filer' },
    { id: 'chat',           label: 'Chat' },
    { id: 'dokumentation',  label: 'Dokumentation' },
    { id: 'team',           label: 'Team' },
];

// Tabs that can never be hidden via the "Faner" settings — mirrors the
// allowlist enforced server-side in set_task_disabled_tabs() (supabase/
// migrations/20260710000007_fix_disabled_tabs_allowlist.sql).
export const ALWAYS_ON_TAB_IDS: TabId[] = ['overblik', 'chat'];

export const AUTO_WARN_SECONDS = 10 * 3600; // warn at 10 h
