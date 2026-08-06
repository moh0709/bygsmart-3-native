import { describe, it, expect, vi } from 'vitest';
import { createHttpMutationTransport } from './httpTransport';
import type { OutboxMutation } from './contract';

const muts: OutboxMutation[] = [{ id: 'm1', entity: 'tasks', op: 'upsert', data: { id: 't1', title: 'A' } }];

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('createHttpMutationTransport', () => {
  it('POSTs { mutations } to <baseUrl>/sync/mutations with a bearer header and returns results', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { results: [{ id: 'm1', status: 'applied', row: { id: 't1' } }] }),
    );
    const transport = createHttpMutationTransport({
      baseUrl: 'https://app.bygsmart.com/api/', // trailing slash tolerated
      getToken: () => 'tok-123',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const results = await transport.send(muts);

    expect(results).toEqual([{ id: 'm1', status: 'applied', row: { id: 't1' } }]);
    const [calledUrl, init] = fetchFn.mock.calls[0]!;
    expect(calledUrl).toBe('https://app.bygsmart.com/api/sync/mutations');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init!.body as string)).toEqual({ mutations: muts });
  });

  it('omits the auth header when no token is available', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, { results: [] }));
    const transport = createHttpMutationTransport({
      baseUrl: 'https://x/api',
      getToken: () => null,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await transport.send(muts);
    expect((fetchFn.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('awaits an async token getter', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, { results: [] }));
    const transport = createHttpMutationTransport({
      baseUrl: 'https://x/api',
      getToken: async () => 'later',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await transport.send(muts);
    expect((fetchFn.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe('Bearer later');
  });

  it('throws on a non-2xx response, including the server error detail (whole-batch failure)', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(400, { error: 'body must be { mutations: Mutation[] }' }));
    const transport = createHttpMutationTransport({
      baseUrl: 'https://x/api',
      getToken: () => 't',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(transport.send(muts)).rejects.toThrow('sync/mutations 400: body must be { mutations: Mutation[] }');
  });

  it('throws a status-only error when the error body is not JSON', async () => {
    const fetchFn = vi.fn(
      async () => ({ ok: false, status: 502, json: async () => { throw new Error('not json'); } }) as unknown as Response,
    );
    const transport = createHttpMutationTransport({
      baseUrl: 'https://x/api',
      getToken: () => 't',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(transport.send(muts)).rejects.toThrow('sync/mutations 502');
  });
});
