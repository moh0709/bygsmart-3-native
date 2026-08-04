// @vitest-environment jsdom
import React, { Suspense, lazy } from 'react';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { loadProjectTimeline, loadProjectTasksTab } from './index';
import type { Project } from '../../types';

// Regression guard for the 2026-07-11 prod incident: the barrel exported
// React.lazy components, consumers wrapped them in lazy() again, and React
// crashed rendering the nested lazy ("TypeError: n is not a function") on
// /project-detail. The barrel must export LOADERS whose resolved default is a
// plain function component, renderable through a single lazy().

const project = {
  id: 'p1',
  name: 'Villa Nord',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
} as Project;

test('loadProjectTimeline renders through a single lazy()', async () => {
  const ProjectTimeline = lazy(() => loadProjectTimeline());
  render(
    <Suspense fallback={<div data-testid="loading" />}>
      <ProjectTimeline project={project} tasks={[]} onNavigate={() => {}} />
    </Suspense>
  );
  // The zoom control appearing means the lazy resolved to a renderable
  // component instead of another lazy (which crashes before painting).
  expect(await screen.findByLabelText('Zoom ind')).toBeInTheDocument();
});

test('loader defaults are plain function components, never lazy objects', async () => {
  for (const load of [loadProjectTimeline, loadProjectTasksTab]) {
    const mod = await load();
    expect(typeof mod.default).toBe('function');
  }
});
