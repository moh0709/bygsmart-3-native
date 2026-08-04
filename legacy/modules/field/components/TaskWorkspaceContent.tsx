import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTaskById, updateTask } from '../../tasks';
import type { Task, ChecklistItem, TaskCheckIn, ProjectMember } from '../../../types';
import {
    CalendarIcon, LinkIcon, CheckCircleIcon, ClockIcon, PaperclipIcon,
    FileTextIcon, XIcon, DownloadIcon,
    EyeIcon, UploadCloudIcon, PlayIcon, SettingsIcon,
} from '../../../components/icons';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';
import { resolveFileUrl } from '../../../utils/fileUtils';
import {
    Alert,
    AppScreen,
    Avatar,
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    EmptyState,
    ListRow,
    ProgressBar,
    Skeleton,
    SkeletonList,
    Tabs,
    cn,
} from '../../../components/ui';
import { STATUS_VARIANT, statusLabel } from '../../tasks';
import {
    getActiveCheckIn,
    getActiveCheckInForTask,
    checkInToTask,
    checkOutOfTask,
    listTaskDocumentation,
} from '../services/taskWorkspace';
import { exportTaskToExcel } from '../../reporting';
import { supabase } from '../../../services/supabaseClient';
import { getAcceptedPartnerForTask, formatOre } from '../../partners';
import type { AcceptedPartnerInfo } from '../../partners';
import { listTaskAccess } from '../../tasks';
import TaskDocumentationTab from './TaskDocumentationTab';
import TaskChatTab from './TaskChatTab';
import { TeamTab } from './TeamTab';
import { TaskSettingsModal } from './TaskSettingsModal';
import { useTaskChatUnread } from '../hooks/useTaskChatUnread';
import { ImageViewModal } from '../pages/TaskDetailPage/ImageViewModal';
import { ResolvedImage } from '../pages/TaskDetailPage/ResolvedImage';
import { CheckOutModal } from '../pages/TaskDetailPage/CheckOutModal';
import { StatusStepper } from '../pages/TaskDetailPage/StatusStepper';
import { HandoverActionCard } from '../pages/TaskDetailPage/HandoverActionCard';
import { FaerdigmeldModal } from '../pages/TaskDetailPage/FaerdigmeldModal';
import { GodkendModal } from '../pages/TaskDetailPage/GodkendModal';
import { AfvisModal } from '../pages/TaskDetailPage/AfvisModal';
import { ICON_BTN, WORKSPACE_TABS, ALWAYS_ON_TAB_IDS, AUTO_WARN_SECONDS } from '../pages/TaskDetailPage/constants';
import type { TabId } from '../pages/TaskDetailPage/constants';
import { formatElapsed } from '../pages/TaskDetailPage/helpers';

// ─── Shared task workspace ──────────────────────────────────────────────────
// The merged UI for both quick tasks and project tasks. Rendered either full-
// page (pages/TaskDetailPage/index.tsx, a thin taskId/route wrapper) or as an
// overlay (TaskWorkspaceModal, opened from task lists) — `mode` only changes
// chrome ownership (AppScreen's header/back-button vs an inline header, fixed
// vs sticky bottom bar), never behaviour. The role-gated Edit/Work/View mode
// switch and tab-visibility settings still land in a later phase.

export interface TaskWorkspaceContentProps {
    taskId: string;
    mode?: 'modal' | 'page';
    /** Modal mode only — lets the "not found" state close the overlay instead of navigating back. */
    onClose?: () => void;
}

