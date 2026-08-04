// ─────────────────────────────────────────────────────────────────────────────
// Project-wide reporting loaders (Shared Foundations)
//
// Today only *per-task* loaders exist (listTaskQualityControls in
// services/taskQualityControl.ts; the handover helpers in
// services/taskWorkspace/handover.ts). Goals A (Projekt-sundhed) and C
// (Overdragelse PDF) need *project-wide* aggregation. These loaders mirror the
// shapes already queried server-side in server/handoverData.js and reuse the
// existing snake_case → TS mappers so the data model stays consistent.
//
// RLS is enforced server-side — these assume the caller is authenticated and
// has project-member or accepted-partner access.
// ─────────────────────────────────────────────────────────────────────────────

import {
  TaskQualityControl,
  TaskQualityControlType,
  TaskQualityControlResult,
  TaskQualityControlPhoto,
  TaskHandover,
} from '../types';
import { supabase } from './supabaseClient';
import { mapHandover } from '../modules/field';

// Untyped handle for tables not yet in database.types (same pattern as
// services/taskQualityControl.ts and services/partners.ts).
const db = supabase as any;

// ---------------------------------------------------------------------------
// MAPPERS
// ---------------------------------------------------------------------------

/**
 * DB row → TaskQualityControl. Mirrors mapControl in
 * services/taskQualityControl.ts (kept local so this reporting module stays
 * independent of the per-task KS service and its upload helpers).
 */
const mapQualityControl = (r: any): TaskQualityControl => ({
  id: r.id,
  taskId: r.task_id,
  projectId: r.project_id,
  authorId: r.author_id,
  authorName: r.author_name ?? '',
  controlPoint: r.control_point ?? undefined,
  controlType: (r.control_type as TaskQualityControlType) ?? undefined,
  requirementRef: r.requirement_ref ?? undefined,
  result: (r.result as TaskQualityControlResult) ?? undefined,
  comments: r.comments ?? undefined,
  hasDeviation: r.has_deviation ?? false,
  deviationDescription: r.deviation_description ?? undefined,
  deviationPhotos: (r.deviation_photos as TaskQualityControlPhoto[]) ?? [],
  correctiveAction: r.corrective_action ?? undefined,
  deviationDeadline: r.deviation_deadline ?? undefined,
  responsibleId: r.responsible_id ?? undefined,
  responsibleName: r.responsible_name ?? undefined,
  signaturePath: r.signature_path ?? undefined,
  controlDate: r.control_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined,
});

// ---------------------------------------------------------------------------
// LOADERS
// ---------------------------------------------------------------------------

/**
 * All quality-control (KS) rows across every task in a project. Shaped like the
 * `task_quality_controls` query in server/handoverData.js — pass/fail results,
 * deviations, requirement refs and the responsible person.
 */
export const getQualityControlsForProject = async (
  projectId: string
): Promise<TaskQualityControl[]> => {
  const { data, error } = await db
    .from('task_quality_controls')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getQualityControlsForProject error:', error);
    return [];
  }
  return (data ?? []).map(mapQualityControl);
};

/** A project handover with the party display names resolved for the sign-off section. */
export interface ProjectHandover extends TaskHandover {
  /** Display name of `submittedBy` (worker/supplier), when resolvable. */
  submittedByName?: string;
  /** Display name of `reviewedBy` (mester), when resolvable. */
  reviewedByName?: string;
}

/**
 * All task handovers across a project including status, submitter/reviewer,
 * supplier/mester signature paths and the task ref — with the party display
 * names resolved from `profiles` (mirrors how GodkendModal resolves the
 * supplier name). Used for the sign-off + KS sections of the handover report.
 */
export const getHandoversForProject = async (projectId: string): Promise<ProjectHandover[]> => {
  const { data, error } = await db
    .from('task_handovers')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getHandoversForProject error:', error);
    return [];
  }

  const rows: any[] = data ?? [];

  // Resolve the distinct party ids (submitter + reviewer) to display names in a
  // single profiles lookup.
  const ids = Array.from(
    new Set(rows.flatMap(r => [r.submitted_by, r.reviewed_by]).filter(Boolean))
  ) as string[];

  let names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles, error: profilesError } = await db
      .from('profiles')
      .select('id, name')
      .in('id', ids);
    if (profilesError) {
      // A missing name must never crash the report — log and fall back to undefined.
      console.error('getHandoversForProject profiles error:', profilesError);
    } else {
      names = new Map((profiles ?? []).map((p: any) => [p.id, p.name ?? '']));
    }
  }

  return rows.map(r => ({
    ...mapHandover(r),
    submittedByName: r.submitted_by ? names.get(r.submitted_by) || undefined : undefined,
    reviewedByName: r.reviewed_by ? names.get(r.reviewed_by) || undefined : undefined,
  }));
};
