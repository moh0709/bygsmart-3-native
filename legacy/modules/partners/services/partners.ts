import {
    PartnerInvite, PartnerInviteStatus, PartnerNegotiationKind,
    PartnerNegotiationMessage, PartnerProjectView, Task, UserRole,
} from '../../../types';
import { assertStorageQuota } from '../../../services/storageQuota';
import { supabase } from '../../../services/supabaseClient';

// project_resources / resource_task_access are not in generated database.types
// yet — use an untyped handle, same pattern as the legacy partner tables.
const db = supabase as any;

const RESOURCE_COLUMNS =
    'id, project_id, user_id, invited_by, status, agreed_price_ore, currency, message, created_at, updated_at, settled_at, name, initials, kind, visibility';
const PARTNER_MESSAGE_COLUMNS =
    'id, partner_invite_id, resource_id, sender_id, kind, body, amount_ore, created_at, attachment_path, attachment_name, attachment_type';

/** Attachment kinds allowed in a negotiation thread: pictures, PDF, Word, Excel. */
export const NEGOTIATION_ATTACHMENT_MIME = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
export const NEGOTIATION_ATTACHMENT_ACCEPT =
    'image/*,.pdf,.doc,.docx,.xls,.xlsx';
export const NEGOTIATION_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export interface NegotiationAttachment {
    path: string;   // canonical task-docs/... path (resolve via resolveFileUrl)
    name: string;   // original filename
    type: string;   // MIME type
}

// --- HELPERS ---

/** Convert a kroner amount (e.g. "1250,50" or 1250.5) to øre. */
export const kronerToOre = (value: string | number): number => {
    const num = typeof value === 'number'
        ? value
        : parseFloat(value.replace(',', '.'));
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
};

/** Format an øre amount as Danish kroner, e.g. 1250050 -> "12.500,50 kr." */
export const formatOre = (ore: number | null | undefined, currency = 'DKK'): string => {
    if (ore === null || ore === undefined) return '–';
    return new Intl.NumberFormat('da-DK', { style: 'currency', currency }).format(ore / 100);
};

/** Map project_resources.status → PartnerInviteStatus for backward compat. */
const mapResourceStatus = (status: string): PartnerInviteStatus => {
    switch (status) {
        case 'active':    return 'accepted';
        case 'declined':  return 'declined';
        case 'cancelled': return 'cancelled';
        default:          return 'invited'; // 'pending' → 'invited'
    }
};

/** Map a project_resources row (kind='partner') to PartnerInvite shape. */
const mapInvite = (row: any): PartnerInvite => ({
    id: row.id,
    projectId: row.project_id,
    partnerId: row.user_id,       // project_resources.user_id = the partner
    invitedBy: row.invited_by,
    status: mapResourceStatus(row.status),
    agreedPriceOre: row.agreed_price_ore == null ? null : Number(row.agreed_price_ore),
    currency: row.currency ?? 'DKK',
    message: row.message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    settledAt: row.settled_at ?? undefined,
    partnerName: row.profiles?.name ?? row.name ?? undefined,
    partnerInitials: row.profiles?.initials ?? row.initials ?? undefined,
});

const mapMessage = (row: any): PartnerNegotiationMessage => ({
    id: row.id,
    partnerInviteId: row.resource_id ?? row.partner_invite_id,
    resourceId: row.resource_id ?? undefined,
    senderId: row.sender_id,
    kind: row.kind as PartnerNegotiationKind,
    body: row.body ?? undefined,
    amountOre: row.amount_ore == null ? null : Number(row.amount_ore),
    createdAt: row.created_at,
    attachmentPath: row.attachment_path ?? undefined,
    attachmentName: row.attachment_name ?? undefined,
    attachmentType: row.attachment_type ?? undefined,
});

