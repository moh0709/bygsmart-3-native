// ─────────────────────────────────────────────────────────────────────────────
// Web-push routes — VAPID key, subscribe/unsubscribe, test send, mention notify.
//
// Mounted from server/index.js via:
//   app.use(createPushRouter({ supabaseAdmin, getAuthenticatedUser, webpush,
//                              vapidPublicKey, vapidPrivateKey,
//                              notifyUserAndPush, sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import {
  canSendTaskChatNotification,
  filterTaskMentionRecipients,
} from '../taskChatAccess.js';

export const createPushRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  webpush,
  vapidPublicKey,
  vapidPrivateKey,
  notifyUserAndPush,
  sensitiveLimiter,
}) => {
  const router = Router();

  router.get('/api/push/vapid-public-key', (_req, res) => {
    if (!vapidPublicKey) {
      res.status(503).json({ error: 'Push notifications are not configured.' });
      return;
    }
    res.json({ publicKey: vapidPublicKey });
  });

  router.post('/api/push/subscribe', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Push notifications are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ error: 'Invalid push subscription.' });
      return;
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        subscription,
        user_agent: req.headers['user-agent'] || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('[api/push/subscribe] error:', error.message);
      res.status(500).json({ error: 'Unable to save push subscription.' });
      return;
    }

    res.status(201).json({ ok: true });
  });

  router.delete('/api/push/subscribe', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Push notifications are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { endpoint } = req.body || {};
    if (!endpoint) {
      res.status(400).json({ error: 'Missing endpoint.' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[api/push/subscribe DELETE] error:', error.message);
      res.status(500).json({ error: 'Unable to remove push subscription.' });
      return;
    }

    res.json({ ok: true });
  });

  router.post('/api/push/test', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin || !vapidPublicKey || !vapidPrivateKey) {
      res.status(503).json({ error: 'Push notifications are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', user.id);

    if (error) {
      res.status(500).json({ error: 'Unable to load push subscriptions.' });
      return;
    }

    const payload = JSON.stringify({
      title: 'BygSmart',
      body: 'Push-notifikationer er slået til.',
      url: '/#/home',
    });

    const results = await Promise.allSettled(
      (data || []).map((row) => webpush.sendNotification(row.subscription, payload))
    );

    res.json({ sent: results.filter((result) => result.status === 'fulfilled').length });
  });

  router.post('/api/push/timer-alert', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Push notifications are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { kind, projectId, projectName, taskName } = req.body || {};
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (
      !['eight-hour-reminder', 'auto-checkout'].includes(kind)
      || typeof projectId !== 'string'
      || !uuidPattern.test(projectId)
      || typeof projectName !== 'string'
      || projectName.trim().length < 1
      || projectName.length > 200
      || typeof taskName !== 'string'
      || taskName.trim().length < 1
      || taskName.length > 200
    ) {
      res.status(400).json({ error: 'Invalid timer notification payload.' });
      return;
    }

    try {
      const context = `${projectName.trim()} · ${taskName.trim()}`;
      const isReminder = kind === 'eight-hour-reminder';
      await notifyUserAndPush(user.id, {
        title: isReminder ? 'Er du stadig på arbejde?' : 'Automatisk checkout',
        text: isReminder
          ? `Timeren har kørt i 8 timer på ${context}.`
          : `Du er blevet automatisk tjekket ud fra '${context}'.`,
        link: `/project-detail/${projectId}?tab=tid-plan`,
        type: 'timer_safety',
        metadata: { kind, project_id: projectId },
      });

      res.status(201).json({ notified: true });
    } catch (error) {
      console.error('[api/push/timer-alert] error:', error?.message);
      res.status(500).json({ error: 'Unable to deliver timer notification.' });
    }
  });

  router.post('/api/push/notify', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Push notifications are not configured.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, mentionedUserIds, preview, link } = req.body || {};
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (
      typeof taskId !== 'string'
      || !uuidPattern.test(taskId)
      || !Array.isArray(mentionedUserIds)
      || mentionedUserIds.length > 50
      || mentionedUserIds.some((id) => typeof id !== 'string' || !uuidPattern.test(id))
      || typeof preview !== 'string'
      || preview.length > 500
      || link !== `/task/${taskId}`
    ) {
      res.status(400).json({ error: 'Invalid mention notification payload.' });
      return;
    }

    try {
      const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks')
        .select('id, project_id, owner_id, assignees')
        .eq('id', taskId)
        .maybeSingle();
      if (taskError) throw taskError;
      if (!task) {
        res.status(404).json({ error: 'Task not found.' });
        return;
      }

      let project = null;
      let projectResourceUserIds = [];
      let explicitTaskUserIds = [];

      if (task.project_id) {
        const [{ data: projectRow, error: projectError }, { data: resources, error: resourceError }, { data: accessRows, error: accessError }] = await Promise.all([
          supabaseAdmin.from('projects').select('id, owner_id, team').eq('id', task.project_id).maybeSingle(),
          supabaseAdmin.from('project_resources').select('id, user_id, status').eq('project_id', task.project_id).eq('status', 'active'),
          supabaseAdmin.from('resource_task_access').select('resource_id').eq('task_id', task.id),
        ]);
        if (projectError || resourceError || accessError) throw projectError || resourceError || accessError;
        project = projectRow;
        const activeResources = resources || [];
        projectResourceUserIds = activeResources.map((row) => row.user_id).filter(Boolean);
        const assignedResourceIds = new Set((accessRows || []).map((row) => row.resource_id));
        explicitTaskUserIds = activeResources
          .filter((row) => assignedResourceIds.has(row.id))
          .map((row) => row.user_id)
          .filter(Boolean);
      } else {
        const { data: accessRows, error: accessError } = await supabaseAdmin
          .from('quick_task_access')
          .select('user_id, status')
          .eq('task_id', task.id)
          .in('status', ['pending', 'active']);
        if (accessError) throw accessError;
        explicitTaskUserIds = (accessRows || []).map((row) => row.user_id).filter(Boolean);
      }

      if (!canSendTaskChatNotification({
        userId: user.id,
        task,
        project,
        projectResourceUserIds,
        explicitTaskUserIds,
      })) {
        res.status(403).json({ error: 'Not authorized for this task chat.' });
        return;
      }

      const recipients = filterTaskMentionRecipients({
        senderId: user.id,
        mentionedUserIds,
        task,
        project,
        projectResourceUserIds,
        explicitTaskUserIds,
      });
      const text = preview.trim().slice(0, 180) || 'Du er blevet nævnt i en opgavechat.';

      await Promise.all(recipients.map((recipientId) => notifyUserAndPush(recipientId, {
        title: 'Du er nævnt i en opgavechat',
        text,
        link,
        type: 'task_chat_mention',
        metadata: { task_id: task.id },
      })));

      res.status(201).json({ notified: recipients.length });
    } catch (error) {
      console.error('[api/push/notify] error:', error?.message);
      res.status(500).json({ error: 'Unable to notify mentioned users.' });
    }
  });

  return router;
};
