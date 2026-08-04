// ─────────────────────────────────────────────────────────────────────────────
// SMTP configuration routes — admin global config + per-owner custom config.
//
// Mounted from server/index.js via:
//   app.use(createSmtpRouter({ supabaseAdmin, getAuthenticatedUser,
//                              getAdminProfile, isProduction }))
//
// Passwords are never returned by any endpoint — responses include
// hasPassword (bool) only. All writes go through service role (bypasses RLS).
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  encryptApiKey,
  hasEncryptionSecret,
  resolveSmtpConfig,
  verifyConnection,
  sendMail,
  assertPublicSmtpHost,
} from './email.js';

export const createSmtpRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  getAdminProfile,
  isProduction,
  getEffectiveTier,
}) => {
  const router = Router();

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? 120 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? 30 : 500,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ── Auth helpers ───────────────────────────────────────────────────────────
  const requireAdmin = async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return null;
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return null;
    }
    const profile = await getAdminProfile(user.id);
    if (!profile || profile.app_role !== 'admin') {
      res.status(403).json({ error: 'Adgang nægtet. Kun administratorer.' });
      return null;
    }
    return user;
  };

  const requireSubscriptionOwner = async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return null;
    }
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return null;
    }
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, subscription_tier, team_role, trial_tier, trial_ends_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !profile) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return null;
    }
    const effectiveTier = getEffectiveTier ? getEffectiveTier(profile) : profile.subscription_tier;
    if (!['PREMIUM', 'ENTERPRISE'].includes(effectiveTier)) {
      res.status(403).json({ error: 'Denne funktion kræver et Premium- eller Enterprise-abonnement.' });
      return null;
    }
    if (['staff', 'member'].includes(profile.team_role)) {
      res.status(403).json({ error: 'Kun abonnementsejere kan konfigurere SMTP.' });
      return null;
    }
    return { user, profile };
  };

  // ── Safe response shape (password never included) ──────────────────────────
  const toSafeShape = (row) => ({
    scope: row?.scope ?? null,
    host: row?.host ?? null,
    port: row?.port ?? null,
    secure: row?.secure ?? true,
    username: row?.username ?? null,
    fromName: row?.from_name ?? null,
    fromEmail: row?.from_email ?? null,
    enabled: Boolean(row?.enabled),
    hasPassword: Boolean(row?.password_encrypted),
    updatedAt: row?.updated_at ?? null,
  });

  const defaultShape = (scope) => ({
    scope,
    host: null,
    port: null,
    secure: true,
    username: null,
    fromName: null,
    fromEmail: null,
    enabled: false,
    hasPassword: false,
    updatedAt: null,
  });

  // ── Password upsert helper ─────────────────────────────────────────────────
  const resolvePasswordField = async (password, existingRow) => {
    if (password === undefined) {
      // Keep existing — do not include in upsert payload
      return existingRow?.password_encrypted !== undefined
        ? { password_encrypted: existingRow.password_encrypted }
        : {};
    }
    if (password === '') {
      return { password_encrypted: null };
    }
    if (!hasEncryptionSecret()) {
      throw Object.assign(new Error('AI_KEYS_SECRET er ikke konfigureret på serveren.'), { status: 503 });
    }
    return { password_encrypted: encryptApiKey(password) };
  };

  // ── GET /api/smtp/global ───────────────────────────────────────────────────
  router.get('/api/smtp/global', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;
    try {
      const { data: row, error } = await supabaseAdmin
        .from('smtp_configs')
        .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
        .eq('scope', 'global')
        .maybeSingle();
      if (error) throw error;
      res.json(row ? toSafeShape(row) : defaultShape('global'));
    } catch (err) {
      console.error('[smtp] GET /global error:', err?.message);
      res.status(500).json({ error: 'Intern serverfejl.' });
    }
  });

  // ── PUT /api/smtp/global ───────────────────────────────────────────────────
  router.put('/api/smtp/global', sensitiveLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;
    try {
      const { host, port, secure, username, password, fromName, fromEmail, enabled } = req.body;

      // Reject internal/loopback hosts before storing (SSRF). Only validate when
      // a host is actually supplied — clearing the config (host null) is allowed.
      if (host != null && host !== '') {
        await assertPublicSmtpHost(host);
      }

      const { data: existing } = await supabaseAdmin
        .from('smtp_configs')
        .select('password_encrypted')
        .eq('scope', 'global')
        .maybeSingle();

      const passwordField = await resolvePasswordField(password, existing);

      const payload = {
        scope: 'global',
        host: host ?? null,
        port: port ?? null,
        secure: secure !== undefined ? Boolean(secure) : true,
        username: username ?? null,
        from_name: fromName ?? null,
        from_email: fromEmail ?? null,
        enabled: Boolean(enabled),
        updated_by: user.id,
        ...passwordField,
      };

      let row, error;
      if (existing) {
        ({ data: row, error } = await supabaseAdmin
          .from('smtp_configs')
          .update(payload)
          .eq('scope', 'global')
          .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
          .maybeSingle());
      } else {
        ({ data: row, error } = await supabaseAdmin
          .from('smtp_configs')
          .insert(payload)
          .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
          .maybeSingle());
      }

      if (error) throw error;
      res.json(toSafeShape(row));
    } catch (err) {
      console.error('[smtp] PUT /global error:', err?.message);
      const status = err?.status ?? 500;
      // Only surface our own controlled client-error messages (validation/SSRF).
      // Never echo raw DB/driver messages back to the client.
      const clientMsg = status >= 400 && status < 500 ? (err?.message ?? 'Ugyldig forespørgsel.') : 'Intern serverfejl.';
      res.status(status).json({ error: clientMsg });
    }
  });

  // ── GET /api/smtp/custom ───────────────────────────────────────────────────
  router.get('/api/smtp/custom', adminLimiter, async (req, res) => {
    const auth = await requireSubscriptionOwner(req, res);
    if (!auth) return;
    try {
      const { data: row, error } = await supabaseAdmin
        .from('smtp_configs')
        .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
        .eq('scope', 'custom')
        .eq('owner_id', auth.user.id)
        .maybeSingle();
      if (error) throw error;
      res.json(row ? toSafeShape(row) : defaultShape('custom'));
    } catch (err) {
      console.error('[smtp] GET /custom error:', err?.message);
      res.status(500).json({ error: 'Intern serverfejl.' });
    }
  });

  // ── PUT /api/smtp/custom ───────────────────────────────────────────────────
  router.put('/api/smtp/custom', sensitiveLimiter, async (req, res) => {
    const auth = await requireSubscriptionOwner(req, res);
    if (!auth) return;
    try {
      const { host, port, secure, username, password, fromName, fromEmail, enabled } = req.body;

      // Reject internal/loopback hosts before storing (SSRF).
      if (host != null && host !== '') {
        await assertPublicSmtpHost(host);
      }

      const { data: existing } = await supabaseAdmin
        .from('smtp_configs')
        .select('password_encrypted')
        .eq('scope', 'custom')
        .eq('owner_id', auth.user.id)
        .maybeSingle();

      const passwordField = await resolvePasswordField(password, existing);

      const payload = {
        scope: 'custom',
        owner_id: auth.user.id,
        host: host ?? null,
        port: port ?? null,
        secure: secure !== undefined ? Boolean(secure) : true,
        username: username ?? null,
        from_name: fromName ?? null,
        from_email: fromEmail ?? null,
        enabled: Boolean(enabled),
        updated_by: auth.user.id,
        ...passwordField,
      };

      let row, error;
      if (existing) {
        ({ data: row, error } = await supabaseAdmin
          .from('smtp_configs')
          .update(payload)
          .eq('scope', 'custom')
          .eq('owner_id', auth.user.id)
          .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
          .maybeSingle());
      } else {
        ({ data: row, error } = await supabaseAdmin
          .from('smtp_configs')
          .insert(payload)
          .select('scope, host, port, secure, username, password_encrypted, from_name, from_email, enabled, updated_at')
          .maybeSingle());
      }

      if (error) throw error;
      res.json(toSafeShape(row));
    } catch (err) {
      console.error('[smtp] PUT /custom error:', err?.message);
      const status = err?.status ?? 500;
      const clientMsg = status >= 400 && status < 500 ? (err?.message ?? 'Ugyldig forespørgsel.') : 'Intern serverfejl.';
      res.status(status).json({ error: clientMsg });
    }
  });

  // ── POST /api/smtp/test-connection ────────────────────────────────────────
  router.post('/api/smtp/test-connection', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Ikke autoriseret.' });

    const { scope } = req.body;
    let ownerId = null;

    if (scope === 'global') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
    } else if (scope === 'custom') {
      const auth = await requireSubscriptionOwner(req, res);
      if (!auth) return;
      ownerId = user.id;
    } else {
      return res.status(400).json({ error: 'scope skal være "global" eller "custom".' });
    }

    try {
      const transportOptions = await resolveSmtpConfig({ supabaseAdmin, ownerId });
      if (!transportOptions) {
        return res.json({ ok: false, error: 'Ingen SMTP-konfiguration fundet.' });
      }
      const result = await verifyConnection(transportOptions);
      res.json(result);
    } catch (err) {
      console.error('[smtp] test-connection error:', err?.message);
      res.status(500).json({ ok: false, error: 'Intern serverfejl.' });
    }
  });

  // ── POST /api/smtp/send-test ───────────────────────────────────────────────
  router.post('/api/smtp/send-test', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Ikke autoriseret.' });

    const { scope } = req.body;
    let ownerId = null;
    let callerEmail = null;

    if (scope === 'global') {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
    } else if (scope === 'custom') {
      const auth = await requireSubscriptionOwner(req, res);
      if (!auth) return;
      ownerId = user.id;
      callerEmail = auth.profile.email;
    } else {
      return res.status(400).json({ error: 'scope skal være "global" eller "custom".' });
    }

    // Load caller's email for the global-admin case
    if (!callerEmail) {
      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle();
      callerEmail = profileRow?.email;
    }

    if (!callerEmail) {
      return res.status(400).json({ ok: false, error: 'Kunne ikke finde din e-mailadresse.' });
    }

    try {
      const transportOptions = await resolveSmtpConfig({ supabaseAdmin, ownerId });
      if (!transportOptions) {
        return res.json({ ok: false, error: 'Ingen SMTP-konfiguration fundet.' });
      }
      const result = await sendMail({
        transportOptions,
        to: callerEmail,
        subject: 'BygSmart – SMTP test',
        html: '<p>Dette er en testbesked fra BygSmart. Din SMTP-konfiguration fungerer korrekt.</p>',
        text: 'Dette er en testbesked fra BygSmart. Din SMTP-konfiguration fungerer korrekt.',
      });
      res.json(result);
    } catch (err) {
      console.error('[smtp] send-test error:', err?.message);
      res.status(500).json({ ok: false, error: 'Intern serverfejl.' });
    }
  });

  return router;
};