const mapPartnerTask = (t: any): Task => ({
    id: t.id,
    title: t.title,
    status: t.status as Task['status'],
    dueDate: t.due_date ?? '',
    description: t.description ?? '',
    assignees: (t.assignees as Task['assignees']) ?? [],
    checklist: (t.checklist as Task['checklist']) ?? [],
    isMilestone: t.is_milestone ?? false,
    estimatedHours: t.estimated_hours ?? 0,
    step: t.step ?? undefined,
    handoverStatus: (t.handover_status ?? 'none') as Task['handoverStatus'],
    completedAt: t.completed_at ?? undefined,
    acceptanceReportPath: t.acceptance_report_path ?? undefined,
    createdAt: t.created_at ?? undefined,
});

// --- INVITES ---

/**
 * Manager invites a connected partner (Underleverandør) to specific tasks.
 * Atomic via the invite_partner SECURITY DEFINER RPC.
 * Returns the resource_id (now the canonical invite id).
 */
export const invitePartner = async (
    projectId: string,
    partnerId: string,
    taskIds: string[],
    message: string,
    openingPriceOre?: number
): Promise<string> => {
    const { data, error } = await db.rpc('invite_partner', {
        p_project_id: projectId,
        p_partner_id: partnerId,
        p_task_ids: taskIds,
        p_message: message || null,
        p_opening_price_ore: openingPriceOre ?? null,
    });
    if (error) {
        console.error('invitePartner error:', error);
        throw new Error(error.message);
    }
    return data as string;
};

/** Manager view: all partner resources on a project, with task allowlist ids. */
export const listPartnerInvitesForProject = async (projectId: string): Promise<PartnerInvite[]> => {
    const { data, error } = await db
        .from('project_resources')
        .select(`${RESOURCE_COLUMNS}, profiles!project_resources_user_id_fkey(name, initials)`)
        .eq('project_id', projectId)
        .eq('kind', 'partner')
        .order('created_at', { ascending: false });
    if (error) { console.error('listPartnerInvitesForProject error:', error); return []; }

    const invites = (data ?? []).map(mapInvite);
    if (invites.length === 0) return invites;

    const { data: accessRows, error: accessError } = await db
        .from('resource_task_access')
        .select('resource_id, task_id')
        .in('resource_id', invites.map(i => i.id));
    if (accessError) { console.error('listPartnerInvitesForProject access error:', accessError); return invites; }

    const byResource = new Map<string, string[]>();
    (accessRows ?? []).forEach((r: any) => {
        const list = byResource.get(r.resource_id) ?? [];
        list.push(r.task_id);
        byResource.set(r.resource_id, list);
    });
    return invites.map(i => ({
        ...i,
        taskIds: byResource.get(i.id) ?? [],
        taskCount: (byResource.get(i.id) ?? []).length,
    }));
};

/** Partner view: my invitations across projects (via updated RPC). */
export const listMyPartnerInvites = async (): Promise<PartnerInvite[]> => {
    const { data, error } = await db.rpc('get_my_partner_invites');
    if (error) { console.error('listMyPartnerInvites error:', error); return []; }
    const { data: { user } } = await supabase.auth.getUser();
    return ((data as any[]) ?? []).map((r: any) => ({
        id: r.invite_id,
        projectId: r.project_id,
        partnerId: user?.id ?? '',
        invitedBy: r.invited_by,
        status: mapResourceStatus(r.status),
        agreedPriceOre: r.agreed_price_ore == null ? null : Number(r.agreed_price_ore),
        currency: r.currency ?? 'DKK',
        message: r.message ?? undefined,
        createdAt: r.created_at,
        settledAt: r.settled_at ?? undefined,
        projectName: r.project_name ?? undefined,
        projectDeadline: r.project_deadline ?? undefined,
        inviterName: r.inviter_name ?? undefined,
        inviterInitials: r.inviter_initials ?? undefined,
        taskCount: r.task_count == null ? undefined : Number(r.task_count),
    }));
};

/**
 * Find the partner resource row for a project the current user is involved in.
 * RLS scopes to rows the caller is party to.
 */
