// Pure view-model selectors for the screens. Keeping the interesting logic here (not in
// JSX) means it is unit-tested in node without a render harness; screens just map the
// result to primitives.
import type { Row } from '../db';

export interface ProjectSummary {
  project: Row;
  /** Tasks not yet done. */
  open: number;
  /** All tasks for the project. */
  total: number;
}

/** Roll up each project's task counts. A task belongs to a project via `project_id`. */
export function projectSummaries(projects: Row[], tasks: Row[]): ProjectSummary[] {
  const agg = new Map<string, { open: number; total: number }>();
  for (const t of tasks) {
    const pid = String(t.project_id ?? '');
    const cur = agg.get(pid) ?? { open: 0, total: 0 };
    cur.total += 1;
    if (t.status !== 'done') cur.open += 1;
    agg.set(pid, cur);
  }
  return projects.map((project) => {
    const cur = agg.get(String(project.id)) ?? { open: 0, total: 0 };
    return { project, open: cur.open, total: cur.total };
  });
}
