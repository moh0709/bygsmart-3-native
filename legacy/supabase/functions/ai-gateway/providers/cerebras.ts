/**
 * providers/cerebras.ts
 * Cerebras adapter for the ai-gateway edge function.
 * Cerebras exposes an OpenAI-compatible Chat Completions endpoint.
 * Docs: https://inference-docs.cerebras.ai/api-reference/chat-completions
 */

import type { ProviderRequest, ProviderResponse } from '../types.ts';

const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

// fast  → llama-3.3-70b   (fastest inference on Cerebras hardware)
// quality → llama-3.3-70b  (same model — Cerebras' quality ceiling today)
const DEFAULT_MODEL = 'llama-3.3-70b';

export async function callCerebras(req: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('CEREBRAS_API_KEY');
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not set');

  const model = req.model ?? DEFAULT_MODEL;

  const body = {
    model,
    max_tokens: req.maxTokens ?? 1024,
    temperature: req.temperature ?? 0.2,
    // Cerebras supports response_format for JSON mode
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userPrompt },
    ],
  };

  const start = Date.now();
  const res = await fetch(CEREBRAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 25_000),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cerebras ${res.status}: ${text.slice(0, 200)}`);
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
    provider: 'cerebras',
  };
}