export const getPartnerInviteForProject = async (projectId: string): Promise<PartnerInvite | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await db
        .from('project_resources')
        .select(RESOURCE_COLUMNS)
        .eq('project_id', projectId)
        .eq('kind', 'partner')
        .order('created_at', { ascending: false });
    if (error) { console.error('getPartnerInviteForProject error:', error); return null; }
    const rows: any[] = data ?? [];
    if (!rows.length) return null;
    const asPartner = rows.find(r => r.user_id === user.id);
    return mapInvite(asPartner ?? rows[0]);
};

/** Task ids the partner has access to on a given resource row. */
export const listPartnerTaskAccess = async (inviteId: string): Promise<string[]> => {
    const { data, error } = await db
        .from('resource_task_access')
        .select('task_id')
        .eq('resource_id', inviteId);
    if (error) { console.error('listPartnerTaskAccess error:', error); return []; }
    return (data ?? []).map((r: any) => r.task_id);
};

// --- NEGOTIATION ---

/** Full message history of an invitation thread (oldest first). */
export const listNegotiationMessages = async (inviteId: string): Promise<PartnerNegotiationMessage[]> => {
    const { data, error } = await db
        .from('partner_negotiation_messages')
        .select(PARTNER_MESSAGE_COLUMNS)
        .eq('resource_id', inviteId)
        .order('created_at', { ascending: true });
    if (error) { console.error('listNegotiationMessages error:', error); return []; }
    return (data ?? []).map(mapMessage);
};

const extFromName = (name: string): string => {
    const dot = name.lastIndexOf('.');
    return dot > -1 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : 'bin';
};

/**
 * Upload a file to share inside a negotiation thread. Stored in the private
 * task-docs bucket under negotiations/{inviteId}/... — readable only by the
 * negotiation parties (storage RLS: storage_taskdocs_negotiation). Returns the
 * canonical path + metadata to attach to a message.
 */
export const uploadNegotiationAttachment = async (
    inviteId: string,
    file: File
): Promise<NegotiationAttachment> => {
    if (!NEGOTIATION_ATTACHMENT_MIME.includes(file.type)) {
        throw new Error('Filtypen understøttes ikke. Tilladt: billede, PDF, Word eller Excel.');
    }
    if (file.size > NEGOTIATION_ATTACHMENT_MAX_BYTES) {
        throw new Error('Filen er for stor (maks. 15 MB).');
    }
    const uuid = crypto.randomUUID();
    const storagePath = `negotiations/${inviteId}/${uuid}.${extFromName(file.name)}`;
    await assertStorageQuota();
    const { error } = await supabase.storage
        .from('task-docs')
        .upload(storagePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) {
        console.error('uploadNegotiationAttachment error:', error);
        throw new Error(error.message);
    }
    return { path: `task-docs/${storagePath}`, name: file.name, type: file.type };
};

/** Send a chat message, offer or counter-offer in the negotiation thread. */
export const sendNegotiationMessage = async (
    inviteId: string,
    kind: PartnerNegotiationKind,
    body: string,
    amountOre?: number,
    attachment?: NegotiationAttachment
): Promise<PartnerNegotiationMessage> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');

    const { data, error } = await db
        .from('partner_negotiation_messages')
        .insert({
            resource_id: inviteId,
            sender_id: user.id,
            kind,
            body: body || null,
            amount_ore: amountOre ?? null,
            attachment_path: attachment?.path ?? null,
            attachment_name: attachment?.name ?? null,
            attachment_type: attachment?.type ?? null,
        })
        .select(PARTNER_MESSAGE_COLUMNS)
        .single();
    if (error) {
        console.error('sendNegotiationMessage error:', error);
        throw new Error(error.message);
    }
    return mapMessage(data);
};

/**
 * Accept the negotiated price. Settles agreed_price_ore + settled_at and
 * marks the partner resource as 'active'.
 */
