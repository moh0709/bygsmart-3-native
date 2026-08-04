import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PartnerInvite, PartnerProjectView, Task } from '../../../types';
import {
    formatOre, getPartnerInviteForProject, getPartnerProjectView,
    getPartnerTasksForProject, listPartnerTaskAccess,
} from '../services/partners';
import { useAuth } from '../../../contexts/AuthProvider';
import { Alert, AppScreen, Badge, Button, Card, CardDescription, CardTitle, EmptyState, ListRow, Skeleton, SkeletonList } from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';
import { NegotiationThread } from './NegotiationThread';
import { PARTNER_STATUS_META, formatDateDa } from './partnerStatus';

const TASK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
    'Udført': 'success',
    'Igangværende': 'info',
    'Forfalden': 'danger',
    'To Do': 'neutral',
};

/**
 * Scoped read-only project view for partners (Underleverandører).
 * Shows ONLY: project name, description, deadline (via the RLS-scoped
 * get_partner_project_view RPC) and the tasks the partner is invited to
 * (via the partner_task_access RLS policy) — never budget, internal notes,
 * other tasks or member lists. Route: /partner-project/:projectId.
 */
const PartnerProjectPage: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [project, setProject] = useState<PartnerProjectView | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [invite, setInvite] = useState<PartnerInvite | null>(null);
    const [loading, setLoading] = useState(true);
    const [showThread, setShowThread] = useState(false);

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const resolvedInvite = await getPartnerInviteForProject(projectId);

            // Managers who follow a deep-link to this partner-scoped view are
            // redirected to the manager surface that has full project context.
            if (resolvedInvite && resolvedInvite.partnerId !== user?.id) {
                navigate(`/project-detail/${projectId}?tab=partnere`, { replace: true });
                return;
            }

            const [view, allTasks] = await Promise.all([
                getPartnerProjectView(projectId),
                getPartnerTasksForProject(projectId),
            ]);
            setProject(view ?? null);
            setInvite(resolvedInvite);

            // Scope the visible task list to the invite's partner_task_access allowlist.
            if (resolvedInvite) {
                const allowedIds = await listPartnerTaskAccess(resolvedInvite.id);
                const allowedSet = new Set(allowedIds);
                setTasks(allTasks.filter(t => allowedSet.has(t.id)));
            } else {
                setTasks(allTasks);
            }
        } finally {
            setLoading(false);
        }
    }, [projectId, navigate, user]);

    useEffect(() => { load(); }, [load]);

    const handleInviteUpdated = useCallback((updated: PartnerInvite) => {
        setInvite(prev => (prev ? { ...prev, ...updated } : updated));
        // Acceptance can change which tasks are accessible/editable.
        if (updated.status === 'accepted') load();
    }, [load]);

    const statusMeta = invite ? PARTNER_STATUS_META[invite.status] : null;

    return (
        <AppScreen
            header={{
                title: project?.name ?? 'Partnerprojekt',
                subtitle: 'Underleverandør-visning',
                back: true,
                actions: statusMeta
                    ? <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                    : undefined,
            }}
        >
            <main className="mt-2 space-y-4">
                {loading ? (
                    <>
                        <Card padding="md" aria-hidden="true">
                            <Skeleton className="h-5 w-2/3 mb-3" />
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-3/4" />
                        </Card>
                        <SkeletonList count={3} label="Indlæser opgaver…" />
                    </>
                ) : !project ? (
                    <EmptyState
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        }
                        title="Ingen adgang"
                        description="Du har ikke adgang til dette projekt, eller invitationen er ikke længere aktiv."
                        action={<Button onClick={() => navigate('/')}>Til forsiden</Button>}
                    />
                ) : (
                    <>
                        {/* Scope banner — this is the partner-scoped view */}
                        <Alert variant="info" title="Du ser en partner-visning">
                            Du har kun adgang til projektnavn, beskrivelse, deadline og de opgaver, du er inviteret til.
                        </Alert>

                        {/* Project info — only name, description, deadline */}
                        <Card padding="lg">
                            <CardTitle>{project.name}</CardTitle>
                            {project.description && (
                                <CardDescription className="mt-1.5 whitespace-pre-wrap">
                                    {project.description}
                                </CardDescription>
                            )}
                            <p className="mt-3 text-label text-text-secondary dark:text-text-dark-secondary">
                                <span className="font-semibold text-text-primary dark:text-text-dark-primary">Deadline:</span>{' '}
                                {formatDateDa(project.deadline)}
                            </p>
                            {invite?.status === 'accepted' && invite.agreedPriceOre !== null && (
                                <div className="mt-3 rounded-control border border-success-border dark:border-success/30 bg-success-subtle dark:bg-success-subtle-dark px-4 py-3">
                                    <p className="text-caption font-semibold uppercase tracking-wide text-success-strong dark:text-success mb-0.5">
                                        Aftale indgået
                                    </p>
                                    <p className="text-title text-success-strong dark:text-success">
                                        {formatOre(invite.agreedPriceOre, invite.currency)}
                                    </p>
                                    {invite.settledAt && (
                                        <p className="mt-0.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                                            Afsluttet {formatDateDa(invite.settledAt)}
                                        </p>
                                    )}
                                </div>
                            )}
                            {invite && (
                                <div className="mt-4 flex gap-2 flex-wrap">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowThread(prev => !prev)}
                                        aria-expanded={showThread}
                                    >
                                        {showThread ? 'Skjul forhandling' : 'Åbn forhandling'}
                                    </Button>
                                </div>
                            )}
                        </Card>

                        {/* Negotiation thread (inline) */}
                        {invite && showThread && (
                            <Card padding="md">
                                <NegotiationThread invite={invite} onInviteUpdated={handleInviteUpdated} />
                            </Card>
                        )}

                        {/* Allowlisted tasks */}
                        <section aria-label="Dine opgaver">
                            <h2 className="text-heading text-text-primary dark:text-text-dark-primary mb-2">
                                Dine opgaver ({tasks.length})
                            </h2>
                            {tasks.length === 0 ? (
                                <EmptyState
                                    title="Ingen opgaver"
                                    description="Du er ikke inviteret til nogen opgaver på dette projekt endnu."
                                    className="py-8"
                                />
                            ) : (
                                <>
                                    <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                                        {tasks.map(task => (
                                            <ListRow
                                                key={task.id}
                                                title={`${task.step ? `${task.step} · ` : ''}${task.title}`}
                                                subtitle={
                                                    [task.description, task.dueDate ? `Frist: ${task.dueDate}` : null]
                                                        .filter(Boolean)
                                                        .join(' · ') || undefined
                                                }
                                                trailing={
                                                    <>
                                                        {task.handoverStatus === 'accepted' && (
                                                            <Badge variant="success">Udført</Badge>
                                                        )}
                                                        <Badge variant={TASK_STATUS_VARIANTS[task.status] ?? 'neutral'}>
                                                            {task.status}
                                                        </Badge>
                                                    </>
                                                }
                                                onClick={
                                                    invite?.status === 'accepted'
                                                        ? () => navigate(`/task/${task.id}`)
                                                        : undefined
                                                }
                                            />
                                        ))}
                                    </Card>
                                    {invite?.status !== 'accepted' && (
                                        <p className="mt-2 text-caption text-text-secondary dark:text-text-dark-secondary text-center">
                                            Afventer aftale — opgave-workspace bliver tilgængeligt efter accept.
                                        </p>
                                    )}
                                </>
                            )}
                        </section>
                    </>
                )}
            </main>
        </AppScreen>
    );
};

export default PartnerProjectPage;
