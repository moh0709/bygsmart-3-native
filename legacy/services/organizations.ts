// ─────────────────────────────────────────────────────────────────────────────
// Client service for organizations (BYG 3.0 Phase 2 — multi-org tenancy).
//
// Membership rows are written directly under RLS (organization_members
// policies in 20260713000002); privileged transitions go through the
// SECURITY DEFINER RPCs (create_organization / set_active_org /
// accept_org_invite). The server route /api/org/invite-notify sends the
// invite e-mail + push the client can't send itself.
//
// NOTE: invites to TEAM-BACKED orgs (sourceTeamId set) must go through the
// existing team-seat flow (TeamManagementPage) — seats are the Stripe
// billing source of truth until Phase 8. The org-mirror trigger keeps
// organization_members in sync with seats automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient';
import { authenticatedServerFetch } from './api/http';

const db = supabase;

export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgMemberStatus = 'pending' | 'active' | 'removed';

export interface Organization {
    id: string;
    name: string;
    cvr: string | null;
    logoUrl: string | null;
    grandfathered: boolean;
    storageAllowanceGb: number;
    /** Non-null ⇒ team-backed org: members are managed via Teams & sæder. */
    sourceTeamId: string | null;
    createdBy: string;
}

export interface OrgMembership {
    role: OrgRole;
    status: OrgMemberStatus;
    org: Organization;
}

export interface OrgMember {
    id: string;
    userId: string | null;
    inviteEmail: string | null;
    role: OrgRole;
    status: OrgMemberStatus;
    name: string;
    initials: string;
}

const mapOrg = (o: any): Organization => ({
    id: o.id,
    name: o.name,
    cvr: o.cvr ?? null,
    logoUrl: o.logo_url ?? null,
    grandfathered: !!o.grandfathered,
    storageAllowanceGb: o.storage_allowance_gb ?? 5,
    sourceTeamId: o.source_team_id ?? null,
    createdBy: o.created_by,
});

/** The caller's memberships (pending + active) with their orgs. */
export const listMyOrganizations = async (): Promise<OrgMembership[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await db
        .from('organization_members')
        .select('role, status, organizations!organization_members_org_id_fkey(*)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'active']);
    if (error) { console.error('listMyOrganizations error:', error); return []; }
    return ((data ?? []) as any[])
        .filter((r) => r.organizations)
        .map((r) => ({ role: r.role as OrgRole, status: r.status as OrgMemberStatus, org: mapOrg(r.organizations) }));
};

/** The caller's active org id (profiles.active_org_id, RPC-validated writes). */
export const getActiveOrgId = async (): Promise<string | null> => {
    const { data, error } = await db.rpc('get_active_org_id');
    if (error) { console.error('getActiveOrgId error:', error); return null; }
    return (data as string | null) ?? null;
};

/** All members of an org (visible to fellow members under RLS). */
export const listOrgMembers = async (orgId: string): Promise<OrgMember[]> => {
    const { data, error } = await db
        .from('organization_members')
        .select('id, user_id, invite_email, role, status, profiles!organization_members_user_id_fkey(name, initials)')
        .eq('org_id', orgId)
        .in('status', ['pending', 'active'])
        .order('created_at', { ascending: true });
    if (error) { console.error('listOrgMembers error:', error); return []; }
    return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        userId: r.user_id,
        inviteEmail: r.invite_email,
        role: r.role as OrgRole,
        status: r.status as OrgMemberStatus,
        name: r.profiles?.name ?? r.invite_email ?? '',
        initials: r.profiles?.initials ?? '',
    }));
};

/** Create an org + owner membership + switch to it (atomic RPC). Returns the new org id. */
export const createOrganization = async (name: string, cvr?: string): Promise<string> => {
    const { data, error } = await db.rpc('create_organization', {
        p_name: name.trim(),
        p_cvr: cvr?.trim() || null,
    });
    if (error) { console.error('createOrganization error:', error); throw new Error(error.message); }
    return data as string;
};

/** Switch the caller's active org — server-validated membership. */
export const switchActiveOrg = async (orgId: string): Promise<void> => {
    const { error } = await db.rpc('set_active_org', { p_org_id: orgId });
    if (error) { console.error('switchActiveOrg error:', error); throw new Error(error.message); }
};

/** Accept the caller's own pending invite. */
export const acceptOrgInvite = async (orgId: string): Promise<void> => {
    const { error } = await db.rpc('accept_org_invite', { p_org_id: orgId });
    if (error) { console.error('acceptOrgInvite error:', error); throw new Error(error.message); }
};

/**
 * Invite an existing user (by id) or a not-yet-registered address (by email)
 * to a NON-team-backed org. handle_new_user() auto-links + auto-activates
 * email invites on signup.
 */
export const inviteOrgMember = async (
    orgId: string,
    params: { userId?: string; email?: string },
    role: Exclude<OrgRole, 'owner'> = 'member'
): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind');
    const row = params.userId
        ? { org_id: orgId, user_id: params.userId, role, status: 'pending', invited_by: user.id }
        : { org_id: orgId, invite_email: params.email!.trim().toLowerCase(), role, status: 'pending', invited_by: user.id };
    const { error } = await db.from('organization_members').insert(row);
    if (error) { console.error('inviteOrgMember error:', error); throw new Error(error.message); }
};

/** Owner/admin changes a member's role (member ⇄ admin; ownership transfer is out of scope). */
export const updateOrgMemberRole = async (memberId: string, role: Exclude<OrgRole, 'owner'>): Promise<void> => {
    const { error } = await db.from('organization_members').update({ role }).eq('id', memberId);
    if (error) { console.error('updateOrgMemberRole error:', error); throw new Error(error.message); }
};

/** Owner/admin removes a member (or a member leaves) — the last active owner is DB-guarded. */
export const removeOrgMember = async (memberId: string): Promise<void> => {
    const { error } = await db.from('organization_members').delete().eq('id', memberId);
    if (error) { console.error('removeOrgMember error:', error); throw new Error(error.message); }
};

export interface OrgStorageUsage {
    bytesTotal: number;
    bytesLegacy: number;
    objectCount: number;
    computedAt: string;
}

/**
 * The org's metered storage usage (refreshed nightly by pg_cron —
 * see refresh_org_storage_usage() in 20260715000001). Null until the first
 * refresh has run or when the caller isn't a member.
 */
export const getOrgStorageUsage = async (orgId: string): Promise<OrgStorageUsage | null> => {
    const { data, error } = await supabase
        .from('org_storage_usage')
        .select('bytes_total, bytes_legacy, object_count, computed_at')
        .eq('org_id', orgId)
        .maybeSingle();
    if (error || !data) return null;
    return {
        bytesTotal: Number(data.bytes_total) || 0,
        bytesLegacy: Number(data.bytes_legacy) || 0,
        objectCount: data.object_count ?? 0,
        computedAt: data.computed_at,
    };
};

/** Best-effort invite e-mail + push via the server (never blocks the invite itself). */
export const notifyOrgInvite = async (params: { orgId: string; granteeUserId?: string; granteeEmail?: string }): Promise<void> => {
    try {
        await authenticatedServerFetch('/org/invite-notify', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    } catch (error) {
        console.error('notifyOrgInvite error:', error);
    }
};
