/**
 * providers/openrouter.ts
 * OpenRouter adapter for the ai-gateway edge function.
 * OpenRouter is OpenAI-compatible and routes to 200+ models.
 * Docs: https://openrouter.ai/docs/api-reference/chat-completion
 */

import type { ProviderRequest, ProviderResponse } from '../types.ts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// A fast default — override via default_model in ai_provider_configs
const DEFAULT_MODEL_FAST    = 'google/gemini-flash-1.5';

export async function callOpenRouter(req: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const model = req.model ?? DEFAULT_MODEL_FAST;

  const body = {
    model,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ],
  };

  const start = Date.now();
  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter attribution headers (optional but good practice)
      'HTTP-Referer': 'https://bygsmart.dk',
      'X-Title': 'BygSmart',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 25_000),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
    model: string;
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    tokensIn:  data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
    latencyMs,
    model: data.model ?? model,
    provider: 'openrouter',
  };
}