export const TaskWorkspaceContent: React.FC<TaskWorkspaceContentProps> = ({ taskId, mode = 'page', onClose }) => {
    const isModal = mode === 'modal';
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { showToast } = useToast();
    // Check-in/out is field's own core feature and must complete regardless of
    // module entitlements — this only decides whether the cross-module
    // logTimeEntry side effect inside checkOutOfTask runs.
    const timeModuleEnabled = useModuleGate('time');
    // Gates the accepted-partner fetch/card and the Excel-export button below —
    // both embed other modules' content inside field's own task workspace.
    const partnersEnabled = useModuleGate('partners');
    const reportingEnabled = useModuleGate('reporting');

    // Honor a ?tab= deep-link (e.g. from a chat-mention notification) on first load.
    const [activeTab, setActiveTab] = useState<TabId>(() => {
        const t = searchParams.get('tab');
        return WORKSPACE_TABS.some(w => w.id === t) ? (t as TabId) : 'overblik';
    });
    const [task, setTask]           = useState<Task | null>(null);
    const [loading, setLoading]     = useState(true);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

    // Check-in/out
    const [myCheckIn, setMyCheckIn]     = useState<TaskCheckIn | null>(null); // own active session (any task)
    const [taskCheckIn, setTaskCheckIn] = useState<TaskCheckIn[]>([]); // all workers active on this task
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [checkingIn, setCheckingIn]   = useState(false);
    const [checkingOut, setCheckingOut] = useState(false);
    const [showCheckOutModal, setShowCheckOutModal] = useState(false);

    // Slot inside the fixed bottom zone (above the check-in bar) that the chat
    // composer portals into, so it's always pinned to the screen edge instead
    // of wherever the message list happens to end.
    const [composerSlot, setComposerSlot] = useState<HTMLDivElement | null>(null);

    // Total time logged on this task
    const [totalTaskHours, setTotalTaskHours] = useState<number | null>(null);

    // Accepted partner info for this task (if any)
    const [acceptedPartner, setAcceptedPartner] = useState<AcceptedPartnerInfo | null>(null);

    // Handover modals
    const [showFaerdigmeldModal, setShowFaerdigmeldModal] = useState(false);
    const [showGodkendModal, setShowGodkendModal]         = useState(false);
    const [showAfvisModal, setShowAfvisModal]             = useState(false);

    // Settings (Faner / Rapport) modal — owner/responsible only
    const [showSettings, setShowSettings] = useState(false);

    // Per-task access grants (quick_task_access) — used for isAssignedWorker/chatTeam
    // derivation here; the Team tab loads its own copy for display/revoke (TeamTab.tsx).
    const [quickTaskMembers, setQuickTaskMembers] = useState<{ userId: string | null; status: string; invitedBy: string; name: string; initials: string }[]>([]);

    // ── Loaders ───────────────────────────────────────────────────────────────

    const fetchTask = useCallback(async () => {
        if (!taskId) return;
        setLoading(true);
        const data = await getTaskById(taskId);
        setTask(data ?? null);
        setChecklist(data?.checklist ?? []);
        setLoading(false);
    }, [taskId]);

    const loadCheckInState = useCallback(async () => {
        if (!user || !taskId) return;
        const [mine, taskCi] = await Promise.all([
            getActiveCheckIn(user.id),
            getActiveCheckInForTask(taskId),
        ]);
        setMyCheckIn(mine);
        setTaskCheckIn(taskCi);
    }, [user, taskId]);

    const loadTotalTime = useCallback(async () => {
        if (!taskId) return;
        const { data, error } = await (supabase as any).rpc('get_task_time_total', { p_task_id: taskId });
        if (!error && data !== null) {
            setTotalTaskHours(Math.round(Number(data) * 100) / 100);
        }
    }, [taskId]);

    useEffect(() => {
        fetchTask();
        loadCheckInState();
        loadTotalTime();
    }, [fetchTask, loadCheckInState, loadTotalTime]);

    // ── Accepted partner info ─────────────────────────────────────────────────

    const taskProjectId = task?.projectId;
    useEffect(() => {
        if (!partnersEnabled || !taskProjectId || !taskId) { setAcceptedPartner(null); return; }
        getAcceptedPartnerForTask(taskId, taskProjectId)
            .then(setAcceptedPartner)
            .catch(() => setAcceptedPartner(null));
    }, [partnersEnabled, taskProjectId, taskId]);

    // ── Task access grants (quick_task_access) ───────────────────────────────
    // Loaded for every task now, not just quick ones — a grant can target a
    // project task too (supabase/migrations/20260710000002_task_access_project_task_rls.sql).

    const loadQuickTaskMembers = useCallback(async () => {
        if (!taskId) return;
        const members = await listTaskAccess(taskId);
        setQuickTaskMembers(members);
    }, [taskId]);

    useEffect(() => {
        loadQuickTaskMembers();
    }, [loadQuickTaskMembers]);

    // ── Elapsed-time ticker ───────────────────────────────────────────────────

    useEffect(() => {
        const activeSession = myCheckIn?.taskId === taskId ? myCheckIn : null;
        if (!activeSession) { setElapsedSeconds(0); return; }
        const base = new Date(activeSession.checkedInAt).getTime();
        const tick = () => setElapsedSeconds(Math.floor((Date.now() - base) / 1000));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [myCheckIn, taskId]);

    // ── Check-in ──────────────────────────────────────────────────────────────

    const handleCheckIn = async () => {
        if (!user || !taskId) return;
        setCheckingIn(true);
        try {
            let geo: { lat: number; lng: number; accuracy?: number } | undefined;
            try {
                const pos = await new Promise<GeolocationPosition>((ok, fail) =>
                    navigator.geolocation.getCurrentPosition(ok, fail, { timeout: 5000 })
                );
                geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            } catch { /* permission denied or unavailable — skip silently */ }

            const ci = await checkInToTask(taskId, task.projectId ?? null, { id: user.id, name: user.name }, geo);
            setMyCheckIn(ci);
            setTaskCheckIn(prev => [...prev, ci]);
            showToast('Du er checket ind!', 'success');
        } catch (err: any) {
            showToast(err?.message ?? 'Kunne ikke checke ind', 'error');
        } finally {
            setCheckingIn(false);
        }
    };

    // ── Check-out ─────────────────────────────────────────────────────────────

    const handleCheckOut = async (data: { hours: number; description: string }) => {
        if (!myCheckIn) return;
        setShowCheckOutModal(false);
        setCheckingOut(true);
        try {
            const checkedOutId = myCheckIn.id;
            await checkOutOfTask(checkedOutId, { hours: data.hours, description: data.description, logTime: timeModuleEnabled });
            setMyCheckIn(null);
            setTaskCheckIn(prev => prev.filter(c => c.id !== checkedOutId));
            setElapsedSeconds(0);
            await loadTotalTime();
            showToast('Tid registreret — check ud gennemført', 'success');
        } catch (err: any) {
            showToast(err?.message ?? 'Kunne ikke checke ud', 'error');
            // The service rolls back checked_out_at on failure — reload so the
            // UI reflects the true server state and doesn't freeze on a stale session.
            await loadCheckInState();
        } finally {
            setCheckingOut(false);
        }
    };

    // ── Checklist ─────────────────────────────────────────────────────────────

    const handleCheckItem = async (id: string) => {
        const updated = checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item);
        setChecklist(updated);
        if (task) await updateTask({ ...task, checklist: updated });
    };

    // ── Excel export ──────────────────────────────────────────────────────────

    const handleExportExcel = async () => {
        if (!task || !taskId || !reportingEnabled) return;
        try {
            const { data: teRows } = await (supabase as any)
                .from('time_entries')
                .select('id, project_id, task_id, user_id, user_name, hours, date, description')
                .eq('task_id', taskId)
                .order('date', { ascending: true });
            const taskTimeEntries = (teRows ?? []).map((r: any) => ({
                id: r.id ?? '',
                projectId: r.project_id ?? task.projectId ?? '',
                taskId: r.task_id ?? taskId,
                userId: r.user_id ?? '',
                userName: r.user_name ?? '',
                hours: r.hours ?? 0,
                date: r.date ?? '',
                description: r.description ?? '',
            }));
            const docs = await listTaskDocumentation(taskId);
            exportTaskToExcel(task, taskTimeEntries, docs);
        } catch {
            showToast('Kunne ikke eksportere til Excel', 'error');
        }
    };

    // ── Open resolved files (attachments / acceptance report) ────────────────

    const handleOpenAttachment = async (att: { url: string; name: string }) => {
        try {
            const url = await resolveFileUrl(att.url);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            showToast('Kunne ikke åbne filen', 'error');
        }
    };

    const handleOpenReport = async () => {
        if (!task?.acceptanceReportPath) return;
        try {
            const url = await resolveFileUrl(task.acceptanceReportPath);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            showToast('Kunne ikke åbne rapporten', 'error');
        }
    };

    // ── Derived state ─────────────────────────────────────────────────────────

    const isCheckedInHere = !!(myCheckIn && myCheckIn.taskId === taskId);
    const isCheckedInElsewhere = !!(myCheckIn && myCheckIn.taskId !== taskId);
    const showAutoWarn = isCheckedInHere && elapsedSeconds >= AUTO_WARN_SECONDS;
    const isDone = task?.handoverStatus === 'accepted';
    const isOwnerOrManager = !!(user && (
        task?.ownerId === user.id ||
        (task?.projectTeam ?? []).some(m => m.id === user.id && m.role === 'MANAGER')
    ));
    const isAssignedWorker = !!(user && (
        task?.ownerId === user.id ||
        (task?.assignees ?? []).some(a => a.id === user.id) ||
        (acceptedPartner?.partnerId === user.id) ||
        quickTaskMembers.some(m => m.userId === user.id && m.status === 'active')
    ));
    const chatTeam = useMemo<ProjectMember[]>(() => {
        const byId = new Map<string, ProjectMember>();
        const allowedIds = new Set([
            task?.ownerId,
            acceptedPartner?.partnerId,
            ...(task?.assignees ?? []).map(member => member.id),
            ...quickTaskMembers.filter(member => member.status === 'active' || member.status === 'pending').map(member => member.userId),
        ].filter((id): id is string => Boolean(id)));
        (task?.projectTeam ?? []).filter(member => allowedIds.has(member.id)).forEach(member => byId.set(member.id, member));
        (task?.assignees ?? []).forEach(member => byId.set(member.id, {
            ...member,
            role: member.isOwner ? 'OWNER' : 'EMPLOYEE',
            status: 'ACTIVE',
            joinedAt: '',
        }));
        quickTaskMembers.filter((member): member is typeof member & { userId: string } => !!member.userId)
            .forEach(member => byId.set(member.userId, {
                id: member.userId,
                name: member.name,
                initials: member.initials,
                role: member.userId === task?.ownerId ? 'OWNER' : 'EMPLOYEE',
                status: member.status === 'active' ? 'ACTIVE' : 'PENDING',
                joinedAt: '',
            }));
        if (acceptedPartner) byId.set(acceptedPartner.partnerId, {
            id: acceptedPartner.partnerId,
            name: acceptedPartner.partnerName,
            initials: acceptedPartner.partnerName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
            role: 'EXTERNAL',
            status: 'ACTIVE',
            joinedAt: '',
        });
        if (user && task?.ownerId === user.id) byId.set(user.id, {
            id: user.id, name: user.name, initials: user.initials, role: 'OWNER', status: 'ACTIVE', joinedAt: '',
        });
        return [...byId.values()];
    }, [acceptedPartner, quickTaskMembers, task, user]);
    const chatUnread = useTaskChatUnread(taskId, user?.id, activeTab === 'chat');
    const disabledTabs = task?.disabledTabs ?? [];
    const workspaceTabs = useMemo(
        () => WORKSPACE_TABS
            .filter(t => ALWAYS_ON_TAB_IDS.includes(t.id as TabId) || !disabledTabs.includes(t.id))
            .map(t => t.id === 'chat' && chatUnread > 0 ? {
                ...t,
                badge: <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{chatUnread > 99 ? '99+' : chatUnread}</span>,
            } : t),
        [disabledTabs, chatUnread]
    );

    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        const skeleton = (
            <>
                <div className="flex items-center gap-3 py-2">
                    <Skeleton className="h-10 w-10 shrink-0" />
                    <div className="grow space-y-2">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                </div>
                <Skeleton className="mb-4 h-16 w-full" />
                <Skeleton className="mb-4 h-9 w-full rounded-full" />
                <SkeletonList count={3} label="Indlæser opgave…" />
            </>
        );
        return isModal ? <div>{skeleton}</div> : <AppScreen hasBottomNav={false}>{skeleton}</AppScreen>;
    }

    if (!task) {
        const notFound = (
                <div className="pt-4">
                    <Alert
                        variant="danger"
                        title="Opgave ikke fundet"
                        action={
                            <Button size="sm" variant="outline" onClick={() => (isModal ? onClose?.() : navigate(-1))}>
                                {isModal ? 'Luk' : 'Tilbage'}
                            </Button>
                        }
                    >
                        Opgaven findes ikke, eller du har ikke adgang til den.
                    </Alert>
                </div>
        );
        return isModal ? <div>{notFound}</div> : <AppScreen hasBottomNav={false}>{notFound}</AppScreen>;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const canFaerdigmeld = !isDone && !isOwnerOrManager
        && (!task.handoverStatus || task.handoverStatus === 'none' || task.handoverStatus === 'rejected');
    const canApprove = !isDone && isOwnerOrManager && task.handoverStatus === 'submitted';
    const hasReport = !!task.acceptanceReportPath;
    const headerSubtitle = `${task.projectName ?? (task.scope === 'quick' ? 'Hurtigopgave' : 'Opgave')} · ${statusLabel(task.status)}`;

    const exportButton = reportingEnabled && (
        <button
            type="button"
            onClick={handleExportExcel}
            aria-label="Eksporter til Excel"
            title="Eksporter til Excel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-text-secondary transition-colors duration-150 hover:bg-bg-subtle hover:text-text-primary dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
        >
            <DownloadIcon className="w-5 h-5" />
        </button>
    );

    const settingsButton = isOwnerOrManager && (
        <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Indstillinger"
            title="Indstillinger"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-bg text-text-secondary transition-colors duration-150 hover:bg-bg-subtle hover:text-text-primary dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:text-text-dark-primary"
        >
            <SettingsIcon className="w-5 h-5" />
        </button>
    );

    const content = (
        <>
            {/* ── Status stepper ─────────────────────────────────────────────── */}
            <div className="mt-1">
                <StatusStepper task={task} />
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────────── */}
            <div className={cn(
                'sticky z-20 bg-bg-subtle/95 py-2 backdrop-blur-sm dark:bg-bg-dark/95',
                isModal ? 'top-0 -mx-5 px-5' : 'top-topbar -mx-4 px-4 md:-mx-6 md:px-6'
            )}>
                <Tabs
                    variant="pills"
                    tabs={workspaceTabs}
                    value={activeTab}
                    onChange={id => setActiveTab(id as TabId)}
                    aria-label="Opgave sektioner"
                />
            </div>

            {/* ── Tab content ─────────────────────────────────────────────────── */}
            <div className="mt-2 space-y-4">

                {/* ── OVERBLIK ─────────────────────────────────────────────── */}
                {activeTab === 'overblik' && (
                    <>
                        {/* Details card */}
                        <Card>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="mb-1 text-caption text-text-secondary dark:text-text-dark-secondary">Status</p>
                                    <Badge variant={STATUS_VARIANT[task.status]} dot>{statusLabel(task.status)}</Badge>
                                </div>
                                <div>
                                    <p className="mb-1 text-caption text-text-secondary dark:text-text-dark-secondary">Forfaldsdato</p>
                                    <div className={cn(
                                        'flex items-center gap-1.5 text-label font-semibold',
                                        task.status === 'Forfalden'
                                            ? 'text-danger-strong dark:text-danger'
                                            : 'text-text-primary dark:text-text-dark-primary'
                                    )}>
                                        <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                                        <span>{task.dueDate}</span>
                                    </div>
                                </div>
                            </div>

                            {task.assignees.length > 0 && (
                                <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
                                    <p className="mb-2 text-caption text-text-secondary dark:text-text-dark-secondary">Tildelt</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                        {task.assignees.map(a => (
                                            <div key={a.id} className="flex items-center gap-2">
                                                <Avatar name={a.name} size="sm" />
                                                <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{a.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {task.description && (
                                <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
                                    <p className="whitespace-pre-wrap text-body text-text-secondary dark:text-text-dark-secondary">{task.description}</p>
                                </div>
                            )}

                            {task.relatedLink && (
                                <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
                                    <div className="flex items-center gap-1.5 text-label font-semibold text-brand-primary dark:text-brand-light">
                                        <LinkIcon className="h-4 w-4" aria-hidden="true" />
                                        <span>{task.relatedLink.text}</span>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Checklist */}
                        {checklist.length > 0 && (
                            <Card>
                                <CardHeader className="mb-2">
                                    <CardTitle className="flex items-center gap-2">
                                        <CheckCircleIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                                        Tjekliste
                                    </CardTitle>
                                    <Badge variant="brand">
                                        {checklist.filter(i => i.checked).length}/{checklist.length}
                                    </Badge>
                                </CardHeader>
                                <ProgressBar
                                    value={(checklist.filter(i => i.checked).length / checklist.length) * 100}
                                    size="sm"
                                    label="Tjekliste-fremdrift"
                                    className="mb-3"
                                />
                                <div>
                                    {checklist.map(item => (
                                        <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={item.checked}
                                                onChange={() => handleCheckItem(item.id)}
                                                className="mt-0.5 h-5 w-5 cursor-pointer rounded border-border-strong accent-brand-primary dark:border-border-dark-strong"
                                            />
                                            <span className={cn(
                                                'flex-1 text-body',
                                                item.checked
                                                    ? 'text-text-tertiary line-through dark:text-text-dark-tertiary'
                                                    : 'text-text-primary dark:text-text-dark-primary'
                                            )}>
                                                {item.text}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Time & who's checked in */}
                        <Card>
                            <CardHeader className="mb-2">
                                <CardTitle className="flex items-center gap-2">
                                    <ClockIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                                    Tid & aktivitet
                                </CardTitle>
                            </CardHeader>
                            <div className="flex items-center justify-between">
                                <span className="text-label text-text-secondary dark:text-text-dark-secondary">Total tid på opgaven</span>
                                <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                    {totalTaskHours !== null ? `${totalTaskHours} t` : '—'}
                                </span>
                            </div>
                            {taskCheckIn.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                    {taskCheckIn.map(ci => (
                                        <div key={ci.id} className="flex items-center gap-2 rounded-control border border-success-border bg-success-subtle px-3 py-2 dark:border-success/30 dark:bg-success-subtle-dark">
                                            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" aria-hidden="true" />
                                            <span className="text-label font-medium text-success-strong dark:text-success">
                                                {ci.userName} er checket ind
                                                {ci.id === myCheckIn?.id && ` · ${formatElapsed(elapsedSeconds)}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        {/* Accepted partner info (only shown when an invite is accepted for this task
                             AND the `partners` module is entitled — the fetch above is skipped
                             otherwise, but the explicit check documents that dependency here too) */}
                        {partnersEnabled && acceptedPartner && (
                            <Card>
                                <CardHeader className="mb-2">
                                    <CardTitle>Partner</CardTitle>
                                </CardHeader>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-label text-text-secondary dark:text-text-dark-secondary">Underleverandør</span>
                                        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">{acceptedPartner.partnerName}</span>
                                    </div>
                                    {acceptedPartner.agreedPriceOre !== null && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-label text-text-secondary dark:text-text-dark-secondary">Aftalt pris</span>
                                            <span className="text-label font-semibold text-success-strong dark:text-success">
                                                {formatOre(acceptedPartner.agreedPriceOre, acceptedPartner.currency)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/* Handover actions */}
                        <HandoverActionCard
                            task={task}
                            isDone={isDone}
                            isOwnerOrManager={isOwnerOrManager}
                            hasReport={hasReport}
                            onOpenReport={handleOpenReport}
                            onFaerdigmeld={() => setShowFaerdigmeldModal(true)}
                            onGodkend={() => setShowGodkendModal(true)}
                            onAfvis={() => setShowAfvisModal(true)}
                        />
                    </>
                )}

                {/* ── FILER ────────────────────────────────────────────────── */}
                {activeTab === 'filer' && (
                    <>
                        {task.attachments && task.attachments.length > 0 ? (
                            <Card padding="none" className="overflow-hidden">
                                <div className="flex items-center gap-2 px-4 pb-1 pt-4">
                                    <PaperclipIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Vedhæftninger</h3>
                                    <Badge variant="brand">{task.attachments.length}</Badge>
                                </div>
                                <div className="divide-y divide-border dark:divide-border-dark">
                                    {task.attachments.map((att, i) => (
                                        <ListRow
                                            key={i}
                                            leading={att.type === 'image' ? (
                                                <ResolvedImage
                                                    src={att.url}
                                                    alt=""
                                                    className="h-11 w-11 rounded-control object-cover"
                                                />
                                            ) : (
                                                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light" aria-hidden="true">
                                                    <FileTextIcon className="h-5 w-5" />
                                                </span>
                                            )}
                                            title={att.name}
                                            subtitle={att.type === 'image' ? 'Billede' : 'Fil'}
                                            trailing={att.type === 'image' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedImage({ src: att.url, alt: att.name })}
                                                    aria-label={`Vis ${att.name}`}
                                                    className={cn(ICON_BTN, '-my-2 hover:text-brand-primary dark:hover:text-brand-light')}
                                                >
                                                    <EyeIcon className="h-5 w-5" />
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenAttachment(att)}
                                                    aria-label={`Åbn ${att.name}`}
                                                    className={cn(ICON_BTN, '-my-2 hover:text-brand-primary dark:hover:text-brand-light')}
                                                >
                                                    <DownloadIcon className="h-5 w-5" />
                                                </button>
                                            )}
                                        />
                                    ))}
                                </div>
                            </Card>
                        ) : (
                            <Card>
                                <EmptyState
                                    icon={<PaperclipIcon className="h-7 w-7" />}
                                    title="Ingen vedhæftninger"
                                    description="Der er ikke vedhæftet filer til denne opgave."
                                />
                            </Card>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab('dokumentation')}
                            className="flex w-full flex-col items-center gap-1 rounded-card border-2 border-dashed border-border-strong bg-bg p-4 text-text-secondary transition-colors duration-150 hover:border-brand-primary hover:text-brand-primary dark:border-border-dark-strong dark:bg-bg-dark-surface dark:text-text-dark-secondary dark:hover:border-brand-light dark:hover:text-brand-light"
                        >
                            <UploadCloudIcon className="h-6 w-6" aria-hidden="true" />
                            <span className="text-label font-semibold">Upload fotos & filer</span>
                            <span className="text-caption">Dokumentation uploades under fanen Dokumentation</span>
                        </button>
                    </>
                )}

                {/* ── CHAT ─────────────────────────────────────────────────── */}
                {activeTab === 'chat' && (
                    <TaskChatTab
                        taskId={task.id}
                        projectId={task.projectId ?? null}
                        projectTeam={chatTeam}
                        currentUserId={user?.id ?? ''}
                        currentUserName={user?.name ?? ''}
                        composerPortalTarget={composerSlot}
                    />
                )}

                {/* ── DOKUMENTATION ────────────────────────────────────────── */}
                {activeTab === 'dokumentation' && (
                    <TaskDocumentationTab
                        taskId={taskId!}
                        projectId={task.projectId ?? null}
                        currentUserId={user?.id ?? ''}
                        currentUserName={user?.name ?? ''}
                        isOwnerOrManager={isOwnerOrManager}
                        isAssignedWorker={isAssignedWorker}
                    />
                )}

                {/* ── TEAM ─────────────────────────────────────────────────── */}
                {activeTab === 'team' && (
                    <TeamTab task={task} canManage={isOwnerOrManager} onAccessChanged={loadQuickTaskMembers} />
                )}

            </div>

            {/* ── Bottom zone: chat composer + action bar (fixed to the viewport in
                 page mode; sticky to the modal's own scroll area in modal mode) ── */}
            <div className={isModal ? 'sticky bottom-0 z-10' : 'fixed inset-x-0 bottom-0 z-30 md:pl-[88px]'}>
                {/* ── Chat composer slot (chat tab only) — TaskChatTab portals its
                     input row in here, directly above the action bar ────────── */}
                {activeTab === 'chat' && <div ref={setComposerSlot} />}

                {/* ── Check-in / handover action bar (always visible) ───────── */}
                <div className="border-t border-border bg-bg px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 dark:border-border-dark dark:bg-bg-dark-surface">
                    <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
                        {isCheckedInHere ? (
                            <>
                                <div className="min-w-0 grow">
                                    <p className="font-mono text-body tabular-nums text-text-primary dark:text-text-dark-primary">
                                        {formatElapsed(elapsedSeconds)}
                                    </p>
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Du er checket ind</p>
                                    {showAutoWarn && (
                                        <p className="text-caption font-semibold text-warning-strong dark:text-warning">
                                            Lang session — husk at checke ud
                                        </p>
                                    )}
                                </div>
                                <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setShowCheckOutModal(true)}
                                    loading={checkingOut}
                                    className="shrink-0"
                                >
                                    Check ud
                                </Button>
                            </>
                        ) : isCheckedInElsewhere ? (
                            <>
                                <p className="min-w-0 grow text-label text-text-secondary dark:text-text-dark-secondary">
                                    Du er allerede checket ind på en anden opgave.
                                </p>
                                <Button size="sm" disabled title="Check ud fra den anden opgave først" className="shrink-0">
                                    Check ind
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="flex min-w-0 grow items-center gap-2">
                                    {taskCheckIn.length > 0 ? (
                                        <>
                                            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" aria-hidden="true" />
                                            <p className="truncate text-label text-text-secondary dark:text-text-dark-secondary">
                                                {taskCheckIn.map(ci => ci.userName).join(', ')} er checket ind
                                            </p>
                                        </>
                                    ) : (
                                        <p className="truncate text-label text-text-secondary dark:text-text-dark-secondary">
                                            Ingen er checket ind på denne opgave
                                        </p>
                                    )}
                                </div>
                                {canFaerdigmeld && (
                                    <Button variant="outline" size="sm" onClick={() => setShowFaerdigmeldModal(true)} className="shrink-0">
                                        Færdigmeld
                                    </Button>
                                )}
                                {canApprove && (
                                    <Button variant="outline" size="sm" onClick={() => setShowGodkendModal(true)} className="shrink-0">
                                        Godkend
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={handleCheckIn}
                                    loading={checkingIn}
                                    iconLeft={<PlayIcon className="h-4 w-4" />}
                                    className="shrink-0"
                                >
                                    Check ind
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            {showCheckOutModal && myCheckIn && (
                <CheckOutModal
                    elapsedSeconds={elapsedSeconds}
                    onClose={() => setShowCheckOutModal(false)}
                    onConfirm={handleCheckOut}
                />
            )}

            {selectedImage && (
                <ImageViewModal
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    onClose={() => setSelectedImage(null)}
                />
            )}

            {/* ── Færdigmeld modal ──────────────────────────────────────── */}
            {showFaerdigmeldModal && (
                <FaerdigmeldModal
                    taskId={taskId!}
                    projectId={task.projectId ?? ''}
                    onClose={() => setShowFaerdigmeldModal(false)}
                    onSuccess={() => {
                        setShowFaerdigmeldModal(false);
                        fetchTask();
                        showToast('Opgave færdigmeldt — Mesteren notificeres', 'success');
                    }}
                />
            )}

            {/* ── Godkend modal ─────────────────────────────────────────── */}
            {showGodkendModal && task.projectId && (
                <GodkendModal
                    taskId={taskId!}
                    projectId={task.projectId}
                    task={task}
                    mesterName={user?.name ?? ''}
                    acceptedPartner={acceptedPartner}
                    onClose={() => setShowGodkendModal(false)}
                    onSuccess={() => {
                        setShowGodkendModal(false);
                        fetchTask();
                        showToast('Opgave godkendt — afleveringsrapport er klar', 'success');
                    }}
                />
            )}

            {/* ── Afvis modal ───────────────────────────────────────────── */}
            {showAfvisModal && task.projectId && (
                <AfvisModal
                    taskId={taskId!}
                    projectId={task.projectId}
                    onClose={() => setShowAfvisModal(false)}
                    onSuccess={() => {
                        setShowAfvisModal(false);
                        fetchTask();
                        showToast('Opgave afvist — medarbejderen notificeres', 'info');
                    }}
                />
            )}
        </>
    );

    if (isModal) {
        return (
            <div>
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold text-text-primary dark:text-text-dark-primary">{task.title}</h2>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{headerSubtitle}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {isDone && <Badge variant="success" dot>Godkendt</Badge>}
                        {exportButton}
                        {settingsButton}
                    </div>
                </div>
                {content}
                {showSettings && (
                    <TaskSettingsModal task={task} onClose={() => setShowSettings(false)} onSaved={fetchTask} />
                )}
            </div>
        );
    }

    return (
        <AppScreen
            hasBottomNav={false}
            header={{
                back: true,
                title: task.title,
                subtitle: headerSubtitle,
                actions: (
                    <>
                        {isDone && <Badge variant="success" dot>Godkendt</Badge>}
                        {exportButton}
                        {settingsButton}
                    </>
                ),
            }}
        >
            {content}
            {showSettings && (
                <TaskSettingsModal task={task} onClose={() => setShowSettings(false)} onSaved={fetchTask} />
            )}
        </AppScreen>
    );
};
