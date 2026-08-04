// ─────────────────────────────────────────────────────────────────────────────
// modules/reporting — public surface (the ONLY entry point for code outside
// the module; enforced by the ESLint boundary rules).
//
// Formerly services/pdfReport.ts. The PDF-report API is re-exported verbatim
// plus the Excel exporters, print templates and the report-settings panel, so
// existing consumers (GodkendModal, ProjectDetailPage, QuotationsTabContent,
// task workspace, …) migrate by changing one import path.
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/pdfReport/theme';
export * from './services/pdfReport/format';
export * from './services/pdfReport/primitives';
export * from './services/pdfReport/table';
export * from './services/pdfReport/intelligenceReport';
export * from './services/pdfReport/acceptanceReport';
export * from './services/excelExport';
export { logAiHandoverReport } from './services/reportsLog';
export { HandoverReportTemplate } from './components/HandoverReportTemplate';
export { ProjectReportTemplate } from './components/ProjectReportTemplate';
export type { ProjectReportData } from './components/ProjectReportTemplate';
export { QuotationPdfTemplate } from './components/QuotationPdfTemplate';
export { default as ReportSettingsPanel } from './components/ReportSettingsPanel';
