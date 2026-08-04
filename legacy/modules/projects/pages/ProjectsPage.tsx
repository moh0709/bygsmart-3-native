
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUnreadNotificationsByProject } from '../../../services/api';
import { getProjects } from '../services/projects';
import { acceptProjectInvitation } from '../services/projectResources';
import { createReminderForProject, getRemindersForProject } from '../../planning';
import { supabase } from '../../../services/supabaseClient';
import { listMyPartnerInvites } from '../../partners';
import type { Project, Task, Reminder, PartnerInvite } from '../../../types';
import { SearchIcon, StarIcon, PlusIcon, FolderIcon, UsersIcon, CheckIcon } from '../../../components/icons';
import CreateProjectModal from '../components/CreateProjectModal';
import QuickProjectModal from '../components/QuickProjectModal';
import { CalendarView } from '../../../components/planning/CalendarView';
import { GanttView, GanttZoomLevel } from '../../../components/planning/GanttView';
import { ReminderFormModal } from '../../planning';
import { useAuth } from '../../../contexts/AuthProvider';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { SubscriptionModal } from '../../../components/settings/SubscriptionModal';
import { Confetti } from '../../../components/ui/Confetti';
import { useToast } from '../../../contexts/ToastContext';
import {
    AppScreen,
    Alert,
    AvatarGroup,
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    FAB,
    ProgressBar,
    SegmentedControl,
    Skeleton,
    SkeletonList,
    cn,
} from '../../../components/ui';
import type { BadgeVariant, ProgressTone } from '../../../components/ui';

interface ProjectData extends Project {
    tasks: Task[];
    reminders: Reminder[];
}

const PlanningLegend: React.FC = () => (
    <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-2 p-2 bg-bg-muted dark:bg-bg-dark-muted rounded-control text-caption text-text-secondary dark:text-text-dark-secondary">
        <div className="font-bold pr-1 text-text-primary dark:text-text-dark-primary">Projekter:</div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-brand-primary rounded-full"></div><span>I gang</span></div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-success rounded-full"></div><span>Afsluttet</span></div>
        <div className="w-px h-4 bg-border dark:bg-border-dark mx-2 hidden sm:block"></div>
        <div className="font-bold pr-1 text-text-primary dark:text-text-dark-primary">Opgaver:</div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-text-tertiary dark:bg-text-dark-tertiary rounded-full"></div><span>To Do</span></div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-info rounded-full"></div><span>Igangværende</span></div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-danger rounded-full"></div><span>Forfalden</span></div>
        <div className="flex items-center space-x-1.5"><div className="w-2.5 h-2.5 bg-success/70 rounded-full"></div><span>Udført</span></div>
    </div>
);

interface ProjectStatusInfo {
    variant: BadgeVariant;
    label: string;
    daysInfo: string;
    openTasks: number;
}

/** Status model unchanged from the old ProjectStatusBadge — remapped to the
 *  approved badge palette: i rute→success, forsinket→danger, risiko→warning,
 *  afsluttet→neutral. */
const getProjectStatus = (project: ProjectData): ProjectStatusInfo => {
    const end = new Date(project.endDate);
    const now = new Date();
    // Calculate days left, considering end of day
    end.setHours(23, 59, 59, 999);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const openTasks = project.tasks.filter(t => t.status !== 'Udført').length;
    const totalTasks = project.tasks.length;

    if (project.status === 'Afsluttet') return { variant: 'neutral', label: 'Afsluttet', daysInfo: '', openTasks };
    if (daysLeft < 0 && openTasks > 0) return { variant: 'danger', label: 'Forsinket', daysInfo: `${Math.abs(daysLeft)} dage over`, openTasks };
    if (daysLeft < 5 && openTasks > 0) return { variant: 'warning', label: 'Risiko', daysInfo: `${daysLeft} dage tilbage`, openTasks };
    if (openTasks === 0 && totalTasks > 0) return { variant: 'success', label: 'Færdig', daysInfo: '', openTasks };
    return { variant: 'success', label: 'I rute', daysInfo: `${daysLeft} dage tilbage`, openTasks };
};

/** Live progress from tasks (stored `progress` column can be stale); falls
 *  back to the stored value for projects without tasks. */
