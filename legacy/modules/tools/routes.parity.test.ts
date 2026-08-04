import { describe, it, expect } from 'vitest';
import { ROUTE_DEFS } from './loaders';
import fixture from './routes.fixture.json';

// ─────────────────────────────────────────────────────────────────────────────
// Route-parity net (Phase 4 extraction, program plan §Phase 4).
//
// routes.fixture.json is the frozen snapshot of the ~90 hand-written App.tsx
// routes (path + Pro gating) at extraction time. The generated ROUTE_DEFS must
// match it EXACTLY — a mismatch means a production deep link changed. Adding a
// NEW calculator later = add it to both loaders.ts and the fixture (that's the
// point: route changes must be deliberate, reviewed edits).
// ─────────────────────────────────────────────────────────────────────────────

describe('tools route parity', () => {
  it('generated routes exactly match the production surface at extraction', () => {
    const generated = ROUTE_DEFS.map((d) => ({ path: d.path, toolId: d.toolId ?? null }));
    expect(generated).toEqual(fixture);
  });

  it('covers 90 routes with 38 Pro-gated', () => {
    expect(ROUTE_DEFS).toHaveLength(90);
    expect(ROUTE_DEFS.filter((d) => d.toolId).length).toBe(38);
  });

  it('has no duplicate paths or toolIds', () => {
    const paths = ROUTE_DEFS.map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
    const toolIds = ROUTE_DEFS.filter((d) => d.toolId).map((d) => d.toolId);
    expect(new Set(toolIds).size).toBe(toolIds.length);
  });
});
