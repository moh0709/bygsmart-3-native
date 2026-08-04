// ─────────────────────────────────────────────────────────────────────────────
// Tool access routes — server-side campaign/pro gating for calculator tools.
//
// Mounted from server/index.js via:
//   app.use(createToolAccessRouter({ supabaseAdmin, getAuthenticatedUser,
//                                    getAdminProfile, isProduction }))
//
// Endpoints:
//   GET  /api/tools/access        — authenticated; effective access map for caller
//   GET  /api/tools/access/admin  — admin; raw configs merged with tool registry
//   PUT  /api/tools/access/admin/:toolId — admin; upsert a tool config
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';

// Legacy Pro-gated tool IDs — canonical IDs matching listCalculators() in calculatorCatalog.
const LEGACY_PRO_TOOL_IDS = [
  'lofter-tag-spaer-estimat',
  'statiske-beregninger-bjaelkebelastning',
  'statiske-beregninger-soejlebelastning',
  'energi-klima-varmetab',
  'energi-klima-co2',
];

const CONFIG_CACHE_TTL_MS = 60_000;

export const createToolAccessRouter = ({
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

  // ── Config cache (60s) ─────────────────────────────────────────────────────
  let configCache = { rows: null, fetchedAt: 0 };

  const loadConfigs = async (force = false) => {
    const now = Date.now();
    if (!force && configCache.rows && now - configCache.fetchedAt < CONFIG_CACHE_TTL_MS) {
      return configCache.rows;
    }
    const { data, error } = await supabaseAdmin
      .from('tool_access_configs')
      .select('tool_id, access_level, campaign_until, advanced_access_level, advanced_campaign_until, note, updated_by, updated_at');
    if (error) throw new Error(`Kunne ikke hente adgangskonfiguration: ${error.message}`);
    configCache = { rows: data || [], fetchedAt: now };
    return configCache.rows;
  };

  const invalidateConfigCache = () => {
    configCache = { rows: null, fetchedAt: 0 };
  };

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

  // ── Resolve effective access for a single config row ──────────────────────
  // Returns: { allowed: boolean, reason: string, campaignUntil: string|null }
  // defaultLevel: 'pro' | 'free' — the tool's legacy default when no active override applies.
  const resolveAccess = (row, isPro, defaultLevel = 'free', now = Date.now()) => {
    if (!row) {
      if (defaultLevel === 'pro') {
        return { allowed: isPro, reason: isPro ? 'pro' : 'pro-locked', campaignUntil: null };
      }
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    const level = row.access_level;

    if (level === 'free') {
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    if (level === 'campaign') {
      const until = row.campaign_until ? new Date(row.campaign_until).getTime() : 0;
      if (until > now) {
        return { allowed: true, reason: 'campaign', campaignUntil: row.campaign_until };
      }
      // Campaign expired — revert to the tool's legacy default
      if (defaultLevel === 'pro') {
        return { allowed: isPro, reason: isPro ? 'pro' : 'pro-locked', campaignUntil: null };
      }
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    // level === 'pro'
    return {
      allowed: isPro,
      reason: isPro ? 'pro' : 'pro-locked',
      campaignUntil: null,
    };
  };

  const resolveAdvancedAccess = (row, isPro, defaultLevel = 'free', now = Date.now()) => {
    if (!row) {
      if (defaultLevel === 'pro') {
        return { allowed: isPro, reason: isPro ? 'pro' : 'pro-locked', campaignUntil: null };
      }
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    const advLevel = row.advanced_access_level === 'inherit' ? row.access_level : row.advanced_access_level;

    if (advLevel === 'free') {
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    if (advLevel === 'campaign') {
      const until = row.advanced_campaign_until
        ? new Date(row.advanced_campaign_until).getTime()
        : row.campaign_until
          ? new Date(row.campaign_until).getTime()
          : 0;
      if (until > now) {
        return { allowed: true, reason: 'campaign', campaignUntil: row.advanced_campaign_until || row.campaign_until };
      }
      // Advanced campaign expired — revert to the tool's legacy default
      if (defaultLevel === 'pro') {
        return { allowed: isPro, reason: isPro ? 'pro' : 'pro-locked', campaignUntil: null };
      }
      return { allowed: true, reason: 'free', campaignUntil: null };
    }

    // advLevel === 'pro'
    return {
      allowed: isPro,
      reason: isPro ? 'pro' : 'pro-locked',
      campaignUntil: null,
    };
  };

  // ── GET /api/tools/access ─────────────────────────────────────────────────
  // Returns effective access map for the authenticated user.
  // Shape: { toolId: { allowed, advancedAllowed, reason, campaignUntil } }
  router.get('/api/tools/access', async (req, res) => {
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
      // Fetch user subscription tier (and any active admin-granted trial) to
      // determine Pro status.
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier, trial_tier, trial_ends_at')
        .eq('id', user.id)
        .single();

      const tier = getEffectiveTier ? getEffectiveTier(profile) : (profile?.subscription_tier ?? 'FREE');
      const isPro = ['PRO', 'PREMIUM', 'ENTERPRISE'].includes(tier);

      const configs = await loadConfigs();
      const now = Date.now();

      // If no configs, emit legacy defaults using canonical IDs
      if (configs.length === 0) {
        const accessMap = {};
        for (const toolId of LEGACY_PRO_TOOL_IDS) {
          accessMap[toolId] = {
            allowed: isPro,
            advancedAllowed: isPro,
            reason: isPro ? 'pro' : 'pro-locked',
            advancedReason: isPro ? 'pro' : 'pro-locked',
            campaignUntil: null,
            advancedCampaignUntil: null,
          };
        }
        res.json({ accessMap, source: 'legacy' });
        return;
      }

      const configByTool = new Map(configs.map((c) => [c.tool_id, c]));

      // Collect all tool IDs (from DB + legacy)
      const allToolIds = new Set([...configByTool.keys(), ...LEGACY_PRO_TOOL_IDS]);
      const accessMap = {};

      for (const toolId of allToolIds) {
        const row = configByTool.get(toolId) ?? null;
        const defaultLevel = LEGACY_PRO_TOOL_IDS.includes(toolId) ? 'pro' : 'free';
        const basic = resolveAccess(row, isPro, defaultLevel, now);
        const advanced = resolveAdvancedAccess(row, isPro, defaultLevel, now);

        accessMap[toolId] = {
          allowed: basic.allowed,
          advancedAllowed: advanced.allowed,
          reason: basic.reason,
          advancedReason: advanced.reason,
          campaignUntil: basic.campaignUntil,
          advancedCampaignUntil: advanced.campaignUntil,
        };
      }

      res.json({ accessMap, source: 'db' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/tools/access] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente adgangsdata.', details: isProduction ? undefined : message });
    }
  });

  // ── GET /api/tools/access/admin ───────────────────────────────────────────
  // Admin: raw configs merged with registry metadata.
  router.get('/api/tools/access/admin', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    try {
      const configs = await loadConfigs(true);
      res.json({ configs });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/tools/access/admin] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente konfigurationer.', details: isProduction ? undefined : message });
    }
  });

  // ── PUT /api/tools/access/admin/:toolId ──────────────────────────────────
  // Admin: upsert a tool access config.
  // Body: { accessLevel, campaignUntil?, advancedAccessLevel?, advancedCampaignUntil?, note? }
  router.put('/api/tools/access/admin/:toolId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const { toolId } = req.params;
    if (!toolId || typeof toolId !== 'string' || toolId.trim() === '') {
      res.status(400).json({ error: 'Ugyldig tool-id.' });
      return;
    }

    const body = req.body || {};
    const validLevels = ['free', 'pro', 'campaign'];
    const validAdvancedLevels = ['free', 'pro', 'campaign', 'inherit'];

    const accessLevel = typeof body.accessLevel === 'string' ? body.accessLevel : null;
    const advancedAccessLevel = typeof body.advancedAccessLevel === 'string' ? body.advancedAccessLevel : null;

    if (accessLevel && !validLevels.includes(accessLevel)) {
      res.status(400).json({ error: `Ugyldig adgangsniveau: ${accessLevel}. Tilladt: ${validLevels.join(', ')}.` });
      return;
    }
    if (advancedAccessLevel && !validAdvancedLevels.includes(advancedAccessLevel)) {
      res.status(400).json({ error: `Ugyldig avanceret adgangsniveau: ${advancedAccessLevel}.` });
      return;
    }

    // Validate campaign dates are in the future
    if (accessLevel === 'campaign') {
      const until = body.campaignUntil ? new Date(body.campaignUntil) : null;
      if (!until || isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        res.status(400).json({ error: 'campaignUntil skal være en gyldig fremtidig dato.' });
        return;
      }
    }
    if (advancedAccessLevel === 'campaign') {
      const until = body.advancedCampaignUntil ? new Date(body.advancedCampaignUntil) : null;
      if (!until || isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        res.status(400).json({ error: 'advancedCampaignUntil skal være en gyldig fremtidig dato.' });
        return;
      }
    }

    const update = {
      tool_id: toolId.trim(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (accessLevel) update.access_level = accessLevel;
    if (advancedAccessLevel) update.advanced_access_level = advancedAccessLevel;
    if (body.campaignUntil !== undefined) update.campaign_until = body.campaignUntil || null;
    if (body.advancedCampaignUntil !== undefined) update.advanced_campaign_until = body.advancedCampaignUntil || null;
    if (typeof body.note === 'string') update.note = body.note.slice(0, 500) || null;

    try {
      const { data, error } = await supabaseAdmin
        .from('tool_access_configs')
        .upsert(update, { onConflict: 'tool_id' })
        .select()
        .single();
      if (error) throw new Error(error.message);

      invalidateConfigCache();
      res.json({ config: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/tools/access/admin PUT] error:', message);
      res.status(500).json({ error: 'Kunne ikke gemme konfigurationen.', details: isProduction ? undefined : message });
    }
  });

  return router;
};
