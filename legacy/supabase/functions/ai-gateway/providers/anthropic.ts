/**
 * providers/anthropic.ts
 * Anthropic Claude adapter for the ai-gateway edge function.
 * Uses the Anthropic Messages API directly (no SDK — Deno-compatible).
 */

import type { ProviderRequest, ProviderResponse } from '../types.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

export async function callAnthropic(req: ProviderRequest): Promise<ProviderResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = req.model ?? DEFAULT_MODEL;

  const body = {
    model,
    max_tokens: req.maxTokens ?? 1024,
    system: req.systemPrompt,
    messages: [{ role: 'user', content: req.userPrompt }],
    temperature: req.temperature ?? 0.2,
  };

  const start = Date.now();
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(req.timeoutMs ?? 25_000),
  });

  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content.find((c) => c.type === 'text')?.text ?? '';
  return {
    text,
    tokensIn: data.usage?.input_tokens,
    tokensOut: data.usage?.output_tokens,
    latencyMs,
    model,
    provider: 'anthropic',
  };
}
