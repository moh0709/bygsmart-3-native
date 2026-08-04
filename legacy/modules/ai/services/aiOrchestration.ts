// ─────────────────────────────────────────────────────────────────────────────
// Client service for the AI orchestration layer (/api/ai/*).
//
// `aiChat` is the general-purpose entry point all new AI features should use:
// the server resolves the admin-configured provider chain (default + fallback)
// and routes the call. The admin functions back the AiOrchestrationPanel.
// Legacy Gemini-specific calls still live in services/gemini.ts (/api/gemini).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../../../services/supabaseClient';
import { QuotaExceededError } from './gemini';

const AI_CHAT_ENDPOINT = '/api/ai/chat';
const AI_ADMIN_BASE = '/api/ai/admin';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatParams {
  prompt?: string;
  messages?: AiChatMessage[];
  system?: string;
  /** Feature tag for usage logging, e.g. 'briefing', 'onboarding', 'chat'. */
  feature?: string;
  /** Force a specific provider as first in the chain. */
  providerId?: string;
  /** Model override (applies to the requested provider only). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  text: string;
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface AiProviderConfigField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface AiProviderAdminView {
  providerId: string;
  label: string;
  authStyle: 'openai-compat' | 'anthropic' | 'gemini' | 'cohere' | 'azure' | 'stub';
  baseUrl: string | null;
  keyLabel: string;
  defaultModels: string[];
  configFields: AiProviderConfigField[];
  stubMessage: string | null;
  enabled: boolean;
  hasKey: boolean;
  keyLast4: string | null;
  defaultModel: string | null;
  priority: number;
  config: Record<string, string>;
  updatedAt: string | null;
}

export interface AiProvidersResponse {
  providers: AiProviderAdminView[];
  /** Resolved fallback chain (provider ids in priority order). */
  chain: string[];
  encryptionConfigured: boolean;
}

export interface SaveProviderPayload {
  enabled?: boolean;
  /** undefined → keep stored key; '' → clear key; string → save new key. */
  apiKey?: string;
  config?: Record<string, string>;
  defaultModel?: string;
  priority?: number;
}

export interface TestProviderPayload {
  apiKey?: string;
  model?: string;
  config?: Record<string, string>;
}

export interface TestProviderResult {
  ok: boolean;
  latencyMs?: number;
  sample?: string;
  error?: string;
}

export interface AiUsageRow {
  id: string;
  provider_id: string;
  model: string | null;
  feature: string | null;
  user_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

export interface AiUsageAggregate {
  providerId: string;
  calls: number;
  failures: number;
  tokensIn: number;
  tokensOut: number;
  avgLatencyMs: number | null;
}

export interface AiUsageResponse {
  rows: AiUsageRow[];
  aggregates: AiUsageAggregate[];
}

// ── Internals ────────────────────────────────────────────────────────────────

const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const authedFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; details?: string };

  if (!response.ok) {
    if (response.status === 429) {
      throw new QuotaExceededError(data.error || 'Kvote overskredet.');
    }
    throw new Error(data.error || data.details || `Serverfejl (${response.status}).`);
  }

  return data;
};

// ── Chat (all app AI calls route through this) ──────────────────────────────

export const aiChatDetailed = async (params: AiChatParams): Promise<AiChatResult> => {
  const result = await authedFetch<AiChatResult>(AI_CHAT_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return result;
};

/** Convenience wrapper returning just the generated text. */
export const aiChat = async (params: AiChatParams): Promise<string> => {
  const result = await aiChatDetailed(params);
  return result.text ?? '';
};

// ── Admin API (AiOrchestrationPanel) ─────────────────────────────────────────

export const listProviders = (): Promise<AiProvidersResponse> =>
  authedFetch<AiProvidersResponse>(`${AI_ADMIN_BASE}/providers`);

export const saveProvider = async (
  providerId: string,
  payload: SaveProviderPayload
): Promise<AiProviderAdminView> => {
  const data = await authedFetch<{ provider: AiProviderAdminView }>(
    `${AI_ADMIN_BASE}/providers/${encodeURIComponent(providerId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  );
  return data.provider;
};

export const testProvider = (
  providerId: string,
  payload: TestProviderPayload = {}
): Promise<TestProviderResult> =>
  authedFetch<TestProviderResult>(
    `${AI_ADMIN_BASE}/providers/${encodeURIComponent(providerId)}/test`,
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const getUsage = (): Promise<AiUsageResponse> =>
  authedFetch<AiUsageResponse>(`${AI_ADMIN_BASE}/usage`);

export interface FetchModelsResult {
  models: string[];
  source: 'live' | 'static';
  fetchError?: string;
}

export const fetchProviderModels = (providerId: string): Promise<FetchModelsResult> =>
  authedFetch<FetchModelsResult>(
    `${AI_ADMIN_BASE}/providers/${encodeURIComponent(providerId)}/models`
  );
