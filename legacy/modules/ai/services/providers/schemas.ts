/**
 * services/ai/schemas.ts
 * Zod schemas for each AI feature — shared between the client callAI() helper
 * and the ai-gateway edge function for output validation.
 *
 * Features:
 *   1. projekt-intake      — natural-language → zones + project type
 *   2. suggest-tasks       — zone + selected tasks → additional suggestions
 *   3. plan-review         — full wizard state → findings list
 *   4. duration-estimate   — selected tasks → total days + critical path
 *   5. photo-scope         — image → detected zones (P3)
 *   6. bundle-recommend    — zone + task mix → nearest bundle suggestion
 */

import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

export const ProjectTypeIdSchema = z.enum([
  'nybyg', 'renovering', 'vedligehold', 'tilbygning', 'lejlighed', 'let_erhverv',
]);

// ─── Feature: projekt-intake ──────────────────────────────────────────────────

export const IntakePayloadSchema = z.object({
  prompt: z.string().min(5).max(2000),
  availableZoneIds: z.array(z.string()),
  availableProjectTypes: z.array(ProjectTypeIdSchema),
});

export const IntakeResultSchema = z.object({
  projectType: ProjectTypeIdSchema.nullable(),
  zoneIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  clarifyingQuestions: z.array(z.string()).max(2),
  summaryDa: z.string(),            // 1-sentence Danish summary for review card
});

export type IntakePayload = z.infer<typeof IntakePayloadSchema>;
export type IntakeResult  = z.infer<typeof IntakeResultSchema>;

// ─── Feature: suggest-tasks ───────────────────────────────────────────────────

export const SuggestTasksPayloadSchema = z.object({
  zoneId: z.string(),
  projectTypeId: ProjectTypeIdSchema.nullable(),
  selectedTaskIds: z.array(z.string()),
  availableTaskIds: z.array(z.string()),  // catalog IDs for the zone
});

export const SuggestTasksResultSchema = z.object({
  suggestedTaskIds: z.array(z.string()),  // max 3, from availableTaskIds only
  reasonDa: z.string(),                   // 1-sentence Danish rationale
});

export type SuggestTasksPayload = z.infer<typeof SuggestTasksPayloadSchema>;
export type SuggestTasksResult  = z.infer<typeof SuggestTasksResultSchema>;

// ─── Feature: plan-review ─────────────────────────────────────────────────────

export const FindingTypeSchema = z.enum([
  'missing_prereq', 'order', 'regulation', 'risk', 'tip',
]);

export const FindingSchema = z.object({
  type: FindingTypeSchema,
  severity: z.enum(['info', 'warning', 'error']),
  messageDa: z.string(),
  affectedTaskIds: z.array(z.string()).optional(),
  fix: z.object({ addTaskId: z.string().optional(), reorderNote: z.string().optional() }).optional(),
});

export const PlanReviewPayloadSchema = z.object({
  projectTypeId: ProjectTypeIdSchema.nullable(),
  selectedZoneIds: z.array(z.string()),
  selectedTaskIds: z.record(z.string(), z.array(z.string())),  // zoneId → taskIds
  details: z.object({ name: z.string(), address: z.string().optional() }),
});

export const PlanReviewResultSchema = z.object({
  findings: z.array(FindingSchema),
  overallQualityScore: z.number().min(0).max(100),
  summaryDa: z.string(),
});

export type PlanReviewPayload = z.infer<typeof PlanReviewPayloadSchema>;
export type PlanReviewResult  = z.infer<typeof PlanReviewResultSchema>;
export type Finding           = z.infer<typeof FindingSchema>;

// ─── Feature: duration-estimate ───────────────────────────────────────────────

export const DurationEstimatePayloadSchema = z.object({
  projectTypeId: ProjectTypeIdSchema.nullable(),
  selectedTaskIds: z.record(z.string(), z.array(z.string())),
  localEstimateDays: z.number(),
});

export const DurationEstimateResultSchema = z.object({
  totalDaysMin: z.number(),
  totalDaysMax: z.number(),
  criticalPath: z.array(z.string()),    // task IDs
  notesDa: z.string().optional(),
});

export type DurationEstimatePayload = z.infer<typeof DurationEstimatePayloadSchema>;
export type DurationEstimateResult  = z.infer<typeof DurationEstimateResultSchema>;

// ─── Feature: bundle-recommend ────────────────────────────────────────────────

export const BundleRecommendPayloadSchema = z.object({
  zoneId: z.string(),
  selectedTaskIds: z.array(z.string()),
  availableBundleIds: z.array(z.string()),
});

export const BundleRecommendResultSchema = z.object({
  bundleId: z.string().nullable(),
  missingTaskIds: z.array(z.string()),
  reasonDa: z.string(),
});

export type BundleRecommendPayload = z.infer<typeof BundleRecommendPayloadSchema>;
export type BundleRecommendResult  = z.infer<typeof BundleRecommendResultSchema>;

// ─── Union: gateway request/response ─────────────────────────────────────────

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

export interface GatewayResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: string;
  provider?: string;
  latencyMs?: number;
}
