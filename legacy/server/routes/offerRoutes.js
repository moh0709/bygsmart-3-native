// ─────────────────────────────────────────────────────────────────────────────
// Task offer routes — notify project owner of a new offer, accept/reject.
//
// Mounted from server/index.js via:
//   app.use(createOfferRouter({ supabaseAdmin, getAuthenticatedUser,
//                               isUuid, isSafeInternalLink, isHttpsUrl }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

export const createOfferRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  isUuid,
  isSafeInternalLink,
  isHttpsUrl,
}) => {
  const router = Router();

  // POST /api/offer/notify
  // Creates a notification for a project owner on behalf of a project member.
  // Required because notification RLS enforces user_id = auth.uid(), so a
  // subcontractor cannot directly write a notification row for the owner.
  router.post('/api/offer/notify', async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverforbindelsen er ikke konfigureret.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    const { projectId, recipientId, text, link } = req.body || {};
    if (
      !isUuid(projectId) ||
      !isUuid(recipientId) ||
      !text || typeof text !== 'string' || text.length > 2000
    ) {
      res.status(400).json({ error: 'Ugyldige parametre.' });
      return;
    }

    // A link is optional, but when present it must be a safe same-origin route —
    // never an off-site URL. Prevents this endpoint from being used to push a
    // trusted-looking notification that redirects the recipient off-platform.
    if (link != null && !isSafeInternalLink(link)) {
      res.status(400).json({ error: 'Ugyldigt link.' });
      return;
    }

    // Verify caller is a member of the project before writing on its behalf.
    const { data: project, error: projError } = await supabaseAdmin
      .from('projects')
      .select('id, owner_id, team')
      .eq('id', projectId)
      .maybeSingle();

    if (projError || !project) {
      res.status(404).json({ error: 'Projektet blev ikke fundet.' });
      return;
    }

    const team = Array.isArray(project.team) ? project.team : [];
    const isMember =
      project.owner_id === user.id ||
      team.some((m) => m != null && String(m.id || '') === user.id);

    if (!isMember) {
      res.status(403).json({ error: 'Du er ikke et medlem af dette projekt.' });
      return;
    }

    // The recipient must ALSO belong to the project. Without this a member could
    // target any user in the system with an arbitrary in-app notification —
    // an in-app phishing/spam primitive. Notifications may only flow between
    // members of the same project.
    const recipientIsMember =
      project.owner_id === recipientId ||
      team.some((m) => m != null && String(m.id || '') === recipientId);

    if (!recipientIsMember) {
      res.status(403).json({ error: 'Modtageren er ikke medlem af dette projekt.' });
      return;
    }

    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: recipientId,
      text,
      timestamp: new Date().toISOString(),
      is_read: false,
      link: link || null,
      type: 'offer_received',
      metadata: { projectId },
    });

    if (error) {
      console.error('[api/offer/notify] error:', error.message);
      res.status(500).json({ error: 'Notifikationen kunne ikke oprettes.' });
      return;
    }

    res.status(201).json({ ok: true });
  });

  // POST /api/offer/update-status
  // Accepts or rejects a task offer. The server verifies that the caller is the
  // project owner before mutating the task and notifying the subcontractor.
  // This prevents any project member from bypassing the owner-only check that
  // exists only in the UI (JobOfferModal's isOwner flag).
  router.post('/api/offer/update-status', async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverforbindelsen er ikke konfigureret.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    const { taskId, offerId, status, ownerName, projectName, projectId, contractUrl } = req.body || {};
    if (
      !taskId || typeof taskId !== 'string' ||
      !offerId || typeof offerId !== 'string' ||
      !['ACCEPTED', 'REJECTED'].includes(status) ||
      !projectId || typeof projectId !== 'string'
    ) {
      res.status(400).json({ error: 'Ugyldige parametre.' });
      return;
    }

    // Verify caller is the project owner — this is the authoritative check.
    const { data: project, error: projError } = await supabaseAdmin
      .from('projects')
      .select('id, owner_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projError || !project) {
      res.status(404).json({ error: 'Projektet blev ikke fundet.' });
      return;
    }

    if (project.owner_id !== user.id) {
      res.status(403).json({ error: 'Kun projektejeren kan acceptere eller afvise tilbud.' });
      return;
    }

    // Fetch the task and mutate the offers array.
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, offers')
      .eq('id', taskId)
      .maybeSingle();

    if (taskError || !task) {
      res.status(404).json({ error: 'Opgaven blev ikke fundet.' });
      return;
    }

    const offers = Array.isArray(task.offers) ? task.offers : [];
    const offer = offers.find((o) => o != null && o.id === offerId);

    if (!offer) {
      res.status(404).json({ error: 'Tilbuddet blev ikke fundet.' });
      return;
    }

    // Only persist a contract URL when it is a valid absolute https:// link, so a
    // javascript: URI or off-site redirect can never be stored on the offer and
    // later rendered as a clickable link in the client.
    const updatedOffers = offers.map((o) =>
      o != null && o.id === offerId
        ? { ...o, status, ...(status === 'ACCEPTED' && isHttpsUrl(contractUrl) ? { contractUrl } : {}) }
        : o
    );

    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({ offers: updatedOffers })
      .eq('id', taskId);

    if (updateError) {
      console.error('[api/offer/update-status] task update error:', updateError.message);
      res.status(500).json({ error: 'Opgaven kunne ikke opdateres.' });
      return;
    }

    // Notify the subcontractor about the decision.
    if (offer && offer.subcontractorId) {
      const statusLabel = status === 'ACCEPTED' ? 'accepteret' : 'afvist';
      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        user_id: offer.subcontractorId,
        text: `Dit tilbud på "${projectName || 'projektet'}" er blevet ${statusLabel} af ${ownerName || 'projektejeren'}.`,
        timestamp: new Date().toISOString(),
        is_read: false,
        link: `/project-detail/${projectId}?tab=oversigt`,
        type: 'offer_decided',
        metadata: { projectId, status },
      });
      if (notifError) {
        console.error('[api/offer/update-status] notification error:', notifError.message);
      }
    }

    res.status(200).json({ ok: true });
  });

  return router;
};
