import {
    TaskDocumentationItem,
    TaskDocumentationKind,
} from '../../../../types';
import { supabase } from '../../../../services/supabaseClient';
import { uploadTaskFile } from './storage';
import { mapDoc } from './mappers';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts).
const db = supabase as any;

// ---------------------------------------------------------------------------
// DOCUMENTATION CRUD
// ---------------------------------------------------------------------------

export const listTaskDocumentation = async (taskId: string): Promise<TaskDocumentationItem[]> => {
    const { data, error } = await db
        .from('task_documentation')
        .select('*')
        .eq('task_id', taskId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
    if (error) { console.error('listTaskDocumentation error:', error); return []; }
    return (data ?? []).map(mapDoc);
};

export const listProjectDocumentation = async (projectId: string): Promise<TaskDocumentationItem[]> => {
    const { data, error } = await db
        .from('task_documentation')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('listProjectDocumentation error:', error); return []; }
    return (data ?? []).map(mapDoc);
};

export interface AddDocumentationParams {
    taskId: string;
    projectId: string | null;
    authorId: string;
    authorName: string;
    kind: TaskDocumentationKind;
    body?: string;
    file?: File | Blob;
    mimeType?: string;
    sizeBytes?: number;
}

export const addTaskDocumentation = async (
    params: AddDocumentationParams
): Promise<TaskDocumentationItem> => {
    const { taskId, projectId, authorId, authorName, kind, body, file, mimeType, sizeBytes } = params;

    // Guard: only the task's assigned worker or accepted partner may create documentation entries.
    {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) throw new Error('Ikke logget ind');

        const { data: taskRow } = await db
            .from('tasks')
            .select('assignees')
            .eq('id', taskId)
            .single();

        const assignees: { id: string }[] = (taskRow?.assignees as any[]) ?? [];
        const isAssigned = assignees.some(a => a.id === authUser.id);

        if (!isAssigned) {
            let hasAccess = false;

            if (projectId) {
                // Project task: check resource_task_access (partner access)
                const { data: accessRows } = await db
                    .from('resource_task_access')
                    .select('resource_id')
                    .eq('task_id', taskId);

                if (accessRows?.length) {
                    const resourceIds = (accessRows as any[]).map(r => r.resource_id);
                    const { data: resourceRows } = await (db as any)
                        .from('project_resources')
                        .select('user_id')
                        .in('id', resourceIds)
                        .in('status', ['active'])
                        .eq('kind', 'partner');
                    hasAccess = ((resourceRows ?? []) as any[]).some(r => r.user_id === authUser.id);
                }
            } else {
                // Quick task: check quick_task_access table
                const { data: qtaRow } = await db
                    .from('quick_task_access')
                    .select('user_id')
                    .eq('task_id', taskId)
                    .eq('user_id', authUser.id)
                    .in('status', ['pending', 'active'])
                    .maybeSingle();
                hasAccess = !!qtaRow;
            }

            if (!hasAccess) {
                throw new Error('Kun den tildelte medarbejder kan tilføje dokumentation');
            }
        }
    }

    let storagePath: string | null = null;
    let resolvedMime = mimeType ?? null;
    let resolvedSize = sizeBytes ?? null;

    if (file && (kind === 'photo' || kind === 'audio' || kind === 'file' || kind === 'report')) {
        storagePath = await uploadTaskFile(projectId, taskId, file, mimeType);
        if (file instanceof File) {
            resolvedMime = resolvedMime ?? file.type;
            resolvedSize = resolvedSize ?? file.size;
        }
    }

    const { data, error } = await db
        .from('task_documentation')
        .insert({
            task_id: taskId,
            project_id: projectId,
            author_id: authorId,
            author_name: authorName,
            kind,
            body: body ?? null,
            storage_path: storagePath,
            mime_type: resolvedMime,
            size_bytes: resolvedSize,
            is_pinned: false,
        })
        .select('*')
        .single();

    if (error) {
        console.error('addTaskDocumentation error:', error);
        throw new Error(error.message);
    }
    return mapDoc(data);
};

export const deleteTaskDocumentation = async (id: string): Promise<void> => {
    // Fetch the row first so we can clean up the stored file before the row is gone.
    const { data: row, error: fetchErr } = await db
        .from('task_documentation')
        .select('storage_path')
        .eq('id', id)
        .single();

    if (fetchErr) {
        console.error('deleteTaskDocumentation fetch error:', fetchErr);
        throw new Error(fetchErr.message);
    }

    const storagePath: string | null = row?.storage_path ?? null;
    if (storagePath) {
        // storage_path is prefixed "task-docs/<bucket-relative-path>" (see uploadTaskFile).
        const bucketPath = storagePath.startsWith('task-docs/')
            ? storagePath.slice('task-docs/'.length)
            : storagePath;
        const { error: storageErr } = await supabase.storage
            .from('task-docs')
            .remove([bucketPath]);
        if (storageErr) {
            // A failed storage removal is preferable to an orphaned DB row; log and continue.
            console.warn('deleteTaskDocumentation storage removal failed:', storageErr.message);
        }
    }

    const { error } = await db.from('task_documentation').delete().eq('id', id);
    if (error) {
        console.error('deleteTaskDocumentation error:', error);
        throw new Error(error.message);
    }
};

/** Pin a single documentation entry and unpin all others for the same task. */
export const pinTaskDocumentation = async (id: string, taskId: string): Promise<void> => {
    // Unpin all existing pins for this task first
    await db
        .from('task_documentation')
        .update({ is_pinned: false })
        .eq('task_id', taskId)
        .eq('is_pinned', true);

    const { error } = await db
        .from('task_documentation')
        .update({ is_pinned: true })
        .eq('id', id);

    if (error) {
        console.error('pinTaskDocumentation error:', error);
        throw new Error(error.message);
    }
};

// ---------------------------------------------------------------------------
// COMMENT MANAGEMENT (owner / manager path)
// ---------------------------------------------------------------------------

/**
 * Append a comment to a task_documentation row.
 * This goes through the task_docs_update_comments RLS policy which allows
 * project owner / manager to update the comments column without touching
 * authorship fields. The application layer here only updates `comments`.
 */
export const addCommentToTaskDoc = async (
    entryId: string,
    comment: { authorId: string; authorName: string; text: string }
): Promise<Record<string, unknown>[]> => {
    const newComment: Record<string, unknown> = {
        id: crypto.randomUUID(),
        authorId: comment.authorId,
        authorName: comment.authorName,
        text: comment.text,
        createdAt: new Date().toISOString(),
    };

    // Optimistic concurrency: read → build → write only when updated_at still matches.
    // This prevents two concurrent submissions from overwriting each other — the second
    // writer detects the conflict (0 rows updated) and retries on the freshly written row.
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const { data: row, error: fetchErr } = await db
            .from('task_documentation')
            .select('comments, updated_at')
            .eq('id', entryId)
            .single();
        if (fetchErr) throw new Error(fetchErr.message);

        const existing = (row?.comments as Record<string, unknown>[]) ?? [];
        const updated = [...existing, newComment];

        const { data: updatedRows, error } = await db
            .from('task_documentation')
            .update({ comments: updated })
            .eq('id', entryId)
            .eq('updated_at', row.updated_at)
            .select('id');

        if (error) throw new Error(error.message);

        if (updatedRows && updatedRows.length > 0) {
            return updated;
        }
        // 0 rows updated = concurrent write modified the row first; back off and retry.
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
    throw new Error('Kunne ikke tilføje kommentar — prøv igen');
};
