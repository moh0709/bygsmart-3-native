import { DocumentItem, DocumentAccessLevel } from '../../../types';
import { assertStorageQuota } from '../../../services/storageQuota';
import { supabase } from '../../../services/supabaseClient';
import { DOCUMENT_COLUMNS, DocumentRow } from '../../../services/api/columns';

// --- DOCUMENTS ---

export const mapDocument = (d: DocumentRow): DocumentItem => ({
    id: d.id,
    projectId: d.project_id,
    name: d.name,
    storagePath: d.storage_path,
    sizeBytes: d.size_bytes ?? 0,
    mimeType: d.mime_type ?? '',
    category: d.category as DocumentItem['category'],
    referenceNo: d.reference_no ?? undefined,
    shortDescription: d.short_description ?? undefined,
    accessLevel: (d.access_level as DocumentItem['accessLevel']) ?? 'public_team',
    passwordProtected: d.password_protected ?? false,
    createdBy: d.created_by ?? '',
    createdAt: d.created_at,
    reviewDeadline: d.review_deadline ?? undefined,
    isDrawing: d.is_drawing ?? false,
    discipline: (d.discipline as DocumentItem['discipline']) ?? undefined,
    drawingNo: d.drawing_no ?? undefined,
    revision: d.revision ?? undefined,
    scale: d.scale ?? undefined,
    issueDate: d.issue_date ?? undefined,
    sheetNo: d.sheet_no ?? undefined,
    planType: (d.plan_type as DocumentItem['planType']) ?? undefined,
    planIndex: d.plan_index ?? undefined,
    isLatestRevision: d.is_latest_revision ?? undefined,
});

/**
 * Upload a project document file to the task-docs bucket (Phase 6 — closes
 * the old gap where documents were stored as base64 data-URLs in the DB row).
 * Path is org-prefixed when the project has an org:
 *   org/{org_id}/project/{project_id}/documents/{uuid}.{ext}
 * Returns the canonical 'task-docs/…' path for resolveFileUrl().
 */
const uploadDocumentFile = async (projectId: string, file: File): Promise<string> => {
    const { data: project } = await supabase
        .from('projects')
        .select('org_id')
        .eq('id', projectId)
        .maybeSingle();
    const orgId = project?.org_id ?? null;
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const uuid = crypto.randomUUID();
    const storagePath = orgId
        ? `org/${orgId}/project/${projectId}/documents/${uuid}.${ext}`
        : `${projectId}/documents/${uuid}.${ext}`;

    await assertStorageQuota();
    const { error } = await supabase.storage
        .from('task-docs')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) { console.error('uploadDocumentFile error:', error); throw new Error(error.message); }
    return `task-docs/${storagePath}`;
};

export const uploadDocument = async (
    projectId: string,
    doc: Partial<DocumentItem>,
    file?: File
): Promise<DocumentItem> => {
    // A real File goes to the bucket; storage_path/size/mime derive from it.
    const storagePath = file ? await uploadDocumentFile(projectId, file) : (doc.storagePath ?? '');

    const { data, error } = await supabase
        .from('documents')
        .insert({
            project_id: projectId,
            name: doc.name ?? '',
            storage_path: storagePath,
            size_bytes: doc.sizeBytes ?? 0,
            mime_type: doc.mimeType ?? '',
            category: doc.category ?? 'GENERAL',
            reference_no: doc.referenceNo ?? null,
            short_description: doc.shortDescription ?? null,
            access_level: doc.accessLevel ?? 'public_team',
            password_protected: doc.passwordProtected ?? false,
            created_by: doc.createdBy ?? '',
            review_deadline: doc.reviewDeadline ?? null,
            is_drawing: doc.isDrawing ?? false,
            discipline: doc.discipline ?? null,
            drawing_no: doc.drawingNo ?? null,
            revision: doc.revision ?? null,
            scale: doc.scale ?? null,
            issue_date: doc.issueDate ?? null,
            sheet_no: doc.sheetNo ?? null,
            plan_type: doc.planType ?? null,
            plan_index: doc.planIndex ?? null,
            is_latest_revision: doc.isLatestRevision ?? true,
        })
        .select(DOCUMENT_COLUMNS)
        .single();
    if (error) { console.error('uploadDocument error:', error); throw error; }
    return mapDocument(data);
};

export const getDocumentsForProject = async (projectId: string): Promise<DocumentItem[]> => {
    const { data, error } = await supabase
        .from('documents')
        .select(DOCUMENT_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (error) { console.error('getDocumentsForProject error:', error); return []; }
    return (data ?? []).map(mapDocument);
};

export const getDocumentVisibility = async (documentId: string): Promise<string[]> => {
    const { data, error } = await (supabase as any)
        .from('document_visibility')
        .select('resource_id')
        .eq('document_id', documentId);
    if (error) { console.error('getDocumentVisibility error:', error); return []; }
    return (data ?? []).map((r: any) => r.resource_id as string);
};

export const setDocumentVisibility = async (
    documentId: string,
    accessLevel: DocumentAccessLevel,
    resourceIds?: string[]
): Promise<void> => {
    const { error: docError } = await (supabase as any)
        .from('documents')
        .update({ access_level: accessLevel })
        .eq('id', documentId);
    if (docError) { console.error('setDocumentVisibility update error:', docError); throw docError; }

    await (supabase as any).from('document_visibility').delete().eq('document_id', documentId);

    if (accessLevel === 'custom_users' && resourceIds && resourceIds.length > 0) {
        const rows = resourceIds.map(rid => ({ document_id: documentId, resource_id: rid }));
        const { error: insertError } = await (supabase as any).from('document_visibility').insert(rows);
        if (insertError) { console.error('setDocumentVisibility insert error:', insertError); throw insertError; }
    }
};
