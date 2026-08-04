// ─────────────────────────────────────────────────────────────────────────────
// modules/partners — public surface (the ONLY entry point for code outside
// the module; enforced by the ESLint boundary rules).
//
// The partner service doubles as the shared partner-status/pricing helper
// (formatOre, AcceptedPartnerTask, …) used by task cards, home widgets and
// modules/field — code imports are NOT entitlement-gated.
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/partners';
export * from './components/partnerStatus';
export { PartnerInvitesPanel } from './components/PartnerInvitesPanel';
export { InvitePartnerModal } from './components/InvitePartnerModal';
