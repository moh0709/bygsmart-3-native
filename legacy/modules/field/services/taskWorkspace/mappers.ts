import {
    TaskDocumentationItem,
    TaskDocumentationKind,
    TaskCheckIn,
    TaskHandover,
} from '../../../../types';

// ---------------------------------------------------------------------------
// MAPPERS
// ---------------------------------------------------------------------------

export const mapDoc = (r: any): TaskDocumentationItem => ({
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    authorId: r.author_id,
    authorName: r.author_name ?? '',
    kind: r.kind as TaskDocumentationKind,
    body: r.body ?? undefined,
    storagePath: r.storage_path ?? undefined,
    mimeType: r.mime_type ?? undefined,
    sizeBytes: r.size_bytes ?? undefined,
    isPinned: r.is_pinned ?? false,
    comments: (r.comments as Record<string, unknown>[]) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
});

export const mapCheckIn = (r: any): TaskCheckIn => ({
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    userId: r.user_id,
    userName: r.user_name ?? '',
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at ?? null,
    checkinLat: r.checkin_lat ?? null,
    checkinLng: r.checkin_lng ?? null,
    checkinAccuracy: r.checkin_accuracy ?? null,
    autoClosed: r.auto_closed ?? false,
    createdAt: r.created_at,
});

export const mapHandover = (r: any): TaskHandover => ({
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    supplierSignaturePath: r.supplier_signature_path ?? null,
    status: r.status as TaskHandover['status'],
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    mesterSignaturePath: r.mester_signature_path ?? null,
    rejectionReason: r.rejection_reason ?? null,
    snags: (r.snags as Record<string, unknown>[]) ?? null,
    reportPath: r.report_path ?? null,
    createdAt: r.created_at,
});
