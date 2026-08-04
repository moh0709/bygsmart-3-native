/**
 * Task chat service: per-task messages with optional attachment and @mentions.
 * Table created by the task_ks_and_chat migration; attachments reuse the
 * private "task-docs" bucket via uploadTaskFile.
 *
 * RLS is enforced server-side — this module assumes the caller is
 * authenticated and has project-member or partner-task access.
 */

import { TaskChatMessage } from '../../../types';
import { supabase } from '../../../services/supabaseClient';
import { uploadTaskFile } from './taskWorkspace/storage';

// Use an untyped handle for tables not yet in database.types (same pattern as
// services/partners.ts and services/taskWorkspace.ts).
const db = supabase as any;

// ---------------------------------------------------------------------------
// MAPPERS
// ---------------------------------------------------------------------------

const mapMessage = (r: any): TaskChatMessage => ({
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    senderId: r.sender_id,
    senderName: r.sender_name ?? '',
    body: r.body ?? undefined,
    attachmentPath: r.attachment_path ?? undefined,
    attachmentMime: r.attachment_mime ?? undefined,
    mentions: (r.mentions as string[]) ?? [],
    createdAt: r.created_at,
});

// ---------------------------------------------------------------------------
// MESSAGES
// ---------------------------------------------------------------------------

export const listTaskChatMessages = async (taskId: string): Promise<TaskChatMessage[]> => {
    const { data, error } = await db
        .from('task_chat_messages')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
    if (error) {
        console.error('listTaskChatMessages error:', error);
        throw new Error(error.message);
    }
    return (data ?? []).map(mapMessage);
};

export interface SendTaskChatMessageParams {
    taskId: string;
    /** Ignored for persistence; the task row is authoritative. */
    projectId?: string | null;
    body?: string;
    mentions?: string[];
    file?: File | Blob;
    mimeType?: string;
}

/**
 * Send a chat message. If a file is attached it is uploaded to the task-docs
 * bucket first and the resulting path stored on the message row.
 */
export const sendTaskChatMessage = async (
    params: SendTaskChatMessageParams
): Promise<TaskChatMessage> => {
    const { taskId, body, mentions, file, mimeType } = params;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');

    const { data: task, error: taskError } = await db
        .from('tasks')
        .select('project_id')
        .eq('id', taskId)
        .single();
    if (taskError || !task) {
        throw new Error(taskError?.message ?? 'Opgaven blev ikke fundet');
    }
    const projectId: string | null = task.project_id ?? null;

    // Resolve sender display name from the profile (sender_name is denormalized
    // on the row so history keeps the name even if the profile changes).
    const { data: profile } = await db
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
    const senderName: string = profile?.name ?? '';

    let attachmentPath: string | null = null;
    let attachmentMime: string | null = null;
    if (file) {
        attachmentPath = await uploadTaskFile(projectId, taskId, file, mimeType);
        attachmentMime = mimeType ?? (file instanceof File ? file.type : null);
    }

    const { data, error } = await db
        .from('task_chat_messages')
        .insert({
            task_id: taskId,
            project_id: projectId,
            sender_id: user.id,
            sender_name: senderName,
            body: body ?? null,
            attachment_path: attachmentPath,
            attachment_mime: attachmentMime,
            mentions: mentions ?? [],
        })
        .select('*')
        .single();

    if (error) {
        console.error('sendTaskChatMessage error:', error);
        throw new Error(error.message);
    }
    return mapMessage(data);
};

// ---------------------------------------------------------------------------
// REALTIME
// ---------------------------------------------------------------------------

/**
 * Subscribe to new messages on a task. Returns an unsubscribe cleanup —
 * same pattern as subscribeToNegotiation in services/partners.ts.
 */
export const subscribeToTaskChat = (
    taskId: string,
    onMessage: (message: TaskChatMessage) => void
): (() => void) => {
    // Unique per call: supabase-js reuses a channel object when the topic
    // string repeats, so a shared `task-chat:${taskId}` topic would make a
    // second concurrent subscriber (e.g. the unread badge and the open chat
    // tab) call `.on()` on a channel the first subscriber already
    // `.subscribe()`d, which throws.
    const channel = db
        .channel(`task-chat:${taskId}:${crypto.randomUUID()}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'task_chat_messages',
            filter: `task_id=eq.${taskId}`,
        }, (payload: any) => {
            onMessage(mapMessage(payload.new));
        })
        .subscribe();
    return () => { db.removeChannel(channel); };
};

// ---------------------------------------------------------------------------
// MENTION NOTIFICATIONS
// ---------------------------------------------------------------------------

const getAuthHeader = async (): Promise<Record<string, string>> => {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
};

export interface NotifyMentionsParams {
    taskId: string;
    mentionedUserIds: string[];
    preview: string;
    link: string;
}

/**
 * Ask the server to push-notify mentioned users. Best-effort: never throws,
 * so a failed notification cannot block the message send.
 */
export const notifyMentions = async (params: NotifyMentionsParams): Promise<void> => {
    if (!params.mentionedUserIds.length) return;
    try {
        await fetch('/api/push/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(await getAuthHeader()),
            },
            body: JSON.stringify(params),
        });
    } catch (error) {
        console.warn('notifyMentions silent failure:', error);
    }
};

// ---------------------------------------------------------------------------
// PER-USER READ CURSOR
// ---------------------------------------------------------------------------

export const getTaskChatUnreadCount = async (
    taskId: string,
    currentUserId: string
): Promise<number> => {
    const { data: read, error: readError } = await db
        .from('task_chat_reads')
        .select('last_read_at')
        .eq('task_id', taskId)
        .eq('user_id', currentUserId)
        .maybeSingle();
    if (readError) throw new Error(readError.message);

    let query = db
        .from('task_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', taskId)
        .neq('sender_id', currentUserId);
    if (read?.last_read_at) query = query.gt('created_at', read.last_read_at);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
};

export const markTaskChatRead = async (
    taskId: string,
    currentUserId: string
): Promise<void> => {
    const now = new Date().toISOString();
    const { error } = await db.from('task_chat_reads').upsert({
        task_id: taskId,
        user_id: currentUserId,
        last_read_at: now,
        updated_at: now,
    }, { onConflict: 'task_id,user_id' });
    if (error) throw new Error(error.message);
};

export const subscribeToTaskChatReads = (
    taskId: string,
    currentUserId: string,
    onRead: () => void
): (() => void) => {
    const channel = db
        .channel(`task-chat-read:${taskId}:${currentUserId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'task_chat_reads',
            filter: `task_id=eq.${taskId}`,
        }, (payload: any) => {
            const row = payload.new ?? payload.old;
            if (row?.user_id === currentUserId) onRead();
        })
        .subscribe();
    return () => { db.removeChannel(channel); };
};
