import { LogEntry, ActivityLogItem, Notification } from '../../types';
import { supabase } from '../supabaseClient';
import { NOTIFICATION_COLUMNS, NotificationRow } from './columns';

// --- LOGS & NOTIFICATIONS ---

export const mapNotification = (n: NotificationRow): Notification => ({
    id: n.id,
    text: n.text,
    timestamp: n.timestamp,
    isRead: n.is_read ?? false,
    link: n.link ?? '',
    type: (n as any).type ?? 'info',
    metadata: (n as any).metadata ?? {},
});

export const getLogs = async (): Promise<LogEntry[]> => {
    const { data, error } = await supabase
        .from('logs')
        .select('id, timestamp, level, message')
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) { console.error('getLogs error:', error); return []; }
    return (data ?? []).map((l: any) => ({
        id: l.id,
        timestamp: l.timestamp,
        level: l.level,
        message: l.message,
    }));
};

export const clearLogs = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('logs').delete().eq('user_id', user.id);
    if (error) console.error('clearLogs error:', error);
};

export const getNotifications = async (): Promise<Notification[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(20);
    if (error) { console.error('getNotifications error:', error); return []; }
    return ((data ?? []) as any[]).map(mapNotification);
};

export const markNotificationAsRead = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
    if (error) console.error('markNotificationAsRead error:', error);
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    if (error) console.error('markAllNotificationsAsRead error:', error);
};

export const acceptTaskInvitation = async (
    notificationId: string,
): Promise<void> => {
    // Delegate entirely to the SECURITY DEFINER RPC, which:
    //   1. Validates the notification belongs to the caller.
    //   2. Derives project_id / task_id / member_kind from notification.metadata
    //      (not from caller-provided arguments, preventing kind spoofing).
    //   3. Updates or creates the project_resources row to status='active'.
    //   4. For partner rows: upserts the resource_task_access allowlist entry.
    //   5. Marks the notification read only after the membership update succeeds.
    const { error } = await (supabase as any).rpc('accept_task_invite_notification', {
        p_notification_id: notificationId,
    });
    if (error) {
        console.error('acceptTaskInvitation error:', error);
        throw new Error(error.message);
    }
};

export const declineTaskInvitation = async (notificationId: string): Promise<void> => {
    await markNotificationAsRead(notificationId);
};

const PROJECT_DETAIL_RE = /project-detail\/([a-f0-9-]+)/;

export const getUnreadNotificationsByProject = async (): Promise<Record<string, number>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};
    const { data, error } = await supabase
        .from('notifications')
        .select('link')
        .eq('user_id', user.id)
        .eq('is_read', false);
    if (error) { console.error('getUnreadNotificationsByProject error:', error); return {}; }
    const map: Record<string, number> = {};
    for (const row of (data ?? []) as any[]) {
        const link: string = row.link ?? '';
        const match = link.match(PROJECT_DETAIL_RE);
        if (match) {
            const projectId = match[1];
            map[projectId] = (map[projectId] ?? 0) + 1;
        }
    }
    return map;
};

export const getTotalUnreadProjectNotifications = async (): Promise<number> => {
    const map = await getUnreadNotificationsByProject();
    return Object.values(map).reduce((sum, count) => sum + count, 0);
};

export const getActivityLog = async (projectId: string): Promise<ActivityLogItem[]> => {
    const { data, error } = await supabase
        .from('activity_log')
        .select('id, type, user_name, description, timestamp')
        .eq('project_id', projectId)
        .order('timestamp', { ascending: false })
        .limit(20);
    if (error) { console.error('getActivityLog error:', error); return []; }
    return (data ?? []).map((a: any) => ({
        id: a.id,
        type: a.type,
        user: a.user_name,
        description: a.description,
        timestamp: a.timestamp,
    }));
};
