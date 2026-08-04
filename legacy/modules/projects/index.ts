// ─────────────────────────────────────────────────────────────────────────────
// modules/projects — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// projects is the BASE module: feature modules (tasks, purchasing, documents,
// field, …) import these services statically, and projects reaches back into
// them only via dynamic import — so this barrel must stay service-only. Pages
// (ProjectsPage, ProjectDetailPage, wizard) load via the manifest routes.
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/projects';
export * from './services/projectResources';
export * from './services/projectMembers';
export * from './services/projectLifecycle';
