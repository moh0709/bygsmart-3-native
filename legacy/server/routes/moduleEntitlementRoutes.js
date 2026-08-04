// ─────────────────────────────────────────────────────────────────────────────
// Module entitlement routes — server-authoritative per-module access for the
// BYG 3.0 modular monolith (Kernel, Phase 1).
//
// Mounted from server/index.js via:
//   app.use(createModuleEntitlementRouter({ supabaseAdmin, getAuthenticatedUser,
//                                           getAdminProfile, isProduction,
//                                           getEffectiveTier }))
//
// Endpoints:
//   GET  /api/modules/entitlements        — authenticated; effective module set
//   GET  /api/modules/entitlements/admin  — admin; raw global configs
//   PUT  /api/modules/entitlements/admin/:moduleId — admin; upsert a config
//
// Resolution lives in server/moduleCatalog.js (pure, unit-tested).
// Phase 3: org-aware — precedence is global kill-switch → grandfathered →
// org_module_entitlements row → tier map (org owner's tier) → fail-open.
// Enforcement is ON by default; MODULE_TIER_MAP_ENFORCED=false in the
// server env is the emergency override back to legacy all-on.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  MODULE_IDS,
  TIER_ORDER,
  DEFAULT_MIN_TIER,
  MODULE_PRICING,
  MODULE_NAMES,
  MODULE_REQUIRES,
  resolveModuleEntitlements,
} from '../moduleCatalog.js';

const CONFIG_CACHE_TTL_MS = 60_000;
const ORG_ENTITLEMENT_STATUSES = ['enabled', 'disabled', 'trial'];

