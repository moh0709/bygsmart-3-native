import { describe, it, expect, vi } from 'vitest';
import { electSingleWriter, type LocksApi } from './writerElection';

/** A fake Web Locks that grants the lock immediately (first requester wins). */
function grantingLocks(): LocksApi {
  return {
    request(_name, _opts, cb) {
      return cb(); // held promise stays pending, like the real API
    },
  };
}

/** A fake that never grants (someone else holds the lock) — this tab stays a follower. */
function contendedLocks(): LocksApi {
  return {
    request() {
      return new Promise<void>(() => {
        /* never resolves, cb never called */
      });
    },
  };
}

describe('electSingleWriter', () => {
  it('becomes leader when it acquires the lock', () => {
    const e = electSingleWriter('db', grantingLocks());
    expect(e.isLeader()).toBe(true);
  });

  it('stays a follower while another tab holds the lock', () => {
    const e = electSingleWriter('db', contendedLocks());
    expect(e.isLeader()).toBe(false);
  });

  it('is leader when no Web Locks API is available (single process)', () => {
    const e = electSingleWriter('db', null);
    expect(e.isLeader()).toBe(true);
  });

  it('notifies listeners on leadership change and on release', () => {
    const seen: boolean[] = [];
    const e = electSingleWriter('db', grantingLocks());
    e.onChange((v) => seen.push(v));
    e.release();
    expect(e.isLeader()).toBe(false);
    expect(seen).toContain(false);
  });

  it('unsubscribes cleanly', () => {
    const e = electSingleWriter('db', grantingLocks());
    const cb = vi.fn();
    const off = e.onChange(cb);
    off();
    e.release();
    expect(cb).not.toHaveBeenCalled();
  });
});
