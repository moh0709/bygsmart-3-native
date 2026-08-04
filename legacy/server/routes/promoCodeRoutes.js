// ─────────────────────────────────────────────────────────────────────────────
// Promo code management — discount codes (Stripe) + free-trial codes (app).
//
// Mounted from server/index.js via:
//   app.use(createPromoCodeRouter({ getStripe, supabaseAdmin,
//                                   getAuthenticatedUser, ensureAdmin, sensitiveLimiter }))
//
// Discount codes are Stripe Coupons + Promotion Codes, managed in LIVE mode
// (real customer checkouts). Trial codes are app-managed rows in public.trial_codes
// and are applied to the Checkout Session's trial params by billingRoutes.js.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

const normalizeCode = (code) =>
  typeof code === 'string' ? code.trim().toUpperCase().replace(/\s+/g, '') : '';

const toUnix = (dateish) => {
  if (!dateish) return undefined;
  const t = new Date(dateish).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
};

export const createPromoCodeRouter = ({
  getStripe,
  supabaseAdmin,
  getAuthenticatedUser,
  ensureAdmin,
  sensitiveLimiter,
}) => {
  const router = Router();

  // Discount codes live in the real (LIVE) Stripe account customers check out in.
  const liveStripe = () => getStripe('live') || null;

  // ── Discount codes (Stripe) ────────────────────────────────────────────────

  router.get('/api/admin/discount-codes', async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;
    const stripe = liveStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Live Stripe er ikke konfigureret på serveren.' });
      return;
    }
    try {
      const list = await stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] });
      const codes = list.data.map((pc) => ({
        id: pc.id,
        code: pc.code,
        active: pc.active,
        percentOff: pc.coupon?.percent_off ?? null,
        amountOff: pc.coupon?.amount_off ?? null,
        currency: pc.coupon?.currency ?? null,
        duration: pc.coupon?.duration ?? null,
        durationInMonths: pc.coupon?.duration_in_months ?? null,
        expiresAt: pc.expires_at ? new Date(pc.expires_at * 1000).toISOString() : null,
        maxRedemptions: pc.max_redemptions ?? null,
        timesRedeemed: pc.times_redeemed ?? 0,
      }));
      res.json({ codes });
    } catch (err) {
      console.error('[discount-codes:list]', err?.message ?? err);
      res.status(502).json({ error: 'Kunne ikke hente rabatkoder fra Stripe.' });
    }
  });

  router.post('/api/admin/discount-codes', sensitiveLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;
    const stripe = liveStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Live Stripe er ikke konfigureret på serveren.' });
      return;
    }

    const code = normalizeCode(req.body?.code);
    const percentOff = Number(req.body?.percentOff);
    const duration = req.body?.duration; // 'once' | 'repeating' | 'forever'
    const durationInMonths = req.body?.durationInMonths ? Number(req.body.durationInMonths) : undefined;
    const expiresAt = toUnix(req.body?.expiresAt);
    const maxRedemptions = req.body?.maxRedemptions ? Number(req.body.maxRedemptions) : undefined;

    if (!/^[A-Z0-9]{3,40}$/.test(code)) {
      res.status(400).json({ error: 'Koden må kun indeholde A–Z og 0–9 (3–40 tegn).' });
      return;
    }
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      res.status(400).json({ error: 'Rabatprocent skal være mellem 1 og 100.' });
      return;
    }
    if (!['once', 'repeating', 'forever'].includes(duration)) {
      res.status(400).json({ error: 'Ugyldig varighed.' });
      return;
    }
    if (duration === 'repeating' && (!Number.isInteger(durationInMonths) || durationInMonths < 1)) {
      res.status(400).json({ error: 'Antal måneder skal angives for "gentages".' });
      return;
    }

    try {
      const coupon = await stripe.coupons.create({
        percent_off: percentOff,
        duration,
        ...(duration === 'repeating' ? { duration_in_months: durationInMonths } : {}),
        name: code,
      });
      const promo = await stripe.promotionCodes.create({
        coupon: coupon.id,
        code,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
      });
      res.status(201).json({ id: promo.id, code: promo.code });
    } catch (err) {
      console.error('[discount-codes:create]', err?.message ?? err);
      const msg = err?.raw?.message || err?.message || 'Kunne ikke oprette rabatkode.';
      res.status(400).json({ error: msg });
    }
  });

  router.post('/api/admin/discount-codes/:promoId/deactivate', sensitiveLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;
    const stripe = liveStripe();
    if (!stripe) {
      res.status(503).json({ error: 'Live Stripe er ikke konfigureret på serveren.' });
      return;
    }
    try {
      await stripe.promotionCodes.update(req.params.promoId, { active: false });
      res.json({ ok: true });
    } catch (err) {
      console.error('[discount-codes:deactivate]', err?.message ?? err);
      res.status(400).json({ error: 'Kunne ikke deaktivere rabatkode.' });
    }
  });

  // ── Trial codes (app-managed) ──────────────────────────────────────────────

  router.get('/api/admin/trial-codes', async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;
    const { data, error } = await supabaseAdmin
      .from('trial_codes')
      .select('id, code, trial_days, trial_until, max_redemptions, redeemed_count, expires_at, active, note, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[trial-codes:list]', error.message);
      res.status(500).json({ error: 'Kunne ikke hente prøvekoder.' });
      return;
    }
    res.json({ codes: data ?? [] });
  });

  router.post('/api/admin/trial-codes', sensitiveLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;

    const code = normalizeCode(req.body?.code);
    const trialDays = req.body?.trialDays != null && req.body.trialDays !== '' ? Number(req.body.trialDays) : null;
    const trialUntil = req.body?.trialUntil || null;
    const maxRedemptions = req.body?.maxRedemptions ? Number(req.body.maxRedemptions) : null;
    const expiresAt = req.body?.expiresAt || null;
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : null;

    if (!/^[A-Z0-9]{3,40}$/.test(code)) {
      res.status(400).json({ error: 'Koden må kun indeholde A–Z og 0–9 (3–40 tegn).' });
      return;
    }
    const hasDays = trialDays != null && Number.isFinite(trialDays);
    const hasUntil = !!trialUntil;
    if (hasDays === hasUntil) {
      res.status(400).json({ error: 'Angiv enten antal dage ELLER en slutdato — ikke begge.' });
      return;
    }
    if (hasDays && (trialDays < 1 || trialDays > 365)) {
      res.status(400).json({ error: 'Antal dage skal være mellem 1 og 365.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('trial_codes')
      .insert({
        code,
        trial_days: hasDays ? trialDays : null,
        trial_until: hasUntil ? new Date(trialUntil).toISOString() : null,
        max_redemptions: maxRedemptions && maxRedemptions > 0 ? maxRedemptions : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        note,
        created_by: admin.id,
      })
      .select('id, code')
      .maybeSingle();

    if (error) {
      const msg = error.code === '23505' ? 'Koden findes allerede.' : 'Kunne ikke oprette prøvekode.';
      res.status(400).json({ error: msg });
      return;
    }
    res.status(201).json(data);
  });

  router.post('/api/admin/trial-codes/:id/deactivate', sensitiveLimiter, async (req, res) => {
    const admin = await ensureAdmin(req, res);
    if (!admin) return;
    const { error } = await supabaseAdmin
      .from('trial_codes')
      .update({ active: false })
      .eq('id', req.params.id);
    if (error) {
      res.status(400).json({ error: 'Kunne ikke deaktivere prøvekode.' });
      return;
    }
    res.json({ ok: true });
  });

  // ── Trial code validation (any authenticated user, pre-checkout) ────────────

  router.post('/api/trial-code/validate', sensitiveLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke autoriseret.' });
      return;
    }
    const code = normalizeCode(req.body?.code);
    if (!code) {
      res.json({ valid: false, reason: 'Indtast en kode.' });
      return;
    }
    const result = await resolveTrialCode(supabaseAdmin, code);
    if (!result.valid) {
      res.json({ valid: false, reason: result.reason });
      return;
    }
    res.json({
      valid: true,
      trialDays: result.row.trial_days,
      trialUntil: result.row.trial_until,
    });
  });

  return router;
};

// Shared resolver — used by the validate endpoint and by billingRoutes.js at
// checkout. Returns { valid, row } or { valid:false, reason }.
export async function resolveTrialCode(supabaseAdmin, rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { valid: false, reason: 'Indtast en kode.' };
  const { data: row } = await supabaseAdmin
    .from('trial_codes')
    .select('id, code, trial_days, trial_until, max_redemptions, redeemed_count, expires_at, active')
    .eq('code', code)
    .maybeSingle();
  if (!row || !row.active) return { valid: false, reason: 'Ukendt eller inaktiv kode.' };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, reason: 'Koden er udløbet.' };
  }
  if (row.trial_until && new Date(row.trial_until).getTime() < Date.now()) {
    return { valid: false, reason: 'Kodens prøveperiode er allerede udløbet.' };
  }
  if (row.max_redemptions != null && row.redeemed_count >= row.max_redemptions) {
    return { valid: false, reason: 'Koden er opbrugt.' };
  }
  return { valid: true, row };
}
