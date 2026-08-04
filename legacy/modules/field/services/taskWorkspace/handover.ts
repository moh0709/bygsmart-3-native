import { TaskHandover } from '../../../../types';
import { supabase } from '../../../../services/supabaseClient';
import { mapHandover } from './mappers';
import { notifyUser, getProjectOwnerId } from './notifications';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts).
const db = supabase as any;

// ---------------------------------------------------------------------------
// HANDOVER & SIGNATURES
// ---------------------------------------------------------------------------

/**
 * Worker submits task completion. Creates or replaces the task_handovers row
 * with status='submitted' and updates tasks.handover_status. Notifies Mester.
 */
export const submitTaskCompletion = async (
    taskId: string,
    projectId: string | null,
    params: { signaturePath?: string }
): Promise<TaskHandover> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');

    const now = new Date().toISOString();

    // Upsert: replace any prior submitted/rejected handover for this task
    const { data: existing } = await db
        .from('task_handovers')
        .select('id')
        .eq('task_id', taskId)
        .maybeSingle();

    let handoverRow: any;
    if (existing?.id) {
        const { data, error } = await db
            .from('task_handovers')
            .update({
                submitted_by: user.id,
                submitted_at: now,
                supplier_signature_path: params.signaturePath ?? null,
                status: 'submitted',
                reviewed_by: null,
                reviewed_at: null,
                mester_signature_path: null,
                rejection_reason: null,
                snags: null,
                report_path: null,
            })
            .eq('id', existing.id)
            .select('*')
            .single();
        if (error) throw new Error(error.message);
        handoverRow = data;
    } else {
        const { data, error } = await db
            .from('task_handovers')
            .insert({
                task_id: taskId,
                project_id: projectId,
                submitted_by: user.id,
                submitted_at: now,
                supplier_signature_path: params.signaturePath ?? null,
                status: 'submitted',
            })
            .select('*')
            .single();
        if (error) throw new Error(error.message);
        handoverRow = data;
    }

    // Update task handover_status
    await db
        .from('tasks')
        .update({ handover_status: 'submitted' })
        .eq('id', taskId);

    // Notify Mester
    const mesterId = await getProjectOwnerId(projectId);
    if (mesterId) {
        await notifyUser(
            mesterId,
            'En opgave er færdigmeldt — afventer din godkendelse',
            `/task/${taskId}`,
            'task_submitted'
        );
    }

    return mapHandover(handoverRow);
};

export interface AcceptHandoverParams {
    signaturePath?: string;
    snags?: Record<string, unknown>[];
    reportPath?: string;
}

/**
 * Mester accepts the handover: sets status='accepted', marks task as 'Udført',
 * pins the acceptance report, and notifies the worker.
 */
export const acceptTaskHandover = async (
    taskId: string,
    projectId: string | null,
    params: AcceptHandoverParams
): Promise<TaskHandover> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');

    const now = new Date().toISOString();

    // Fetch existing handover
    const { data: existing, error: fetchErr } = await db
        .from('task_handovers')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 'submitted')
        .single();
    if (fetchErr || !existing) throw new Error('Ingen aflevering til godkendelse');

    const { data, error } = await db
        .from('task_handovers')
        .update({
            status: 'accepted',
            reviewed_by: user.id,
            reviewed_at: now,
            mester_signature_path: params.signaturePath ?? null,
            snags: params.snags ?? null,
            report_path: params.reportPath ?? null,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
    if (error) throw new Error(error.message);

    // Update the task
    await db
        .from('tasks')
        .update({
            status: 'Udført',
            handover_status: 'accepted',
            completed_at: now,
            acceptance_report_path: params.reportPath ?? null,
        })
        .eq('id', taskId);

    // Pin the acceptance report in documentation if a reportPath was given
    if (params.reportPath) {
        const { data: reportDoc } = await db
            .from('task_documentation')
            .select('id')
            .eq('task_id', taskId)
            .eq('kind', 'report')
            .maybeSingle();

        if (!reportDoc) {
            await db.from('task_documentation').insert({
                task_id: taskId,
                project_id: projectId,
                author_id: user.id,
                author_name: 'System',
                kind: 'report',
                body: 'Afleveringsrapport',
                storage_path: params.reportPath,
                mime_type: 'application/pdf',
                is_pinned: true,
            });
        } else {
            await db
                .from('task_documentation')
                .update({ is_pinned: true, storage_path: params.reportPath })
                .eq('id', reportDoc.id);
        }
    }

    // Notify the worker (submitted_by)
    if (existing.submitted_by && existing.submitted_by !== user.id) {
        await notifyUser(
            existing.submitted_by,
            'Din opgave er godkendt — afleveringsrapporten er klar',
            `/task/${taskId}`,
            'task_accepted'
        );
    }

    return mapHandover(data);
};

/**
 * Mester rejects the handover: task reverts to 'Igangværende' and worker is notified.
 */
export const rejectTaskHandover = async (
    taskId: string,
    projectId: string | null,
    params: { reason: string }
): Promise<TaskHandover> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');

    const now = new Date().toISOString();

    const { data: existing, error: fetchErr } = await db
        .from('task_handovers')
        .select('*')
        .eq('task_id', taskId)
        .eq('status', 'submitted')
        .single();
    if (fetchErr || !existing) throw new Error('Ingen aflevering at afvise');

    const { data, error } = await db
        .from('task_handovers')
        .update({
            status: 'rejected',
            reviewed_by: user.id,
            reviewed_at: now,
            rejection_reason: params.reason,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
    if (error) throw new Error(error.message);

    // Reopen the task
    await db
        .from('tasks')
        .update({
            status: 'Igangværende',
            handover_status: 'rejected',
        })
        .eq('id', taskId);

    // Notify the worker
    if (existing.submitted_by && existing.submitted_by !== user.id) {
        await notifyUser(
            existing.submitted_by,
            `Din opgave er afvist — se kommentar: ${params.reason}`,
            `/task/${taskId}`,
            'task_rejected'
        );
    }

    return mapHandover(data);
};
