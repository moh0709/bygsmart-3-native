import { describe, it, expect, vi } from 'vitest';
import { createHttpPullSource } from './httpPullSource';

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('createHttpPullSource', () => {
  it('GETs <baseUrl>/sync/:entity with cursor + limit and maps the server result to a PullPage', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, {
        rows: [{ id: 't1', updated_at: '2026-08-06T00:00:00Z', title: 'A' }],
        deletes: [{ id: 't2', deletedAt: '2026-08-06T00:00:01Z' }],
        nextCursor: 'cur-2',
        hasMore: true,
      }),
    );
    const source = createHttpPullSource({
      baseUrl: 'http://127.0.0.1:3100/api/',
      getToken: () => 'tok',
      limit: 500,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const page = await source.fetch('tasks', 'cur-1');

    expect(page).toEqual({
      rows: [{ id: 't1', updated_at: '2026-08-06T00:00:00Z', title: 'A' }],
      deletes: [{ id: 't2' }], // deletedAt dropped — puller only needs the id
      nextCursor: 'cur-2',
      hasMore: true,
    });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:3100/api/sync/tasks?cursor=cur-1&limit=500');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('omits the cursor param on the first page', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse(200, { rows: [], deletes: [], nextCursor: null, hasMore: false }),
    );
    const source = createHttpPullSource({ baseUrl: 'http://x/api', getToken: () => null, fetchFn: fetchFn as unknown as typeof fetch });
    await source.fetch('projects', null);
    expect(fetchFn.mock.calls[0]![0]).toBe('http://x/api/sync/projects');
  });

  it('throws on a non-2xx response', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(401, { error: 'nope' }));
    const source = createHttpPullSource({ baseUrl: 'http://x/api', getToken: () => 't', fetchFn: fetchFn as unknown as typeof fetch });
    await expect(source.fetch('tasks', null)).rejects.toThrow('sync/tasks 401');
  });
});
