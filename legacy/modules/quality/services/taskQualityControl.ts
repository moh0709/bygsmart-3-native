/**
 * Task quality control (KS / kvalitetssikring) service.
 * One row per control performed on a task — table created by the
 * task_ks_and_chat migration. Deviation photos and the control signature
 * live in the "task-docs" bucket: the UI uploads them via uploadTaskFile /
 * uploadSignature (re-exported below) and persists the returned paths in
 * deviation_photos / signature_path.
 *
 * RLS is enforced server-side — this module assumes the caller is
 * authenticated and has project-member or partner-task access.
 */

import {
    TaskQualityControl,
    TaskQualityControlType,
    TaskQualityControlResult,
    TaskQualityControlPhoto,
} from '../../../types';
import { supabase } from '../../../services/supabaseClient';

// Re-export the shared upload helpers so the KS tab has a single import point.
export { uploadTaskFile, uploadSignature } from '../../field';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts and services/taskWorkspace.ts).
const db = supabase as any;

// ---------------------------------------------------------------------------
// MAPPERS
// ---------------------------------------------------------------------------

const mapControl = (r: any): TaskQualityControl => ({
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
// CRUD
// ---------------------------------------------------------------------------

export const listTaskQualityControls = async (taskId: string): Promise<TaskQualityControl[]> => {
    const { data, error } = await db
        .from('task_quality_controls')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('listTaskQualityControls error:', error);
        throw new Error(error.message);
    }
    return (data ?? []).map(mapControl);
};

export interface AddTaskQualityControlParams {
    taskId: string;
    projectId: string;
    authorId: string;
    authorName: string;
    controlPoint?: string;
    controlType?: TaskQualityControlType;
    requirementRef?: string;
    result?: TaskQualityControlResult;
    comments?: string;
    hasDeviation?: boolean;
    deviationDescription?: string;
    /** Paths returned by uploadTaskFile — upload before calling this. */
    deviationPhotos?: TaskQualityControlPhoto[];
    correctiveAction?: string;
    deviationDeadline?: string;
    responsibleId?: string;
    responsibleName?: string;
    /** Path returned by uploadSignature — upload before calling this. */
    signaturePath?: string;
    controlDate?: string;
}

export const addTaskQualityControl = async (
    params: AddTaskQualityControlParams
): Promise<TaskQualityControl> => {
    const { data, error } = await db
        .from('task_quality_controls')
        .insert({
            task_id: params.taskId,
            project_id: params.projectId,
            author_id: params.authorId,
            author_name: params.authorName,
            control_point: params.controlPoint ?? null,
            control_type: params.controlType ?? null,
            requirement_ref: params.requirementRef ?? null,
            result: params.result ?? null,
            comments: params.comments ?? null,
            has_deviation: params.hasDeviation ?? false,
            deviation_description: params.deviationDescription ?? null,
            deviation_photos: params.deviationPhotos ?? [],
            corrective_action: params.correctiveAction ?? null,
            deviation_deadline: params.deviationDeadline ?? null,
            responsible_id: params.responsibleId ?? null,
            responsible_name: params.responsibleName ?? null,
            signature_path: params.signaturePath ?? null,
            ...(params.controlDate ? { control_date: params.controlDate } : {}),
        })
        .select('*')
        .single();

    if (error) {
        console.error('addTaskQualityControl error:', error);
        throw new Error(error.message);
    }
    return mapControl(data);
};

/** Patch shape: omit a key to leave it unchanged; pass null to clear it. */
export interface TaskQualityControlPatch {
    controlPoint?: string | null;
    controlType?: TaskQualityControlType | null;
    requirementRef?: string | null;
    result?: TaskQualityControlResult | null;
    comments?: string | null;
    hasDeviation?: boolean;
    deviationDescription?: string | null;
    deviationPhotos?: TaskQualityControlPhoto[];
    correctiveAction?: string | null;
    deviationDeadline?: string | null;
    responsibleId?: string | null;
    responsibleName?: string | null;
    signaturePath?: string | null;
    controlDate?: string;
}

const PATCH_COLUMN_MAP: Record<keyof TaskQualityControlPatch, string> = {
    controlPoint: 'control_point',
    controlType: 'control_type',
    requirementRef: 'requirement_ref',
    result: 'result',
    comments: 'comments',
    hasDeviation: 'has_deviation',
    deviationDescription: 'deviation_description',
    deviationPhotos: 'deviation_photos',
    correctiveAction: 'corrective_action',
    deviationDeadline: 'deviation_deadline',
    responsibleId: 'responsible_id',
    responsibleName: 'responsible_name',
    signaturePath: 'signature_path',
    controlDate: 'control_date',
};

export const updateTaskQualityControl = async (
    id: string,
    patch: TaskQualityControlPatch
): Promise<TaskQualityControl> => {
    const row: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(PATCH_COLUMN_MAP)) {
        const value = patch[key as keyof TaskQualityControlPatch];
        if (value !== undefined) row[column] = value;
    }

    const { data, error } = await db
        .from('task_quality_controls')
        .update(row)
        .eq('id', id)
        .select('*')
        .single();

    if (error) {
        console.error('updateTaskQualityControl error:', error);
        throw new Error(error.message);
    }
    return mapControl(data);
};

export const deleteTaskQualityControl = async (id: string): Promise<void> => {
    // Delete first so row-level authorization succeeds before any storage object is touched.
    const { data: row, error } = await db
        .from('task_quality_controls')
        .delete()
        .eq('id', id)
        .select('deviation_photos, signature_path')
        .single();

    if (error) {
        console.error('deleteTaskQualityControl error:', error);
        throw new Error(error.message);
    }

    // Paths are prefixed "task-docs/<bucket-relative-path>" (see uploadTaskFile /
    // uploadSignature) — strip the prefix before removal.
    const photos = ((row?.deviation_photos as TaskQualityControlPhoto[]) ?? [])
        .map(p => p.storagePath)
        .filter(Boolean);
    const paths = [...photos, ...(row?.signature_path ? [row.signature_path] : [])]
        .map((p: string) => (p.startsWith('task-docs/') ? p.slice('task-docs/'.length) : p));

    if (paths.length) {
        const { error: storageErr } = await supabase.storage
            .from('task-docs')
            .remove(paths);
        if (storageErr) {
            // A failed storage removal is preferable to an orphaned DB row; log and continue.
            console.warn('deleteTaskQualityControl storage removal failed:', storageErr.message);
        }
    }

};
