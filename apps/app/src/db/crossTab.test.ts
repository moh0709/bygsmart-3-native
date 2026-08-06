import { describe, it, expect, vi } from 'vitest';
import { openChangeChannel, type BroadcastChannelLike, type ChannelFactory } from './crossTab';

/** An in-memory BroadcastChannel bus: instances on the same name reach each other, never themselves. */
function fakeBus(): ChannelFactory {
  const byName = new Map<string, Set<BroadcastChannelLike>>();
  return (name: string) => {
    const set = byName.get(name) ?? new Set<BroadcastChannelLike>();
    byName.set(name, set);
    const ch: BroadcastChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of set) if (other !== ch) other.onmessage?.({ data: message });
      },
      close() {
        set.delete(ch);
      },
    };
    set.add(ch);
    return ch;
  };
}

describe('openChangeChannel', () => {
  it('delivers a broadcast to other tabs on the same name, not the sender', () => {
    const bus = fakeBus();
    const aRemote = vi.fn();
    const bRemote = vi.fn();
    const a = openChangeChannel('db', aRemote, bus);
    openChangeChannel('db', bRemote, bus);

    a.broadcast();
    expect(bRemote).toHaveBeenCalledOnce(); // the other tab heard it
    expect(aRemote).not.toHaveBeenCalled(); // the sender does not hear itself
  });

  it('isolates channels of different names', () => {
    const bus = fakeBus();
    const other = vi.fn();
    const a = openChangeChannel('db-1', () => {}, bus);
    openChangeChannel('db-2', other, bus);
    a.broadcast();
    expect(other).not.toHaveBeenCalled();
  });

  it('is a no-op when BroadcastChannel is unavailable (native)', () => {
    const none: ChannelFactory = () => null;
    const ch = openChangeChannel('db', () => {}, none);
    expect(() => {
      ch.broadcast();
      ch.close();
    }).not.toThrow();
  });
});
