import { supabase } from '../../../services/supabaseClient';
import { findUserByEmail } from '../../tasks';

// ─────────────────────────────────────────────────────────────────────────────
// Arbejdshold (Teams v2 T1) — org-scoped work teams with an appointed leader
// and invitation-based membership. Tables: org_teams + org_team_members
// (20260716000005). The Stripe billing team (teams/team_seats) is separate.
// ─────────────────────────────────────────────────────────────────────────────

const db = supabase as any;

export type OrgTeamRole = 'leader' | 'member';
export type OrgTeamMemberStatus = 'pending' | 'active';

export interface OrgTeamMember {
    userId: string;
    role: OrgTeamRole;
    status: OrgTeamMemberStatus;
    name: string;
    initials: string;
    email: string | null;
}

export interface OrgTeam {
    id: string;
    orgId: string;
    name: string;
    leaderId: string | null;
    createdBy: string;
    members: OrgTeamMember[];
}

const mapTeam = (t: any): OrgTeam => ({
    id: t.id,
    orgId: t.org_id,
    name: t.name,
    leaderId: t.leader_id ?? null,
    createdBy: t.created_by,
    members: (t.org_team_members ?? []).map((m: any) => ({
        userId: m.user_id,
        role: m.role,
        status: m.status,
        name: m.profiles?.name ?? 'Ukendt',
        initials: m.profiles?.initials ?? '?',
        email: m.profiles?.email ?? null,
    })),
});

/** All work teams in the caller's active org (RLS scopes to org members). */
export const listOrgTeams = async (): Promise<OrgTeam[]> => {
    const { data, error } = await db
        .from('org_teams')
        // profiles must be disambiguated: org_team_members has TWO FKs to
        // profiles (user_id + invited_by) and PostgREST refuses ambiguous embeds.
        .select('id, org_id, name, leader_id, created_by, org_team_members(user_id, role, status, profiles!org_team_members_user_id_fkey(name, initials, email))')
        .order('created_at', { ascending: true });
    if (error) { console.error('listOrgTeams error:', error); return []; }
    return (data ?? []).map(mapTeam);
};

export const createOrgTeam = async (orgId: string, name: string): Promise<OrgTeam> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind.');
    const { data, error } = await db
        .from('org_teams')
        .insert({ org_id: orgId, name: name.trim(), created_by: user.id })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return mapTeam({ ...data, org_team_members: [] });
};

export const renameOrgTeam = async (teamId: string, name: string): Promise<void> => {
    const { error } = await db
        .from('org_teams')
        .update({ name: name.trim(), updated_at: new Date().toISOString() })
        .eq('id', teamId);
    if (error) throw new Error(error.message);
};

export const deleteOrgTeam = async (teamId: string): Promise<void> => {
    const { error } = await db.from('org_teams').delete().eq('id', teamId);
    if (error) throw new Error(error.message);
};

/**
 * Invite a profile to the team by e-mail (as member or directly as leader).
 * The invitee accepts/declines on /team under "Mine hold".
 */
export const inviteOrgTeamMember = async (teamId: string, email: string, role: OrgTeamRole = 'member'): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind.');
    const found = await findUserByEmail(email.trim());
    if (!found) throw new Error('Ingen BygSmart-bruger med den e-mail. Invitér personen til appen først (Team & Adgang).');
    const { error } = await db
        .from('org_team_members')
        .insert({ team_id: teamId, user_id: found.id, role, status: 'pending', invited_by: user.id });
    if (error) {
        throw new Error(error.code === '23505' ? 'Personen er allerede på holdet (eller inviteret).' : error.message);
    }
};

/** Accept (status → active) or decline (row removed) my own invitation. */
export const respondToOrgTeamInvite = async (teamId: string, accept: boolean): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Ikke logget ind.');
    const { error } = accept
        ? await db.from('org_team_members')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('team_id', teamId).eq('user_id', user.id)
        : await db.from('org_team_members')
            .delete()
            .eq('team_id', teamId).eq('user_id', user.id);
    if (error) throw new Error(error.message);
};

export const removeOrgTeamMember = async (teamId: string, userId: string): Promise<void> => {
    const { error } = await db.from('org_team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    if (error) throw new Error(error.message);
};

/**
 * Appoint an ACTIVE member as team leader (the "manager" of the hold):
 * demotes a previous leader-row to member and syncs org_teams.leader_id.
 */
export const setOrgTeamLeader = async (teamId: string, userId: string): Promise<void> => {
    const { error: demoteError } = await db
        .from('org_team_members')
        .update({ role: 'member', updated_at: new Date().toISOString() })
        .eq('team_id', teamId).eq('role', 'leader');
    if (demoteError) throw new Error(demoteError.message);
    const { error: promoteError } = await db
        .from('org_team_members')
        .update({ role: 'leader', updated_at: new Date().toISOString() })
        .eq('team_id', teamId).eq('user_id', userId);
    if (promoteError) throw new Error(promoteError.message);
    const { error: teamError } = await db
        .from('org_teams')
        .update({ leader_id: userId, updated_at: new Date().toISOString() })
        .eq('id', teamId);
    if (teamError) throw new Error(teamError.message);
};
