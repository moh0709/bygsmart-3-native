import { PunchListLayout, PunchListItem } from '../../../types';
import { assertStorageQuota } from '../../../services/storageQuota';
import { supabase } from '../../../services/supabaseClient';
import { PUNCH_LAYOUT_COLUMNS, PUNCH_ITEM_COLUMNS, PunchListLayoutRow, PunchListItemRow } from '../../../services/api/columns';

// --- PUNCH LIST ---

export const mapLayout = (l: PunchListLayoutRow): PunchListLayout => ({
    id: l.id,
    projectId: l.project_id,
    title: l.title,
    reference: l.reference ?? undefined,
    fileUrl: l.file_url,
    createdAt: l.created_at,
});

export const mapPunchItem = (i: PunchListItemRow): PunchListItem => ({
    id: i.id,
    projectId: i.project_id,
    layoutId: i.layout_id,
    photoUrl: i.photo_url,
    pin: (i.pin as unknown as PunchListItem['pin']) ?? { x: 0, y: 0 },
    description: i.description ?? '',
    status: i.status as PunchListItem['status'],
    timestamp: i.created_at
        ? new Date(i.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
        : '',
    resolutionDueDate: i.resolution_due_date ?? undefined,
});

export const getLayoutsForProject = async (projectId: string): Promise<PunchListLayout[]> => {
    const { data, error } = await supabase
        .from('punch_list_layouts')
        .select(PUNCH_LAYOUT_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('getLayoutsForProject error:', error); return []; }
    return (data ?? []).map(mapLayout);
};

// ---------------------------------------------------------------------------
// IMAGE STORAGE (Phase 7 W3 — punch images stop being inline base64)
// ---------------------------------------------------------------------------

/** The project's owning org — mirrors modules/field's uploader (Phase 6). */
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
 * Store a punch image in the task-docs bucket and return its storage path
 * (resolveFileUrl/ResolvedImage dual-read both paths and legacy data: URLs).
 * Fail-open on every branch — an upload hiccup must never block registering a
 * defect on site, so the caller then keeps the inline base64 exactly as
 * before. Org-less projects also keep base64 (their legacy storage paths
 * pre-date the org RLS helper).
 */
const storePunchImage = async (projectId: string, url: string): Promise<string> => {
    if (!url.startsWith('data:')) return url;
    try {
        const orgId = await getProjectOrgId(projectId);
        if (!orgId) return url;
        const blob = await (await fetch(url)).blob();
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        const storagePath = `org/${orgId}/project/${projectId}/punch/${crypto.randomUUID()}.${ext}`;
        await assertStorageQuota();
        const { error } = await supabase.storage
            .from('task-docs')
            .upload(storagePath, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
        if (error) {
            console.error('storePunchImage upload error:', error);
            return url;
        }
        return `task-docs/${storagePath}`;
    } catch (err) {
        console.error('storePunchImage error:', err);
        return url;
    }
};

export const createLayout = async (projectId: string, layout: { title: string; reference?: string; fileUrl: string }): Promise<PunchListLayout> => {
    const fileUrl = await storePunchImage(projectId, layout.fileUrl);
    const { data, error } = await supabase
        .from('punch_list_layouts')
        .insert({
            project_id: projectId,
            title: layout.title,
            reference: layout.reference || null,
            file_url: fileUrl,
        })
        .select()
        .single();
    if (error) { console.error('createLayout error:', error); throw error; }
    return mapLayout(data);
};

export const updateLayout = async (id: string, layout: Partial<PunchListLayout>): Promise<void> => {
    const updates: any = {};
    if (layout.title !== undefined) updates.title = layout.title;
    if (layout.reference !== undefined) updates.reference = layout.reference;
    if (Object.keys(updates).length === 0) return;
    const { error } = await supabase
        .from('punch_list_layouts')
        .update(updates)
        .eq('id', id);
    if (error) console.error('updateLayout error:', error);
};

export const deleteLayout = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('punch_list_layouts')
        .delete()
        .eq('id', id);
    if (error) console.error('deleteLayout error:', error);
};

export const getPunchListForProject = async (projectId: string): Promise<PunchListItem[]> => {
    const { data, error } = await supabase
        .from('punch_list_items')
        .select(PUNCH_ITEM_COLUMNS)
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('getPunchListForProject error:', error); return []; }
    return (data ?? []).map(mapPunchItem);
};

export const createPunchListItem = async (
    projectId: string,
    item: Omit<PunchListItem, 'id' | 'timestamp' | 'projectId'> & { layoutId: string }
): Promise<void> => {
    const photoUrl = await storePunchImage(projectId, item.photoUrl);
    const { error } = await supabase
        .from('punch_list_items')
        .insert({
            project_id: projectId,
            layout_id: item.layoutId,
            photo_url: photoUrl,
            pin: item.pin as any,
            description: item.description,
            status: item.status,
            resolution_due_date: item.resolutionDueDate || null,
        });
    if (error) console.error('createPunchListItem error:', error);
};

export const updatePunchListItem = async (projectId: string, item: PunchListItem): Promise<void> => {
    const { error } = await supabase
        .from('punch_list_items')
        .update({
            description: item.description,
            status: item.status,
            resolution_due_date: item.resolutionDueDate || null,
        })
        .eq('id', item.id);
    if (error) console.error('updatePunchListItem error:', error);
};

export const deletePunchListItem = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('punch_list_items')
        .delete()
        .eq('id', id);
    if (error) console.error('deletePunchListItem error:', error);
};
