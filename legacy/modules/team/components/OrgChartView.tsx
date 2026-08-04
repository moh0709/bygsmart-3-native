import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Pencil, User, Users } from 'lucide-react';
import { Avatar, Badge, EmptyState, cn, type BadgeVariant } from '../../../components/ui';
import type { OrgMember } from '../../../services/organizations';
import type { OrgTeam } from '../services/orgTeams';

// ─────────────────────────────────────────────────────────────────────────────
// OrgChartView — a data-driven, pure-CSS org diagram used in three places:
// the /team leader view, the /team member view and the Settings "Organisation"
// preview (compact). Hierarchy: org owner at top → each Arbejdshold as a
// branch (leader first, then members) → a "Uden hold" group for active members
// not on any team. Connectors are drawn with thin token-coloured divs so they
// read cleanly in light and dark mode.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_LABELS = {
    owner: 'Ejer',
    leader: 'Holdleder',
    member: 'Medlem',
    admin: 'Admin',
} as const;

// Role label → Badge variant, kept consistent with ROLE_BADGES in
// TeamManagementPage (owner → brand; leader/admin → info; member → neutral).
// Keyed by the Danish roleLabel string carried on each ChartPerson, with a
// neutral fallback for any custom/unknown label.
const ROLE_BADGE_VARIANTS: Record<string, BadgeVariant> = {
    [ROLE_LABELS.owner]: 'brand',
    [ROLE_LABELS.leader]: 'info',
    [ROLE_LABELS.admin]: 'info',
    [ROLE_LABELS.member]: 'neutral',
};

const roleBadgeVariant = (roleLabel: string): BadgeVariant => ROLE_BADGE_VARIANTS[roleLabel] ?? 'neutral';

export interface ChartPerson {
    userId: string | null;
    name: string;
    email?: string;
    roleLabel: string;
    isOwner?: boolean;
    /** Work-team context set when this card is rendered inside a team branch. */
    teamId?: string | null;
    teamName?: string | null;
    /** The person's role within that work team (drives the modal actions). */
    teamRole?: 'leader' | 'member';
}

export interface ChartTeam {
    id: string;
    name: string;
    leader: ChartPerson | null;
    members: ChartPerson[];
}

export interface OrgChartData {
    owner: ChartPerson | null;
    teams: ChartTeam[];
    unassigned: ChartPerson[];
}

interface OrgChartViewProps {
    data: OrgChartData;
    currentUserId?: string | null;
    /** Whether the pencil edit affordance is shown on a given card. */
    canEditPerson?: (person: ChartPerson) => boolean;
    /** Fired when a card (or its edit button) is activated. */
    onSelect?: (person: ChartPerson) => void;
    /** Smaller cards + avatars for the Settings preview. */
    compact?: boolean;
}

// ── Pure builder: org members + work teams → normalized chart data ───────────

export function chartFromOrg(members: OrgMember[], teams: OrgTeam[], ownerId: string): OrgChartData {
    const activeMembers = members.filter((m) => m.status === 'active');
    const ownerMember =
        activeMembers.find((m) => m.userId === ownerId) ??
        activeMembers.find((m) => m.role === 'owner') ??
        null;

    const owner: ChartPerson | null = ownerMember
        ? {
              userId: ownerMember.userId,
              name: ownerMember.name || ownerMember.inviteEmail || ROLE_LABELS.owner,
              email: ownerMember.inviteEmail ?? undefined,
              roleLabel: ROLE_LABELS.owner,
              isOwner: true,
          }
        : null;

    const assigned = new Set<string>();
    const chartTeams: ChartTeam[] = teams.map((team) => {
        const active = team.members.filter((m) => m.status === 'active');
        active.forEach((m) => assigned.add(m.userId));
        const toPerson = (m: (typeof active)[number], role: 'leader' | 'member'): ChartPerson => ({
            userId: m.userId,
            name: m.name,
            email: m.email ?? undefined,
            roleLabel: role === 'leader' ? ROLE_LABELS.leader : ROLE_LABELS.member,
            teamId: team.id,
            teamName: team.name,
            teamRole: role,
        });
        const leaderM = active.find((m) => m.role === 'leader') ?? null;
        return {
            id: team.id,
            name: team.name,
            leader: leaderM ? toPerson(leaderM, 'leader') : null,
            members: active.filter((m) => m.role !== 'leader').map((m) => toPerson(m, 'member')),
        };
    });

    const ownerUserId = ownerMember?.userId ?? null;
    const unassigned: ChartPerson[] = activeMembers
        .filter((m) => m.userId && m.userId !== ownerUserId && !assigned.has(m.userId))
        .map((m) => ({
            userId: m.userId,
            name: m.name || m.inviteEmail || 'Ukendt',
            email: m.inviteEmail ?? undefined,
            roleLabel: m.role === 'admin' ? ROLE_LABELS.admin : ROLE_LABELS.member,
        }));

    return { owner, teams: chartTeams, unassigned };
}

