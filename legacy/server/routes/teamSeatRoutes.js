// ─────────────────────────────────────────────────────────────────────────────
// Team seat management routes.
//
// Mounted from server/index.js via:
//   app.use(createTeamSeatRouter({ supabaseAdmin, getAuthenticatedUser,
//                                  syncStripeSeatsForLeader, sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

export const createTeamSeatRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  syncStripeSeatsForLeader,
  sensitiveLimiter,
}) => {
  const router = Router();

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/team-seat
  // Called by TeamManagementPage when a leader adds a seat.
  // 1. Inserts the seat into team_seats.
  // 2a. Existing user → sends an in-app notification with type='team_invite'.
  // 2b. New user      → calls Supabase inviteUserByEmail so they get an email;
  //     handle_new_user() trigger auto-activates their seat on signup.
  // ─────────────────────────────────────────────────────────────────────────────
  router.post('/api/team-seat', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    const { team_id, email, subscription_tier } = req.body || {};

    if (!team_id || typeof team_id !== 'string') {
      res.status(400).json({ error: 'team_id mangler.' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Ugyldig e-mailadresse.' });
      return;
    }
    const allowedTiers = ['PRO', 'PREMIUM'];
    const tier = allowedTiers.includes(subscription_tier) ? subscription_tier : 'PRO';

    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Databaseforbindelsen er ikke konfigureret.' });
      return;
    }

    // Verify caller is the leader of this team
    const { data: teamRow, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('id, name, leader_id')
      .eq('id', team_id)
      .eq('leader_id', user.id)
      .maybeSingle();

    if (teamErr || !teamRow) {
      res.status(403).json({ error: 'Du har ikke adgang til dette team.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Insert seat (idempotent via UNIQUE constraint)
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('team_seats')
      .insert({ team_id, email: normalizedEmail, subscription_tier: tier, status: 'pending' })
      .select('id')
      .single();

    if (seatErr) {
      if (seatErr.code === '23505') {
        res.status(409).json({ error: 'Et sæde med denne e-mail findes allerede i teamet.' });
      } else {
        console.error('POST /api/team-seat seat insert error:', seatErr);
        res.status(500).json({ error: 'Sædet kunne ikke oprettes. Prøv igen.' });
      }
      return;
    }

    // Check if a real (non-demo) profile already exists for this email
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .eq('email', normalizedEmail)
      .eq('is_demo', false)
      .maybeSingle();

    let notified = 'email';
    if (existingProfile) {
      // Existing user: send in-app notification with Accept/Decline metadata
      const { data: leaderProfile } = await supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      const leaderName = leaderProfile?.name || 'Din teamleder';

      await supabaseAdmin.from('notifications').insert({
        user_id:  existingProfile.id,
        text:     `${leaderName} har inviteret dig til at blive teammedlem (${tier})`,
        link:     '#/team-invite',
        type:     'team_invite',
        metadata: { seat_id: seat.id, team_id, team_name: teamRow.name, tier },
      });

      notified = 'in-app';
    } else {
      // New user: send Supabase invite email; handle_new_user() trigger activates seat on signup
      try {
        const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
          normalizedEmail,
          {
            data: { pending_seat_id: seat.id, team_name: teamRow.name },
          }
        );
        if (inviteErr) {
          console.error('POST /api/team-seat inviteUserByEmail error:', inviteErr);
          notified = 'email_failed';
        }
      } catch (err) {
        console.error('POST /api/team-seat inviteUserByEmail exception:', err);
        notified = 'email_failed';
      }

    }

    // Sync Stripe subscription quantity to reflect the new seat.
    // Runs after res.json() — non-fatal if Stripe fails.
    const billingSync = await syncStripeSeatsForLeader(user.id);
    res.json({
      success: true,
      notified,
      seat_id: seat.id,
      billing_synced: billingSync.ok,
      billing: billingSync,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /api/team-seat/:seatId
  // Removes a seat and decrements the leader's Stripe subscription quantity.
  // ─────────────────────────────────────────────────────────────────────────────
  router.delete('/api/team-seat/:seatId', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }

    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Databaseforbindelsen er ikke konfigureret.' });
      return;
    }

    const { seatId } = req.params;

    // Verify seat exists and caller is the team leader
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('team_seats')
      .select('id, team_id, status, email, teams!inner(leader_id, name)')
      .eq('id', seatId)
      .maybeSingle();

    if (seatErr || !seat) {
      res.status(404).json({ error: 'Sædet blev ikke fundet.' });
      return;
    }

    if (seat.teams?.leader_id !== user.id) {
      res.status(403).json({ error: 'Kun teamlederen kan fjerne sæder.' });
      return;
    }

    const { error: delErr } = await supabaseAdmin
      .from('team_seats')
      .delete()
      .eq('id', seatId);

    if (delErr) {
      console.error('DELETE /api/team-seat error:', delErr);
      res.status(500).json({ error: 'Sædet kunne ikke slettes. Prøv igen.' });
      return;
    }

    // Notify the removed member (best-effort). When the seat belongs to a real
    // user, this in-app notification is fanned out to email + push by the
    // notification delivery webhook, honouring their prefs. Pending (unclaimed)
    // seats have no profile yet, so there's nobody to notify.
    try {
      if (seat.email) {
        const { data: removedProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', seat.email)
          .maybeSingle();
        if (removedProfile) {
          await supabaseAdmin.from('notifications').insert({
            user_id: removedProfile.id,
            text: `Du er blevet fjernet fra teamet "${seat.teams?.name || ''}".`,
            timestamp: new Date().toISOString(),
            is_read: false,
            link: '/#/home',
            type: 'team_seat_removed',
            metadata: { team_id: seat.team_id },
          });
        }
      }
    } catch (notifyErr) {
      console.error('DELETE /api/team-seat notify error:', notifyErr?.message ?? notifyErr);
    }

    const billingSync = await syncStripeSeatsForLeader(user.id);
    res.json({
      success: true,
      billing_synced: billingSync.ok,
      billing: billingSync,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /api/sync-stripe-seats
  // Leader can call this to force a Stripe quantity resync from the DB.
  // ─────────────────────────────────────────────────────────────────────────────
  router.post('/api/sync-stripe-seats', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }
    const billingSync = await syncStripeSeatsForLeader(user.id);
    res.json({
      success: billingSync.ok,
      billing_synced: billingSync.ok,
      billing: billingSync,
    });
  });

  return router;
};
