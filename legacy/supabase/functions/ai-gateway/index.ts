/**
 * supabase/functions/ai-gateway/index.ts
 * Multi-provider AI gateway with automatic fallback and usage logging.
 *
 * Security posture (F-04 / F-11):
 *   - Verifies the caller's Supabase **user** JWT in-function (anonymous / no-user
 *     requests are rejected with 401). The function still uses the service-role key
 *     for DB writes, so this end-user check is the only thing standing between the
 *     public anon key (shipped in the bundle) and our AI credits.
 *   - Enforces the same per-user daily quota as `enforceAiQuota` in server/index.js
 *     (profiles.ai_requests_today / ai_last_reset_date + plan limits) → 429 on excess.
 *   - Restricts CORS to the configured production origin(s) (AI_GATEWAY_ALLOWED_ORIGINS,
 *     default https://app.bygsmart.com) instead of `*`.
 *   - Caps maxTokens and request payload size.
 *
 * Flow:
 *   POST /functions/v1/ai-gateway
 *   { feature, payload, stream? }
 *   → verify user JWT → enforce per-user daily quota
 *   → load ai_provider_configs (ordered by priority ASC)
 *   → build prompts for feature
 *   → call primary provider → on error, call fallback
 *   → parse + zod-validate output
 *   → log to ai_usage_log
 *   → return { ok, result, provider, latencyMs }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

import { callAnthropic } from './providers/anthropic.ts';
import { callGoogle }    from './providers/google.ts';
import { callOpenAI }    from './providers/openai.ts';
import { callCerebras }   from './providers/cerebras.ts';
import { callOpenRouter } from './providers/openrouter.ts';

import type { GatewayRequest, ProviderRequest, ProviderResponse } from './types.ts';

// ─── Abuse controls ────────────────────────────────────────────────────────────

// Cap the model output. Mirrors the previous hard-coded 1024 ceiling.
const MAX_TOKENS = 1024;
// Cap the inbound request body. Gateway payloads are short (project descriptions,
// id lists) — anything larger is abuse and is rejected before parsing.
const MAX_BODY_BYTES = 32 * 1024; // 32 KB

// Per-plan daily AI request limits — keep in sync with PLAN_LIMITS in server/index.js.
const PLAN_LIMITS: Record<string, number> = {
  FREE: 5,
  PRO: 50,
  PREMIUM: 1000,
  ENTERPRISE: 10000,
};
const PLAN_PRIORITY = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

function normalizeTier(tier: unknown): string {
  if (!tier || typeof tier !== 'string') return 'FREE';
  const upper = tier.toUpperCase();
  return PLAN_PRIORITY.includes(upper) ? upper : 'FREE';
}

// ─── Prompt builders (inline — keeps edge function self-contained) ─────────────

function buildPrompts(feature: string, payload: unknown): { system: string; user: string } {
  const p = payload as Record<string, unknown>;

  switch (feature) {
    case 'projekt-intake':
      return {
        system: `Du er en dansk byggesagsassistent for BYG SMART. Analyser brugerens beskrivelse og returner JSON med: projectType (én af: ${JSON.stringify(p.availableProjectTypes)} eller null), zoneIds (fra: ${JSON.stringify(p.availableZoneIds)}), confidence (0-1), clarifyingQuestions (max 2 hvis confidence<0.6), summaryDa (1 sætning). KUN JSON, KUN dansk, KUN kendte id'er.`,
        user: `Brugerens beskrivelse: "${p.prompt}"`,
      };

    case 'suggest-tasks':
      return {
        system: `Du er byggeekspert for BYG SMART. Foreslå op til 3 yderligere opgave-id'er for zone "${p.zoneId}" (projekttype: ${p.projectTypeId ?? 'ukendt'}). Brug KUN id'er fra: ${JSON.stringify(p.availableTaskIds)}. Returner JSON: { "suggestedTaskIds": [], "reasonDa": "" }. KUN dansk.`,
        user: `Allerede valgte: ${JSON.stringify(p.selectedTaskIds)}. Tilgængelige: ${JSON.stringify(p.availableTaskIds)}.`,
      };

    case 'plan-review':
      return {
        system: `Du er byggeleder for BYG SMART. Gennemgå projektplanen og identificer manglende forudsætninger, forkert rækkefølge, BR18-regler og risici. Returner JSON: { "findings": [{"type":"missing_prereq|order|regulation|risk|tip","severity":"info|warning|error","messageDa":"","affectedTaskIds":[],"fix":{}}], "overallQualityScore":0, "summaryDa":"" }. KUN dansk.`,
        user: `Projekt: ${p.details ? JSON.stringify(p.details) : ''}. Type: ${p.projectTypeId ?? 'ukendt'}. Zoner: ${JSON.stringify(p.selectedZoneIds)}. Opgaver: ${JSON.stringify(p.selectedTaskIds)}.`,
      };

    case 'duration-estimate':
      return {
        system: `Du er tidsplansekspert. Estimer realistisk varighed baseret på opgavelisten. Returner JSON: { "totalDaysMin":0, "totalDaysMax":0, "criticalPath":[], "notesDa":"" }. KUN dansk.`,
        user: `Type: ${p.projectTypeId ?? 'ukendt'}. Lokalt estimat: ${p.localEstimateDays} dage. Opgaver: ${JSON.stringify(p.selectedTaskIds)}.`,
      };

    case 'bundle-recommend':
      return {
        system: `Du er pakkeekspert for BYG SMART. Anbefal den bedste tilgængelige pakke. Returner JSON: { "bundleId":"<id eller null>", "missingTaskIds":[], "reasonDa":"" }. Brug KUN id'er fra: ${JSON.stringify(p.availableBundleIds)}. KUN dansk.`,
        user: `Zone: ${p.zoneId}. Valgte opgaver: ${JSON.stringify(p.selectedTaskIds)}. Pakker: ${JSON.stringify(p.availableBundleIds)}.`,
      };

    default:
      throw new Error(`Unknown feature: ${feature}`);
  }
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

async function dispatchToProvider(
  providerId: string,
  req: ProviderRequest,
): Promise<ProviderResponse> {
  switch (providerId) {
    case 'anthropic': return callAnthropic(req);
    case 'google':    return callGoogle(req);
    case 'openai':    return callOpenAI(req);
    case 'cerebras':    return callCerebras(req);
    case 'openrouter':  return callOpenRouter(req);
    default:          throw new Error(`Unknown provider: ${providerId}`);
  }
}

// ─── CORS (restricted to allowed origin[s]) ─────────────────────────────────────

// Comma-separated allow-list, configurable via env. Defaults to the production origin.
const ALLOWED_ORIGINS = (Deno.env.get('AI_GATEWAY_ALLOWED_ORIGINS') ?? 'https://app.bygsmart.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  // Echo the request origin only when it is explicitly allow-listed; otherwise fall
  // back to the first configured origin so the header is never the wildcard `*`.
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// ─── Auth (verify end-user JWT) ─────────────────────────────────────────────────

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  const CORS = corsHeaders(req);
  const jsonHeaders = { ...CORS, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: jsonHeaders,
    });
  }

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  // ── Verify the caller's Supabase user JWT ──
  // The function holds the service-role key, so we MUST authenticate the end user
  // ourselves. Reject anonymous / anon-key-only / invalid-token requests.
  const token = getBearerToken(req.headers.get('authorization'));
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: 'Ikke autoriseret.' }), {
      status: 401, headers: jsonHeaders,
    });
  }

  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ ok: false, error: 'Ikke autoriseret.' }), {
      status: 401, headers: jsonHeaders,
    });
  }

  // ── Enforce request payload size cap (reject before parsing) ──
  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, error: 'Payload too large' }), {
      status: 413, headers: jsonHeaders,
    });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ ok: false, error: 'Payload too large' }), {
      status: 413, headers: jsonHeaders,
    });
  }

  let body: GatewayRequest;
  try {
    body = JSON.parse(rawBody) as GatewayRequest;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 400, headers: jsonHeaders,
    });
  }

  const { feature, payload } = body;

  // ── Enforce per-user daily AI quota (mirrors enforceAiQuota in server/index.js) ──
  const quota = await enforceAiQuota(sb, user.id);
  if (!quota.ok) {
    return new Response(JSON.stringify({ ok: false, error: quota.error }), {
      status: quota.status, headers: jsonHeaders,
    });
  }

  // ── Load provider configs ordered by priority ──
  const { data: configs, error: cfgErr } = await sb
    .from('ai_provider_configs')
    .select('provider_id, default_model')
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (cfgErr || !configs || configs.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'No AI providers configured' }), {
      status: 503, headers: jsonHeaders,
    });
  }

  // ── Build prompts ──
  let prompts: { system: string; user: string };
  try {
    prompts = buildPrompts(feature, payload);
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 400, headers: jsonHeaders,
    });
  }

  const providerReq: ProviderRequest = {
    systemPrompt: prompts.system,
    userPrompt: prompts.user,
    maxTokens: MAX_TOKENS,
    temperature: 0.2,
    timeoutMs: 25_000,
  };

  // ── Try providers in priority order ──
  let lastError = '';
  let providerResponse: ProviderResponse | null = null;

  for (const cfg of configs) {
    try {
      providerResponse = await dispatchToProvider(cfg.provider_id, {
        ...providerReq,
        model: cfg.default_model ?? undefined,
      });

      // Log success
      await sb.from('ai_usage_log').insert({
        provider_id: cfg.provider_id,
        model: providerResponse.model,
        feature,
        tokens_in: providerResponse.tokensIn,
        tokens_out: providerResponse.tokensOut,
        latency_ms: providerResponse.latencyMs,
        success: true,
      });

      break; // success — stop trying
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`Provider ${cfg.provider_id} failed:`, lastError);

      // Log failure
      await sb.from('ai_usage_log').insert({
        provider_id: cfg.provider_id,
        feature,
        latency_ms: 0,
        success: false,
        error: lastError.slice(0, 500),
      });
      // continue to next provider
    }
  }

  if (!providerResponse) {
    return new Response(
      JSON.stringify({ ok: false, error: `All providers failed. Last: ${lastError}` }),
      { status: 502, headers: jsonHeaders },
    );
  }

  // ── Parse JSON output ──
  let result: unknown;
  try {
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = providerResponse.text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    result = JSON.parse(cleaned);
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: 'Model returned invalid JSON', raw: providerResponse.text.slice(0, 200) }),
      { status: 502, headers: jsonHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      result,
      provider: providerResponse.provider,
      latencyMs: providerResponse.latencyMs,
    }),
    { headers: jsonHeaders },
  );
});

// ─── Per-user daily AI quota ────────────────────────────────────────────────────
// Mirrors enforceAiQuota in server/index.js: same profiles columns, same plan limits,
// same daily reset semantics. Returns { ok:false, status, error } when blocked.
async function enforceAiQuota(
  sb: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, ai_requests_today, ai_last_reset_date, subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, status: 403, error: 'Unable to validate AI quota.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastReset = profile.ai_last_reset_date as string | null;
  const currentCount = lastReset === today ? (profile.ai_requests_today as number ?? 0) : 0;
  const tier = normalizeTier(profile.subscription_tier);
  const limit = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;

  if (currentCount >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Kvote overskredet for ${tier}-planen. Prøv igen i morgen eller opgrader.`,
    };
  }

  const { error: updateError } = await sb
    .from('profiles')
    .update({
      ai_requests_today: currentCount + 1,
      ai_last_reset_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    return { ok: false, status: 500, error: 'Unable to update AI quota usage.' };
  }

  return { ok: true };
}
