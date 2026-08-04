import React, { useState, useEffect, useCallback } from 'react';
import { List, Network } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthProvider';
import { useOrg } from '../../../core/org/OrgProvider';
import { supabase } from '../../../services/supabaseClient';
import {
  Alert,
  AppScreen,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  ListRow,
  Modal,
  ProgressBar,
  SegmentedControl,
  SkeletonList,
} from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';
import { CheckIcon, CopyIcon, PlusIcon, TrashIcon, UsersIcon } from '../../../components/icons';
import { OrgTeamsSection } from '../components/OrgTeamsSection';
import { TeamOrgChart } from '../components/TeamOrgChart';
import { ROLE_LABELS, type ChartPerson, type OrgChartData } from '../components/OrgChartView';
import { useTeamViewMode, type TeamViewMode } from '../hooks/useTeamViewMode';
import { useOrgChartData } from '../hooks/useOrgChartData';

// ── View toggle (Liste ↔ Diagram) — shared by both /team branches ────────────

const TeamViewToggle: React.FC<{ value: TeamViewMode; onChange: (m: TeamViewMode) => void }> = ({ value, onChange }) => (
  <SegmentedControl<TeamViewMode>
    label="Skift visning"
    value={value}
    onChange={onChange}
    options={[
      { label: 'Liste', value: 'list', icon: <List className="w-4 h-4" /> },
      { label: 'Diagram', value: 'chart', icon: <Network className="w-4 h-4" /> },
    ]}
  />
);

// ── Types ────────────────────────────────────────────────────────────────────

type SeatTier = 'PRO' | 'PREMIUM';
type SeatStatus = 'pending' | 'active' | 'declined';

interface OrgMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  job_title: string | null;
  team_role: string;
}

interface OrgData {
  team_id: string;
  team_name: string;
  leader: OrgMember;
  members: OrgMember[];
  my_role: string;
}

// ── Badge mappings (docs/UI_OVERHAUL_PLAN.md §C4) ───────────────────────────

/** Real role values → approved badge palette:
 *  owner/leader → brand, manager → info, worker/member → neutral, client → warning. */
const ROLE_BADGES: Record<string, { variant: BadgeVariant; label: string }> = {
  owner: { variant: 'brand', label: 'Ejer' },
  leader: { variant: 'brand', label: 'Leder' },
  manager: { variant: 'info', label: 'Projektleder' },
  worker: { variant: 'neutral', label: 'Medarbejder' },
  member: { variant: 'neutral', label: 'Medlem' },
  client: { variant: 'warning', label: 'Kunde' },
};

const roleBadge = (role: string): { variant: BadgeVariant; label: string } =>
  ROLE_BADGES[role] ?? { variant: 'neutral', label: role };

const SEAT_STATUS_BADGES: Record<SeatStatus, { variant: BadgeVariant; label: string }> = {
  active: { variant: 'success', label: 'Aktiv' },
  pending: { variant: 'neutral', label: 'Afventer' },
  declined: { variant: 'danger', label: 'Afvist' },
};

// ── Member org-view ────────────────────────────────────────────────────────

