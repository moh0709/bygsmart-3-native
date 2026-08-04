/**
 * services/ai/index.ts
 * Client-side AI gateway service.
 * Routes all AI calls through the Supabase Edge Function `ai-gateway`
 * so API keys never appear in the browser bundle.
 */

import { supabase } from '../../../../services/supabaseClient';
import type {
  AIFeature,
  GatewayRequest,
  GatewayResponse,
  IntakePayload,
  IntakeResult,
  SuggestTasksPayload,
  SuggestTasksResult,
  PlanReviewPayload,
  PlanReviewResult,
  DurationEstimatePayload,
  DurationEstimateResult,
  BundleRecommendPayload,
  BundleRecommendResult,
} from './schemas';

// ─── Core caller ──────────────────────────────────────────────────────────────

async function callAI<TPayload, TResult>(
  feature: AIFeature,
  payload: TPayload,
  options: { stream?: boolean; signal?: AbortSignal } = {},
): Promise<GatewayResponse<TResult>> {
  const body: GatewayRequest = { feature, payload, stream: options.stream };

  const { data: session } = await supabase.auth.getSession();
  const accessToken = session?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'unknown error');
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const json = (await res.json()) as GatewayResponse<TResult>;
    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Anmodning annulleret' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─── Typed feature helpers ────────────────────────────────────────────────────

export async function runIntake(
  payload: IntakePayload,
  signal?: AbortSignal,
): Promise<GatewayResponse<IntakeResult>> {
  return callAI<IntakePayload, IntakeResult>('projekt-intake', payload, { signal });
}

export async function runSuggestTasks(
  payload: SuggestTasksPayload,
): Promise<GatewayResponse<SuggestTasksResult>> {
  return callAI<SuggestTasksPayload, SuggestTasksResult>('suggest-tasks', payload);
}

export async function runPlanReview(
  payload: PlanReviewPayload,
  signal?: AbortSignal,
): Promise<GatewayResponse<PlanReviewResult>> {
  return callAI<PlanReviewPayload, PlanReviewResult>('plan-review', payload, { signal });
}

export async function runDurationEstimate(
  payload: DurationEstimatePayload,
): Promise<GatewayResponse<DurationEstimateResult>> {
  return callAI<DurationEstimatePayload, DurationEstimateResult>('duration-estimate', payload);
}

export async function runBundleRecommend(
  payload: BundleRecommendPayload,
): Promise<GatewayResponse<BundleRecommendResult>> {
  return callAI<BundleRecommendPayload, BundleRecommendResult>('bundle-recommend', payload);
}

// Re-export types for convenience
export type {
  IntakePayload, IntakeResult,
  SuggestTasksPayload, SuggestTasksResult,
  PlanReviewPayload, PlanReviewResult,
  DurationEstimatePayload, DurationEstimateResult,
  BundleRecommendPayload, BundleRecommendResult,
  GatewayResponse,
} from './schemas';
