// ─────────────────────────────────────────────────────────────────────────────
// Gemini proxy route — legacy single-provider endpoint used by services/gemini.ts.
//
// Mounted from server/index.js via:
//   app.use(createGeminiProxyRouter({ geminiClient, getAuthenticatedUser,
//                                     enforceAiQuota, isProduction }))
//
// NOTE: the per-route JSON body-size limit for /api/gemini is registered in
// index.js (before the global express.json()) — it must stay there per the
// raw-body/JSON-limit ordering invariant. This module only owns the handler.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';

// Only models we intentionally expose. Prevents arbitrary (potentially far more
// expensive) model names from being proxied through our API key.
const ALLOWED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
]);

// Hard bounds for the Gemini proxy (F-08). The forwarded request body is
// whitelisted to these top-level fields and config keys and clamped, so a
// caller cannot run up cost or widen the prompt-injection blast radius beyond
// what the app legitimately needs.
const GEMINI_ALLOWED_TOP_LEVEL_KEYS = new Set(['model', 'contents', 'config']);
const GEMINI_ALLOWED_CONFIG_KEYS = new Set([
  'responseMimeType',
  'responseSchema',
  'systemInstruction',
  'temperature',
  'topP',
  'topK',
  'maxOutputTokens',
  'candidateCount',
  'stopSequences',
  'thinkingConfig',
  'safetySettings',
]);
const GEMINI_MAX_OUTPUT_TOKENS = 8192;
// Serialized `contents` ceiling. Sized to allow multimodal image payloads
// (base64 inlineData) — the prior global behaviour permitted up to ~10mb — while
// still rejecting absurdly large bodies. Kept just under the route's 11mb body
// limit so this in-handler check trips first with a friendly Danish 413.
const GEMINI_MAX_CONTENTS_BYTES = 10 * 1024 * 1024;

// Strip unknown keys from the AI generation config and clamp the cost-bearing
// fields. Always returns a config object with a bounded maxOutputTokens.
const sanitizeGeminiConfig = (rawConfig) => {
  const config = {};
  if (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
    for (const [key, value] of Object.entries(rawConfig)) {
      if (GEMINI_ALLOWED_CONFIG_KEYS.has(key)) config[key] = value;
    }
  }

  const requestedTokens = Number(config.maxOutputTokens);
  config.maxOutputTokens = Number.isFinite(requestedTokens)
    ? Math.min(Math.max(1, Math.floor(requestedTokens)), GEMINI_MAX_OUTPUT_TOKENS)
    : GEMINI_MAX_OUTPUT_TOKENS;

  // Never let a caller fan out into multiple candidates (cost multiplier).
  if (config.candidateCount != null) config.candidateCount = 1;

  return config;
};

export const createGeminiProxyRouter = ({ geminiClient, getAuthenticatedUser, enforceAiQuota, isProduction }) => {
  const router = Router();

  router.post('/api/gemini', async (req, res) => {
    if (!geminiClient) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on server.' });
      return;
    }

    try {
      // AI calls must be authenticated: anonymous callers would otherwise bypass
      // the per-user quota entirely while still consuming our API key.
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

      const body =
        req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : null;
      if (!body) {
        res.status(400).json({ error: 'Ugyldig forespørgsel.' });
        return;
      }

      const requestedModel = typeof body.model === 'string' ? body.model : '';
      if (!ALLOWED_GEMINI_MODELS.has(requestedModel)) {
        res.status(400).json({ error: 'Ugyldig AI-model.' });
        return;
      }

      // Reject unknown top-level fields rather than silently forwarding them.
      const unknownFields = Object.keys(body).filter(
        (key) => !GEMINI_ALLOWED_TOP_LEVEL_KEYS.has(key)
      );
      if (unknownFields.length > 0) {
        res.status(400).json({ error: `Ugyldige felter: ${unknownFields.join(', ')}` });
        return;
      }

      if (body.contents == null) {
        res.status(400).json({ error: 'Manglende indhold i forespørgslen.' });
        return;
      }

      // Cap input size independently of the body parser limit so a single oversized
      // `contents` payload cannot be forwarded to Google.
      let serializedContents;
      try {
        serializedContents = JSON.stringify(body.contents);
      } catch {
        res.status(400).json({ error: 'Ugyldigt indhold i forespørgslen.' });
        return;
      }
      if (Buffer.byteLength(serializedContents || '', 'utf8') > GEMINI_MAX_CONTENTS_BYTES) {
        res.status(413).json({ error: 'Forespørgslen er for stor.' });
        return;
      }

      // Forward only the whitelisted, clamped shape — never the raw body.
      const sanitizedRequest = {
        model: requestedModel,
        contents: body.contents,
        config: sanitizeGeminiConfig(body.config),
      };

      const response = await geminiClient.models.generateContent(sanitizedRequest);
      res.status(200).json({
        text: response.text,
        functionCalls: response.functionCalls,
        candidates: response.candidates,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[api/gemini] error:', message);
      res.status(500).json({
        error: 'An error occurred while communicating with the AI.',
        details: isProduction ? undefined : message,
      });
    }
  });

  return router;
};
