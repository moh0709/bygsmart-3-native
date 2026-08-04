import { describe, it, expect } from 'vitest';
import { resolveTier, tierBehaviour, probeStorageCapabilities } from '../web-capability';
import { SCENARIOS, blankScorecard, passesHardGates } from '../scenarios';
import type { Scorecard } from '../scenarios';

describe('graded web-offline tier logic (S-13 / plan R8)', () => {
  it('no OPFS -> online-only', () => {
    expect(resolveTier({ opfsAvailable: false, persistent: false })).toBe('online-only');
    expect(resolveTier({ opfsAvailable: false, persistent: true })).toBe('online-only');
  });
  it('OPFS + persisted -> full', () => {
    expect(resolveTier({ opfsAvailable: true, persistent: true })).toBe('full');
  });
  it('OPFS, not persisted -> session-durable', () => {
    expect(resolveTier({ opfsAvailable: true, persistent: false })).toBe('session-durable');
  });

  it('online-only REFUSES to queue mutations (P3: never lies about state)', () => {
    expect(tierBehaviour('online-only').canQueueMutations).toBe(false);
    expect(tierBehaviour('full').canQueueMutations).toBe(true);
    expect(tierBehaviour('session-durable').canQueueMutations).toBe(true);
    expect(tierBehaviour('session-durable').promptInstall).toBe(true);
  });

  it('probe is safe with no navigator.storage (returns online-only-shaped caps)', async () => {
    const caps = await probeStorageCapabilities();
    expect(caps.opfsAvailable).toBe(false);
    expect(resolveTier(caps)).toBe('online-only');
  });
});

describe('scenario matrix integrity', () => {
  it('has unique scenario ids', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('includes the load-bearing hard gates incl. R5 (private-browsing refusal)', () => {
    const hard = SCENARIOS.filter((s) => s.hardGate).map((s) => s.id);
    expect(hard).toContain('R5');
    expect(hard).toContain('B3'); // tombstone
    expect(hard.length).toBeGreaterThanOrEqual(6);
  });
  it('blank scorecard applies web scenarios to web only, native to devices only', () => {
    const card = blankScorecard('powersync');
    const r5 = card.cells.filter((c) => c.scenarioId === 'R5');
    expect(r5.map((c) => c.runtime)).toEqual(['web']);
    const n1 = card.cells.filter((c) => c.scenarioId === 'N1');
    expect(n1.map((c) => c.runtime).sort()).toEqual(['android', 'ios']);
  });
  it('a fresh (unrun) scorecard has not failed any hard gate yet', () => {
    const card: Scorecard = blankScorecard('electricsql');
    expect(passesHardGates(card)).toBe(true);
  });
});
