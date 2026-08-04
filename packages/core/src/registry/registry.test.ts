// TEST LAYER 2 — requires-closure + slot collection. Ported from legacy/core/registry/registry.test.ts.
import { describe, it, expect } from 'vitest';
import { resolveActiveManifests, collectSlot } from './registry';
import type { ModuleId, ModuleManifest } from './types';

const manifest = (id: ModuleId, requires: ModuleId[] = [], extra: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id,
  name: id,
  description: '',
  requires,
  entitlement: `module.${id}`,
  ...extra,
});

describe('resolveActiveManifests', () => {
  const MANIFESTS = [
    manifest('projects'),
    manifest('tasks'),
    manifest('tools'),
    manifest('time', ['tasks', 'projects']),
    manifest('budget', ['projects']),
    manifest('ar', ['tools']),
  ];

  it('keeps only entitled modules', () => {
    const active = resolveActiveManifests(new Set<ModuleId>(['projects', 'tasks']), MANIFESTS);
    expect(active.map((m) => m.id)).toEqual(['projects', 'tasks']);
  });

  it('drops a module whose dependency is not entitled', () => {
    const active = resolveActiveManifests(new Set<ModuleId>(['time', 'tasks']), MANIFESTS);
    // time requires projects too — projects is off, so time drops
    expect(active.map((m) => m.id)).toEqual(['tasks']);
  });

  it('drops transitively: ar → tools off pulls ar down with it', () => {
    const active = resolveActiveManifests(new Set<ModuleId>(['ar', 'projects']), MANIFESTS);
    expect(active.map((m) => m.id)).toEqual(['projects']);
  });

  it('preserves declaration order regardless of set order', () => {
    const active = resolveActiveManifests(new Set<ModuleId>(['budget', 'tools', 'projects']), MANIFESTS);
    expect(active.map((m) => m.id)).toEqual(['projects', 'tools', 'budget']);
  });
});

describe('collectSlot', () => {
  it('flattens and sorts contributions by order', () => {
    const a = manifest('projects', [], {
      nav: [{ to: '/projects', label: 'Projekter', icon: '•', surface: 'bottom', order: 20 }],
    });
    const b = manifest('tasks', [], {
      nav: [{ to: '/tasks', label: 'Opgaver', icon: '•', surface: 'bottom', order: 10 }],
    });
    const nav = collectSlot([a, b], 'nav');
    expect(nav.map((n) => n.to)).toEqual(['/tasks', '/projects']);
  });

  it('returns empty for slots nobody contributes to', () => {
    expect(collectSlot([manifest('projects')], 'homeWidgets')).toEqual([]);
  });
});