const getProjectProgress = (project: ProjectData): number => {
    const total = project.tasks.length;
    if (total > 0) return Math.round((project.tasks.filter(t => t.status === 'Udført').length / total) * 100);
    return Math.max(0, Math.min(100, project.progress ?? 0));
};

const ProjectCard: React.FC<{
    project: ProjectData;
    unreadCount: number;
    isShared: boolean;
    onOpen: () => void;
    onToggleFavorite: (e: React.MouseEvent) => void;
}> = ({ project, unreadCount, isShared, onOpen, onToggleFavorite }) => {
    const status = getProjectStatus(project);
    const progress = getProjectProgress(project);
    const tone: ProgressTone =
        status.variant === 'danger' ? 'danger'
        : status.variant === 'warning' ? 'warning'
        : progress >= 100 ? 'success'
        : 'brand';
    const team = project.team.filter(m => m.status === 'ACTIVE');
    const meta = [`#${project.projectNumber}`, `${status.openTasks} åbne`, status.daysInfo].filter(Boolean).join(' · ');

    return (
        <Card
            interactive
            padding="md"
            onClick={onOpen}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return; // ignore keys from the star button
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Åbn projekt: ${project.name}`}
            className="group focus:outline-none focus:ring-2 focus:ring-brand-primary flex flex-col gap-3"
        >
            {/* Row 1: unread dot · name · status badge · favorite */}
            <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                    <span
                        className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-caption font-bold leading-none"
                        aria-label={`${unreadCount} ulæste notifikationer`}
                    >
                        {unreadCount}
                    </span>
                )}
                <h2 className="grow min-w-0 text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{project.name}</h2>
                <Badge variant={status.variant} dot>{status.label}</Badge>
                <button
                    type="button"
                    onClick={onToggleFavorite}
                    aria-label={project.isFavorite ? 'Fjern favorit' : 'Tilføj favorit'}
                    className="shrink-0 inline-flex w-11 h-11 -my-3 -mr-3 items-center justify-center rounded-control text-text-tertiary dark:text-text-dark-tertiary hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                >
                    <StarIcon filled={project.isFavorite} className={cn('w-5 h-5', project.isFavorite && 'text-warning')} />
                </button>
            </div>

            {/* Row 2: progress */}
            <ProgressBar value={progress} tone={tone} label={`Fremgang: ${progress}%`} />

            {/* Row 3: team + meta */}
            <div className="flex items-center justify-between gap-3 min-h-8">
                <div className="flex items-center gap-2 min-w-0">
                    {team.length > 0 ? (
                        <AvatarGroup people={team.map(m => ({ name: m.name }))} max={4} size="sm" />
                    ) : (
                        <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Intet team</span>
                    )}
                    {isShared && <Badge variant="brand">Delt med dig</Badge>}
                </div>
                <p className="shrink-0 text-caption text-text-secondary dark:text-text-dark-secondary text-right">{meta}</p>
            </div>
        </Card>
    );
};

type ProjectFilterStatus = 'ALL' | 'I gang' | 'Afsluttet' | 'ARCHIVED_CANCELLED' | 'Partner Projekter';

const ProjectsPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { checkNumericLimit } = useSubscription();
    const { showToast } = useToast();
    const planningEnabled = useModuleGate('planning');
    const partnersEnabled = useModuleGate('partners');
    const [projectsWithData, setProjectsWithData] = useState<ProjectData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'projects' | 'planning'>('projects');
    const [planningView, setPlanningView] = useState<'calendar' | 'gantt'>('gantt');
    const [filterStatus, setFilterStatus] = useState<ProjectFilterStatus>('ALL');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
    const [isQuickProjectOpen, setIsQuickProjectOpen] = useState(false);
    const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalInitialTime, setModalInitialTime] = useState('09:00');
    const [isFullScreenGantt, setIsFullScreenGantt] = useState(false);
    const [ganttZoomLevel, setGanttZoomLevel] = useState<GanttZoomLevel>('month');

    const [notifMap, setNotifMap] = useState<Record<string, number>>({});

    // Invitation Handling
    const [showConfetti, setShowConfetti] = useState(false);
    const [acceptedPartnerInvites, setAcceptedPartnerInvites] = useState<PartnerInvite[]>([]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);
        try {
            const [projectData, partnerInvites, unreadMap] = await Promise.all([
                getProjects(user?.id),
                partnersEnabled ? listMyPartnerInvites() : Promise.resolve([]),
                getUnreadNotificationsByProject(),
            ]);
            setNotifMap(unreadMap);
            const projectsWithDetails = await Promise.all(projectData.map(async (p) => {
              const [tasks, reminders] = await Promise.all([
                  // projects is the base module: tasks depends on it statically,
                  // so the reverse edge stays dynamic (no module cycle).
                  import('../../tasks').then((m) => m.getTasksForProject(p.id, user?.id)),
                  planningEnabled ? getRemindersForProject(p.id) : Promise.resolve([])
              ]);
              return {
                  ...p,
                  tasks,
                  reminders,
                  // Compute live from tasks — stored columns are stale (never updated after creation)
                  regulationCount: tasks.reduce((acc, t) => acc + (t.suggestedRegulations?.length ?? 0), 0),
                  checklistCount:  tasks.reduce((acc, t) => acc + (t.checklist?.length ?? 0), 0),
              };
            }));
            setProjectsWithData(projectsWithDetails);
            setAcceptedPartnerInvites(partnerInvites.filter(i => i.status === 'accepted'));
            setError(null);
        } catch {
            setError('Projekterne kunne ikke indlæses. Tjek din forbindelse og prøv igen.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, partnersEnabled, planningEnabled]);

    useEffect(() => { fetchAllData(); }, [fetchAllData]);
    useEffect(() => {
        const id = setInterval(() => fetchAllData(), 120_000);
        return () => clearInterval(id);
    }, [fetchAllData]);
    // Refresh the list immediately when the current user is removed from a
    // project (membership row deleted or cancelled), so the terminated project
    // disappears without waiting for the 120s poll.
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel('project-resources-mine')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'project_resources',
                filter: `user_id=eq.${user.id}`,
            }, (payload: any) => {
                const isRemoval =
                    payload.eventType === 'DELETE' ||
                    (payload.eventType === 'UPDATE' &&
                        (payload.new?.status === 'cancelled' || payload.new?.status === 'declined'));
                if (isRemoval) fetchAllData();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id, fetchAllData]);
    useEffect(() => { document.body.style.overflow = isFullScreenGantt ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [isFullScreenGantt]);
    // Safety net for a realtime entitlement flip while a locked view is open.
    useEffect(() => { if (!planningEnabled && viewMode === 'planning') setViewMode('projects'); }, [planningEnabled, viewMode]);
    useEffect(() => { if (!partnersEnabled && filterStatus === 'Partner Projekter') setFilterStatus('ALL'); }, [partnersEnabled, filterStatus]);

    const toggleFavorite = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setProjectsWithData(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
    };

    const handleProjectClick = (id: string) => navigate(`/project-detail/${id}`);

    const toggleSearch = () => {
        if (searchOpen) setSearchQuery('');
        setSearchOpen(!searchOpen);
    };

    const openReminderModal = (date: Date, time?: string) => {
        setModalDate(date);
        setModalInitialTime(time || '09:00');
        setIsReminderModalOpen(true);
    };

    const handleCreateReminder = async (data: { title: string, dateTime: string, context: string }) => {
        if (!projectsWithData.length) return;
        // Default to first project for calendar quick-add
        await createReminderForProject(projectsWithData[0].id, data);
        fetchAllData();
    }

    const handleEventClick = (event: any) => {
        if (event.type === 'project') navigate(`/project-detail/${event.projectId}`);
        else if (event.type === 'task') navigate(`/task/${event.data.id}`);
        else if (event.type === 'reminder') navigate(`/project-detail/${event.projectId}?tab=pamindelser`);
    };

    const onProjectCreated = (newProject: Project) => { setIsAddProjectModalOpen(false); fetchAllData(); navigate(`/project-detail/${newProject.id}`); };

    const handleOpenCreate = () => {
        if (!checkNumericLimit('maxActiveProjects', activeProjectCount)) {
            setIsLimitModalOpen(true);
        } else {
            setIsAddProjectModalOpen(true);
        }
    };

    const handleAcceptInvitation = async (projectId: string) => {
        if (!user) return;
        setShowConfetti(true);
        showToast("Du er nu en del af teamet!", "success");
        await acceptProjectInvitation(projectId, user.id);
        await fetchAllData();
    };

    const handleDeclineInvitation = () => {
        showToast("Invitation afvist.", "info");
    };

    const pendingProjects = useMemo(() => {
        if (!user) return [];
        return projectsWithData.filter(p => {
             const member = p.team.find(m => m.id === user.id);
             return member && member.status === 'PENDING';
        });
    }, [projectsWithData, user]);

    const activeProjects = useMemo(() => {
         if (!user) return projectsWithData.filter(p => !['ARCHIVED', 'CANCELLED'].includes(p.status ?? ''));
         // Exclude archived/cancelled and pending-member projects from the main list
         return projectsWithData.filter(p => {
             if (['ARCHIVED', 'CANCELLED'].includes(p.status ?? '')) return false;
             if (p.ownerId === user.id) return true;
             const member = p.team.find(m => m.id === user.id);
             if (member) return member.status === 'ACTIVE'; // hide if still PENDING invite
             // Not in team[] — project was returned via project_resources (active partner/staff)
             // or quick_task_access. SQL already enforces they have active access; show it.
             return true;
         });
    }, [projectsWithData, user]);

    const activeProjectCount = useMemo(() => {
        if (!user) return 0;
        // Match backend trigger: count OWNED projects where status is not Afsluttet, ARCHIVED, or CANCELLED
        return projectsWithData.filter(p =>
            p.ownerId === user.id &&
            !['Afsluttet', 'ARCHIVED', 'CANCELLED'].includes(p.status || '')
        ).length;
    }, [projectsWithData, user]);

    const archivedCancelledProjects = useMemo(() => {
        if (!user) return [];
        return projectsWithData.filter(p =>
            ['ARCHIVED', 'CANCELLED'].includes(p.status ?? '') &&
            p.ownerId === user.id
        );
    }, [projectsWithData, user]);

    const filteredProjects = useMemo(() => {
        if (filterStatus === 'Partner Projekter') return [];
        let projects: ProjectData[];
        if (filterStatus === 'ARCHIVED_CANCELLED') {
            projects = archivedCancelledProjects;
        } else {
            projects = filterStatus === 'ALL' ? activeProjects : activeProjects.filter(p => p.status === filterStatus);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            projects = projects.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.projectNumber && p.projectNumber.toLowerCase().includes(q)) ||
                (p.clientName && p.clientName.toLowerCase().includes(q)) ||
                (p.address && p.address.toLowerCase().includes(q))
            );
        }
        return projects;
    }, [activeProjects, archivedCancelledProjects, filterStatus, searchQuery]);

    const filterOptions: Array<{ id: ProjectFilterStatus; label: string; count: number }> = [
        { id: 'ALL', label: 'Alle', count: activeProjects.length },
        { id: 'I gang', label: 'I gang', count: activeProjects.filter(p => p.status === 'I gang').length },
        { id: 'Afsluttet', label: 'Afsluttet', count: activeProjects.filter(p => p.status === 'Afsluttet').length },
        { id: 'ARCHIVED_CANCELLED', label: 'Arkiveret', count: archivedCancelledProjects.length },
        ...(partnersEnabled ? [{ id: 'Partner Projekter' as ProjectFilterStatus, label: 'Partner Projekter', count: acceptedPartnerInvites.length }] : []),
    ];

    const errorAlert = error && (
        <Alert
            variant="danger"
            title="Kunne ikke hente projekter"
            action={<Button size="sm" variant="outline" onClick={fetchAllData}>Prøv igen</Button>}
        >
            {error}
        </Alert>
    );

    const ganttContent = !loading && !error && planningView === 'gantt' && (
        <GanttView projectsWithData={filteredProjects} onProjectClick={handleProjectClick} isFullScreen={isFullScreenGantt} onToggleFullScreen={setIsFullScreenGantt} zoomLevel={ganttZoomLevel} onZoomChange={setGanttZoomLevel} />
    );

    return (
        <AppScreen
            hasBottomNav={false}
            header={{
                title: <span className="text-title text-text-primary dark:text-text-dark-primary">Projekter</span>,
                back: '/home',
                actions: (
                    <>
                        <button
                            type="button"
                            aria-label="Søg i projekter"
                            aria-expanded={searchOpen ? 'true' : 'false'}
                            onClick={toggleSearch}
                            className={cn(
                                'inline-flex w-11 h-11 items-center justify-center rounded-control border transition-colors duration-150',
                                searchOpen
                                    ? 'border-brand-primary text-brand-primary bg-brand-subtle dark:bg-brand-subtle-dark'
                                    : 'border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
                            )}
                        >
                            <SearchIcon className="w-5 h-5" />
                        </button>
                        <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={handleOpenCreate}>Nyt</Button>
                    </>
                ),
            }}
        >
            <Confetti isActive={showConfetti} onComplete={() => setShowConfetti(false)} />

            <div className="space-y-4">
                <SegmentedControl<'projects' | 'planning'>
                    label="Skift visning"
                    options={[
                        { label: 'Projekter', value: 'projects' },
                        ...(planningEnabled ? [{ label: 'Planlægning', value: 'planning' as const }] : []),
                    ]}
                    value={viewMode}
                    onChange={setViewMode}
                />

                {searchOpen && (
                    <div className="relative animate-fade-in">
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary" />
                        <input
                            type="search"
                            autoFocus
                            placeholder="Søg i projekter"
                            aria-label="Søg i projekter"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 text-body bg-bg-muted dark:bg-bg-dark-muted pl-11 pr-4 rounded-control border border-transparent focus:border-brand-primary focus:outline-none transition-colors duration-150 text-text-primary dark:text-text-dark-primary placeholder:text-text-tertiary dark:placeholder:text-text-dark-tertiary"
                        />
                    </div>
                )}

                {new URLSearchParams(location.search).get('intent') === 'punch' && (
                    <Alert variant="warning" title="Tilføj Punch Punkt" className="animate-fade-in">
                        Vælg et projekt herunder og åbn punch-listen for at tilføje et nyt punkt.
                    </Alert>
                )}

                {viewMode === 'projects' ? (
                    <>
                        {/* Pending Invitations Section */}
                        {pendingProjects.length > 0 && (
                            <section className="animate-fade-in">
                                <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-2 flex items-center gap-2">
                                    <UsersIcon className="w-4 h-4" /> Invitationer
                                </h3>
                                <div className="space-y-3">
                                    {pendingProjects.map(project => (
                                        <div key={project.id} className="bg-brand-subtle dark:bg-brand-subtle-dark p-4 rounded-card border border-brand-primary/20 flex flex-col gap-3">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <h4 className="text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{project.name}</h4>
                                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">Inviteret af {project.team.find(m => m.role === 'OWNER')?.name || 'Ukendt'}</p>
                                                </div>
                                                <Badge variant="info">Afventer</Badge>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" className="flex-1" onClick={handleDeclineInvitation}>
                                                    Afvis
                                                </Button>
                                                <Button className="flex-[2]" iconLeft={<CheckIcon className="w-4 h-4" />} onClick={() => handleAcceptInvitation(project.id)}>
                                                    Accepter invitation
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <div role="group" aria-label="Filtrer projekter efter status" className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
                            {filterOptions.map(f => (
                                <Chip
                                    key={f.id}
                                    selected={filterStatus === f.id}
                                    count={f.count}
                                    onClick={() => setFilterStatus(f.id)}
                                    className="shrink-0"
                                >
                                    {f.label}
                                </Chip>
                            ))}
                        </div>

                        <div className="animate-fade-in">
                            {loading ? (
                                <SkeletonList count={3} label="Indlæser projekter…" />
                            ) : error ? (
                                errorAlert
                            ) : filterStatus === 'Partner Projekter' ? (
                                acceptedPartnerInvites.length === 0 ? (
                                    <Card padding="none">
                                        <EmptyState
                                            icon={<FolderIcon />}
                                            title="Ingen partnerforhold"
                                            description="Accepterede partnerinvitationer vises her."
                                        />
                                    </Card>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {acceptedPartnerInvites.map(invite => (
                                            <Card
                                                key={`partner-${invite.id}`}
                                                interactive
                                                padding="md"
                                                onClick={() => navigate(`/partner-project/${invite.projectId}`)}
                                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/partner-project/${invite.projectId}`)}
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Åbn partnerprojekt: ${invite.projectName ?? 'Projekt'}`}
                                                className="group focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <h2 className="grow min-w-0 text-label font-bold text-text-primary dark:text-text-dark-primary truncate">
                                                        {invite.projectName ?? 'Projekt'}
                                                    </h2>
                                                    <Badge variant="warning" dot>Underentreprise</Badge>
                                                </div>
                                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2">
                                                    {invite.taskCount !== undefined
                                                        ? `${invite.taskCount} ${invite.taskCount === 1 ? 'opgave tildelt' : 'opgaver tildelt'}`
                                                        : 'Underleverandør'}
                                                </p>
                                            </Card>
                                        ))}
                                    </div>
                                )
                            ) : filteredProjects.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredProjects.map(project => (
                                        <ProjectCard
                                            key={project.id}
                                            project={project}
                                            unreadCount={notifMap[project.id] ?? 0}
                                            isShared={project.ownerId !== user?.id}
                                            onOpen={() => handleProjectClick(project.id)}
                                            onToggleFavorite={(e) => toggleFavorite(project.id, e)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <Card padding="none">
                                    <EmptyState
                                        icon={<FolderIcon />}
                                        title={searchQuery.trim() || filterStatus !== 'ALL' ? 'Ingen projekter fundet' : 'Ingen projekter endnu'}
                                        description={
                                            searchQuery.trim() || filterStatus !== 'ALL'
                                                ? 'Prøv at justere din søgning eller dit filter.'
                                                : 'Opret dit første projekt og saml opgaver, indkøb og dokumentation ét sted.'
                                        }
                                        action={
                                            !(searchQuery.trim() || filterStatus !== 'ALL') && (
                                                <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={handleOpenCreate}>
                                                    Nyt projekt
                                                </Button>
                                            )
                                        }
                                    />
                                </Card>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <SegmentedControl<'calendar' | 'gantt'>
                            label="Skift planlægningsvisning"
                            options={[{ label: 'Kalender', value: 'calendar' }, { label: 'Gantt', value: 'gantt' }]}
                            value={planningView}
                            onChange={setPlanningView}
                        />
                        {planningView === 'gantt' ? <PlanningLegend /> : <div className="p-2 bg-bg-muted dark:bg-bg-dark-muted rounded-control text-caption text-center text-text-secondary dark:text-text-dark-secondary">Tryk på en dag for at se detaljer eller oprette påmindelse.</div>}
                        {loading && (
                            <div role="status" aria-label="Indlæser planlægning…">
                                <Skeleton className="h-64 rounded-card" />
                                <span className="sr-only">Indlæser planlægning…</span>
                            </div>
                        )}
                        {!loading && errorAlert}
                        {!loading && !error && planningView === 'calendar' && <CalendarView projectsWithData={filteredProjects} openModal={openReminderModal} onEventClick={handleEventClick} />}
                        {!isFullScreenGantt && ganttContent}
                    </div>
                )}
            </div>

            <FAB aria-label="Opret nyt projekt" icon={<PlusIcon className="w-7 h-7" />} onClick={handleOpenCreate} />
            <CreateProjectModal isOpen={isAddProjectModalOpen} onClose={() => setIsAddProjectModalOpen(false)} onProjectCreated={onProjectCreated} onQuickCreate={() => setIsQuickProjectOpen(true)} />
            <QuickProjectModal isOpen={isQuickProjectOpen} onClose={() => { setIsQuickProjectOpen(false); fetchAllData(); }} />
            {isLimitModalOpen && (
                <SubscriptionModal
                    onClose={() => setIsLimitModalOpen(false)}
                    limitMessage="Du har nået grænsen for aktive projekter på din plan."
                />
            )}
            {isReminderModalOpen && modalDate && <ReminderFormModal onClose={() => setIsReminderModalOpen(false)} onSave={handleCreateReminder} reminder={{id: '', title: '', dateTime: modalDate.toISOString(), context: '', isCompleted: false}} />}
            {isFullScreenGantt && ganttContent}
        </AppScreen>
    );
};

export default ProjectsPage;
