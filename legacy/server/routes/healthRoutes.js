// ─────────────────────────────────────────────────────────────────────────────
// Health check route.
//
// Mounted from server/index.js via:
//   app.use(createHealthRouter({ appVersion }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

export const createHealthRouter = ({ appVersion }) => {
  const router = Router();

  router.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: appVersion,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};
