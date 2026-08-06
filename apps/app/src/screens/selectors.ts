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

export interface TaskGroup {
  projectId: string;
  /** Project display name, or null when the task's project isn't in the list. */
  projectName: string | null;
  tasks: Row[];
}

/**
 * Group tasks under their project, ordered by the projects list (so the grouping is
 * stable and matches the Projects screen). Tasks whose project is unknown are collected
 * into trailing groups with a null name.
 */
export function groupTasksByProject(tasks: Row[], projects: Row[]): TaskGroup[] {
  const byProject = new Map<string, Row[]>();
  for (const t of tasks) {
    const pid = String(t.project_id ?? '');
    const list = byProject.get(pid);
    if (list) list.push(t);
    else byProject.set(pid, [t]);
  }

  const groups: TaskGroup[] = [];
  const seen = new Set<string>();
  for (const p of projects) {
    const pid = String(p.id);
    const list = byProject.get(pid);
    if (list) {
      groups.push({ projectId: pid, projectName: String(p.name), tasks: list });
      seen.add(pid);
    }
  }
  for (const [pid, list] of byProject) {
    if (!seen.has(pid)) groups.push({ projectId: pid, projectName: null, tasks: list });
  }
  return groups;
}

export interface OpenTask {
  task: Row;
  /** Project display name, or null when the project isn't in the list. */
  projectName: string | null;
}

/**
 * The Min Dag worklist: every not-done task across projects, each tagged with its
 * project name. Preserves task order.
 */
export function openTasksWithProject(tasks: Row[], projects: Row[]): OpenTask[] {
  const nameById = new Map(projects.map((p) => [String(p.id), String(p.name)]));
  return tasks
    .filter((t) => t.status !== 'done')
    .map((task) => ({ task, projectName: nameById.get(String(task.project_id ?? '')) ?? null }));
}
