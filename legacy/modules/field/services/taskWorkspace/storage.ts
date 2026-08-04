import { assertStorageQuota } from '../../../../services/storageQuota';
import { supabase } from '../../../../services/supabaseClient';

// ---------------------------------------------------------------------------
// INTERNAL HELPERS
// ---------------------------------------------------------------------------

/** Derive a short extension from a MIME type or fall back to 'bin'. */
const extFromMime = (mimeType: string): string => {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'application/pdf': 'pdf',
        'image/svg+xml': 'svg',
    };
    return map[mimeType] ?? mimeType.split('/')[1]?.split(';')[0] ?? 'bin';
};

/**
 * The project's owning organization — new uploads are org-prefixed (Phase 6
 * storage isolation) so usage meters directly per org. Returns null when the
 * project has no org (fail-open: the caller falls back to the legacy path,
 * which storage RLS still accepts and metering attributes via a join).
 */
const getProjectOrgId = async (projectId: string): Promise<string | null> => {
    try {
        const { data } = await supabase
            .from('projects')
            .select('org_id')
            .eq('id', projectId)
            .maybeSingle();
        return data?.org_id ?? null;
    } catch {
        return null;
    }
};

/**
 * Upload a File or Blob to the task-docs bucket.
 * Returns the full storage path (bucket-relative) so it can be stored in the DB
 * and later resolved to a signed URL via resolveFileUrl().
 */
export const uploadTaskFile = async (
    projectId: string | null,
    taskId: string,
    file: File | Blob,
    mimeType?: string
): Promise<string> => {
    const mime = mimeType ?? (file instanceof File ? file.type : 'application/octet-stream');
    const ext = extFromMime(mime);
    const uuid = crypto.randomUUID();
    // Quick tasks have no project UUID — use a dedicated prefix so the path is always valid.
    const orgId = projectId ? await getProjectOrgId(projectId) : null;
    const storagePath = projectId
        ? orgId
            ? `org/${orgId}/project/${projectId}/task/${taskId}/${uuid}.${ext}`
            : `${projectId}/${taskId}/${uuid}.${ext}`
        : `quick-tasks/${taskId}/${uuid}.${ext}`;

    await assertStorageQuota();
    const { error } = await supabase.storage
        .from('task-docs')
        .upload(storagePath, file, { contentType: mime, upsert: false });

    if (error) {
        console.error('uploadTaskFile error:', error);
        throw new Error(error.message);
    }
    // Return the canonical path prefix used by resolveFileUrl()
    return `task-docs/${storagePath}`;
};

/**
 * Upload a canvas signature (as data URL) to the task-docs bucket.
 * Returns the storage path for use in submitTaskCompletion / acceptTaskHandover.
 */
export const uploadSignature = async (dataUrl: string): Promise<string> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? 'unknown';

    const uuid = crypto.randomUUID();
    const storagePath = `signatures/${userId}/${uuid}.png`;

    await assertStorageQuota();
    const { error } = await supabase.storage
        .from('task-docs')
        .upload(storagePath, blob, { contentType: 'image/png', upsert: false });

    if (error) {
        console.error('uploadSignature error:', error);
        throw new Error(error.message);
    }
    return `task-docs/${storagePath}`;
};
