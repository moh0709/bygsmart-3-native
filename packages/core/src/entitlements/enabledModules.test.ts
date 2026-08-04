// TEST LAYER 2 — client fail-open reducer.
import { describe, it, expect } from 'vitest';
import { computeEnabledModules } from './enabledModules';
import { MODULE_IDS } from '../registry/types';

describe('computeEnabledModules', () => {
  it('null modules (loading/error) → all enabled (fail open)', () => {
    expect(computeEnabledModules(null).size).toBe(MODULE_IDS.length);
  });

  it('subtracts the owner-hidden set', () => {
    const enabled = computeEnabledModules(null, new Set(['ai']));
    expect(enabled.has('ai')).toBe(false);
    expect(enabled.has('tasks')).toBe(true);
  });

  it('honours enabled=false, and unknown ids fail open', () => {
    const enabled = computeEnabledModules({ field: { enabled: false } });
    expect(enabled.has('field')).toBe(false);
    expect(enabled.has('tasks')).toBe(true); // absent from the map → fail open
  });
});