export const acceptInvite = async (inviteId: string, agreedPriceOre: number): Promise<void> => {
    const { error } = await db.rpc('accept_partner_invite', {
        p_invite_id: inviteId,
        p_agreed_price_ore: agreedPriceOre,
    });
    if (error) {
        console.error('acceptInvite error:', error);
        throw new Error(error.message);
    }
};

/** Partner declines the invitation. */
export const declineInvite = async (inviteId: string): Promise<void> => {
    const { error } = await db.rpc('decline_partner_invite', { p_invite_id: inviteId });
    if (error) {
        console.error('declineInvite error:', error);
        throw new Error(error.message);
    }
};

/** Manager cancels/withdraws the invitation (sets resource status = 'cancelled'). */
export const cancelInvite = async (inviteId: string): Promise<void> => {
    const { error } = await db
        .from('project_resources')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);
    if (error) {
        console.error('cancelInvite error:', error);
        throw new Error(error.message);
    }
};

// --- SCOPED PARTNER PROJECT VIEW ---

/**
 * The ONLY way partners read project data: name, description and deadline
 * via the get_partner_project_view SECURITY DEFINER RPC.
 */
export const getPartnerProjectView = async (projectId: string): Promise<PartnerProjectView | undefined> => {
    const { data, error } = await db.rpc('get_partner_project_view', { p_project_id: projectId });
    if (error) { console.error('getPartnerProjectView error:', error); return undefined; }
    const row = ((data as any[]) ?? [])[0];
    if (!row) return undefined;
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? '',
        deadline: row.deadline ?? null,
    };
};

/**
 * The tasks a partner can see on a project. RLS (tasks_select_partner_access)
 * scopes the result to allowlisted tasks via resource_task_access.
 */
