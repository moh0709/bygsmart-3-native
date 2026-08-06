import { describe, it, expect } from 'vitest';
import { projectSummaries, groupTasksByProject, openTasksWithProject, tasksForProject } from './selectors';
import type { Row } from '../db';

const p = (id: string, name: string): Row => ({ id, updated_at: '2026-08-01T00:00:00Z', name });
const t = (id: string, project_id: string, status: string): Row => ({ id, updated_at: '2026-08-01T00:00:00Z', project_id, status });

describe('projectSummaries', () => {
  it('rolls up open vs total task counts per project', () => {
    const projects = [p('p1', 'Villa Nord'), p('p2', 'Villa Syd')];
    const tasks = [t('t1', 'p1', 'open'), t('t2', 'p1', 'done'), t('t3', 'p2', 'open')];
    const out = projectSummaries(projects, tasks);
    expect(out).toEqual([
      { project: projects[0], open: 1, total: 2 },
      { project: projects[1], open: 1, total: 1 },
    ]);
  });

  it('reports zero counts for a project with no tasks', () => {
    const out = projectSummaries([p('p1', 'Tom')], []);
    expect(out[0]).toMatchObject({ open: 0, total: 0 });
  });

  it('ignores tasks whose project is not in the list', () => {
    const out = projectSummaries([p('p1', 'A')], [t('t1', 'ghost', 'open')]);
    expect(out[0]).toMatchObject({ open: 0, total: 0 });
    expect(out).toHaveLength(1);
  });

  it('preserves project order', () => {
    const projects = [p('p3', 'C'), p('p1', 'A'), p('p2', 'B')];
    expect(projectSummaries(projects, []).map((s) => s.project.id)).toEqual(['p3', 'p1', 'p2']);
  });
});

describe('groupTasksByProject', () => {
  it('groups tasks under their project in the projects list order', () => {
    const projects = [p('p1', 'Villa Nord'), p('p2', 'Villa Syd')];
    const tasks = [t('t1', 'p2', 'open'), t('t2', 'p1', 'open'), t('t3', 'p1', 'done')];
    const groups = groupTasksByProject(tasks, projects);
    expect(groups.map((g) => g.projectId)).toEqual(['p1', 'p2']); // list order, not task order
    expect(groups[0]).toMatchObject({ projectName: 'Villa Nord' });
    expect(groups[0]!.tasks.map((x) => x.id)).toEqual(['t2', 't3']);
    expect(groups[1]!.tasks.map((x) => x.id)).toEqual(['t1']);
  });

  it('omits projects that have no tasks', () => {
    const groups = groupTasksByProject([t('t1', 'p1', 'open')], [p('p1', 'A'), p('p2', 'B')]);
    expect(groups.map((g) => g.projectId)).toEqual(['p1']);
  });

  it('collects orphan tasks (unknown project) into a trailing null-name group', () => {
    const groups = groupTasksByProject([t('t1', 'ghost', 'open')], [p('p1', 'A')]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ projectId: 'ghost', projectName: null });
  });
});

describe('openTasksWithProject', () => {
  const projects = [p('p1', 'Villa Nord'), p('p2', 'Villa Syd')];

  it('returns only not-done tasks, tagged with their project name', () => {
    const tasks = [t('t1', 'p1', 'open'), t('t2', 'p1', 'done'), t('t3', 'p2', 'open')];
    const out = openTasksWithProject(tasks, projects);
    expect(out.map((o) => o.task.id)).toEqual(['t1', 't3']); // t2 (done) excluded
    expect(out[0]).toMatchObject({ projectName: 'Villa Nord' });
    expect(out[1]).toMatchObject({ projectName: 'Villa Syd' });
  });

  it('tags an unknown project as null', () => {
    const out = openTasksWithProject([t('t1', 'ghost', 'open')], projects);
    expect(out[0]).toMatchObject({ projectName: null });
  });

  it('is empty when everything is done', () => {
    expect(openTasksWithProject([t('t1', 'p1', 'done')], projects)).toEqual([]);
  });
});

describe('tasksForProject', () => {
  it('returns only the given project\'s tasks, in order', () => {
    const tasks = [t('t1', 'p1', 'open'), t('t2', 'p2', 'open'), t('t3', 'p1', 'done')];
    expect(tasksForProject(tasks, 'p1').map((x) => x.id)).toEqual(['t1', 't3']);
  });

  it('is empty for a project with no tasks', () => {
    expect(tasksForProject([t('t1', 'p1', 'open')], 'p2')).toEqual([]);
  });
});
