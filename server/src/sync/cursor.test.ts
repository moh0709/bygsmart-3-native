import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  keysetOrFilter,
  nextCursor,
  tombstoneSince,
  EPOCH,
} from './cursor';

describe('cursor encode/decode', () => {
  it('round-trips', () => {
    const c = { updatedAt: '2026-08-06T10:00:00.000Z', id: 'abc-123' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('returns null for absent input (start from beginning)', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null for garbage / malformed / missing fields', () => {
    expect(decodeCursor('not-base64-!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('{"id":"x"}').toString('base64url'))).toBeNull(); // no updatedAt
    expect(decodeCursor(Buffer.from('{"updatedAt":"nope","id":"x"}').toString('base64url'))).toBeNull();
  });
});

describe('keysetOrFilter', () => {
  it('expresses updated_at > U OR (updated_at = U AND id > ID)', () => {
    expect(keysetOrFilter({ updatedAt: '2026-08-06T10:00:00.000Z', id: 'zz' })).toBe(
      'updated_at.gt.2026-08-06T10:00:00.000Z,and(updated_at.eq.2026-08-06T10:00:00.000Z,id.gt.zz)',
    );
  });
});

describe('nextCursor', () => {
  const rows = [
    { id: 'a', updated_at: '2026-08-06T10:00:00.000Z' },
    { id: 'b', updated_at: '2026-08-06T11:00:00.000Z' },
  ];
  it('is null when there is no more', () => {
    expect(nextCursor(rows, false)).toBeNull();
    expect(nextCursor([], true)).toBeNull();
  });
  it('points at the last row when hasMore', () => {
    const c = decodeCursor(nextCursor(rows, true));
    expect(c).toEqual({ updatedAt: '2026-08-06T11:00:00.000Z', id: 'b' });
  });
});

describe('tombstoneSince', () => {
  it('uses EPOCH when no cursor', () => {
    expect(tombstoneSince(null)).toBe(EPOCH);
  });
  it('uses the cursor timestamp otherwise', () => {
    expect(tombstoneSince({ updatedAt: '2026-08-06T10:00:00.000Z', id: 'x' })).toBe(
      '2026-08-06T10:00:00.000Z',
    );
  });
});
