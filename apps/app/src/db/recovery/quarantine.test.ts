import { describe, it, expect, vi } from 'vitest';
import { openOrRecover, type RecoveryHooks } from './quarantine';

function hooks(overrides: Partial<RecoveryHooks<string>>): RecoveryHooks<string> {
  return {
    open: vi.fn(async () => 'existing'),
    quarantine: vi.fn(async () => {}),
    fresh: vi.fn(async () => 'fresh'),
    rehydrate: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('openOrRecover', () => {
  it('returns the existing store untouched on a clean open', async () => {
    const h = hooks({});
    const res = await openOrRecover(h);
    expect(res).toEqual({ store: 'existing', recovered: false });
    expect(h.quarantine).not.toHaveBeenCalled();
    expect(h.fresh).not.toHaveBeenCalled();
    expect(h.rehydrate).not.toHaveBeenCalled();
  });

  it('quarantines, starts fresh and rehydrates when the store is corrupt', async () => {
    const h = hooks({ open: vi.fn(async () => { throw new Error('SQLITE_CORRUPT'); }) });
    const res = await openOrRecover(h);
    expect(res).toEqual({ store: 'fresh', recovered: true });
    expect(h.quarantine).toHaveBeenCalledOnce();
    expect(h.fresh).toHaveBeenCalledOnce();
    expect(h.rehydrate).toHaveBeenCalledWith('fresh');
  });

  it('recovers from a failed decrypt the same way', async () => {
    const h = hooks({ open: vi.fn(async () => { throw new Error('decrypt failed'); }) });
    const res = await openOrRecover(h);
    expect(res.recovered).toBe(true);
    expect(res.store).toBe('fresh');
  });
});
