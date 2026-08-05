import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { Env } from './env';
import { userClient } from './supabase';
import { cursorEntity } from './sync/entities';
import { clampLimit, pullEntity } from './sync/pull';

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

  // Error handler — never leak a stack; map known DB errors to 400.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(status).json({ error: message });
  });

  return app;
}
