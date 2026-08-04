// ─────────────────────────────────────────────────────────────────────────────
// modules/team — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// Both pages arrive via the manifest's route contributions and the rail-nav
// entry. The Settings "Organisation" section mirrors the /team view choice, so
// the shared view-mode hook, the org-chart data hook and the OrgChartView are
// re-exported here for that external consumer.
// ─────────────────────────────────────────────────────────────────────────────

export { useTeamViewMode } from './hooks/useTeamViewMode';
export type { TeamViewMode } from './hooks/useTeamViewMode';
export { useOrgChartData } from './hooks/useOrgChartData';
export { OrgChartView, chartFromOrg, ROLE_LABELS } from './components/OrgChartView';
export type { ChartPerson, ChartTeam, OrgChartData } from './components/OrgChartView';