// ── Card ─────────────────────────────────────────────────────────────────────

const PersonCard: React.FC<{
    person: ChartPerson;
    isCurrentUser: boolean;
    canEdit: boolean;
    onSelect: (p: ChartPerson) => void;
    compact?: boolean;
}> = ({ person, isCurrentUser, canEdit, onSelect, compact }) => (
    <div className="relative shrink-0">
        <button
            type="button"
            onClick={() => onSelect(person)}
            aria-label={`${person.name} — ${person.roleLabel}`}
            className={cn(
                'group flex flex-col items-center text-center rounded-card border bg-bg shadow-card',
                'border-border dark:border-border-dark dark:bg-bg-dark-surface',
                'transition-all duration-150 hover:shadow-card-hover hover:border-border-strong',
                'dark:hover:border-border-dark-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                person.isOwner && 'border-brand-border dark:border-brand-border-dark',
                compact ? 'w-[150px] gap-1 px-3 py-2.5' : 'w-[168px] gap-1.5 px-4 py-3.5'
            )}
        >
            <Avatar name={person.name} size={compact ? 'sm' : 'md'} />
            <span className="mt-0.5 max-w-full truncate text-label font-semibold text-text-primary dark:text-text-dark-primary">
                {person.name}
            </span>
            {/* Role (and, for the viewer, "Dig") as badges — wraps within the
                card width so nothing overflows the ~150-170px card. */}
            <span className="mt-1 flex max-w-full flex-wrap items-center justify-center gap-1">
                <Badge variant={roleBadgeVariant(person.roleLabel)} className="max-w-full truncate">
                    {person.roleLabel}
                </Badge>
                {isCurrentUser && <Badge variant="brand">Dig</Badge>}
            </span>
        </button>

        {canEdit && (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(person);
                }}
                aria-label={`Rediger ${person.name}`}
                className={cn(
                    'absolute top-1.5 right-1.5 flex items-center justify-center rounded-control',
                    'text-text-tertiary hover:text-brand-primary hover:bg-brand-subtle',
                    'dark:text-text-dark-tertiary dark:hover:text-brand-light dark:hover:bg-brand-subtle-dark',
                    'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                    compact ? 'w-6 h-6' : 'w-7 h-7'
                )}
            >
                <Pencil className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            </button>
        )}
    </div>
);

// ── Branch (a team column, or the "Uden hold" group) ─────────────────────────

interface BranchModel extends ChartTeam {
    kind: 'team' | 'unassigned';
}

const Connector: React.FC<{ className?: string }> = ({ className }) => (
    <div className={cn('w-px bg-border dark:bg-border-dark', className)} aria-hidden="true" />
);

