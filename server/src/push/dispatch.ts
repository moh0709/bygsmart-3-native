import type { ProviderRegistry, PushMessage, PushResult, PushSub } from './types';

export interface DispatchOutcome {
  results: PushResult[];
  /** Subscription ids whose endpoint/token is dead → caller prunes them. */
  deadIds: string[];
}

/**
 * Route each subscription to its platform's provider and send concurrently. A
 * missing provider or a thrown send is captured as a failed result, never a reject —
 * one bad device can't sink the fan-out. Dead endpoints are collected for pruning.
 */
export async function dispatchPush(
  providers: ProviderRegistry,
  subs: PushSub[],
  msg: PushMessage,
): Promise<DispatchOutcome> {
  const results = await Promise.all(
    subs.map(async (s): Promise<PushResult> => {
      const provider = providers[s.platform];
      if (!provider) return { subscriptionId: s.id, ok: false, error: `no provider for platform ${s.platform}` };
      try {
        return await provider.send(s, msg);
      } catch (e) {
        return { subscriptionId: s.id, ok: false, error: e instanceof Error ? e.message : 'send failed' };
      }
    }),
  );
  return { results, deadIds: results.filter((r) => r.dead).map((r) => r.subscriptionId) };
}
