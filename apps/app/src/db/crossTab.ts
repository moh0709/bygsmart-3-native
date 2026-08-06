// Cross-tab change notification (P3a 3a.3). The single writer broadcasts after it
// persists; follower tabs re-read the shared store so two tabs stay consistent. Built
// on BroadcastChannel, which delivers to OTHER tabs of the same origin (never the
// sender). The channel factory is injectable so the fan-out is unit-testable, and it
// degrades to a no-op where BroadcastChannel is absent (native).
export interface ChangeChannel {
  /** Tell other tabs the store changed. */
  broadcast(): void;
  close(): void;
}

export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  close(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export type ChannelFactory = (name: string) => BroadcastChannelLike | null;

const CHANGE = 'changed';

function ambientFactory(name: string): BroadcastChannelLike | null {
  const Ctor = (globalThis as { BroadcastChannel?: new (n: string) => BroadcastChannelLike }).BroadcastChannel;
  return Ctor ? new Ctor(name) : null;
}

export function openChangeChannel(
  name: string,
  onRemoteChange: () => void,
  factory: ChannelFactory = ambientFactory,
): ChangeChannel {
  const channel = factory(name);
  if (channel) {
    channel.onmessage = (ev) => {
      if (ev.data === CHANGE) onRemoteChange();
    };
  }
  return {
    broadcast: () => channel?.postMessage(CHANGE),
    close: () => channel?.close(),
  };
}
