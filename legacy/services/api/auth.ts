import { User, UserRole } from '../../types';
import { supabase } from '../supabaseClient';
import { authenticatedServerFetch } from './http';

// --- USER & AUTH ---

export const getProfileById = async (userId: string): Promise<{ id: string; name: string; initials: string; email?: string; companyName?: string | null } | null> => {
    const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, name, initials, email, company_name')
        .eq('id', userId)
        .maybeSingle();
    if (error) { console.error('getProfileById error:', error); return null; }
    if (!data) return null;
    return {
        id: data.id,
        name: data.name,
        initials: data.initials,
        email: data.email ?? undefined,
        companyName: data.company_name ?? null,
    };
};

export const getUserConnections = async (userId: string): Promise<User[]> => {
    const { data, error } = await supabase
        .from('user_connections')
        .select('connected_user_id, profiles!user_connections_connected_user_id_fkey(id, username, name, initials, email, subscription_tier)')
        .eq('user_id', userId);
    if (error) { console.error('getUserConnections error:', error); return []; }
    return (data ?? []).map((row: any) => {
        const p = row.profiles;
        return {
            id: p.id,
            username: p.username,
            name: p.name,
            initials: p.initials,
            email: p.email ?? undefined,
            subscriptionTier: p.subscription_tier,
            appRole: 'user' as const,
        };
    });
};

// Uses the search_users SECURITY DEFINER RPC so RLS does not block discovery.
export const searchUsersToConnect = async (_currentUserId: string, query: string): Promise<User[]> => {
    const { data, error } = await supabase.rpc('search_users' as any, { p_query: query });
    if (error) { console.error('searchUsersToConnect error:', error); return []; }
    return ((data as any[]) ?? []).map((p: any) => ({
        id: p.id,
        username: p.username,
        name: p.name,
        initials: p.initials,
        subscriptionTier: 'FREE' as const,
        appRole: 'user' as const,
    }));
};

export const sendConnectionRequest = async (toUserId: string, role: UserRole = 'EMPLOYEE'): Promise<void> => {
    const { error } = await supabase.rpc('send_connection_request' as any, {
        p_to_user_id: toUserId,
        p_role: role,
    });
    if (error) {
        console.error('sendConnectionRequest error:', error);
        throw new Error(error.message);
    }
};

export interface PendingConnectionRequest {
    requestId: string;
    fromUserId: string;
    username: string;
    name: string;
    initials: string;
    role: string;
    createdAt: string;
}

export const getPendingConnectionRequests = async (): Promise<PendingConnectionRequest[]> => {
    const { data, error } = await supabase.rpc('get_pending_connection_requests' as any);
    if (error) { console.error('getPendingConnectionRequests error:', error); return []; }
    return ((data as any[]) ?? []).map((r: any) => ({
        requestId: r.request_id,
        fromUserId: r.from_user_id,
        username: r.username,
        name: r.name,
        initials: r.initials,
        role: r.role,
        createdAt: r.created_at,
    }));
};

export const acceptConnectionRequest = async (requestId: string): Promise<void> => {
    const { error } = await supabase.rpc('accept_connection_request' as any, { p_request_id: requestId });
    if (error) {
        console.error('acceptConnectionRequest error:', error);
        throw new Error(error.message);
    }
};

export const rejectConnectionRequest = async (requestId: string): Promise<void> => {
    const { error } = await supabase.rpc('reject_connection_request' as any, { p_request_id: requestId });
    if (error) {
        console.error('rejectConnectionRequest error:', error);
        throw new Error(error.message);
    }
};

export const getSentConnectionRequests = async (): Promise<Set<string>> => {
    const { data } = await supabase
        .from('connection_requests')
        .select('to_user_id')
        .eq('status', 'pending');
    return new Set((data ?? []).map((r: any) => r.to_user_id));
};

export const createConnectionInvite = async (
    email: string,
    role: UserRole
): Promise<{ success: boolean; message?: string; emailSent?: boolean; alreadyMember?: boolean }> => {
    try {
        const res = await authenticatedServerFetch('/invite', {
            method: 'POST',
            body: JSON.stringify({ email, role }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('createConnectionInvite error:', data?.error);
            return { success: false, message: data?.error };
        }
        return {
            success: data.success !== false,
            message: data.message,
            emailSent: data.emailSent,
            alreadyMember: data.alreadyMember,
        };
    } catch (error) {
        console.error('createConnectionInvite error:', error);
        return { success: false };
    }
};
