// ─────────────────────────────────────────────────────────────────────────────
// modules/budget — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// getProjectBudgetSummary is the shared budget read used across the app
// (intelligence, time tab, project tabs) — code imports are NOT
// entitlement-gated; only the manifest's budget tab is.
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/budget';
export { BudgetTabContent } from './components/BudgetTabContent';
