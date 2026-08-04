// ─────────────────────────────────────────────────────────────────────────────
// modules/quality — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// KS (quality control), punch-list/mangelliste and their services. The punch
// service is also the layout API used by modules/tools' MeasurementTool, and
// the KS service backs the handover ceremony in modules/field's GodkendModal.
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/punchList';
export * from './services/taskQualityControl';
export { default as TaskQualityControlTab } from './components/TaskQualityControlTab';
export { default as PunchListTabContent } from './components/PunchListTabContent';
