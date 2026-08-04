// ─────────────────────────────────────────────────────────────────────────────
// modules/tasks — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// Services (formerly services/api/tasks.ts + quickTasks.ts and
// services/taskAccess.ts) are re-exported verbatim. Components stay OUT of the
// barrel's static graph: many light consumers (HomePage, ProjectsPage, other
// modules' tab contents) import services from here, and a static component
// re-export would drag TaskFormModal's tools/ai/quality chains into all of
// them — so ProjectTasksTab ships as a lazy component and GlobalTasksPage is
// reached only via the manifest route's load().
// ─────────────────────────────────────────────────────────────────────────────
export * from './services/tasks';
export * from './services/quickTasks';
export * from './services/taskAccess';
export { STATUS_VARIANT, statusLabel } from './components/taskMeta';

// Heavy components ship as LOADERS, not React.lazy components: consumers reach
// this barrel via dynamic import and wrap the loader in their own lazy().
// Exporting lazy() here nests lazy-in-lazy, which React cannot render — prod
// incident 2026-07-11 ("TypeError: n is not a function" on /project-detail).
// The dynamic import inside each loader keeps the component out of the
// barrel's static graph, which is the whole point.
export const loadProjectTasksTab = () =>
  import('./components/ProjectTasksTab').then((m) => ({ default: m.ProjectTasksTab }));
// Task timeline for the project overview (renders TaskCards).
export const loadProjectTimeline = () =>
  import('./components/ProjectTimeline').then((m) => ({ default: m.ProjectTimeline }));
// Existing standalone quick-task creator, exposed lazily for lightweight
// cross-module entry points such as the new-project wizard.
export const loadCreateQuickTaskModal = () =>
  import('./pages/GlobalTasksPage/CreateQuickTaskModal').then((m) => ({
    default: m.CreateQuickTaskModal,
  }));
