import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Env } from './env';
import { serviceClient, userClient } from './supabase';
import { cursorEntity } from './sync/entities';
import { clampLimit, pullEntity } from './sync/pull';
import { applyMutations } from './sync/apply';
import type { Mutation } from './sync/mutations';
import { resolveEnabledModules } from './sync/entitlements';
import { verifyJwtSub } from './jwt';

/** Minimal shape validation for an incoming mutation batch. */
function parseMutations(body: unknown): Mutation[] | null {
  if (!body || typeof body !== 'object') return null;
  const arr = (body as { mutations?: unknown }).mutations;
  if (!Array.isArray(arr)) return null;
  const out: Mutation[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    if (typeof m.id !== 'string' || typeof m.entity !== 'string') return null;
    if (m.op !== 'upsert' && m.op !== 'delete') return null;
    if (!m.data || typeof m.data !== 'object') return null;
    out.push({
      id: m.id,
      entity: m.entity,
      op: m.op,
      data: m.data as Record<string, unknown>,
      baseVersion: typeof m.baseVersion === 'string' ? m.baseVersion : undefined,
      dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn.filter((d): d is string => typeof d === 'string') : undefined,
    });
  }
  return out;
}

/** Pull the Bearer token; 401 if absent. RLS (not this check) is the authorisation boundary. */
function bearer(req: Request): string | null {
  const h = req.header('authorization') ?? req.header('Authorization');
  if (!h || !h.toLowerCase().startsWith('bearer ')) return null;
  const token = h.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function createApp(env: Env): Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // CORS — the web (react-native-web PWA) target calls this API cross-origin. The
  // bearer token travels in the Authorization header (not a cookie), so a wildcard
  // origin is safe here; tighten to the app origin in production via CORS_ORIGIN.
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', corsOrigin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Headers', 'authorization, content-type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // GET /api/sync/:entity — cursor (updated_at, id), RLS-applied, tombstones, paged.
  app.get('/api/sync/:entity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (!token) return res.status(401).json({ error: 'missing bearer token' });

      const name = req.params.entity;
      const entity = typeof name === 'string' ? cursorEntity(name) : null;
      if (!entity) return res.status(404).json({ error: `unknown syncable entity: ${String(name)}` });

      const limit = clampLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const result = await pullEntity(userClient(env, token), entity, cursor, limit);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  // POST /api/sync/mutations — idempotency keys, dependsOn ordering, baseVersion
  // optimistic concurrency, per-entity conflict adjudication.
  app.post('/api/sync/mutations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (!token) return res.status(401).json({ error: 'missing bearer token' });

      const mutations = parseMutations(req.body);
      if (!mutations) return res.status(400).json({ error: 'body must be { mutations: Mutation[] }' });

      const userId = await verifyJwtSub(token, { hmacSecret: env.jwtSecret, jwksUrl: env.jwksUrl });
      if (!userId) return res.status(401).json({ error: 'invalid token' });

      const userDb = userClient(env, token);
      const svc = serviceClient(env);
      const enabledModules = await resolveEnabledModules(svc, userId);
      let results;
      try {
        results = await applyMutations(userDb, svc, userId, mutations, enabledModules);
      } catch (e) {
        // topoSort rejects the whole batch (cycle / unknown dependency).
        return res.status(400).json({ error: e instanceof Error ? e.message : 'bad batch' });
      }
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  });

  // Error handler — never leak a stack; map known DB errors to 400.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(status).json({ error: message });
  });

  return app;
}