const BranchColumn: React.FC<{
    branch: BranchModel;
    index: number;
    total: number;
    hasParent: boolean;
    currentUserId?: string | null;
    canEditPerson: (p: ChartPerson) => boolean;
    onSelect: (p: ChartPerson) => void;
    compact?: boolean;
}> = ({ branch, index, total, hasParent, currentUserId, canEditPerson, onSelect, compact }) => {
    const [expanded, setExpanded] = useState(true);
    const people = [branch.leader, ...branch.members].filter(Boolean) as ChartPerson[];
    const stem = compact ? 'h-4' : 'h-6';
    const showRail = hasParent && total > 1;
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
        <div className="relative flex flex-col items-center px-2 sm:px-3">
            {/* Top connector: rail across siblings + vertical stem up to it */}
            {hasParent && (
                <div className={cn('relative w-full', stem)} aria-hidden="true">
                    <div className={cn('absolute top-0 left-1/2 -translate-x-1/2 w-px bg-border dark:bg-border-dark', stem)} />
                    {showRail && (
                        <div
                            className={cn(
                                'absolute top-0 h-px bg-border dark:bg-border-dark',
                                isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'left-0 right-0'
                            )}
                        />
                    )}
                </div>
            )}

            {/* Team header — collapsible */}
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className={cn(
                    'flex items-center gap-2 rounded-card border bg-bg shadow-card dark:bg-bg-dark-surface',
                    'transition-colors duration-150 hover:border-border-strong dark:hover:border-border-dark-strong',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                    branch.kind === 'unassigned'
                        ? 'border-dashed border-border-strong dark:border-border-dark-strong'
                        : 'border-border dark:border-border-dark',
                    compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
                )}
            >
                <span
                    className={cn(
                        'flex items-center justify-center rounded-control shrink-0',
                        branch.kind === 'unassigned'
                            ? 'bg-bg-muted text-text-tertiary dark:bg-bg-dark-muted dark:text-text-dark-tertiary'
                            : 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light',
                        compact ? 'w-7 h-7' : 'w-8 h-8'
                    )}
                    aria-hidden="true"
                >
                    {branch.kind === 'unassigned' ? <User className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                </span>
                <span className="min-w-0 max-w-[140px] text-left">
                    <span className="block truncate text-label font-bold text-text-primary dark:text-text-dark-primary">
                        {branch.name}
                    </span>
                </span>
                <Badge variant="neutral">{people.length}</Badge>
                <ChevronDown
                    className={cn(
                        'w-4 h-4 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-200',
                        expanded && 'rotate-180'
                    )}
                    aria-hidden="true"
                />
            </button>

            {/* People — leader first, then members, chained vertically */}
            <AnimatePresence initial={false}>
                {expanded && people.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="flex flex-col items-center overflow-hidden"
                    >
                        {people.map((p, i) => (
                            <React.Fragment key={p.userId ?? `${branch.id}-${i}`}>
                                <Connector className={stem} />
                                <PersonCard
                                    person={p}
                                    isCurrentUser={p.userId != null && p.userId === currentUserId}
                                    canEdit={canEditPerson(p)}
                                    onSelect={onSelect}
                                    compact={compact}
                                />
                            </React.Fragment>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── Chart ────────────────────────────────────────────────────────────────────

export const OrgChartView: React.FC<OrgChartViewProps> = ({
    data,
    currentUserId,
    canEditPerson = () => false,
    onSelect = () => undefined,
    compact = false,
}) => {
    const branches: BranchModel[] = [
        ...data.teams.map((t) => ({ ...t, kind: 'team' as const })),
        ...(data.unassigned.length
            ? [{ kind: 'unassigned' as const, id: '__unassigned__', name: 'Uden hold', leader: null, members: data.unassigned }]
            : []),
    ];

    if (!data.owner && branches.length === 0) {
        return (
            <EmptyState
                icon={<Users className="w-7 h-7" />}
                title="Ingen organisation endnu"
                description="Der er endnu ingen medlemmer at vise i diagrammet."
            />
        );
    }

    return (
        <div className="overflow-x-auto pb-2">
            <div className="inline-flex min-w-full flex-col items-center px-2 py-1">
                {data.owner && (
                    <PersonCard
                        person={data.owner}
                        isCurrentUser={data.owner.userId != null && data.owner.userId === currentUserId}
                        canEdit={canEditPerson(data.owner)}
                        onSelect={onSelect}
                        compact={compact}
                    />
                )}
                {data.owner && branches.length > 0 && <Connector className={compact ? 'h-4' : 'h-6'} />}
                {branches.length > 0 && (
                    <div className="flex items-start justify-center">
                        {branches.map((b, i) => (
                            <BranchColumn
                                key={b.id}
                                branch={b}
                                index={i}
                                total={branches.length}
                                hasParent={!!data.owner}
                                currentUserId={currentUserId}
                                canEditPerson={canEditPerson}
                                onSelect={onSelect}
                                compact={compact}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
