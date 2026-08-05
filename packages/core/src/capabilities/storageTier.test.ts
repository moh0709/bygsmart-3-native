import { describe, it, expect } from 'vitest';
import { resolveTier, tierBehaviour, type StorageTier } from './storageTier';

describe('resolveTier', () => {
  it('no durable store → online-only regardless of persistence', () => {
    expect(resolveTier({ opfsAvailable: false, persistent: false })).toBe('online-only');
    expect(resolveTier({ opfsAvailable: false, persistent: true })).toBe('online-only');
  });

  it('durable + persisted → full', () => {
    expect(resolveTier({ opfsAvailable: true, persistent: true })).toBe('full');
  });

  it('durable but not persisted → session-durable', () => {
    expect(resolveTier({ opfsAvailable: true, persistent: false })).toBe('session-durable');
  });
});

describe('tierBehaviour', () => {
  it('online-only REFUSES to queue mutations (P3: never lie about durability)', () => {
    expect(tierBehaviour('online-only').canQueueMutations).toBe(false);
  });

  it('full and session-durable may queue', () => {
    expect(tierBehaviour('full').canQueueMutations).toBe(true);
    expect(tierBehaviour('session-durable').canQueueMutations).toBe(true);
  });

  it('non-full tiers prompt install and warn about eviction', () => {
    for (const tier of ['session-durable', 'online-only'] as StorageTier[]) {
      expect(tierBehaviour(tier).promptInstall).toBe(true);
      expect(tierBehaviour(tier).warnsEvictable).toBe(true);
    }
    expect(tierBehaviour('full').warnsEvictable).toBe(false);
    expect(tierBehaviour('full').promptInstall).toBe(false);
  });
});