const MemberOrgView: React.FC = () => {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const [viewMode, setViewMode] = useTeamViewMode();
  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {

        const { data, error: rpcErr } = await (supabase as any).rpc('get_my_team_org');
        if (rpcErr) throw rpcErr;
        setOrg(data);
      } catch (e: any) {
        setError(e.message ?? 'Kunne ikke hente teamdata');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Chart fallback when a member has no mirrored org: leader as root, the
  // get_my_team_org members as the single team.
  const memberFallback = useCallback((): OrgChartData | null => {
    if (!org) return null;
    const owner: ChartPerson = {
      userId: org.leader.id,
      name: org.leader.name,
      email: org.leader.email,
      roleLabel: ROLE_LABELS.leader,
      isOwner: true,
    };
    const members: ChartPerson[] = org.members.map((m) => ({
      userId: m.id,
      name: m.name,
      email: m.email,
      roleLabel: ROLE_LABELS.member,
      teamId: org.team_id,
      teamName: org.team_name,
      teamRole: 'member',
    }));
    return { owner, teams: [{ id: org.team_id, name: org.team_name, leader: null, members }], unassigned: [] };
  }, [org]);

  const viewerIsOwner = !!activeOrg && user?.id === activeOrg.createdBy;
  const chart = useOrgChartData({ enabled: viewMode === 'chart', fallback: memberFallback });

  if (loading) {
    return <SkeletonList count={2} label="Indlæser team…" className="mt-2" />;
  }

  // Chart mode: visual org overview (no list-only management sections).
  if (viewMode === 'chart') {
    return (
      <div className="flex flex-col gap-4 mt-2">
        <TeamViewToggle value={viewMode} onChange={setViewMode} />
        <TeamOrgChart
          data={chart.data}
          loading={chart.loading}
          viewerIsOwner={viewerIsOwner}
          currentUserId={user?.id}
          onRefresh={chart.refresh}
        />
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="flex flex-col gap-4 mt-2">
        <TeamViewToggle value={viewMode} onChange={setViewMode} />
        <Alert variant="danger" title="Kunne ikke hente teamdata">
          {error ?? 'Teamdata ikke fundet.'}
        </Alert>
      </div>
    );
  }

  const all = [org.leader, ...org.members];
  const leaderRole = roleBadge(org.leader.team_role || 'leader');

  return (
    <div className="flex flex-col gap-4 mt-2">
      <TeamViewToggle value={viewMode} onChange={setViewMode} />
      {/* Arbejdshold (Teams v2) */}
      <OrgTeamsSection />

      {/* Team hero card */}
      <div className="rounded-card bg-gradient-to-br from-brand-primary to-brand-strong p-5 text-white shadow-card">
        <p className="text-caption font-semibold uppercase tracking-widest text-white/70 mb-1">Dit team</p>
        <h2 className="text-title">{org.team_name}</h2>
        <div className="mt-3 inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-white/80" aria-hidden="true" />
          <span className="text-caption font-semibold">
            {user?.subscriptionTier ?? 'PRO'} · Teammedlem
          </span>
        </div>
      </div>

      {/* Info callout */}
      <Alert variant="info">
        Du er tilmeldt dette team og har adgang via teamlederens abonnement. Du kan ikke oprette dit
        eget team, mens du er teammedlem.
      </Alert>

      {/* Org hierarchy */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border dark:border-border-dark">
          <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Organisation</h3>
          <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {all.length} {all.length === 1 ? 'person' : 'personer'}
          </p>
        </div>

        <ul className="divide-y divide-border dark:divide-border-dark">
          {/* Leader row */}
          <li>
            <ListRow
              leading={<Avatar name={org.leader.name} size="md" />}
              title={org.leader.name}
              subtitle={org.leader.job_title ?? org.leader.email}
              trailing={<Badge variant={leaderRole.variant}>{leaderRole.label}</Badge>}
            />
          </li>

          {/* Member rows */}
          {org.members.map(member => {
            const isMe = member.id === user?.id;
            const rb = roleBadge(member.team_role || 'member');
            return (
              <li key={member.id}>
                <ListRow
                  leading={<Avatar name={member.name} size="md" />}
                  title={isMe ? `${member.name} (dig)` : member.name}
                  subtitle={member.job_title ?? member.email}
                  trailing={<Badge variant={rb.variant}>{rb.label}</Badge>}
                />
              </li>
            );
          })}

          {org.members.length === 0 && (
            <li className="px-4 py-4 text-center">
              <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                Ingen andre teammedlemmer endnu.
              </p>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
};


interface TeamSeat {
  id: string;
  email: string;
  subscription_tier: SeatTier;
  status: SeatStatus;
  profile_id: string | null;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  leader_id: string;
  created_at: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

const TeamManagementPage: React.FC = () => {
  const { user } = useAuth();

  // Staff/members see the org hierarchy; leaders see the management view
  const isMember = user?.teamRole === 'member';


  const db = supabase as any;

  const [team, setTeam] = useState<Team | null>(null);
  const [seats, setSeats] = useState<TeamSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for creating / editing team
  const [teamName, setTeamName] = useState('');

  // New seat form (invite flow)
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newSeatEmail, setNewSeatEmail] = useState('');
  const [newSeatTier, setNewSeatTier] = useState<SeatTier>('PRO');
  const [addingSeat, setAddingSeat] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // View mode (Liste ↔ Diagram) + org-chart data for the leader/management view.
  const [viewMode, setViewMode] = useTeamViewMode();
  const { activeOrg } = useOrg();
  const viewerIsOwner = !!activeOrg && user?.id === activeOrg.createdBy;
  const leaderFallback = useCallback((): OrgChartData | null => {
    if (!user) return null;
    const owner: ChartPerson = {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleLabel: ROLE_LABELS.leader,
      isOwner: true,
    };
    if (!team) return { owner, teams: [], unassigned: [] };
    const members: ChartPerson[] = seats
      .filter((s) => s.status === 'active')
      .map((s) => ({
        userId: s.profile_id,
        name: s.email,
        email: s.email,
        roleLabel: ROLE_LABELS.member,
        teamId: team.id,
        teamName: team.name,
        teamRole: 'member',
      }));
    return { owner, teams: [{ id: team.id, name: team.name, leader: null, members }], unassigned: [] };
  }, [user, team, seats]);
  const chart = useOrgChartData({ enabled: viewMode === 'chart', fallback: leaderFallback });

  // Real-time seat updates
  useEffect(() => {
    if (!team) return;
    const channel = (supabase as any)
      .channel(`team_seats:${team.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_seats',
        filter: `team_id=eq.${team.id}`,
      }, (payload: any) => {
        if (payload.eventType === 'UPDATE') {
          setSeats(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s));
        } else if (payload.eventType === 'INSERT') {
          setSeats(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'DELETE') {
          setSeats(prev => prev.filter(s => s.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [team?.id]);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTeamData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Load team where user is leader
      const { data: teamData, error: teamErr } = await db
        .from('teams')
        .select('*')
        .eq('leader_id', user.id)
        .maybeSingle();

      if (teamErr) throw teamErr;

      if (teamData) {
        setTeam(teamData);
        setTeamName(teamData.name);

        // Load seats for the team
        const { data: seatData, error: seatsErr } = await db
          .from('team_seats')
          .select('*')
          .eq('team_id', teamData.id)
          .order('created_at', { ascending: true });

        if (seatsErr) throw seatsErr;
        setSeats(seatData ?? []);
      }
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke hente teamdata');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  // Sync Stripe quantity on load so any drift from previous sessions is corrected
  useEffect(() => {
    if (!team) return;
    (async () => {
      try {
        const token = (await (supabase as any).auth.getSession()).data.session?.access_token ?? '';
        await fetch('/api/sync-stripe-seats', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch { /* silent — Stripe sync is non-critical */ }
    })();
  }, [team?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveTeamName = async () => {
    if (!teamName.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (team) {
        // Update existing team name
        const { error: upErr } = await db
          .from('teams')
          .update({ name: teamName.trim() })
          .eq('id', team.id);
        if (upErr) throw upErr;
        setTeam(prev => prev ? { ...prev, name: teamName.trim() } : prev);
      } else {
        // Create new team
        const { data: newTeam, error: insErr } = await db
          .from('teams')
          .insert({ name: teamName.trim(), leader_id: user!.id })
          .select()
          .single();
        if (insErr) throw insErr;
        setTeam(newTeam);

        // Update the user's profile with team_id + team_role = 'leader'
        await db
          .from('profiles')
          .update({ team_id: newTeam.id, team_role: 'leader' })
          .eq('id', user!.id);
      }
      setSuccess('Teamnavn gemt');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke gemme teamnavn');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSeat = async () => {
    if (!newSeatEmail.trim() || !team) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newSeatEmail.trim())) {
      setError('Ugyldig e-mailadresse');
      return;
    }
    setAddingSeat(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/team-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await (supabase as any).auth.getSession()).data.session?.access_token ?? ''}` },
        body: JSON.stringify({ team_id: team.id, email: newSeatEmail.trim().toLowerCase(), subscription_tier: newSeatTier }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Kunne ikke tilføje sæde');
      setNewSeatEmail('');
      const noticeMap: Record<string, string> = {
        'in-app': 'Sæde tilføjet — invitation sendt i appen',
        'email':  'Sæde tilføjet — invitations-e-mail afsendt',
        'email_failed': 'Sæde tilføjet — e-mail mislykkedes, prøv igen',
      };
      const billingMessage = json.billing_synced && json.billing?.quantity
        ? ` Stripe er opdateret til ${json.billing.quantity} betalte sæder.`
        : ' Stripe blev ikke opdateret automatisk; prøv "Administrer abonnement" eller kontakt support.';
      setSuccess(`${noticeMap[json.notified] ?? 'Sæde tilføjet'}.${billingMessage}`);
      setTimeout(() => setSuccess(null), 4000);
      // Reload seat list immediately (realtime also keeps it live)
      await loadTeamData();
      setInviteOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke tilføje sæde');
    } finally {
      setAddingSeat(false);
    }
  };

  const handleRemoveSeat = async (seatId: string) => {
    setError(null);
    try {
      const session = await (supabase as any).auth.getSession();
      const token = session.data.session?.access_token ?? '';
      const res = await fetch(`/api/team-seat/${seatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Kunne ikke slette sæde');
      }
      setSeats(prev => prev.filter(s => s.id !== seatId));
    } catch (e: any) {
      setError(e.message ?? 'Kunne ikke slette sæde');
    }
  };

  /** Copies the deep link invited users land on (same link the server puts in
   *  in-app notifications) — lets leaders share it manually. UI-only helper. */
  const handleCopyInviteLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/team-invite`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard unavailable (non-secure context) — ignore */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Members see the org hierarchy view — skip the leader loading state
  if (isMember) {
    return (
      <AppScreen
        hasBottomNav={false}
        width="reading"
        header={{ title: 'Mit Team', subtitle: 'Teammedlem', back: '/home' }}
      >
        <MemberOrgView />
      </AppScreen>
    );
  }

  if (loading) {
    return (
      <AppScreen hasBottomNav={false} width="reading" header={{ title: 'Team', back: '/home' }}>
        <SkeletonList count={3} label="Indlæser team…" className="mt-2" />
      </AppScreen>
    );
  }

  const activeSeats = seats.filter(s => s.status === 'active').length;

  return (
    <AppScreen
      hasBottomNav={false}
      width="reading"
      header={{
        title: 'Team',
        subtitle: user?.teamRole === 'leader' ? 'Du er teamleder' : undefined,
        back: '/home',
        actions: team ? (
          <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setInviteOpen(true)}>
            Inviter
          </Button>
        ) : undefined,
      }}
    >
      <div className="flex flex-col gap-4 mt-2">
        <TeamViewToggle value={viewMode} onChange={setViewMode} />

        {viewMode === 'chart' ? (
          <TeamOrgChart
            data={chart.data}
            loading={chart.loading}
            viewerIsOwner={viewerIsOwner}
            currentUserId={user?.id}
            onRefresh={chart.refresh}
          />
        ) : (
          <>
        {/* Status banners */}
        {error && !inviteOpen && (
          <Alert variant="danger" title="Der opstod en fejl">{error}</Alert>
        )}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Arbejdshold (Teams v2) — multiple org work teams with leader + invites */}
        <OrgTeamsSection />

        {/* Team name */}
        <Card padding="md">
          <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-3">Teamnavn</h2>
          <div className="flex gap-2">
            <Input
              type="text"
              aria-label="Teamnavn"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="Fx Labotek Bygge A/S"
            />
            <Button
              onClick={handleSaveTeamName}
              loading={saving}
              disabled={!teamName.trim()}
              className="shrink-0"
            >
              {team ? 'Gem' : 'Opret'}
            </Button>
          </div>
          {!team && (
            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2">
              Opret dit team for at begynde at invitere teammedlemmer.
            </p>
          )}
        </Card>

        {/* Members + seat usage — only shown once team exists */}
        {team && (
          <Card padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border dark:border-border-dark">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-heading text-text-primary dark:text-text-dark-primary">Teammedlemmer</h2>
                <span className="text-caption text-text-secondary dark:text-text-dark-secondary">
                  {activeSeats} af {seats.length} pladser
                </span>
              </div>
              {seats.length > 0 && (
                <ProgressBar
                  className="mt-2.5"
                  size="sm"
                  tone={activeSeats === seats.length ? 'success' : 'brand'}
                  value={(activeSeats / seats.length) * 100}
                  label={`${activeSeats} af ${seats.length} pladser i brug`}
                />
              )}
            </div>

            {seats.length === 0 ? (
              <EmptyState
                icon={<UsersIcon className="w-7 h-7" />}
                title="Ingen teammedlemmer endnu"
                description="Inviter dit første teammedlem — de får adgang via dit abonnement."
                action={
                  <Button size="sm" onClick={() => setInviteOpen(true)}>Inviter teammedlem</Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border dark:divide-border-dark">
                {seats.map(seat => {
                  const status = SEAT_STATUS_BADGES[seat.status] ?? SEAT_STATUS_BADGES.pending;
                  return (
                    <li key={seat.id}>
                      <ListRow
                        leading={<Avatar name={seat.email} size="md" />}
                        title={seat.email}
                        subtitle={`${seat.subscription_tier}-sæde · Tilføjet ${new Date(seat.created_at).toLocaleDateString('da-DK')}`}
                        trailing={
                          <>
                            <Badge variant={status.variant} dot>{status.label}</Badge>
                            <button
                              type="button"
                              onClick={() => handleRemoveSeat(seat.id)}
                              aria-label={`Fjern sæde for ${seat.email}`}
                              className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-control text-text-tertiary hover:text-danger hover:bg-danger-subtle dark:text-text-dark-tertiary dark:hover:text-danger dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
          </>
        )}
      </div>

      {/* Invite flow */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Inviter teammedlem"
        description="Medlemmet får adgang via dit abonnement."
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Annuller</Button>
            <Button onClick={handleAddSeat} loading={addingSeat} disabled={!newSeatEmail.trim()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="danger">{error}</Alert>}

          <Input
            label="E-mail"
            type="email"
            value={newSeatEmail}
            onChange={e => setNewSeatEmail(e.target.value)}
            placeholder="teammedlem@email.dk"
            autoComplete="email"
          />

          <SegmentedControl
            label="Abonnementsniveau"
            value={newSeatTier}
            onChange={v => setNewSeatTier(v as SeatTier)}
            options={[
              { label: 'PRO', value: 'PRO' },
              { label: 'PREMIUM', value: 'PREMIUM' },
            ]}
          />

          <Alert variant="info" title="Sådan fungerer det">
            Eksisterende brugere modtager en invitation i appen og kan acceptere eller afvise. Nye
            brugere modtager en invitations-e-mail — når de registrerer sig, aktiveres deres sæde
            automatisk, og de tilføjes som forbindelser.
          </Alert>

          <Button
            variant="outline"
            fullWidth
            onClick={handleCopyInviteLink}
            iconLeft={linkCopied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
          >
            {linkCopied ? 'Link kopieret' : 'Kopiér invitationslink'}
          </Button>
        </div>
      </Modal>
    </AppScreen>
  );
};

export default TeamManagementPage;