export const createModuleEntitlementRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  getAdminProfile,
  isProduction,
  getEffectiveTier,
  isUuid,
  getStripeForUserType = null,
  enforceTierMap = process.env.MODULE_TIER_MAP_ENFORCED !== 'false',
}) => {
  const router = Router();

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isProduction ? 120 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ── Config cache (60s) ─────────────────────────────────────────────────────
  let configCache = { rows: null, fetchedAt: 0 };

  const loadConfigs = async (force = false) => {
    const now = Date.now();
    if (!force && configCache.rows && now - configCache.fetchedAt < CONFIG_CACHE_TTL_MS) {
      return configCache.rows;
    }
    const { data, error } = await supabaseAdmin
      .from('module_access_configs')
      .select('module_id, enabled, min_tier, note, updated_by, updated_at');
    if (error) throw new Error(`Kunne ikke hente modulkonfiguration: ${error.message}`);
    configCache = { rows: data || [], fetchedAt: now };
    return configCache.rows;
  };

  const invalidateConfigCache = () => {
    configCache = { rows: null, fetchedAt: 0 };
  };

  // Modules missing from `moduleId`'s requires-closure for this org — empty
  // when satisfied. `alsoGranting` lets a bulk grant (trial-all) treat its
  // own targets as already-satisfied prerequisites (atomic grant, no
  // chicken-and-egg block).
  const missingRequires = (moduleId, modules, alsoGranting = []) =>
    (MODULE_REQUIRES[moduleId] || []).filter(
      (reqId) => !modules[reqId]?.enabled && !alsoGranting.includes(reqId)
    );

  const requiresErrorMessage = (missing) =>
    `Kræver modulet ${missing.map((id) => MODULE_NAMES[id] || id).join(', ')} først.`;

  // Resolves the real Stripe SUBSCRIPTION id (sub_...) for a module row.
  // stripe_subscription_id is the column populated by the webhook going
  // forward; stripe_subscription_item_id (si_... — an older, differently-
  // named column, see migration 20260716000006) is a one-time fallback for
  // rows purchased before that column existed.
  const resolveModuleSubscriptionId = async (stripe, row) => {
    if (row.stripe_subscription_id) return row.stripe_subscription_id;
    if (!row.stripe_subscription_item_id) return null;
    try {
      const item = await stripe.subscriptionItems.retrieve(row.stripe_subscription_item_id);
      return item?.subscription ? String(item.subscription) : null;
    } catch {
      return null;
    }
  };

  // ── Auth helper (same contract as toolAccessRoutes) ───────────────────────
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

  // ── Org context for the caller ─────────────────────────────────────────────
  // active_org_id is column-guarded (moves only via set_active_org), but the
  // membership is re-verified here anyway (defense in depth). Returns
  // { org: {id, grandfathered}|null, orgRows, orgTier } — org null = fail-open.
  const loadOrgContext = async (userId, callerTier) => {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('active_org_id')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.active_org_id) return { org: null, orgRows: [], orgTier: callerTier };

    const { data: orgRow } = await supabaseAdmin
      .from('organizations')
      .select('id, grandfathered, created_by')
      .eq('id', profile.active_org_id)
      .maybeSingle();
    if (!orgRow) return { org: null, orgRows: [], orgTier: callerTier };

    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('org_id', orgRow.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return { org: null, orgRows: [], orgTier: callerTier };

    const { data: rows } = await supabaseAdmin
      .from('org_module_entitlements')
      .select('module_id, status, source, valid_until, stripe_subscription_id, stripe_subscription_item_id, cancel_at_period_end, current_period_end')
      .eq('org_id', orgRow.id);

    // The org's tier = its creator's effective tier (for team orgs that is
    // the leader, whose tier is the Stripe-backed one).
    let orgTier = callerTier;
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_tier, trial_tier, trial_ends_at')
      .eq('id', orgRow.created_by)
      .maybeSingle();
    if (ownerProfile) {
      orgTier = getEffectiveTier ? getEffectiveTier(ownerProfile) : (ownerProfile.subscription_tier ?? 'FREE');
    }

    return { org: orgRow, orgRows: rows || [], orgTier };
  };

  // ── GET /api/modules/entitlements ──────────────────────────────────────────
  // Effective module set for the authenticated user's ACTIVE ORG.
  // Shape: { orgId, grandfathered, modules: { [id]: { enabled, source, validUntil } }, source }
  router.get('/api/modules/entitlements', async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Login er påkrævet.' });
      return;
    }

    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, trial_tier, trial_ends_at')
        .eq('id', user.id)
        .single();

      const callerTier = getEffectiveTier ? getEffectiveTier(profile) : (profile?.subscription_tier ?? 'FREE');
      const [configs, orgContext] = await Promise.all([
        loadConfigs(),
        loadOrgContext(user.id, callerTier),
      ]);

      const { modules, source } = resolveModuleEntitlements({
        tier: orgContext.orgTier,
        configRows: configs,
        enforceTierMap,
        org: orgContext.org,
        orgRows: orgContext.orgRows,
      });

      res.json({
        orgId: orgContext.org?.id ?? null,
        grandfathered: !!orgContext.org?.grandfathered,
        modules,
        source,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente modulrettigheder.', details: isProduction ? undefined : message });
    }
  });

  // ── GET /api/modules/entitlements/admin ────────────────────────────────────
  // Admin: raw global configs (fresh read) + the canonical module id list so
  // the panel can render unconfigured modules too.
  router.get('/api/modules/entitlements/admin', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    try {
      const configs = await loadConfigs(true);
      res.json({ configs, moduleIds: MODULE_IDS, enforceTierMap });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente konfigurationer.', details: isProduction ? undefined : message });
    }
  });

  // ── GET /api/modules/entitlements/admin/orgs ───────────────────────────────
  // Admin: organizations for the per-org override selector.
  router.get('/api/modules/entitlements/admin/orgs', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    try {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('id, name, cvr, grandfathered, created_at')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      res.json({ orgs: data || [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin/orgs] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente organisationer.', details: isProduction ? undefined : message });
    }
  });

  // ── GET /api/modules/entitlements/admin/org/:orgId ─────────────────────────
  // Admin: an org's override rows.
  router.get('/api/modules/entitlements/admin/org/:orgId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { orgId } = req.params;
    if (!isUuid || !isUuid(orgId)) {
      res.status(400).json({ error: 'Ugyldigt organisations-id.' });
      return;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('org_module_entitlements')
        .select('module_id, status, source, valid_until, note, updated_at')
        .eq('org_id', orgId);
      if (error) throw new Error(error.message);
      res.json({ overrides: data || [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin/org GET] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente modulrettigheder.', details: isProduction ? undefined : message });
    }
  });

  // ── PUT /api/modules/entitlements/admin/org/:orgId/:moduleId ───────────────
  // Admin: upsert a per-org override.
  // Body: { status: 'enabled'|'disabled'|'trial', validUntil?: string|null, note?: string }
  // ── POST /api/modules/trial ────────────────────────────────────────────────
  // Self-serve 14-day trial for the caller's ACTIVE ORG (marketplace CTA).
  // Only the org's creator may start one, one row per module per org ever,
  // and never for grandfathered orgs (they already have everything).
  router.post('/api/modules/trial', adminLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke logget ind.' });
      return;
    }
    const wantAll = req.body?.all === true;
    const moduleId = req.body?.moduleId;
    if (!wantAll && !MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: `Ukendt modul-id: ${moduleId}.` });
      return;
    }
    try {
      const { org, orgRows, orgTier } = await loadOrgContext(user.id, 'FREE');
      if (!org) {
        res.status(400).json({ error: 'Ingen aktiv organisation fundet.' });
        return;
      }
      if (org.created_by !== user.id) {
        res.status(403).json({ error: 'Kun organisationens ejer kan starte en prøveperiode.' });
        return;
      }
      if (org.grandfathered) {
        res.status(400).json({ error: 'Din organisation har allerede fuld adgang.' });
        return;
      }
      // Paid modules only; a module with any existing row keeps its history
      // (one trial per module per org, ever). Expired trials fall through to
      // the tier map in resolution, so bulk trials can never lock a module
      // below what the org's tier grants.
      const hasRow = (id) => (orgRows || []).some((r) => r.module_id === id);
      const targets = wantAll
        ? MODULE_IDS.filter((id) => (DEFAULT_MIN_TIER[id] || 'FREE') !== 'FREE' && !hasRow(id))
        : [moduleId];
      // Single-module trial must satisfy requires; a bulk "try all" grants its
      // own closure atomically, so it's exempt (nothing left ungranted to block on).
      if (!wantAll) {
        const configs = await loadConfigs();
        const { modules } = resolveModuleEntitlements({
          tier: orgTier,
          configRows: configs,
          enforceTierMap,
          org,
          orgRows,
        });
        const missing = missingRequires(moduleId, modules);
        if (missing.length > 0) {
          res.status(409).json({ error: requiresErrorMessage(missing) });
          return;
        }
      }
      if (!wantAll && hasRow(moduleId)) {
        const existing = (orgRows || []).find((r) => r.module_id === moduleId);
        res.status(409).json({
          error: existing.status === 'trial'
            ? 'Prøveperioden for dette modul er allerede brugt.'
            : 'Modulet har allerede en rettighed på din organisation.',
        });
        return;
      }
      if (targets.length === 0) {
        res.status(409).json({ error: 'Der er ingen moduler tilbage at prøve — alle har allerede en rettighed.' });
        return;
      }
      const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();
      // insert (not upsert): a second attempt must fail, one trial per module ever.
      const { data, error } = await supabaseAdmin
        .from('org_module_entitlements')
        .insert(targets.map((id) => ({
          org_id: org.id,
          module_id: id,
          status: 'trial',
          source: 'trial',
          valid_until: validUntil,
          updated_by: user.id,
          updated_at: nowIso,
          note: wantAll ? 'Selvbetjent prøveperiode (marketplace, prøv alle)' : 'Selvbetjent prøveperiode (marketplace)',
        })))
        .select();
      if (error) throw new Error(error.message);
      const trials = (data || []).map((d) => ({ moduleId: d.module_id, validUntil: d.valid_until }));
      res.json({ trial: trials.length === 1 ? trials[0] : null, trials });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/trial] error:', message);
      res.status(500).json({ error: 'Kunne ikke starte prøveperioden.', details: isProduction ? undefined : message });
    }
  });

  // ── POST /api/storage/checkout ─────────────────────────────────────────────
  // Extra org storage: 25 kr per GB per month (base allowance is 5 GB).
  // Quantity-based Stripe subscription; the webhook syncs
  // organizations.storage_allowance_gb = 5 + quantity on subscription events.
  router.post('/api/storage/checkout', adminLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke logget ind.' });
      return;
    }
    const extraGb = Number.parseInt(req.body?.extraGb, 10);
    if (!Number.isInteger(extraGb) || extraGb < 1 || extraGb > 500) {
      res.status(400).json({ error: 'Vælg mellem 1 og 500 GB ekstra plads.' });
      return;
    }
    if (typeof getStripeForUserType !== 'function') {
      res.status(500).json({ error: 'Betaling er ikke konfigureret på serveren.' });
      return;
    }
    try {
      const { org } = await loadOrgContext(user.id, 'FREE');
      if (!org) {
        res.status(400).json({ error: 'Ingen aktiv organisation fundet.' });
        return;
      }
      if (org.created_by !== user.id) {
        res.status(403).json({ error: 'Kun organisationens ejer kan købe lagerplads.' });
        return;
      }
      const { data: orgRow } = await supabaseAdmin
        .from('organizations')
        .select('storage_subscription_id')
        .eq('id', org.id)
        .maybeSingle();
      if (orgRow?.storage_subscription_id) {
        res.status(409).json({ error: 'Organisationen har allerede et lagerplads-abonnement — administrér det i abonnementsportalen.' });
        return;
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, stripe_customer_id, user_type')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError || !profile) {
        res.status(404).json({ error: 'Brugerprofil blev ikke fundet.' });
        return;
      }
      const stripe = getStripeForUserType(profile.user_type);
      if (!stripe) {
        res.status(500).json({ error: 'Stripe er ikke konfigureret for din brugertype.' });
        return;
      }

      const lookupKey = 'bygsmart_lagerplads_dkk_gb_mdr';
      const priceList = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      let price = priceList.data[0] ?? null;
      if (!price) {
        const product = await stripe.products.create({
          name: 'BygSmart — Ekstra lagerplads (pr. GB)',
          metadata: { bygsmart_addon: 'storage' },
        });
        price = await stripe.prices.create({
          product: product.id,
          currency: 'dkk',
          unit_amount: 2500,
          recurring: { interval: 'month' },
          lookup_key: lookupKey,
          metadata: { bygsmart_addon: 'storage' },
        });
      }

      let customerId = profile.stripe_customer_id;
      if (customerId) {
        try {
          const existingCustomer = await stripe.customers.retrieve(customerId);
          if (existingCustomer?.deleted) customerId = null;
        } catch (err) {
          if (err?.code === 'resource_missing') customerId = null;
          else throw err;
        }
      }
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: profile.email ?? undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      const origin = process.env.ALLOWED_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000';
      const meta = { kind: 'storage', user_id: user.id, org_id: org.id, extra_gb: String(extraGb) };
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.id, quantity: extraGb }],
        success_url: `${origin}/#/moduler?storage=success`,
        cancel_url: `${origin}/#/moduler?storage=cancelled`,
        metadata: meta,
        subscription_data: {
          description: `BygSmart ekstra lagerplads: ${extraGb} GB`,
          metadata: meta,
        },
        billing_address_collection: 'auto',
      });
      res.status(200).json({ url: session.url, id: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/storage/checkout] error:', message);
      res.status(502).json({ error: 'Kunne ikke oprette betaling. Prøv igen om lidt.', details: isProduction ? undefined : message });
    }
  });

  // ── POST /api/modules/checkout ─────────────────────────────────────────────
  // Per-module Stripe purchase (Phase 8): creates a subscription Checkout
  // Session for the caller's ACTIVE ORG. Products/prices are found-or-created
  // by lookup_key so the Stripe catalog self-assembles from MODULE_PRICING.
  // The entitlement row is written by the stripe-webhook edge function on
  // checkout.session.completed / subscription events (source='purchase').
  router.post('/api/modules/checkout', adminLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke logget ind.' });
      return;
    }
    const moduleId = req.body?.moduleId;
    const pricing = MODULE_PRICING[moduleId];
    if (!MODULE_IDS.includes(moduleId) || !pricing) {
      res.status(400).json({ error: `Modulet kan ikke købes: ${moduleId}.` });
      return;
    }
    if (typeof getStripeForUserType !== 'function') {
      res.status(500).json({ error: 'Betaling er ikke konfigureret på serveren.' });
      return;
    }
    try {
      const { org, orgRows, orgTier } = await loadOrgContext(user.id, 'FREE');
      if (!org) {
        res.status(400).json({ error: 'Ingen aktiv organisation fundet.' });
        return;
      }
      if (org.created_by !== user.id) {
        res.status(403).json({ error: 'Kun organisationens ejer kan købe moduler.' });
        return;
      }
      if (org.grandfathered) {
        res.status(400).json({ error: 'Din organisation har allerede fuld adgang.' });
        return;
      }
      const existing = (orgRows || []).find((r) => r.module_id === moduleId);
      if (existing && existing.source === 'purchase' && existing.status === 'enabled') {
        res.status(409).json({ error: 'Modulet er allerede købt.' });
        return;
      }
      {
        const configs = await loadConfigs();
        const { modules } = resolveModuleEntitlements({
          tier: orgTier,
          configRows: configs,
          enforceTierMap,
          org,
          orgRows,
        });
        const missing = missingRequires(moduleId, modules);
        if (missing.length > 0) {
          res.status(409).json({ error: requiresErrorMessage(missing) });
          return;
        }
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, stripe_customer_id, user_type')
        .eq('id', user.id)
        .maybeSingle();
      if (profileError || !profile) {
        res.status(404).json({ error: 'Brugerprofil blev ikke fundet.' });
        return;
      }
      // Same mode rules as tier checkout: demo/test users -> test Stripe.
      const stripe = getStripeForUserType(profile.user_type);
      if (!stripe) {
        res.status(500).json({ error: 'Stripe er ikke konfigureret for din brugertype.' });
        return;
      }

      // Find-or-create the module's recurring price by lookup_key.
      const lookupKey = `bygsmart_modul_${moduleId}_dkk_mdr`;
      const priceList = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
      let price = priceList.data[0] ?? null;
      if (!price) {
        const product = await stripe.products.create({
          name: `BygSmart modul — ${pricing.name}`,
          metadata: { bygsmart_module_id: moduleId },
        });
        price = await stripe.prices.create({
          product: product.id,
          currency: 'dkk',
          unit_amount: pricing.priceKr * 100,
          recurring: { interval: 'month' },
          lookup_key: lookupKey,
          metadata: { bygsmart_module_id: moduleId },
        });
      }

      // Customer find/create, verified against THIS Stripe mode (same pattern
      // as billingRoutes — a customer id from the other mode is discarded).
      let customerId = profile.stripe_customer_id;
      if (customerId) {
        try {
          const existingCustomer = await stripe.customers.retrieve(customerId);
          if (existingCustomer?.deleted) customerId = null;
        } catch (err) {
          if (err?.code === 'resource_missing') customerId = null;
          else throw err;
        }
      }
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: profile.email ?? undefined,
          metadata: { user_id: user.id },
        });
        customerId = customer.id;
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      const origin = process.env.ALLOWED_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000';
      const meta = { kind: 'module', user_id: user.id, org_id: org.id, module_id: moduleId };
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${origin}/#/moduler/${moduleId}?checkout=success`,
        cancel_url: `${origin}/#/moduler/${moduleId}?checkout=cancelled`,
        metadata: meta,
        subscription_data: {
          description: `BygSmart modul: ${pricing.name}`,
          metadata: meta,
        },
        billing_address_collection: 'auto',
      });
      res.status(200).json({ url: session.url, id: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/checkout] error:', message);
      res.status(502).json({ error: 'Kunne ikke oprette betaling. Prøv igen om lidt.', details: isProduction ? undefined : message });
    }
  });

  // ── POST /api/modules/:moduleId/cancel ─────────────────────────────────────
  // Native in-app graceful cancel: sets cancel_at_period_end on the module's
  // Stripe subscription — access continues until the paid period ends. The
  // webhook's existing moduleCanceled branch removes the entitlement row once
  // Stripe actually ends the subscription (status -> canceled / .deleted).
  // This call also writes the two scheduling columns immediately so the UI
  // reflects it without waiting on the webhook round-trip. Org-owner only,
  // purchase-sourced rows only (trial/admin-granted modules have no
  // subscription to cancel — "Administrér abonnement" -> Stripe portal covers
  // payment-method/invoice needs for those and remains untouched).
  router.post('/api/modules/:moduleId/cancel', adminLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke logget ind.' });
      return;
    }
    const { moduleId } = req.params;
    if (!MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: `Ukendt modul-id: ${moduleId}.` });
      return;
    }
    if (typeof getStripeForUserType !== 'function') {
      res.status(500).json({ error: 'Betaling er ikke konfigureret på serveren.' });
      return;
    }
    try {
      const { org, orgRows } = await loadOrgContext(user.id, 'FREE');
      if (!org) {
        res.status(400).json({ error: 'Ingen aktiv organisation fundet.' });
        return;
      }
      if (org.created_by !== user.id) {
        res.status(403).json({ error: 'Kun organisationens ejer kan annullere moduler.' });
        return;
      }
      const row = (orgRows || []).find((r) => r.module_id === moduleId);
      if (!row || row.source !== 'purchase' || row.status !== 'enabled') {
        res.status(404).json({ error: 'Modulet har ikke et aktivt køb at annullere.' });
        return;
      }
      if (row.cancel_at_period_end) {
        res.status(409).json({ error: 'Modulet er allerede sat til at ophøre.' });
        return;
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();
      const stripe = getStripeForUserType(profile?.user_type);
      if (!stripe) {
        res.status(500).json({ error: 'Stripe er ikke konfigureret for din brugertype.' });
        return;
      }

      const subscriptionId = await resolveModuleSubscriptionId(stripe, row);
      if (!subscriptionId) {
        res.status(404).json({ error: 'Kunne ikke finde et Stripe-abonnement for modulet.' });
        return;
      }

      const subscription = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      const { error: updateError } = await supabaseAdmin
        .from('org_module_entitlements')
        .update({
          stripe_subscription_id: subscriptionId,
          cancel_at_period_end: true,
          current_period_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', org.id)
        .eq('module_id', moduleId);
      if (updateError) throw new Error(updateError.message);

      res.json({ ok: true, cancelAtPeriodEnd: true, currentPeriodEnd });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/:moduleId/cancel] error:', message);
      res.status(502).json({ error: 'Kunne ikke annullere modulet. Prøv igen om lidt.', details: isProduction ? undefined : message });
    }
  });

  // ── POST /api/modules/:moduleId/reactivate ──────────────────────────────────
  // Undo a pending graceful cancellation (before the period actually ends).
  router.post('/api/modules/:moduleId/reactivate', adminLimiter, async (req, res) => {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Ikke logget ind.' });
      return;
    }
    const { moduleId } = req.params;
    if (!MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: `Ukendt modul-id: ${moduleId}.` });
      return;
    }
    if (typeof getStripeForUserType !== 'function') {
      res.status(500).json({ error: 'Betaling er ikke konfigureret på serveren.' });
      return;
    }
    try {
      const { org, orgRows } = await loadOrgContext(user.id, 'FREE');
      if (!org) {
        res.status(400).json({ error: 'Ingen aktiv organisation fundet.' });
        return;
      }
      if (org.created_by !== user.id) {
        res.status(403).json({ error: 'Kun organisationens ejer kan fortryde en opsigelse.' });
        return;
      }
      const row = (orgRows || []).find((r) => r.module_id === moduleId);
      if (!row || row.source !== 'purchase' || row.status !== 'enabled' || !row.cancel_at_period_end) {
        res.status(404).json({ error: 'Modulet har ikke en igangværende opsigelse at fortryde.' });
        return;
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();
      const stripe = getStripeForUserType(profile?.user_type);
      if (!stripe) {
        res.status(500).json({ error: 'Stripe er ikke konfigureret for din brugertype.' });
        return;
      }

      const subscriptionId = await resolveModuleSubscriptionId(stripe, row);
      if (!subscriptionId) {
        res.status(404).json({ error: 'Kunne ikke finde et Stripe-abonnement for modulet.' });
        return;
      }

      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });

      const { error: updateError } = await supabaseAdmin
        .from('org_module_entitlements')
        .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
        .eq('org_id', org.id)
        .eq('module_id', moduleId);
      if (updateError) throw new Error(updateError.message);

      res.json({ ok: true, cancelAtPeriodEnd: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/:moduleId/reactivate] error:', message);
      res.status(502).json({ error: 'Kunne ikke fortryde opsigelsen. Prøv igen om lidt.', details: isProduction ? undefined : message });
    }
  });

  router.put('/api/modules/entitlements/admin/org/:orgId/:moduleId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { orgId, moduleId } = req.params;
    if (!isUuid || !isUuid(orgId)) {
      res.status(400).json({ error: 'Ugyldigt organisations-id.' });
      return;
    }
    if (!MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: `Ukendt modul-id: ${moduleId}.` });
      return;
    }

    const body = req.body || {};
    if (!ORG_ENTITLEMENT_STATUSES.includes(body.status)) {
      res.status(400).json({ error: `Ugyldig status: ${body.status}. Tilladt: ${ORG_ENTITLEMENT_STATUSES.join(', ')}.` });
      return;
    }
    if (body.status === 'trial') {
      const until = body.validUntil ? new Date(body.validUntil) : null;
      if (!until || isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        res.status(400).json({ error: 'validUntil skal være en gyldig fremtidig dato for prøveperioder.' });
        return;
      }
    }

    const update = {
      org_id: orgId,
      module_id: moduleId,
      status: body.status,
      source: body.status === 'trial' ? 'trial' : 'admin',
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (body.validUntil !== undefined) update.valid_until = body.validUntil || null;
    if (typeof body.note === 'string') update.note = body.note.slice(0, 500) || null;

    try {
      const { data, error } = await supabaseAdmin
        .from('org_module_entitlements')
        .upsert(update, { onConflict: 'org_id,module_id' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      res.json({ override: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin/org PUT] error:', message);
      res.status(500).json({ error: 'Kunne ikke gemme rettigheden.', details: isProduction ? undefined : message });
    }
  });

  // ── DELETE /api/modules/entitlements/admin/org/:orgId/:moduleId ────────────
  // Admin: clear a per-org override (back to grandfathered/tier resolution).
  router.delete('/api/modules/entitlements/admin/org/:orgId/:moduleId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { orgId, moduleId } = req.params;
    if (!isUuid || !isUuid(orgId) || !MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: 'Ugyldige parametre.' });
      return;
    }

    try {
      const { error } = await supabaseAdmin
        .from('org_module_entitlements')
        .delete()
        .eq('org_id', orgId)
        .eq('module_id', moduleId);
      if (error) throw new Error(error.message);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin/org DELETE] error:', message);
      res.status(500).json({ error: 'Kunne ikke fjerne rettigheden.', details: isProduction ? undefined : message });
    }
  });

  // ── PUT /api/modules/entitlements/admin/:moduleId ──────────────────────────
  // Admin: upsert a global module config.
  // Body: { enabled?: boolean, minTier?: string|null, note?: string }
  router.put('/api/modules/entitlements/admin/:moduleId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { moduleId } = req.params;
    if (!MODULE_IDS.includes(moduleId)) {
      res.status(400).json({ error: `Ukendt modul-id: ${moduleId}. Gyldige: ${MODULE_IDS.join(', ')}.` });
      return;
    }

    const body = req.body || {};

    if (body.minTier !== undefined && body.minTier !== null && !TIER_ORDER.includes(body.minTier)) {
      res.status(400).json({ error: `Ugyldigt minimum-tier: ${body.minTier}. Tilladt: ${TIER_ORDER.join(', ')}.` });
      return;
    }
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled skal være true eller false.' });
      return;
    }

    const update = {
      module_id: moduleId,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (body.enabled !== undefined) update.enabled = body.enabled;
    if (body.minTier !== undefined) update.min_tier = body.minTier;
    if (typeof body.note === 'string') update.note = body.note.slice(0, 500) || null;

    try {
      const { data, error } = await supabaseAdmin
        .from('module_access_configs')
        .upsert(update, { onConflict: 'module_id' })
        .select()
        .single();
      if (error) throw new Error(error.message);

      invalidateConfigCache();
      res.json({ config: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/modules/entitlements/admin PUT] error:', message);
      res.status(500).json({ error: 'Kunne ikke gemme konfigurationen.', details: isProduction ? undefined : message });
    }
  });

  return router;
};
