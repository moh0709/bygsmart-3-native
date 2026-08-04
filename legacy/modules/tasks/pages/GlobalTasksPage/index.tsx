
import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTasksForActiveProjects, archiveTask, deleteTask, updateTask, restoreTask } from '../../services/tasks';
import { getMyQuickTasks } from '../../services/quickTasks';
import { getMyAcceptedPartnerTasks, AcceptedPartnerTask, getMyPendingQuickTaskInvites, acceptQuickTaskInvite, PendingQuickTaskInvite } from '../../../partners';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useToast } from '../../../../contexts/ToastContext';
import { useModuleGate } from '../../../../core/entitlements/ModuleGate';
import type { Task, TaskStatus } from '../../../../types';
import {
    CheckCircleIcon, PlusIcon, ZapIcon,
    ChevronDownIcon,
} from '../../../../components/icons';
import TaskListView from '../../components/TaskListView';
import TaskGroupView from '../../components/TaskGroupView';
import TaskSplitView from '../../components/TaskSplitView';
import TaskKanbanView from '../../components/TaskKanbanView';
import { buildUnifiedItems, sortByCreatedAt, sortByDueDate } from '../../components/taskViewModel';
import { quickTaskId } from '../../components/taskCards';
import {
    Alert,
    AppScreen,
    Badge,
    Button,
    Card,
    Chip,
    EmptyState,
    FAB,
    ListRow,
    SegmentedControl,
    SkeletonList,
    cn,
} from '../../../../components/ui';
import { CreateQuickTaskModal } from './CreateQuickTaskModal';
// Workspace modals live in modules/field, which depends on THIS module
// (field requires:['tasks']) — lazy-load so tasks never statically imports field.
const InviteTaskMemberModal = lazy(() => import('../../../field').then((m) => ({ default: m.InviteTaskMemberModal })));
const TaskWorkspaceModal = lazy(() => import('../../../field').then((m) => ({ default: m.TaskWorkspaceModal })));
import type { FilterTab, TaskView, SortField, SortDir, GroupBy, QuickStatusTab } from './constants';
import {
    isToday, isOverdue, isPartnerTaskOverdue, filterPartnerTasks,
    QUICK_STATUS_TABS, TABS, VIEW_LABELS, SORT_LABELS, GROUP_BY_LABELS,
    menuTriggerClass, menuPanelClass, menuItemClass,
} from './constants';

const GlobalTasksPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const partnersEnabled = useModuleGate('partners');
    const fieldEnabled = useModuleGate('field');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [partnerTasks, setPartnerTasks] = useState<AcceptedPartnerTask[]>([]);
    const [quickTasks, setQuickTasks] = useState<Task[]>([]);
    const [pendingInvites, setPendingInvites] = useState<PendingQuickTaskInvite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>('Alle');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [delegateTaskId, setDelegateTaskId] = useState<string | null>(null);
    const [quickStatusTab, setQuickStatusTab] = useState<QuickStatusTab>('Alle');
    const [showArchived, setShowArchived] = useState(false);
    const [archivedQuickTasks, setArchivedQuickTasks] = useState<Task[]>([]);

    // View + sort state
    const [taskView, setTaskView] = useState<TaskView>('List');
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [groupBy, setGroupBy] = useState<GroupBy>('project');
    const groupByMenuRef = useRef<HTMLDivElement>(null);
    const [groupByMenuOpen, setGroupByMenuOpen] = useState(false);

    const loadAll = useCallback(() => {
        if (!user) return;
        setIsLoading(true);
        setError(null);
        Promise.all([
            getAllTasksForActiveProjects(user.id),
            partnersEnabled ? getMyAcceptedPartnerTasks() : Promise.resolve([]),
            getMyQuickTasks(),
            partnersEnabled ? getMyPendingQuickTaskInvites() : Promise.resolve([]),
        ])
            .then(([regular, partner, quick, pending]) => {
                setTasks(regular);
                setPartnerTasks(partner);
                setQuickTasks(quick);
                setPendingInvites(pending);
            })
            .catch(() => setError('Kunne ikke hente opgaver. Prøv igen.'))
            .finally(() => setIsLoading(false));
    }, [user, partnersEnabled]);

    useEffect(() => { loadAll(); }, [loadAll]);
    useEffect(() => {
        const id = setInterval(() => loadAll(), 120_000);
        return () => clearInterval(id);
    }, [loadAll]);

    useEffect(() => {
        if (!sortMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
                setSortMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [sortMenuOpen]);

    useEffect(() => {
        if (!groupByMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (groupByMenuRef.current && !groupByMenuRef.current.contains(e.target as Node)) {
                setGroupByMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [groupByMenuOpen]);

    const filtered = useMemo(() => {
        if (activeTab === 'Partner Opgaver' || activeTab === 'Quick Tasks') return [];
        switch (activeTab) {
            case 'I dag':
                return tasks.filter(t => t.dueDate && isToday(t.dueDate) && t.status !== 'Udført');
            case 'Forfaldne':
                return tasks.filter(isOverdue);
            case 'Igangværende':
                return tasks.filter(t => t.status === 'Igangværende');
            case 'Udført':
                return tasks.filter(t => t.status === 'Udført');
            default:
                return tasks;
        }
    }, [tasks, activeTab]);

    const filteredPartner = useMemo(
        () => activeTab === 'Quick Tasks' ? [] : filterPartnerTasks(partnerTasks, activeTab),
        [partnerTasks, activeTab],
    );

    const filteredQuick = useMemo(() => {
        if (activeTab !== 'Quick Tasks' && activeTab !== 'Alle') return [];
        if (quickStatusTab === 'Alle') return quickTasks;
        return quickTasks.filter(t => t.status === quickStatusTab);
    }, [quickTasks, activeTab, quickStatusTab]);

    const quickStatusCounts = useMemo<Record<QuickStatusTab, number>>(() => ({
        'Alle': quickTasks.length,
        'To Do': quickTasks.filter(t => t.status === 'To Do').length,
        'Igangværende': quickTasks.filter(t => t.status === 'Igangværende').length,
        'Udført': quickTasks.filter(t => t.status === 'Udført').length,
        'Annulleret': quickTasks.filter(t => t.status === ('Annulleret' as TaskStatus)).length,
    }), [quickTasks]);

    const unifiedItems = useMemo(() => {
        const projectItems = (activeTab !== 'Partner Opgaver' && activeTab !== 'Quick Tasks') ? filtered : [];
        const partnerItems = (activeTab !== 'Quick Tasks') ? filteredPartner : [];
        const quickItems = (activeTab === 'Alle' || activeTab === 'Quick Tasks') ? filteredQuick : [];

        const raw = buildUnifiedItems(projectItems, quickItems, partnerItems);

        if (taskView === 'List') {
            return sortField === 'dueDate'
                ? sortByDueDate(raw, sortDir)
                : sortByCreatedAt(raw, sortDir);
        }
        return raw;
    }, [filtered, filteredPartner, filteredQuick, activeTab, taskView, sortField, sortDir]);

    const counts: Record<FilterTab, number> = useMemo(() => ({
        'Alle': tasks.length + partnerTasks.length + quickTasks.length,
        'I dag': tasks.filter(t => t.dueDate && isToday(t.dueDate) && t.status !== 'Udført').length
            + partnerTasks.filter(t => t.dueDate && isToday(t.dueDate) && t.status !== 'Udført').length,
        'Forfaldne': tasks.filter(isOverdue).length + partnerTasks.filter(isPartnerTaskOverdue).length,
        'Igangværende': tasks.filter(t => t.status === 'Igangværende').length
            + partnerTasks.filter(t => t.status === 'Igangværende').length,
        'Udført': tasks.filter(t => t.status === 'Udført').length
            + partnerTasks.filter(t => t.status === 'Udført').length,
        'Partner Opgaver': partnerTasks.length,
        'Quick Tasks': quickTasks.length,
    }), [tasks, partnerTasks, quickTasks]);

    const handleArchiveQuick = async (id: string) => {
        await archiveTask(id);
        setQuickTasks(prev => prev.filter(t => t.id !== id));
        showToast('Opgave arkiveret', 'success');
    };

    const handleDeleteQuick = async (id: string) => {
        await deleteTask(id);
        setQuickTasks(prev => prev.filter(t => t.id !== id));
        showToast('Opgave slettet', 'success');
    };

    const handleStatusChangeQuick = async (taskId: string, newStatus: string) => {
        const task = quickTasks.find(t => t.id === taskId);
        if (!task) return;
        const updated = { ...task, status: newStatus as TaskStatus };
        const success = await updateTask(updated);
        if (success) {
            setQuickTasks(prev => prev.map(t => t.id === taskId ? updated : t));
            showToast('Status opdateret', 'success');
        } else {
            showToast('Kunne ikke opdatere status', 'error');
        }
    };

    const handleKanbanDrop = (taskId: string, newStatus: string, kind: 'quick' | 'project' | 'partner') => {
        if (kind === 'quick') {
            setQuickTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));
        } else if (kind === 'project') {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));
        } else {
            setPartnerTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));
        }
    };

    const handleKanbanStatusChangeFailed = (message: string) => {
        showToast(message, 'error');
    };

    // Opening a task's workspace and delegating a task both render field-module
    // UI (TaskWorkspaceModal / InviteTaskMemberModal) — neither goes through a
    // route-level gate here (this is a modal, not a route), so redirect to the
    // module's storefront page instead of opening locked content.
    const handleOpenTask = useCallback((id: string) => {
        if (!fieldEnabled) { navigate('/moduler/field'); return; }
        setOpenTaskId(id);
    }, [fieldEnabled, navigate]);

    const handleDelegateTask = useCallback((id: string) => {
        if (!fieldEnabled) { navigate('/moduler/field'); return; }
        setDelegateTaskId(id);
    }, [fieldEnabled, navigate]);

    const handleAcceptQuickTaskInvite = async (taskId: string) => {
        try {
            await acceptQuickTaskInvite(taskId);
            setPendingInvites(prev => prev.filter(i => i.taskId !== taskId));
            const updated = await getMyQuickTasks();
            setQuickTasks(updated);
            showToast('Invitation accepteret', 'success');
        } catch {
            showToast('Kunne ikke acceptere invitation', 'error');
        }
    };

    const handleToggleArchived = async () => {
        if (!showArchived) {
            const all = await getMyQuickTasks(true);
            setQuickTasks(all.filter(t => t.archivedAt == null));
            setArchivedQuickTasks(all.filter(t => t.archivedAt != null));
            setShowArchived(true);
        } else {
            setArchivedQuickTasks([]);
            const active = await getMyQuickTasks(false);
            setQuickTasks(active);
            setShowArchived(false);
        }
    };

    const handleRestoreQuick = async (id: string) => {
        try {
            await restoreTask(id);
            const restored = archivedQuickTasks.find(t => t.id === id);
            setArchivedQuickTasks(prev => prev.filter(t => t.id !== id));
            if (restored) setQuickTasks(prev => [{ ...restored, archivedAt: undefined }, ...prev]);
            showToast('Opgave gendannet', 'success');
        } catch {
            showToast('Kunne ikke gendanne opgave', 'error');
        }
    };

    const showQuickSection = activeTab === 'Alle' || activeTab === 'Quick Tasks';

    const showEmpty = !isLoading && !error
        && filtered.length === 0
        && filteredPartner.length === 0
        && (showQuickSection ? filteredQuick.length === 0 && archivedQuickTasks.length === 0 : true);

    const showQuickStatusEmpty = !isLoading && !error
        && showQuickSection
        && quickStatusTab !== 'Alle'
        && filteredQuick.length === 0
        && quickTasks.length > 0;

    const showQuickArchived = showQuickSection && (quickTasks.length > 0 || archivedQuickTasks.length > 0);

    const showQuickStatusTabs = !isLoading && !error && showQuickSection && (quickTasks.length > 0 || archivedQuickTasks.length > 0);

    const emptyTitle =
        activeTab === 'Udført' ? 'Ingen afsluttede opgaver'
        : activeTab === 'Partner Opgaver' ? 'Ingen partneropgaver'
        : activeTab === 'Quick Tasks' ? 'Ingen hurtigopgaver'
        : 'Ingen opgaver her';

    const emptyDescription =
        activeTab === 'Forfaldne' ? 'Godt klaret – ingen forfaldne opgaver.'
        : activeTab === 'I dag' ? 'Ingen opgaver forfaldne i dag.'
        : activeTab === 'Igangværende' ? 'Ingen igangværende opgaver.'
        : activeTab === 'Udført' ? 'Fuldfør dine første opgaver for at se dem her.'
        : activeTab === 'Alle' ? 'Start et projekt eller opret en hurtigopgave.'
        : activeTab === 'Partner Opgaver' ? 'Accepterede partneropgaver vises her.'
        : 'Opret en hurtigopgave til opgaver der ikke hører til et projekt.';

    return (
        <AppScreen
            hasBottomNav={false}
            header={{
                title: <span className="text-title text-text-primary dark:text-text-dark-primary">Opgaver</span>,
                back: '/home',
                actions: (
                    <Button
                        size="sm"
                        iconLeft={<PlusIcon className="w-4 h-4" />}
                        onClick={() => setShowCreateModal(true)}
                    >
                        Ny
                    </Button>
                ),
            }}
        >
            <div className="space-y-4">
                {/* Filter chips */}
                <div role="group" aria-label="Filtrer opgaver" className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
                    {TABS.filter(tab => tab !== 'Partner Opgaver' || partnersEnabled).map(tab => (
                        <Chip
                            key={tab}
                            selected={activeTab === tab}
                            count={counts[tab]}
                            icon={tab === 'Quick Tasks' ? <ZapIcon className="w-3.5 h-3.5" /> : undefined}
                            onClick={() => setActiveTab(tab)}
                            className="shrink-0"
                        >
                            {tab}
                        </Chip>
                    ))}
                </div>

                {/* View switcher */}
                <SegmentedControl<TaskView>
                    label="Skift opgavevisning"
                    value={taskView}
                    onChange={setTaskView}
                    options={(['List', 'Group', 'Split', 'Kanban'] as TaskView[]).map(v => ({
                        label: VIEW_LABELS[v],
                        value: v,
                    }))}
                />

                {/* Sort (List) / group-by (Group) toolbar */}
                {(taskView === 'List' || taskView === 'Group') && (
                    <div className="flex items-center gap-2">
                        {taskView === 'Group' && (
                            <div ref={groupByMenuRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setGroupByMenuOpen(v => !v)}
                                    className={menuTriggerClass}
                                >
                                    {GROUP_BY_LABELS[groupBy]}
                                    <ChevronDownIcon className="w-3.5 h-3.5" />
                                </button>
                                {groupByMenuOpen && (
                                    <div className={menuPanelClass}>
                                        {(['project', 'createdMonth', 'dueMonth'] as GroupBy[]).map(g => (
                                            <button
                                                type="button"
                                                key={g}
                                                onClick={() => { setGroupBy(g); setGroupByMenuOpen(false); }}
                                                className={menuItemClass(groupBy === g)}
                                            >
                                                {groupBy === g && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                                {GROUP_BY_LABELS[g]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {taskView === 'List' && (
                            <>
                                <div ref={sortMenuRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setSortMenuOpen(v => !v)}
                                        className={menuTriggerClass}
                                    >
                                        {SORT_LABELS[sortField]}
                                        <ChevronDownIcon className="w-3.5 h-3.5" />
                                    </button>
                                    {sortMenuOpen && (
                                        <div className={menuPanelClass}>
                                            {(['createdAt', 'dueDate'] as SortField[]).map(f => (
                                                <button
                                                    type="button"
                                                    key={f}
                                                    onClick={() => { setSortField(f); setSortMenuOpen(false); }}
                                                    className={menuItemClass(sortField === f)}
                                                >
                                                    {sortField === f && <CheckCircleIcon className="w-3.5 h-3.5" />}
                                                    {SORT_LABELS[f]}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Asc/desc toggle */}
                                <button
                                    type="button"
                                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    aria-label={sortDir === 'asc' ? 'Sortér faldende' : 'Sortér stigende'}
                                    title={sortDir === 'asc' ? 'Stigende' : 'Faldende'}
                                    className={cn(menuTriggerClass, 'w-9 justify-center px-0 font-bold')}
                                >
                                    {sortDir === 'asc' ? '↑' : '↓'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Quick status sub-chips */}
                {showQuickStatusTabs && (
                    <div role="group" aria-label="Filtrer hurtigopgaver efter status" className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 pb-1">
                        {QUICK_STATUS_TABS.map(tab => (
                            <Chip
                                key={tab}
                                selected={quickStatusTab === tab}
                                count={quickStatusCounts[tab]}
                                onClick={() => setQuickStatusTab(tab)}
                                className="shrink-0"
                            >
                                {tab === 'To Do' ? 'Ikke startet' : tab}
                            </Chip>
                        ))}
                    </div>
                )}

                {isLoading && <SkeletonList count={4} label="Henter opgaver…" />}

                {!isLoading && error && (
                    <Alert
                        variant="danger"
                        title="Kunne ikke hente opgaver"
                        action={<Button size="sm" variant="outline" onClick={loadAll}>Prøv igen</Button>}
                    >
                        {error}
                    </Alert>
                )}

                {/* Empty state */}
                {showEmpty && (
                    <Card padding="none">
                        <EmptyState
                            icon={activeTab === 'Quick Tasks' ? <ZapIcon /> : <CheckCircleIcon />}
                            title={emptyTitle}
                            description={emptyDescription}
                            action={
                                activeTab === 'Quick Tasks' && (
                                    <Button
                                        size="sm"
                                        iconLeft={<PlusIcon className="w-4 h-4" />}
                                        onClick={() => setShowCreateModal(true)}
                                    >
                                        Opret hurtigopgave
                                    </Button>
                                )
                            }
                        />
                    </Card>
                )}

                {showQuickStatusEmpty && (
                    <Card padding="none">
                        <EmptyState
                            icon={<ZapIcon />}
                            title={`Ingen hurtigopgaver med status "${quickStatusTab === 'To Do' ? 'Ikke startet' : quickStatusTab}"`}
                        />
                    </Card>
                )}

                {!isLoading && !error && (
                    <>
                        {/* Pending quick-task delegation invites — shown in all views */}
                        {showQuickSection && pendingInvites.length > 0 && (
                            <section aria-label="Ventende invitationer">
                                <div className="flex items-center gap-1.5 mb-2 px-1">
                                    <ZapIcon className="w-3.5 h-3.5 text-warning" />
                                    <span className="text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                                        Ventende invitationer
                                    </span>
                                    <Badge variant="warning">{pendingInvites.length}</Badge>
                                </div>
                                <div className="space-y-2">
                                    {pendingInvites.map(inv => (
                                        <Card
                                            key={inv.taskId}
                                            padding="md"
                                            className="flex items-center justify-between gap-3 border-warning-border dark:border-warning/30"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{inv.title}</p>
                                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">Invitation til hurtigopgave</p>
                                            </div>
                                            <Button size="sm" onClick={() => handleAcceptQuickTaskInvite(inv.taskId)} className="shrink-0">
                                                Accepter
                                            </Button>
                                        </Card>
                                    ))}
                                </div>
                            </section>
                        )}

                        {taskView === 'List' && (
                            <TaskListView
                                items={unifiedItems}
                                userId={user?.id}
                                onNavigate={handleOpenTask}
                                onArchive={handleArchiveQuick}
                                onDelete={handleDeleteQuick}
                                onDelegate={handleDelegateTask}
                                onStatusChange={handleStatusChangeQuick}
                            />
                        )}

                        {taskView === 'Group' && (
                            <TaskGroupView
                                items={unifiedItems}
                                groupBy={groupBy}
                                userId={user?.id}
                                onNavigate={handleOpenTask}
                                onArchive={handleArchiveQuick}
                                onDelete={handleDeleteQuick}
                                onDelegate={handleDelegateTask}
                                onStatusChange={handleStatusChangeQuick}
                            />
                        )}

                        {taskView === 'Split' && (
                            <div className="overflow-hidden">
                                <TaskSplitView
                                    items={unifiedItems}
                                    userId={user?.id}
                                    onNavigate={handleOpenTask}
                                    onArchive={handleArchiveQuick}
                                    onDelete={handleDeleteQuick}
                                    onDelegate={handleDelegateTask}
                                    onStatusChange={handleStatusChangeQuick}
                                />
                            </div>
                        )}

                        {taskView === 'Kanban' && (
                            <TaskKanbanView
                                items={unifiedItems}
                                userId={user?.id}
                                onNavigate={handleOpenTask}
                                onArchive={handleArchiveQuick}
                                onDelete={handleDeleteQuick}
                                onDelegate={handleDelegateTask}
                                onStatusChange={handleStatusChangeQuick}
                                onStatusChangeFailed={handleKanbanStatusChangeFailed}
                                onKanbanDrop={handleKanbanDrop}
                            />
                        )}

                        {/* Archive toggle — shown in all views */}
                        {showQuickArchived && (
                            <div className="flex items-center justify-between pt-1">
                                <Chip
                                    selected={showArchived}
                                    count={archivedQuickTasks.length > 0 ? archivedQuickTasks.length : undefined}
                                    onClick={handleToggleArchived}
                                    className="shrink-0"
                                >
                                    Arkiverede
                                </Chip>
                            </div>
                        )}

                        {showArchived && archivedQuickTasks.length > 0 && (
                            <section aria-label="Arkiverede opgaver">
                                <div className="flex items-center gap-1.5 mb-2 px-1">
                                    <span className="text-caption font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                                        Arkiverede opgaver
                                    </span>
                                    <Badge>{archivedQuickTasks.length}</Badge>
                                </div>
                                <Card padding="none" className="divide-y divide-border dark:divide-border-dark overflow-hidden">
                                    {archivedQuickTasks.map(task => (
                                        <ListRow
                                            key={task.id}
                                            title={<span className="opacity-70">{task.title}</span>}
                                            subtitle={
                                                <span className="font-mono text-warning-strong dark:text-warning">
                                                    {quickTaskId(task.id)}
                                                </span>
                                            }
                                            trailing={
                                                <>
                                                    <Badge>Arkiveret</Badge>
                                                    <Button size="sm" variant="secondary" onClick={() => handleRestoreQuick(task.id)}>
                                                        Gendan
                                                    </Button>
                                                </>
                                            }
                                        />
                                    ))}
                                </Card>
                            </section>
                        )}
                    </>
                )}
            </div>

            {/* FAB — create quick task */}
            <FAB
                aria-label="Opret hurtigopgave"
                icon={<PlusIcon className="w-7 h-7" />}
                onClick={() => setShowCreateModal(true)}
            />

            {showCreateModal && (
                <CreateQuickTaskModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={task => setQuickTasks(prev => [task, ...prev])}
                />
            )}

            {delegateTaskId && fieldEnabled && (
                <Suspense fallback={null}>
                    <InviteTaskMemberModal
                        taskId={delegateTaskId}
                        existingUserIds={[]}
                        onClose={() => setDelegateTaskId(null)}
                        onGranted={() => {
                            setDelegateTaskId(null);
                            getMyQuickTasks().then(updated => setQuickTasks(updated));
                        }}
                    />
                </Suspense>
            )}

            {openTaskId && fieldEnabled && (
                <Suspense fallback={null}>
                    <TaskWorkspaceModal
                        taskId={openTaskId}
                        onClose={() => { setOpenTaskId(null); loadAll(); }}
                    />
                </Suspense>
            )}
        </AppScreen>
    );
};

export default GlobalTasksPage;
