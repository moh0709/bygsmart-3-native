// The real HTTP MutationTransport (P3b) — ships one outbox batch to
// POST /api/sync/mutations and returns the server's per-mutation results to the
// flusher. Transport ONLY: it does exactly one request and never decides policy —
// retries, backoff, conflict handling, and dead-lettering all live in the flusher.
// A non-2xx response is a whole-batch failure (throw), which the flusher turns into a
// backed-off retry of every entry. `fetch` and the token getter are injected so this
// is unit-testable without a live server and works identically on native and web.
import type { OutboxMutation } from './contract';
import type { MutationResult, MutationTransport } from './flusher';

export interface HttpTransportConfig {
  /** API origin including the `/api` prefix, e.g. https://app.bygsmart.com/api. */
  baseUrl: string;
  /** Current bearer token (may refresh); called per request. Null → no auth header (server 401s). */
  getToken: () => string | null | Promise<string | null>;
  /** Injected for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

interface MutationsResponse {
  results: MutationResult[];
}

export function createHttpMutationTransport(config: HttpTransportConfig): MutationTransport {
  const doFetch = config.fetchFn ?? fetch;
  const url = `${config.baseUrl.replace(/\/+$/, '')}/sync/mutations`;

  return {
    async send(mutations: OutboxMutation[]): Promise<MutationResult[]> {
      const token = await config.getToken();
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mutations }),
      });
      if (!res.ok) {
        // 4xx/5xx = the batch did not land. Surface a message; the flusher retries all.
        let detail = '';
        try {
          detail = ((await res.json()) as { error?: string }).error ?? '';
        } catch {
          /* non-JSON body */
        }
        throw new Error(`sync/mutations ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      const body = (await res.json()) as MutationsResponse;
      return body.results ?? [];
    },
  };
}
