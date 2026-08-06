import { describe, it, expect } from 'vitest';
import { projectSummaries } from './selectors';
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
