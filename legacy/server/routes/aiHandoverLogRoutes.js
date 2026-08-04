// ─────────────────────────────────────────────────────────────────────────────
// AI handover report generation log.
//
// Mounted from server/index.js via:
//   app.use(createAiHandoverLogRouter({ supabaseAdmin, getAuthenticatedUser }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

export const createAiHandoverLogRouter = ({ supabaseAdmin, getAuthenticatedUser }) => {
  const router = Router();

  // POST /api/reports/ai-handover — logs generation of an on-demand AI project
  // handover report (services/gemini.ts generateHandoverReport). Not admin-only:
  // any authenticated project member who generates a report calls this. Best
  // effort — failing to log never blocks the user's PDF download.
  router.post('/api/reports/ai-handover', async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }
    const { projectId } = req.body || {};
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId er påkrævet.' });
      return;
    }
    try {
      const { error } = await supabaseAdmin
        .from('ai_handover_reports_log')
        .insert({ project_id: projectId, generated_by: user.id });
      if (error) throw error;
      res.status(201).json({ ok: true });
    } catch (err) {
      // Non-fatal: the table may not be migrated yet, or the insert may race
      // a deleted project. Never surface this as an error to the caller.
      console.warn('[api/reports/ai-handover] log insert failed (non-fatal):', err?.message);
      res.status(202).json({ ok: false });
    }
  });

  return router;
};
