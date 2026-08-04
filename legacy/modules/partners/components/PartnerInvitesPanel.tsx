import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PartnerInvite, PartnerInviteStatus } from '../../../types';
import {
    declineInvite, formatOre, listMyPartnerInvites, listPartnerInvitesForProject,
    getPartnerTasksOverview, PartnerTaskOverview,
} from '../services/partners';
import { Avatar, Badge, Button, Card, CardDescription, CardTitle, EmptyState, Modal, SkeletonList, cn } from '../../../components/ui';
import { NegotiationThread } from './NegotiationThread';
import { OPEN_STATUSES, PARTNER_STATUS_META, formatDateTimeDa } from './partnerStatus';
import { ChevronDownIcon, ChevronUpIcon, ChevronRightIcon } from '../../../components/icons';
import InviteIdReveal from '../../../components/dashboard/InviteIdReveal';
import { useToast } from '../../../contexts/ToastContext';

interface PartnerInvitesPanelProps {
    /** 'manager': invites on one project (requires projectId). 'partner': my invitations across projects. */
    mode: 'manager' | 'partner';
    projectId?: string;
    /** Manager mode: shows an "Inviter partner" CTA wired by the parent. */
    onInvitePartner?: () => void;
    /** Render nothing (incl. while loading) when there are no invitations — for dashboards. */
    hideWhenEmpty?: boolean;
    /** When provided, only invites whose status is in this array are shown. */
    statuses?: PartnerInviteStatus[];
    className?: string;
}

const HANDOVER_LABEL: Record<string, { label: string; color: string }> = {
    none: { label: 'Igangværende', color: 'text-info-strong dark:text-info' },
    submitted: { label: 'Færdigmeldt', color: 'text-warning-strong dark:text-warning' },
    accepted: { label: 'Godkendt', color: 'text-success-strong dark:text-success' },
    rejected: { label: 'Afvist', color: 'text-danger-strong dark:text-danger' },
};

const formatElapsed = (checkedInAt: string): string => {
    const ms = Date.now() - new Date(checkedInAt).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}t ${m}m` : `${m}m`;
};

/** Compact Danish age caption ("lige nu", "12 min siden", "3 t siden", "2 d siden"). */
const formatAgeDa = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 60000) return 'lige nu';
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min} min siden`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} t siden`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d} d siden`;
    return formatDateTimeDa(iso);
};

/**
 * List panel for partner invitations. Used by the manager on a project
 * (invites + statuses + open negotiation thread) and by the partner across
 * projects (my invitations).
 */
