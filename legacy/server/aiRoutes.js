// ─────────────────────────────────────────────────────────────────────────────
// AI orchestration routes — one proxy for all AI calls (/api/ai/chat) plus
// admin endpoints for provider configuration, connection tests and usage.
//
// Mounted from server/index.js via:
//   app.use(createAiRouter({ supabaseAdmin, getAuthenticatedUser,
//                            enforceAiQuota, getAdminProfile, isProduction }))
//
// Keys live server-side only: stored AES-256-GCM-encrypted (see
// server/aiProviders.js) and decrypted in memory at invocation time. Admin
// endpoints never return decrypted keys — only hasKey + masked last4.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  PROVIDERS,
  getProviderMeta,
  encryptApiKey,
  decryptApiKey,
  hasEncryptionSecret,
  invokeProvider,
  resolveChain,
} from './aiProviders.js';

const CONFIG_CACHE_TTL_MS = 60_000;

export const createAiRouter = ({
  supabaseAdmin,
  getAuthenticatedUser,
  enforceAiQuota,
  getAdminProfile,
  isProduction,
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
      .from('ai_provider_configs')
      .select('id, provider_id, enabled, api_key_encrypted, config, default_model, priority, updated_at');
    if (error) throw new Error(`Kunne ikke hente AI-konfiguration: ${error.message}`);
    configCache = { rows: data || [], fetchedAt: now };
    return configCache.rows;
  };

  const invalidateConfigCache = () => {
    configCache = { rows: null, fetchedAt: 0 };
  };

  // ── Non-blocking usage logging ─────────────────────────────────────────────
  const logUsage = (entry) => {
    if (!supabaseAdmin) return;
    supabaseAdmin
      .from('ai_usage_log')
      .insert({
        provider_id: entry.providerId,
        model: entry.model ?? null,
        feature: entry.feature ?? null,
        user_id: entry.userId ?? null,
        tokens_in: entry.tokensIn ?? null,
        tokens_out: entry.tokensOut ?? null,
        latency_ms: entry.latencyMs ?? null,
        success: Boolean(entry.success),
        error: entry.error ? String(entry.error).slice(0, 500) : null,
      })
      .then(({ error }) => {
        if (error) console.error('[ai] usage log insert failed:', error.message);
      })
      .catch((err) => {
        console.error('[ai] usage log network error:', err?.message ?? err);
      });
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

  const maskedLast4 = (row) => {
    if (!row?.api_key_encrypted) return null;
    try {
      const plain = decryptApiKey(row.api_key_encrypted);
      return plain.length >= 4 ? plain.slice(-4) : null;
    } catch {
      return null;
    }
  };

  const toAdminView = (meta, row) => ({
    providerId: meta.id,
    label: meta.label,
    authStyle: meta.authStyle,
    baseUrl: meta.baseUrl,
    keyLabel: meta.keyLabel || 'API-nøgle',
    defaultModels: meta.defaultModels,
    configFields: meta.configFields,
    stubMessage: meta.stubMessage || null,
    enabled: Boolean(row?.enabled),
    hasKey: Boolean(row?.api_key_encrypted),
    keyLast4: maskedLast4(row),
    defaultModel: row?.default_model ?? null,
    priority: row?.priority ?? 100,
    config: row?.config ?? {},
    updatedAt: row?.updated_at ?? null,
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/ai/chat — the one proxy all app AI calls route through.
  // Body: { messages | prompt, system?, feature?, providerId?, model?,
  //         temperature?, maxTokens? }
  // Tries the resolved provider chain in order until one succeeds.
  // ───────────────────────────────────────────────────────────────────────────
  router.post('/api/ai/chat', async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Serverkonfiguration mangler.' });
      return;
    }

    const user = await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Login er påkrævet for at bruge AI-funktioner.' });
      return;
    }
    const quotaCheck = await enforceAiQuota(user.id);
    if (!quotaCheck.ok) {
      res.status(quotaCheck.status).json({ error: quotaCheck.error });
      return;
    }

    const body = req.body || {};
    let messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages && typeof body.prompt === 'string' && body.prompt.trim()) {
      messages = [{ role: 'user', content: body.prompt }];
    }
    if (!messages || messages.length === 0) {
      res.status(400).json({ error: 'Der mangler en prompt eller beskeder.' });
      return;
    }

    const requestedProviderId = typeof body.providerId === 'string' ? body.providerId : undefined;
    const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined;
    const feature = typeof body.feature === 'string' ? body.feature.slice(0, 100) : null;
    const temperature = typeof body.temperature === 'number' ? body.temperature : undefined;
    const maxTokens = typeof body.maxTokens === 'number' ? body.maxTokens : undefined;

    if (!hasEncryptionSecret()) {
      res.status(503).json({ error: 'AI-orkestrering er ikke konfigureret (AI_KEYS_SECRET mangler).' });
      return;
    }

    let chain;
    try {
      const configs = await loadConfigs();
      chain = resolveChain(configs, requestedProviderId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/ai/chat] config load failed:', message);
      res.status(500).json({ error: 'Kunne ikke hente AI-konfiguration.', details: isProduction ? undefined : message });
      return;
    }

    if (chain.length === 0) {
      res.status(503).json({
        error: 'Ingen AI-udbyder er aktiveret. Bed en administrator om at konfigurere en udbyder.',
      });
      return;
    }

    const failures = [];
    for (const cfg of chain) {
      const meta = getProviderMeta(cfg.provider_id);
      // A model explicitly requested by the client only applies to the
      // provider it was requested for; fallback providers use their own
      // default model.
      const model =
        requestedModel && (!requestedProviderId || requestedProviderId === cfg.provider_id)
          ? requestedModel
          : cfg.default_model || meta?.defaultModels?.[0];

      const startedAt = Date.now();
      try {
        const apiKey = decryptApiKey(cfg.api_key_encrypted);
        const result = await invokeProvider({
          providerConfig: { provider_id: cfg.provider_id, apiKey, config: cfg.config, default_model: cfg.default_model },
          model,
          messages,
          system: typeof body.system === 'string' ? body.system : undefined,
          temperature,
          maxTokens,
        });
        const latencyMs = Date.now() - startedAt;
        logUsage({
          providerId: cfg.provider_id,
          model,
          feature,
          userId: user.id,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          latencyMs,
          success: true,
        });
        res.status(200).json({
          text: result.text,
          provider: cfg.provider_id,
          model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        });
        return;
      } catch (err) {
        const latencyMs = Date.now() - startedAt;
        const message = err instanceof Error ? err.message : 'Ukendt fejl';
        failures.push(`${cfg.provider_id}: ${message}`);
        logUsage({
          providerId: cfg.provider_id,
          model,
          feature,
          userId: user.id,
          latencyMs,
          success: false,
          error: message,
        });
        console.error(`[api/ai/chat] provider ${cfg.provider_id} failed:`, message);
      }
    }

    res.status(502).json({
      error: 'Alle AI-udbydere fejlede. Prøv igen senere.',
      details: isProduction ? undefined : failures,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/ai/admin/providers — registry merged with saved configs.
  // ───────────────────────────────────────────────────────────────────────────
  router.get('/api/ai/admin/providers', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    try {
      const configs = await loadConfigs(true);
      const byId = new Map(configs.map((c) => [c.provider_id, c]));
      const providers = PROVIDERS.map((meta) => toAdminView(meta, byId.get(meta.id)));
      const chain = resolveChain(configs).map((c) => c.provider_id);
      res.json({ providers, chain, encryptionConfigured: hasEncryptionSecret() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/ai/admin/providers] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente AI-udbydere.', details: isProduction ? undefined : message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PUT /api/ai/admin/providers/:providerId — upsert a provider config.
  // Body: { enabled?, apiKey?, config?, defaultModel?, priority? }
  // apiKey: undefined → keep stored key; '' → clear; string → encrypt + store.
  // ───────────────────────────────────────────────────────────────────────────
  router.put('/api/ai/admin/providers/:providerId', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const meta = getProviderMeta(req.params.providerId);
    if (!meta) {
      res.status(404).json({ error: 'Ukendt AI-udbyder.' });
      return;
    }

    const body = req.body || {};
    const update = {
      provider_id: meta.id,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (body.config && typeof body.config === 'object' && !Array.isArray(body.config)) {
      update.config = body.config;
    }
    if (typeof body.defaultModel === 'string') {
      update.default_model = body.defaultModel.trim() || null;
    }
    if (typeof body.priority === 'number' && Number.isFinite(body.priority)) {
      update.priority = Math.max(0, Math.min(9999, Math.round(body.priority)));
    }

    if (typeof body.apiKey === 'string') {
      if (body.apiKey === '') {
        update.api_key_encrypted = null;
      } else {
        if (!hasEncryptionSecret()) {
          res.status(503).json({ error: 'AI_KEYS_SECRET mangler på serveren — nøgler kan ikke gemmes.' });
          return;
        }
        try {
          update.api_key_encrypted = encryptApiKey(body.apiKey.trim());
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Ukendt fejl';
          res.status(500).json({ error: 'Kryptering af nøglen fejlede.', details: isProduction ? undefined : message });
          return;
        }
      }
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('ai_provider_configs')
        .upsert(update, { onConflict: 'provider_id' })
        .select('id, provider_id, enabled, api_key_encrypted, config, default_model, priority, updated_at')
        .single();
      if (error) throw new Error(error.message);

      invalidateConfigCache();
      res.json({ provider: toAdminView(meta, data) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/ai/admin/providers PUT] error:', message);
      res.status(500).json({ error: 'Kunne ikke gemme udbyderen.', details: isProduction ? undefined : message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/ai/admin/providers/:providerId/test — tiny live invocation.
  // Body (optional): { apiKey?, model?, config? } to test unsaved values.
  // ───────────────────────────────────────────────────────────────────────────
  router.post('/api/ai/admin/providers/:providerId/test', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const meta = getProviderMeta(req.params.providerId);
    if (!meta) {
      res.status(404).json({ error: 'Ukendt AI-udbyder.' });
      return;
    }

    const body = req.body || {};

    let apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null;
    let config = body.config && typeof body.config === 'object' ? body.config : null;
    let model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : null;

    try {
      if (!apiKey || !config || !model) {
        const configs = await loadConfigs(true);
        const saved = configs.find((c) => c.provider_id === meta.id);
        if (!apiKey) {
          if (!saved?.api_key_encrypted) {
            res.json({ ok: false, error: 'Ingen API-nøgle gemt for denne udbyder.' });
            return;
          }
          apiKey = decryptApiKey(saved.api_key_encrypted);
        }
        if (!config) config = saved?.config || {};
        if (!model) model = saved?.default_model || meta.defaultModels[0] || null;
      }

      const startedAt = Date.now();
      const result = await invokeProvider({
        providerConfig: { provider_id: meta.id, apiKey, config },
        model,
        messages: [{ role: 'user', content: 'Svar kun med OK' }],
        maxTokens: 20,
      });
      const latencyMs = Date.now() - startedAt;
      res.json({ ok: true, latencyMs, sample: (result.text || '').slice(0, 50) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      res.json({ ok: false, error: message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/ai/admin/usage — last 200 usage rows + per-provider aggregates.
  // ───────────────────────────────────────────────────────────────────────────
  router.get('/api/ai/admin/usage', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    try {
      const { data, error } = await supabaseAdmin
        .from('ai_usage_log')
        .select('id, provider_id, model, feature, user_id, tokens_in, tokens_out, latency_ms, success, error, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      const rows = data || [];
      const aggregates = {};
      for (const row of rows) {
        const agg = (aggregates[row.provider_id] ||= {
          providerId: row.provider_id,
          calls: 0,
          failures: 0,
          tokensIn: 0,
          tokensOut: 0,
          avgLatencyMs: 0,
          _latencySum: 0,
          _latencyCount: 0,
        });
        agg.calls += 1;
        if (!row.success) agg.failures += 1;
        agg.tokensIn += row.tokens_in || 0;
        agg.tokensOut += row.tokens_out || 0;
        if (typeof row.latency_ms === 'number') {
          agg._latencySum += row.latency_ms;
          agg._latencyCount += 1;
        }
      }
      const aggregateList = Object.values(aggregates).map((agg) => {
        const { _latencySum, _latencyCount, ...rest } = agg;
        return { ...rest, avgLatencyMs: _latencyCount > 0 ? Math.round(_latencySum / _latencyCount) : null };
      });

      res.json({ rows, aggregates: aggregateList });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      console.error('[api/ai/admin/usage] error:', message);
      res.status(500).json({ error: 'Kunne ikke hente AI-forbrug.', details: isProduction ? undefined : message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/ai/admin/providers/:providerId/models — live model list from provider.
  // Falls back to hardcoded defaultModels for providers without a /models API.
  // ───────────────────────────────────────────────────────────────────────────
  router.get('/api/ai/admin/providers/:providerId/models', adminLimiter, async (req, res) => {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const meta = getProviderMeta(req.params.providerId);
    if (!meta) {
      res.status(404).json({ error: 'Ukendt AI-udbyder.' });
      return;
    }

    // Providers that publish an OpenAI-compatible /models endpoint
    const supportsModelList = meta.authStyle === 'openai-compat';

    if (!supportsModelList) {
      return res.json({ models: meta.defaultModels, source: 'static' });
    }

    try {
      const configs = await loadConfigs(true);
      const saved = configs.find((c) => c.provider_id === meta.id);
      if (!saved?.api_key_encrypted) {
        return res.json({ models: meta.defaultModels, source: 'static' });
      }
      const apiKey = decryptApiKey(saved.api_key_encrypted);
      const baseUrl = (saved.config?.endpoint || meta.baseUrl || '').replace(/\/$/, '');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let fetchRes;
      try {
        fetchRes = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!fetchRes.ok) {
        return res.json({ models: meta.defaultModels, source: 'static', fetchError: `HTTP ${fetchRes.status}` });
      }

      const json = await fetchRes.json();
      // OpenAI format: { data: [{ id }] }; some providers use { models: [{ id }] } or [{ id }]
      const raw = Array.isArray(json) ? json : (json.data ?? json.models ?? []);
      const ids = raw
        .map((m) => (typeof m === 'string' ? m : m?.id ?? m?.name))
        .filter(Boolean)
        .sort();

      res.json({ models: ids.length ? ids : meta.defaultModels, source: ids.length ? 'live' : 'static' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ukendt fejl';
      res.json({ models: meta.defaultModels, source: 'static', fetchError: message });
    }
  });

  return router;
};
