// The real HTTP PullSource — drains GET /api/sync/:entity into the puller. Mirrors the
// httpTransport pattern (injected fetch + token) so it is universal and unit-testable.
// Maps the server PullResult ({ rows, deletes:[{id,deletedAt}], nextCursor, hasMore })
// onto the client PullPage the puller expects.
import type { Row } from '../contract';
import type { PullPage, PullSource } from '../puller';

export interface HttpPullConfig {
  /** API origin incl. the /api prefix, e.g. http://127.0.0.1:3100/api. */
  baseUrl: string;
  getToken: () => string | null | Promise<string | null>;
  /** Page size (server clamps to <= 1000). */
  limit?: number;
  fetchFn?: typeof fetch;
}

interface ServerPullResult {
  rows: Row[];
  deletes: { id: string; deletedAt?: string }[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function createHttpPullSource(config: HttpPullConfig): PullSource {
  const doFetch = config.fetchFn ?? fetch;
  const base = config.baseUrl.replace(/\/+$/, '');

  return {
    async fetch(entity: string, cursor: string | null): Promise<PullPage> {
      const token = await config.getToken();
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (config.limit) params.set('limit', String(config.limit));
      const qs = params.toString();
      const res = await doFetch(`${base}/sync/${entity}${qs ? `?${qs}` : ''}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`sync/${entity} ${res.status}`);
      const body = (await res.json()) as ServerPullResult;
      return {
        rows: body.rows ?? [],
        deletes: (body.deletes ?? []).map((d) => ({ id: d.id })),
        nextCursor: body.nextCursor ?? null,
        hasMore: !!body.hasMore,
      };
    },
  };
}
