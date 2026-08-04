// ─────────────────────────────────────────────────────────────────────────────
// modules/documents — public surface (the ONLY entry point for code outside
// the module; enforced by the ESLint boundary rules).
//
// The document service is the app's shared "attach a file to a project" API —
// modules/tools (save-to-project, measurement layouts) and ProjectDetailPage
// import it from here. Code-level imports are NOT entitlement-gated; only the
// manifest's shell contributions (the Dokumenter tab) are.
// ─────────────────────────────────────────────────────────────────────────────

export {
  uploadDocument,
  getDocumentsForProject,
  getDocumentVisibility,
  setDocumentVisibility,
} from './services/documents';
export { DocumentsTabContent } from './components/DocumentsTabContent';