export const PartnerInvitesPanel: React.FC<PartnerInvitesPanelProps> = ({
    mode,
    projectId,
    onInvitePartner,
    hideWhenEmpty,
    statuses,
    className,
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [invites, setInvites] = useState<PartnerInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [openInvite, setOpenInvite] = useState<PartnerInvite | null>(null);
    const [decliningId, setDecliningId] = useState<string | null>(null);
    const [taskOverviews, setTaskOverviews] = useState<Record<string, PartnerTaskOverview[]>>({});
    const [activeTab, setActiveTab] = useState<'open' | 'active' | 'archive'>('active');
    const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});

    // Device-local "last seen" timestamp for the manager-mode "Åbne" sub-tab.
    // Used to show an unread badge when open negotiations are new/updated since
    // the manager last opened the tab on this device. No server-side state.
    const openLastSeenKey = projectId ? `bygSmart-partnere-open-lastSeen-${projectId}` : null;
    const [openLastSeen, setOpenLastSeen] = useState<number>(0);

    useEffect(() => {
        if (!openLastSeenKey) return;
        try {
            const stored = localStorage.getItem(openLastSeenKey);
            setOpenLastSeen(stored ? Number(stored) : 0);
        } catch {
            setOpenLastSeen(0);
        }
    }, [openLastSeenKey]);

    const markOpenSeen = useCallback(() => {
        if (!openLastSeenKey) return;
        const now = Date.now();
        try { localStorage.setItem(openLastSeenKey, String(now)); } catch { /* ignore */ }
        setOpenLastSeen(now);
    }, [openLastSeenKey]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const loaded = mode === 'manager' && projectId
                ? await listPartnerInvitesForProject(projectId)
                : await listMyPartnerInvites();
            setInvites(loaded);

            // Load task overviews for accepted invites in manager mode
            if (mode === 'manager' && projectId) {
                const accepted = loaded.filter(i => i.status === 'accepted' && i.taskIds?.length);
                if (accepted.length) {
                    const overviewEntries = await Promise.all(
                        accepted.map(async (inv) => {
                            const overviews = await getPartnerTasksOverview(projectId, inv.taskIds ?? []);
                            return [inv.id, overviews] as const;
                        })
                    );
                    setTaskOverviews(Object.fromEntries(overviewEntries));
                }
            }
        } finally {
            setLoading(false);
        }
    }, [mode, projectId]);

    useEffect(() => { load(); }, [load]);

    const handleInviteUpdated = useCallback(async (updated: PartnerInvite) => {
        setInvites(prev => prev.map(i => (i.id === updated.id ? { ...i, ...updated } : i)));
        setOpenInvite(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));

        if (mode === 'manager' && projectId) {
            if (updated.status === 'accepted' && updated.taskIds?.length) {
                const overviews = await getPartnerTasksOverview(projectId, updated.taskIds);
                setTaskOverviews(prev => ({ ...prev, [updated.id]: overviews }));
            } else if (updated.status !== 'accepted') {
                setTaskOverviews(prev => {
                    const next = { ...prev };
                    delete next[updated.id];
                    return next;
                });
            }
        }
    }, [mode, projectId]);

    /** Partner declines an incoming invitation directly from the card (same
     *  RPC as "Afvis invitation" inside the negotiation thread). */
    const handleDeclineInvite = useCallback(async (invite: PartnerInvite) => {
        if (decliningId) return;
        setDecliningId(invite.id);
        try {
            await declineInvite(invite.id);
            setInvites(prev => prev.map(i => (i.id === invite.id ? { ...i, status: 'declined' as PartnerInviteStatus } : i)));
            showToast('Invitationen er afvist.', 'info');
        } catch {
            showToast('Handlingen mislykkedes. Prøv igen.', 'error');
        } finally {
            setDecliningId(null);
        }
    }, [decliningId, showToast]);

    const TAB_STATUSES: Record<'open' | 'active' | 'archive', PartnerInviteStatus[]> = {
        open: ['invited', 'negotiating'],
        active: ['accepted'],
        archive: ['declined', 'cancelled'],
    };

    const tabCounts = mode === 'manager' ? {
        open: invites.filter(i => TAB_STATUSES.open.includes(i.status)).length,
        active: invites.filter(i => TAB_STATUSES.active.includes(i.status)).length,
        archive: invites.filter(i => TAB_STATUSES.archive.includes(i.status)).length,
    } : null;

    // Unread open invites = open negotiations whose newest activity (created or
    // updated) is newer than the last time the manager opened the "Åbne" tab.
    const openUnreadCount = mode === 'manager' && projectId
        ? invites.filter(i => TAB_STATUSES.open.includes(i.status)).filter(i => {
            const created = new Date(i.createdAt).getTime();
            const updated = i.updatedAt ? new Date(i.updatedAt).getTime() : created;
            return Math.max(created, updated) > openLastSeen;
        }).length
        : 0;

    const visibleInvites = mode === 'manager'
        ? invites.filter(i => TAB_STATUSES[activeTab].includes(i.status))
        : (statuses ? invites.filter(i => statuses.includes(i.status)) : invites);

    const toggleCard = (id: string) =>
        setCollapsedCards(prev => ({ ...prev, [id]: !prev[id] }));

    // On dashboards we render nothing at all (incl. while loading) when there
    // are no invitations, instead of an empty-state card.
    if (hideWhenEmpty && visibleInvites.length === 0) return null;

    const renderManagerAcceptedCard = (invite: PartnerInvite) => {
        const overviews = taskOverviews[invite.id] ?? [];
        const totalTime = overviews.reduce((s, t) => s + t.timeLoggedHours, 0);
        const totalDocs = overviews.reduce((s, t) => s + t.docCount, 0);
        const checkedIn = overviews.find(t => t.activeCheckIn);
        const statusMeta = PARTNER_STATUS_META[invite.status];
        const isCollapsed = !!collapsedCards[invite.id];

        return (
            <Card key={invite.id} padding="md" className="border-l-4 border-l-success">
                {/* Collapsible header */}
                <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={`invite-body-${invite.id}`}
                    className="flex items-center justify-between gap-3 w-full text-left cursor-pointer min-h-11"
                    onClick={() => toggleCard(invite.id)}
                >
                    <Avatar name={invite.partnerName ?? 'Partner'} size="sm" />
                    <div className="min-w-0 flex-1">
                        <CardTitle className="truncate">{invite.partnerName ?? 'Partner'}</CardTitle>
                        <CardDescription className="mt-0.5 text-caption">
                            {formatAgeDa(invite.createdAt)}
                            {invite.taskCount !== undefined &&
                                ` · ${invite.taskCount} ${invite.taskCount === 1 ? 'opgave' : 'opgaver'}`}
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                        {isCollapsed
                            ? <ChevronDownIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" />
                            : <ChevronUpIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" />
                        }
                    </div>
                </button>

                {/* Collapsible body */}
                {!isCollapsed && (
                    <div id={`invite-body-${invite.id}`}>
                        {/* Agreed price */}
                        {invite.agreedPriceOre !== null && (
                            <div className="mt-3 rounded-control bg-success-subtle dark:bg-success-subtle-dark border border-success-border dark:border-success/30 px-3 py-2">
                                <p className="text-label font-bold text-success-strong dark:text-success">
                                    Aftalt pris: {formatOre(invite.agreedPriceOre, invite.currency)}
                                </p>
                            </div>
                        )}

                        {/* Aggregated stats */}
                        {overviews.length > 0 && (
                            <div className="mt-3 flex gap-4">
                                <div>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Tid brugt</p>
                                    <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">
                                        {totalTime > 0 ? `${Math.round(totalTime * 10) / 10} t` : '–'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Dokumentation</p>
                                    <p className="text-label font-bold text-text-primary dark:text-text-dark-primary">{totalDocs}</p>
                                </div>
                                {checkedIn?.activeCheckIn && (
                                    <div>
                                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Tjekket ind</p>
                                        <p className="text-caption font-bold text-success-strong dark:text-success">
                                            {checkedIn.activeCheckIn.userName} ({formatElapsed(checkedIn.activeCheckIn.checkedInAt)})
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Per-task rows */}
                        {overviews.length > 0 && (
                            <div className="mt-3 space-y-2 border-t border-border dark:border-border-dark pt-3">
                                {overviews.map(task => {
                                    const hs = HANDOVER_LABEL[task.handoverStatus ?? 'none'] ?? HANDOVER_LABEL.none;
                                    return (
                                        <div
                                            key={task.taskId}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <span className="block truncate text-label font-medium text-text-primary dark:text-text-dark-primary">
                                                    {task.title}
                                                    {task.handoverStatus === 'accepted' && (
                                                        <Badge variant="success" className="ml-1.5 align-middle">Udført</Badge>
                                                    )}
                                                </span>
                                                <span className={`text-caption font-medium ${hs.color}`}>{hs.label}</span>
                                                {task.activeCheckIn && (
                                                    <span className="ml-2 text-caption text-success-strong dark:text-success">
                                                        · {task.activeCheckIn.userName} tjekket ind
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0"
                                                onClick={() => navigate(`/task/${task.taskId}`)}
                                            >
                                                Åbn opgave
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-3 flex justify-end">
                            <Button variant="primary" size="sm" onClick={() => setOpenInvite(invite)}>
                                Åbn forhandling
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        );
    };

    return (
        <div className={cn('space-y-3', className)}>
            {mode === 'manager' && onInvitePartner && (
                <div className="flex justify-end">
                    <Button size="sm" onClick={onInvitePartner}>Inviter partner</Button>
                </div>
            )}

            {/* Tab control — manager mode only */}
            {mode === 'manager' && !loading && tabCounts && (
                <div className="flex gap-1 rounded-full bg-bg-muted dark:bg-bg-dark-muted p-1">
                    {(['open', 'active', 'archive'] as const).map(tab => {
                        const labels = { open: 'Åbne', active: 'Aktive', archive: 'Arkiv' };
                        const count = tabCounts[tab];
                        const isActive = activeTab === tab;
                        const showUnread = tab === 'open' && openUnreadCount > 0;
                        return (
                            <button
                                key={tab}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => {
                                    setActiveTab(tab);
                                    if (tab === 'open') markOpenSeen();
                                }}
                                className={cn(
                                    'relative flex-1 min-h-11 rounded-full px-3 py-1.5 text-label font-medium transition-colors',
                                    isActive
                                        ? 'bg-bg dark:bg-bg-dark-surface text-brand-primary shadow-sm'
                                        : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary'
                                )}
                            >
                                {labels[tab]} ({count})
                                {showUnread && (
                                    <span
                                        className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-caption font-bold text-white"
                                        aria-label={`${openUnreadCount} nye`}
                                    >
                                        {openUnreadCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <SkeletonList count={2} label="Indlæser invitationer…" />
            ) : visibleInvites.length === 0 ? (
                <EmptyState
                    icon={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
                        </svg>
                    }
                    title={mode === 'manager' ? 'Ingen partnerinvitationer' : 'Ingen invitationer'}
                    description={
                        mode === 'manager'
                            ? 'Inviter en underleverandør til udvalgte opgaver, og forhandl prisen direkte i appen.'
                            : 'Når en projektleder inviterer dig som underleverandør, vises invitationen her.'
                    }
                    action={
                        mode === 'manager' && onInvitePartner
                            ? <Button onClick={onInvitePartner}>Inviter partner</Button>
                            : undefined
                    }
                />
            ) : (
                visibleInvites.map(invite => {
                    // Accepted partners in manager mode get the enhanced oversight card
                    if (mode === 'manager' && invite.status === 'accepted') {
                        return renderManagerAcceptedCard(invite);
                    }

                    const statusMeta = PARTNER_STATUS_META[invite.status];
                    const title = mode === 'manager'
                        ? (invite.partnerName ?? 'Partner')
                        : (invite.projectName ?? 'Projekt');
                    const avatarName = mode === 'manager'
                        ? (invite.partnerName ?? 'Partner')
                        : (invite.inviterName ?? 'Afsender');
                    const isCollapsed = !!collapsedCards[invite.id];
                    // Eye-catching treatment only for an incoming partner invitation
                    // that the current user has been invited to (not manager view,
                    // not the negotiating/accepted states).
                    const isPartnerInvited = mode === 'partner' && invite.status === 'invited';
                    const isOpenInvite = OPEN_STATUSES.includes(invite.status);
                    const taskCountLabel = invite.taskCount !== undefined
                        ? `${invite.taskCount} ${invite.taskCount === 1 ? 'opgave' : 'opgaver'}`
                        : null;

                    return (
                        <Card
                            key={invite.id}
                            padding="md"
                            interactive
                            onClick={() => setOpenInvite(invite)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenInvite(invite); } }}
                            aria-label="Åbn forhandling"
                            className={cn(
                                isOpenInvite && !isPartnerInvited && 'border-l-4 border-l-warning',
                                isPartnerInvited && 'invite-glow border-2'
                            )}
                            style={isPartnerInvited ? { ['--glow-color' as any]: 'var(--color-warning)' } : undefined}
                        >
                            {/* Header — the whole card opens the negotiation. */}
                            <div className="flex items-center justify-between gap-3 w-full text-left min-h-11">
                                <Avatar name={avatarName} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <CardTitle className="truncate">{title}</CardTitle>
                                    <CardDescription className="mt-0.5 text-caption">
                                        {mode === 'partner' && invite.inviterName
                                            ? `Inviteret af ${invite.inviterName} · `
                                            : ''}
                                        {formatAgeDa(invite.createdAt)}
                                        {!isPartnerInvited && taskCountLabel && ` · ${taskCountLabel}`}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {isPartnerInvited
                                        ? <Badge variant="success" className="font-bold uppercase tracking-wide">Du er inviteret</Badge>
                                        : <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                                    }
                                    <ChevronRightIcon className="w-4 h-4 text-text-secondary dark:text-text-dark-secondary" />
                                </div>
                            </div>

                            {/* Invitation reference + task count reveal (partner invited card) */}
                            {isPartnerInvited && (
                                <div
                                    className="mt-2 text-text-secondary dark:text-text-dark-secondary"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <InviteIdReveal
                                        label={taskCountLabel ?? 'Invitation'}
                                        fullId={invite.id}
                                    />
                                </div>
                            )}

                            {/* Collapsible body */}
                            {!isCollapsed && (
                                <div id={`invite-body-${invite.id}`}>
                                    {invite.message && (
                                        <p className="mt-2 text-label text-text-secondary dark:text-text-dark-secondary line-clamp-2">
                                            {invite.message}
                                        </p>
                                    )}

                                    {invite.status === 'accepted' && invite.agreedPriceOre !== null && (
                                        <p className="mt-2 text-label font-semibold text-success-strong dark:text-success">
                                            Aftalt pris: {formatOre(invite.agreedPriceOre, invite.currency)}
                                        </p>
                                    )}

                                    <div className="mt-3 flex items-center justify-end gap-2">
                                        {mode === 'partner' && isOpenInvite && (
                                            <Button
                                                variant="danger"
                                                size="sm"
                                                loading={decliningId === invite.id}
                                                onClick={(e) => { e.stopPropagation(); handleDeclineInvite(invite); }}
                                            >
                                                Afvis
                                            </Button>
                                        )}
                                        {mode === 'partner' && invite.status === 'accepted' && invite.projectId && (
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/partner-project/${invite.projectId}`); }}>
                                                Gå til projekt
                                            </Button>
                                        )}
                                        <Button
                                            variant={invite.status === 'accepted' ? 'outline' : 'primary'}
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); setOpenInvite(invite); }}
                                        >
                                            Åbn forhandling
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    );
                })
            )}

            <Modal
                open={!!openInvite}
                onClose={() => setOpenInvite(null)}
                title="Forhandling"
                size="lg"
            >
                {openInvite && (
                    <NegotiationThread
                        invite={openInvite}
                        onInviteUpdated={handleInviteUpdated}
                    />
                )}
            </Modal>
        </div>
    );
};

export default PartnerInvitesPanel;