export const getPartnerTasksForProject = async (projectId: string): Promise<Task[]> => {
    const { data, error } = await db
        .from('tasks')
        .select('id, title, status, due_date, description, assignees, checklist, is_milestone, estimated_hours, step, handover_status, completed_at, acceptance_report_path, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
    if (error) { console.error('getPartnerTasksForProject error:', error); return []; }
    return (data ?? []).map(mapPartnerTask);
};

// --- ACCEPTED PARTNER TASKS (for supplier GlobalTasksPage) ---

export interface AcceptedPartnerTask extends Task {
    projectName: string;
    projectId: string;
    inviteId: string;
    agreedPriceOre: number | null;
}

/** Returns all tasks from accepted partner resources for the current user. */
export const getMyAcceptedPartnerTasks = async (): Promise<AcceptedPartnerTask[]> => {
    const invites = await listMyPartnerInvites();
    const accepted = invites.filter(i => i.status === 'accepted');
    if (!accepted.length) return [];

    const groups = await Promise.all(
        accepted.map(async (invite) => {
            const tasks = await getPartnerTasksForProject(invite.projectId);
            return tasks.map((task): AcceptedPartnerTask => ({
                ...task,
                projectName: invite.projectName ?? '',
                projectId: invite.projectId,
                inviteId: invite.id,
                agreedPriceOre: invite.agreedPriceOre,
            }));
        })
    );
    return groups.flat();
};

// --- MANAGER OVERSIGHT: task overview per accepted partner ---

export interface PartnerTaskOverview {
    taskId: string;
    title: string;
    status: Task['status'];
    handoverStatus: Task['handoverStatus'];
    timeLoggedHours: number;
    docCount: number;
    activeCheckIn: { userName: string; checkedInAt: string } | null;
}

/** Fetches task-level stats for a set of task IDs (manager Partnere tab). */
export const getPartnerTasksOverview = async (
    projectId: string,
    taskIds: string[]
): Promise<PartnerTaskOverview[]> => {
    if (!taskIds.length) return [];

    const [tasksRes, docsRes, checkInsRes, timeResults] = await Promise.all([
        db.from('tasks')
            .select('id, title, status, handover_status')
            .in('id', taskIds),
        db.from('task_documentation')
            .select('task_id')
            .in('task_id', taskIds),
        db.from('task_check_ins')
            .select('task_id, user_name, checked_in_at')
            .in('task_id', taskIds)
            .is('checked_out_at', null),
        Promise.all(
            taskIds.map(tid =>
                db.rpc('get_task_time_total', { p_task_id: tid })
                    .then(({ data }: { data: any }) => ({ taskId: tid, total: Number(data ?? 0) }))
                    .catch(() => ({ taskId: tid, total: 0 }))
            )
        ),
    ]);

    const timeByTask = new Map<string, number>();
    (timeResults as { taskId: string; total: number }[]).forEach(({ taskId: tid, total }) => {
        timeByTask.set(tid, total);
    });

    const docsByTask = new Map<string, number>();
    ((docsRes.data ?? []) as any[]).forEach((r: any) => {
        docsByTask.set(r.task_id, (docsByTask.get(r.task_id) ?? 0) + 1);
    });

    const checkInByTask = new Map<string, { userName: string; checkedInAt: string }>();
    ((checkInsRes.data ?? []) as any[]).forEach((r: any) => {
        checkInByTask.set(r.task_id, { userName: r.user_name ?? '', checkedInAt: r.checked_in_at });
    });

    return ((tasksRes.data ?? []) as any[]).map((t: any): PartnerTaskOverview => ({
        taskId: t.id,
        title: t.title,
        status: t.status as Task['status'],
        handoverStatus: (t.handover_status ?? 'none') as Task['handoverStatus'],
        timeLoggedHours: Math.round((timeByTask.get(t.id) ?? 0) * 10) / 10,
        docCount: docsByTask.get(t.id) ?? 0,
        activeCheckIn: checkInByTask.get(t.id) ?? null,
    }));
};

// --- ACCEPTED PARTNER FOR TASK ---

export interface AcceptedPartnerInfo {
    partnerId: string;
    partnerName: string;
    agreedPriceOre: number | null;
    currency: string;
    settledAt?: string;
}

/**
 * Returns the accepted partner (settled price) for a given task via
 * resource_task_access. Used by TaskDetailPage.
 */
export const getAcceptedPartnerForTask = async (
    taskId: string,
    projectId: string
): Promise<AcceptedPartnerInfo | null> => {
    const { data: accessRows, error: accessErr } = await db
        .from('resource_task_access')
        .select('resource_id')
        .eq('task_id', taskId);
    if (accessErr || !accessRows?.length) return null;

    const resourceIds = (accessRows as any[]).map((r: any) => r.resource_id);

    const { data, error } = await db
        .from('project_resources')
        .select(`user_id, agreed_price_ore, currency, settled_at, profiles!project_resources_user_id_fkey(name)`)
        .eq('project_id', projectId)
        .eq('status', 'active')
        .eq('kind', 'partner')
        .in('id', resourceIds)
        .limit(1)
        .maybeSingle();

    if (error || !data) return null;
    return {
        partnerId: data.user_id,
        partnerName: data.profiles?.name ?? 'Underleverandør',
        agreedPriceOre: data.agreed_price_ore == null ? null : Number(data.agreed_price_ore),
        currency: data.currency ?? 'DKK',
        settledAt: data.settled_at ?? undefined,
    };
};

// --- PARTNER CONTACTS ---

export interface PartnerContact {
    id: string;
    username: string;
    name: string;
    initials: string;
    role: UserRole;
}

/**
 * The manager's connected contacts (user_connections), with role so
 * Underleverandør (EXTERNAL) contacts can be listed first.
 */
export const listPartnerContacts = async (): Promise<PartnerContact[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await db
        .from('user_connections')
        .select('connected_user_id, role, profiles!user_connections_connected_user_id_fkey(id, username, name, initials)')
        .eq('user_id', user.id);
    if (error) { console.error('listPartnerContacts error:', error); return []; }

    const contacts = ((data as any[]) ?? [])
        .filter((row: any) => row.profiles)
        .map((row: any): PartnerContact => ({
            id: row.profiles.id,
            username: row.profiles.username,
            name: row.profiles.name,
            initials: row.profiles.initials,
            role: (row.role as UserRole) ?? 'EMPLOYEE',
        }));
    return contacts.sort((a, b) => {
        if (a.role === 'EXTERNAL' && b.role !== 'EXTERNAL') return -1;
        if (a.role !== 'EXTERNAL' && b.role === 'EXTERNAL') return 1;
        return a.name.localeCompare(b.name, 'da');
    });
};

// --- QUICK TASK ACCESS ---
// Granting/listing/revoking access now goes through modules/tasks (taskAccess)
// (role-aware, works for project tasks too). This module keeps only the
// invitee-side accept flow, which that new module doesn't replace.

/** Rebuild tasks.assignees from all active quick_task_access rows. Throws on failure. */
const syncQuickTaskAssignees = async (taskId: string): Promise<void> => {
    const { data: accessRows, error: accessErr } = await db
        .from('quick_task_access')
        .select('user_id, profiles!quick_task_access_user_id_fkey(name, initials)')
        .eq('task_id', taskId)
        .eq('status', 'active');
    if (accessErr) throw new Error(accessErr.message);
    const newAssignees = ((accessRows ?? []) as any[]).map((r: any) => ({
        id: r.user_id,
        name: r.profiles?.name ?? '',
        initials: r.profiles?.initials ?? '',
    }));
    const { error: updateErr } = await db.from('tasks').update({ assignees: newAssignees }).eq('id', taskId);
    if (updateErr) throw new Error(updateErr.message);
};

/** Invitee accepts their quick-task invite (sets own row to 'active'). */
export const acceptQuickTaskInvite = async (taskId: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');
    const { error } = await db
        .from('quick_task_access')
        .update({ status: 'active' })
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .eq('status', 'pending');
    if (error) {
        console.error('acceptQuickTaskInvite error:', error);
        throw new Error(error.message);
    }
    await syncQuickTaskAssignees(taskId);
};

export interface PendingQuickTaskInvite {
    taskId: string;
    title: string;
    invitedBy: string;
}

/** Returns all quick-task invitations waiting for the current user to accept. */
export const getMyPendingQuickTaskInvites = async (): Promise<PendingQuickTaskInvite[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await db
        .from('quick_task_access')
        .select('task_id, invited_by')
        .eq('user_id', user.id)
        .eq('status', 'pending');
    if (error || !data?.length) return [];
    const taskIds = (data as any[]).map((r: any) => r.task_id as string);
    const { data: taskRows } = await db.from('tasks').select('id, title').in('id', taskIds);
    const titleMap = new Map(((taskRows ?? []) as any[]).map((t: any) => [t.id as string, t.title as string]));
    return (data as any[]).map((r: any) => ({
        taskId: r.task_id as string,
        title: titleMap.get(r.task_id) ?? 'Ukendt opgave',
        invitedBy: r.invited_by as string,
    }));
};

// --- REALTIME ---

export interface NegotiationEvent {
    type: 'message' | 'invite_updated';
    message?: PartnerNegotiationMessage;
    invite?: PartnerInvite;
}

/**
 * Subscribe to live updates on an invitation: new thread messages and
 * status/price changes on the project_resources row.
 */
export const subscribeToNegotiation = (
    inviteId: string,
    onEvent: (event: NegotiationEvent) => void
): (() => void) => {
    const channel = db
        .channel(`partner-negotiation:${inviteId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'partner_negotiation_messages',
            filter: `resource_id=eq.${inviteId}`,
        }, (payload: any) => {
            onEvent({ type: 'message', message: mapMessage(payload.new) });
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'project_resources',
            filter: `id=eq.${inviteId}`,
        }, (payload: any) => {
            onEvent({ type: 'invite_updated', invite: mapInvite(payload.new) });
        })
        .subscribe();
    return () => { db.removeChannel(channel); };
};
