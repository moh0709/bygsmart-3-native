/**
 * types.ts — shared types for the ai-gateway edge function
 */

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface ProviderResponse {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  model: string;
  provider: string;
}

export type AIFeature =
  | 'projekt-intake'
  | 'suggest-tasks'
  | 'plan-review'
  | 'duration-estimate'
  | 'bundle-recommend';

export interface GatewayRequest {
  feature: AIFeature;
  payload: unknown;
  stream?: boolean;
}
