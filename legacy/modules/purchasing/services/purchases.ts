import { PurchaseItem } from '../../../types';
import { assertStorageQuota } from '../../../services/storageQuota';
import { supabase } from '../../../services/supabaseClient';
import { PURCHASE_COLUMNS, PurchaseRow } from '../../../services/api/columns';
import { getProjects } from '../../projects';

// --- PURCHASES ---

export const mapPurchase = (p: PurchaseRow): PurchaseItem => ({
    id: p.id,
    name: p.name,
    details: p.details ?? '',
    quantity: p.quantity ?? 1,
    price: p.price ?? 0,
    status: p.status as PurchaseItem['status'],
    supplier: p.supplier ?? undefined,
    itemNumber: p.item_number ?? undefined,
    attachment: (p.attachment as unknown as PurchaseItem['attachment']) ?? undefined,
    expectedDeliveryDate: p.expected_delivery_date ?? undefined,
    taskId: p.task_id ?? undefined,
    assigneeId: p.assignee_id ?? undefined,
});

export const getAllPendingPurchases = async (userId?: string): Promise<(PurchaseItem & { projectName: string; projectId: string })[]> => {
    let projectIds: string[] | undefined;

    if (userId) {
        const projects = await getProjects(userId);
        if (projects.length === 0) return [];
        projectIds = projects.map(p => p.id);
    }

    let query = supabase
        .from('purchases')
        .select(PURCHASE_COLUMNS + ', projects!inner(name, id)')
        .eq('status', 'Afventer');

    if (projectIds) {
        query = query.in('project_id', projectIds);
    }

    const { data, error } = await query;
    if (error) { console.error('getAllPendingPurchases error:', error); return []; }

    return ((data as any[]) ?? []).map((p: any) => ({
        ...mapPurchase(p),
        projectName: p.projects?.name ?? '',
        projectId: p.project_id,
    }));
};

export const getPurchaseInfoForProject = async (projectId: string, userId?: string): Promise<{ total: number; items: PurchaseItem[] }> => {
    const { data, error } = await supabase
        .from('purchases')
        .select(PURCHASE_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('getPurchaseInfoForProject error:', error); return { total: 0, items: [] }; }
    const items = (data ?? []).map(mapPurchase);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return { total, items };
};

// ---------------------------------------------------------------------------
// ATTACHMENT STORAGE (Phase 7 W4 — receipts stop being inline base64)
// ---------------------------------------------------------------------------

/** The project's owning org — mirrors modules/quality's punch uploader. */
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
 * Store a purchase attachment (receipt photo/PDF) in the task-docs bucket and
 * return the attachment with its url swapped for the storage path
 * (resolveFileUrl dual-reads paths and legacy data: URLs). Fail-open on every
 * branch — an upload hiccup must never block registering a purchase, so the
 * inline base64 is kept exactly as before.
 */
const storeAttachment = async (
    projectId: string,
    attachment: PurchaseItem['attachment']
): Promise<PurchaseItem['attachment']> => {
    if (!attachment?.url || !attachment.url.startsWith('data:')) return attachment;
    try {
        const orgId = await getProjectOrgId(projectId);
        if (!orgId) return attachment;
        const blob = await (await fetch(attachment.url)).blob();
        const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
        const storagePath = `org/${orgId}/project/${projectId}/purchase/${crypto.randomUUID()}.${ext}`;
        await assertStorageQuota();
        const { error } = await supabase.storage
            .from('task-docs')
            .upload(storagePath, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
        if (error) {
            console.error('storeAttachment upload error:', error);
            return attachment;
        }
        return { ...attachment, url: `task-docs/${storagePath}` };
    } catch (err) {
        console.error('storeAttachment error:', err);
        return attachment;
    }
};

export const createPurchaseItemForProject = async (projectId: string, item: Omit<PurchaseItem, 'id'>): Promise<void> => {
    const attachment = await storeAttachment(projectId, item.attachment);
    const { error } = await supabase
        .from('purchases')
        .insert({
            project_id: projectId,
            name: item.name,
            details: item.details || '',
            quantity: item.quantity,
            price: item.price,
            status: item.status,
            supplier: item.supplier || null,
            item_number: item.itemNumber || null,
            attachment: attachment || null,
            expected_delivery_date: item.expectedDeliveryDate || null,
            task_id: item.taskId || null,
            assignee_id: item.assigneeId || null,
        });
    if (error) console.error('createPurchaseItemForProject error:', error);
};

export const updatePurchaseItem = async (projectId: string, item: PurchaseItem): Promise<void> => {
    const attachment = await storeAttachment(projectId, item.attachment);
    const { error } = await supabase
        .from('purchases')
        .update({
            name: item.name,
            details: item.details || '',
            quantity: item.quantity,
            price: item.price,
            status: item.status,
            supplier: item.supplier || null,
            item_number: item.itemNumber || null,
            attachment: attachment || null,
            expected_delivery_date: item.expectedDeliveryDate || null,
            task_id: item.taskId || null,
            assignee_id: item.assigneeId || null,
        })
        .eq('id', item.id);
    if (error) console.error('updatePurchaseItem error:', error);
};

export const deletePurchaseItem = async (projectId: string, id: string): Promise<void> => {
    const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);
    if (error) console.error('deletePurchaseItem error:', error);
};
