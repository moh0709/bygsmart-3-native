/**
 * providers/openai.ts
 * OpenAI adapter for the ai-gateway edge function.
 * Uses the OpenAI Chat Completions API (Deno-compatible).
 */

import type { ProviderRequest, ProviderResponse } from '../types.ts';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export async function callOpenAI(req: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = req.model ?? DEFAULT_MODEL;

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
  const res = await fetch(OPENAI_API_URL, {
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
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const text = data.choices?.[0]?.message?.content ?? '';
  return {
    text,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
    latencyMs,
    model,
    provider: 'openai',
  };
}
