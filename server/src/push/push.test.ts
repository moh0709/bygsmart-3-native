import { describe, it, expect, vi } from 'vitest';
import { dispatchPush } from './dispatch';
import { buildExpoMessage, buildWebPayload, isDeadExpoReceipt, isDeadWebStatus } from './messages';
import type { ProviderRegistry, PushProvider, PushSub } from './types';

const sub = (id: string, platform: PushSub['platform']): PushSub => ({
  id,
  userId: 'u',
  platform,
  token: platform === 'web' ? null : `ExponentPushToken[${id}]`,
  subscription: platform === 'web' ? { endpoint: `https://push/${id}` } : undefined,
});

function fakeProvider(platform: PushProvider['platform'], opts?: { dead?: boolean; throws?: boolean }): PushProvider {
  return {
    platform,
    send: vi.fn(async (s) => {
      if (opts?.throws) throw new Error('boom');
      return { subscriptionId: s.id, ok: !opts?.dead, dead: opts?.dead };
    }),
  };
}

describe('dispatchPush', () => {
  it('routes each subscription to its platform provider', async () => {
    const web = fakeProvider('web');
    const ios = fakeProvider('ios');
    const android = fakeProvider('android');
    const providers: ProviderRegistry = { web, ios, android };
    const out = await dispatchPush(providers, [sub('a', 'web'), sub('b', 'ios'), sub('c', 'android')], {
      title: 'T',
      body: 'B',
    });
    expect(out.results.every((r) => r.ok)).toBe(true);
    expect(web.send).toHaveBeenCalledOnce();
    expect(ios.send).toHaveBeenCalledOnce();
    expect(android.send).toHaveBeenCalledOnce();
  });

  it('records a failure (not a reject) when a platform has no provider', async () => {
    const out = await dispatchPush({ web: fakeProvider('web') }, [sub('b', 'ios')], { title: 'T', body: 'B' });
    const r = out.results[0]!;
    expect(r).toMatchObject({ subscriptionId: 'b', ok: false });
    expect(r.error).toMatch(/no provider/);
  });

  it('captures a thrown send as a failed result', async () => {
    const out = await dispatchPush({ web: fakeProvider('web', { throws: true }) }, [sub('a', 'web')], {
      title: 'T',
      body: 'B',
    });
    expect(out.results[0]!.ok).toBe(false);
    expect(out.results[0]!.error).toBe('boom');
  });

  it('aggregates dead endpoints for pruning', async () => {
    const providers: ProviderRegistry = { web: fakeProvider('web', { dead: true }), ios: fakeProvider('ios') };
    const out = await dispatchPush(providers, [sub('a', 'web'), sub('b', 'ios')], { title: 'T', body: 'B' });
    expect(out.deadIds).toEqual(['a']);
  });
});

describe('message building', () => {
  it('expo message carries token, title, body and folds url into data', () => {
    expect(buildExpoMessage(sub('x', 'ios'), { title: 'T', body: 'B', url: '/task/1', data: { k: 1 } })).toEqual({
      to: 'ExponentPushToken[x]',
      title: 'T',
      body: 'B',
      data: { k: 1, url: '/task/1' },
    });
  });

  it('web payload is JSON with title/body/data', () => {
    const p = JSON.parse(buildWebPayload({ title: 'T', body: 'B', url: '/x' }));
    expect(p).toEqual({ title: 'T', body: 'B', data: { url: '/x' } });
  });

  it('dead-endpoint predicates', () => {
    expect(isDeadWebStatus(410)).toBe(true);
    expect(isDeadWebStatus(404)).toBe(true);
    expect(isDeadWebStatus(201)).toBe(false);
    expect(isDeadExpoReceipt({ status: 'error', details: { error: 'DeviceNotRegistered' } })).toBe(true);
    expect(isDeadExpoReceipt({ status: 'ok' })).toBe(false);
  });
});
