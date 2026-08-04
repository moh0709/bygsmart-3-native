
import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';

import { getActivityLog, markNotificationAsRead } from '../../../services/api';
import { getProjectById } from '../services/projects';
import { getProjectResources } from '../services/projectResources';
// projects is the base module — tasks/purchasing/documents depend on it
// statically, so every reverse edge here is dynamic (no module cycles).
const ProjectTasksTab = lazy(() => import('../../tasks').then(m => m.loadProjectTasksTab()));
import { supabase } from '../../../services/supabaseClient';
import { sendTimerPushAlert } from '../../../services/pushNotifications';

import { generateHandoverReport, HandoverReportContent } from '../../ai';

import type {
  Project,
  Task,
  DocumentItem,
  TimeEntry,
  UserRole,
  PurchaseItem,
  ProjectResource,
  ResourceVisibility,
} from '../../../types';

import {
  DownloadIcon,
  PlayIcon,
  UsersIcon,
  ClipboardListIcon,
  FileTextIcon,
  InfoIcon,
} from '../../../components/icons';
import { exportProjectToExcel, PartnerExportStats, logAiHandoverReport } from '../../reporting';
import {
  AUTO_CHECKOUT_NOTE,
  getTimeEntriesForProject,
  getTimerSafetyAction,
  logTimeEntry,
} from '../../time';
import { listPartnerInvitesForProject, getPartnerTasksOverview } from '../../partners';
import { listProjectDocumentation } from '../../field';
// Tab content is lazy (Phase 5): each tab is its own chunk, fetched when the
// user first opens it — the project hub no longer ships Budget/Quotations/
// Purchasing/PDF code up front.
const FollowUpTabContent = lazy(() => import('../../planning').then(m => ({ default: m.FollowUpTabContent })));
const PunchListTabContent = lazy(() => import('../../quality').then(m => ({ default: m.PunchListTabContent })));
const TimeManagementTabContent = lazy(() => import('../../time').then(m => ({ default: m.TimeManagementTabContent })));
import type { TimerState } from '../../time';
import { BackButton } from '../../../components/BackButton';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { useSlot } from '../../../core/registry/hooks';
import type { ProjectTabContext } from '../../../core/registry/types';
import { FloatingTimer } from '../../time';
import { useModuleGate, ModuleUpsellCard } from '../../../core/entitlements/ModuleGate';

// Import Tab Components
const ProjectOverviewTab = lazy(() => import('../components/ProjectOverviewTab').then(m => ({ default: m.ProjectOverviewTab })));
const ProjectRemindersTab = lazy(() => import('../../planning').then(m => ({ default: m.ProjectRemindersTab })));
const PurchasingTabContent = lazy(() => import('../../purchasing').then(m => ({ default: m.PurchasingTabContent })));
const DocumentsTabContent = lazy(() => import('../../documents').then(m => ({ default: m.DocumentsTabContent })));
const ProjectDetailsTabContent = lazy(() => import('../components/ProjectDetailsTabContent').then(m => ({ default: m.ProjectDetailsTabContent })));
const QuotationsTabContent = lazy(() => import('../../quotations').then(m => ({ default: m.QuotationsTabContent })));
const BudgetTabContent = lazy(() => import('../../budget').then(m => ({ default: m.BudgetTabContent })));
import { HandoverReportTemplate } from '../../reporting';
import { GenericModal } from '../../../components/ui/GenericModal';
import { PartnerInvitesPanel } from '../../partners';
import { InvitePartnerModal } from '../../partners';
import { IntelligenceIndexCard } from '../../ai';
import {
  Alert,
  Badge,
  BottomSheet,
  Button,
  ListRow,
  SegmentedControl,
  Skeleton,
  SkeletonList,
} from '../../../components/ui';

/* -------------------------------- Tabs ---------------------------------- */

type TabKey = 'overblik' | 'opgaver' | 'tid-plan' | 'budget' | 'indkob' | 'partnere' | 'opfølgning' | 'punch-list' | 'pamindelser' | 'dokumenter' | 'tilbud' | 'detaljer';

/* ---------------- 5-destination IA (docs/UI_OVERHAUL_PLAN.md §B2) ----------------
 * The 11 TabKeys keep working (deep links, notifications, content switch);
 * they are grouped into 5 fixed destinations. "Mere" opens a bottom sheet.
 * `allowedTabs` remains the single source of truth for access — destinations
 * are derived from it and collapse naturally for restricted roles.
 */

type DestinationId = 'overblik' | 'opgaver' | 'plan' | 'okonomi' | 'mere';

const DESTINATION_DEFS: Array<{ id: DestinationId; label: string; keys: TabKey[] }> = [
    { id: 'overblik', label: 'Overblik', keys: ['overblik'] },
    { id: 'opgaver', label: 'Opgaver', keys: ['opgaver', 'punch-list'] },
    { id: 'plan', label: 'Plan', keys: ['tid-plan', 'pamindelser'] },
    { id: 'okonomi', label: 'Økonomi', keys: ['budget', 'indkob', 'tilbud'] },
    { id: 'mere', label: 'Mere', keys: ['partnere', 'opfølgning', 'dokumenter', 'detaljer'] },
];

/** Sub-view labels inside a destination (and rows in the "Mere" sheet). */
const SUB_LABELS: Record<TabKey, string> = {
    overblik: 'Overblik',
    opgaver: 'Opgaver',
    'punch-list': 'Punch',
    'tid-plan': 'Tid & Plan',
    pamindelser: 'Påmindelser',
    budget: 'Budget',
    indkob: 'Indkøb',
    tilbud: 'Tilbud & Rapport',
    partnere: 'Partnere',
    'opfølgning': 'Opfølgning',
    dokumenter: 'Dokumenter',
    detaljer: 'Detaljer',
};

/** Icon + hint for rows in the "Mere" bottom sheet. */
const MERE_META: Partial<Record<TabKey, { hint: string; icon: React.ReactNode }>> = {
    partnere: { hint: 'Invitationer & samarbejde', icon: <UsersIcon className="w-4 h-4" /> },
    'opfølgning': { hint: 'Kvalitetssikring & tilsyn', icon: <ClipboardListIcon className="w-4 h-4" /> },
    dokumenter: { hint: 'Filer, fotos & kontrakter', icon: <FileTextIcon className="w-4 h-4" /> },
    detaljer: { hint: 'Projektinfo & rapport', icon: <InfoIcon className="w-4 h-4" /> },
};

const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Ejer',
    MANAGER: 'Projektleder',
    EMPLOYEE: 'Medarbejder',
    EXTERNAL: 'Underentreprenør',
    CLIENT: 'Kunde',
};

const ProjectDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [projectTasks, setProjectTasks] = useState<Task[]>([]);
    const [projectPurchases, setProjectPurchases] = useState<PurchaseItem[]>([]);
    const [currentResource, setCurrentResource] = useState<ProjectResource | null>(null);
    const [showInvitePartner, setShowInvitePartner] = useState(false);
    const [mereOpen, setMereOpen] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const timeEnabled = useModuleGate('time');
    const fieldEnabled = useModuleGate('field');
    const reportingEnabled = useModuleGate('reporting');
    const aiEnabled = useModuleGate('ai');

    const [isExportingExcel, setIsExportingExcel] = useState(false);

    // Handover Report State
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportContent, setReportContent] = useState<HandoverReportContent | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);
    
    const activeTabKey = (searchParams.get('tab') as TabKey) || 'overblik';

    // Per-tab unread notification map: { [tabKey]: count }
    const [tabNotifMap, setTabNotifMap] = useState<Record<string, number>>({});
    // Map notif id → tabKey, so we can mark as read when the tab is opened
    const tabNotifIds = useRef<Record<string, string[]>>({});

    // Per-task unread notification map: { [taskId]: count }
    const [taskNotifMap, setTaskNotifMap] = useState<Record<string, number>>({});
    const taskNotifIds = useRef<Record<string, string[]>>({});

    // Track the loaded project's owner id so the realtime eviction guard never
    // redirects a true owner, and flag when a fetch concludes with no accessible
    // project for the current non-owner so the fallback can redirect them to the
    // projects list instead of showing a static "not found" message.
    const ownerIdRef = useRef<string | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    const fetchTabNotifications = useCallback(async () => {
        if (!id) return;
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        const { data } = await supabase
            .from('notifications')
            .select('id, link, metadata')
            .eq('user_id', authUser.id)
            .eq('is_read', false)
            .ilike('link', `%project-detail/${id}%`);
        if (!data) return;
        const counts: Record<string, number> = {};
        const ids: Record<string, string[]> = {};
        const taskCounts: Record<string, number> = {};
        const taskIdsMap: Record<string, string[]> = {};
        const PROJECT_RE = /project-detail\/([a-f0-9-]+)/;
        const TASK_RE = /\/task\/([a-f0-9-]+)/;
        for (const row of data as any[]) {
            const link: string = row.link ?? '';
            const projectMatch = link.match(PROJECT_RE);
            if (!projectMatch || projectMatch[1] !== id) continue;
            const qIdx = link.indexOf('?');
            const tab = qIdx >= 0 ? new URLSearchParams(link.substring(qIdx + 1)).get('tab') : null;
            if (tab) {
                counts[tab] = (counts[tab] ?? 0) + 1;
                ids[tab] = [...(ids[tab] ?? []), row.id];
            }
            const taskMatch = link.match(TASK_RE);
            const taskId = taskMatch?.[1] ?? (row.metadata as any)?.task_id;
            if (taskId) {
                taskCounts[taskId] = (taskCounts[taskId] ?? 0) + 1;
                taskIdsMap[taskId] = [...(taskIdsMap[taskId] ?? []), row.id];
            }
        }
        setTabNotifMap(counts);
        tabNotifIds.current = ids;
        setTaskNotifMap(taskCounts);
        taskNotifIds.current = taskIdsMap;
    }, [id]);

    useEffect(() => {
        fetchTabNotifications();
        const channel = supabase
            .channel(`project-detail-notifs:${id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, fetchTabNotifications)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, fetchTabNotifications]);

    // Evict the current user from this project view in realtime if their
    // membership is removed/cancelled (e.g. the owner terminates the member).
    useEffect(() => {
        if (!id || !user) return;
        const channel = supabase
            .channel(`project-resources-evict:${id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'project_resources',
                filter: `project_id=eq.${id}`,
            }, (payload: any) => {
                // The project owner is never evicted from their own project.
                if (ownerIdRef.current && ownerIdRef.current === user.id) return;
                const row = (payload.new ?? payload.old) as any;
                if (!row || row.user_id !== user.id) return;
                const isRemoval =
                    payload.eventType === 'DELETE' ||
                    (payload.eventType === 'UPDATE' &&
                        (payload.new?.status === 'cancelled' || payload.new?.status === 'declined'));
                if (!isRemoval) return;
                showToast('Du er ikke længere medlem af dette projekt.', 'info');
                navigate('/projects', { replace: true });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [id, user, navigate, showToast]);

    // Redirect a non-owner when the project is inaccessible — both on the initial
    // load (getProjectById returns nothing) and after a refetch returns null
    // because the membership row is gone — instead of showing the static
    // "not found" screen. The owner guard keeps a true owner from being redirected.
    useEffect(() => {
        if (loading || project || !accessDenied || !user) return;
        if (ownerIdRef.current === user.id) return;
        showToast('Du er ikke længere medlem af dette projekt.', 'info');
        navigate('/projects', { replace: true });
    }, [loading, project, accessDenied, user, navigate, showToast]);

    // Clear tab dot when the tab is opened
    useEffect(() => {
        if (!tabNotifMap[activeTabKey]) return;
        const ids = tabNotifIds.current[activeTabKey] ?? [];
        // Optimistic clear
        setTabNotifMap(prev => { const next = { ...prev }; delete next[activeTabKey]; return next; });
        delete tabNotifIds.current[activeTabKey];
        ids.forEach(nId => markNotificationAsRead(nId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTabKey]);

    const handleMarkTaskNotifsRead = useCallback((taskId: string) => {
        const ids = taskNotifIds.current[taskId] ?? [];
        if (!ids.length) return;
        setTaskNotifMap(prev => { const next = { ...prev }; delete next[taskId]; return next; });
        delete taskNotifIds.current[taskId];
        ids.forEach(nId => markNotificationAsRead(nId));
    }, []);

    // Timer State - Initialized from localStorage
    const autoCheckoutInProgress = useRef(false);
    const [timerState, setTimerState] = useState<TimerState>(() => {
        const saved = localStorage.getItem('bygSmart-timer');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                let seconds = parsed.seconds ?? 0;
                if (parsed.isRunning === true && parsed.isPaused !== true && parsed.startedAt) {
                    seconds += Math.floor((Date.now() - parsed.startedAt) / 1000);
                }
                return {
                    isRunning: parsed.isRunning,
                    isPaused: parsed.isPaused,
                    seconds,
                    taskId: parsed.taskId,
                    startedAt: parsed.startedAt,
                    eightHourReminderSent: parsed.eightHourReminderSent === true,
                    start: () => {},
                    stop: () => {},
                    pause: () => {},
                    log: () => {}
                };
            } catch { }
        }
        return {
            isRunning: false,
            isPaused: false,
            seconds: 0,
            taskId: '',
            eightHourReminderSent: false,
            start: () => {},
            stop: () => {},
            pause: () => {},
            log: () => {}
        };
    });
    
    // Update methods to use setTimerState properly
    const timerMethods = useMemo(() => ({
        start: (tId?: string) => setTimerState(p => ({
            ...p,
            isRunning: true,
            isPaused: false,
            taskId: tId || p.taskId,
            startedAt: Date.now(),
            eightHourReminderSent: p.isRunning ? p.eightHourReminderSent : false,
        })),
        stop: () => setTimerState(p => ({
            ...p,
            isRunning: false,
            isPaused: false,
            seconds: 0,
            taskId: '',
            startedAt: undefined,
            eightHourReminderSent: false,
        })),
        pause: () => setTimerState(p => ({ ...p, isPaused: true, startedAt: undefined })),
        log: () => {}
    }), []);

    // Merge state and methods
    const activeTimerState = { ...timerState, ...timerMethods };

    // Persist timer state
    useEffect(() => {
        const elapsedSinceStartedAt = timerState.startedAt
            ? Math.floor((Date.now() - timerState.startedAt) / 1000)
            : 0;
        // When the timer is actively running, persist the base (pre-run) seconds
        // rather than the live running total, so that on reload we can reconstruct
        // the correct total as base + elapsedSinceStartedAt without double-counting.
        const secondsToSave = timerState.isRunning && !timerState.isPaused && timerState.startedAt
            ? timerState.seconds - elapsedSinceStartedAt
            : timerState.seconds;
        const stateToSave = {
            isRunning: timerState.isRunning,
            isPaused: timerState.isPaused,
            seconds: secondsToSave,
            taskId: timerState.taskId,
            startedAt: timerState.startedAt,
            eightHourReminderSent: timerState.eightHourReminderSent === true,
        };
        localStorage.setItem('bygSmart-timer', JSON.stringify(stateToSave));
    }, [timerState.isRunning, timerState.isPaused, timerState.seconds, timerState.taskId, timerState.startedAt, timerState.eightHourReminderSent]);

    // Basic timer effect to increment seconds
    useEffect(() => {
        let interval: number;
        if (timerState.isRunning && !timerState.isPaused) {
            interval = window.setInterval(() => {
                setTimerState(p => ({ ...p, seconds: p.seconds + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerState.isRunning, timerState.isPaused]);

    useEffect(() => {
        const fetchProject = async () => {
            if (!id || !user) return;
            setLoading(true);
            // Pass currentUserId to enforce data isolation in API.
            // None of these four calls depends on another's result, so fire them
            // concurrently. Purchases feed the intelligence index (non-fatal if
            // unavailable) — keep its own fallback so a purchases failure can't
            // reject the others.
            const [data, resources, tasks, purchaseInfo] = await Promise.all([
                getProjectById(id, user.id),
                getProjectResources(id),
                import('../../tasks').then(m => m.getTasksForProject(id, user.id)),
                import('../../purchasing').then(m => m.getPurchaseInfoForProject(id, user.id)).catch(() => ({ total: 0, items: [] as PurchaseItem[] })),
            ]);

            setProject(data || null);
            if (data) {
                ownerIdRef.current = data.ownerId;
                setAccessDenied(false);
            } else {
                // No accessible project came back for this user. They are not the
                // owner of an accessible project (an owner's fetch returns data),
                // so flag access as denied to trigger the fallback redirect.
                setAccessDenied(true);
            }

            // Resolve the current user's project_resource for visibility gating
            const myResource = resources.find(r => r.userId === user.id) ?? null;
            setCurrentResource(myResource);

            // Pre-fetch tasks for the timer dropdown
            // Note: getTasksForProject also filters based on user role inside API
            setProjectTasks(tasks);

            setProjectPurchases(purchaseInfo.items);

            setLoading(false);
        };
        fetchProject();
    }, [id, user]);

    const fetchDocuments = useCallback(async () => {
        if (id) {
            const { getDocumentsForProject } = await import('../../documents');
            const docs = await getDocumentsForProject(id);
            setDocuments(docs);
        }
    }, [id]);

    useEffect(() => {
        if (activeTabKey === 'dokumenter') fetchDocuments();
    }, [activeTabKey, fetchDocuments]);

    const handleTabChange = (key: TabKey) => {
        setSearchParams({ tab: key });
    };
    
    const handleSaveLog = useCallback(async (data: { hours: number, taskId: string, description: string }) => {
        if (data.hours > 0 && user && id) {
            const newEntry: Omit<TimeEntry, 'id'> = {
                projectId: id,
                taskId: (data.taskId && data.taskId !== 'administration') ? data.taskId : undefined,
                userId: user.id,
                userName: user.name,
                hours: data.hours,
                date: new Date().toISOString(),
                description: data.description
            };
            await logTimeEntry(newEntry);
        }
    }, [id, user]);

    useEffect(() => {
        if (!timerState.isRunning) {
            autoCheckoutInProgress.current = false;
            return;
        }
        if (!project || !user || !id) return;

        const action = getTimerSafetyAction(timerState);
        if (!action) return;

        const taskName = timerState.taskId === 'administration'
            ? 'Administration'
            : projectTasks.find(task => task.id === timerState.taskId)?.title || 'Generel tid';
        const alertPayload = {
            projectId: id,
            projectName: project.name,
            taskName,
        };

        if (action === 'eight-hour-reminder') {
            setTimerState(previous => ({ ...previous, eightHourReminderSent: true }));
            void sendTimerPushAlert({
                kind: 'eight-hour-reminder',
                ...alertPayload,
            }).catch(error => {
                console.warn('[Timer] Eight-hour push notification failed:', error);
            });
            return;
        }

        if (autoCheckoutInProgress.current) return;
        autoCheckoutInProgress.current = true;
        const elapsedHours = parseFloat((timerState.seconds / 3600).toFixed(2));

        void (async () => {
            try {
                await handleSaveLog({
                    hours: elapsedHours,
                    taskId: timerState.taskId,
                    description: AUTO_CHECKOUT_NOTE,
                });
                timerMethods.stop();
                try {
                    await sendTimerPushAlert({
                        kind: 'auto-checkout',
                        ...alertPayload,
                    });
                } catch (error) {
                    console.warn('[Timer] Auto-checkout push notification failed:', error);
                }
            } catch (error) {
                autoCheckoutInProgress.current = false;
                console.error('[Timer] Automatic checkout failed:', error);
                showToast('Automatisk checkout kunne ikke gemmes. Timeren fortsætter.', 'error');
            }
        })();
    }, [
        handleSaveLog,
        id,
        project,
        projectTasks,
        showToast,
        timerMethods,
        timerState.eightHourReminderSent,
        timerState.isPaused,
        timerState.isRunning,
        timerState.seconds,
        timerState.taskId,
        user,
    ]);
    
    // Role & Permission Logic
    const getUserRole = (): UserRole => {
        if (!project || !user) return 'EMPLOYEE'; // Default safest
        if (project.ownerId === user.id) return 'OWNER';
        const member = project.team.find(m => m.id === user.id);
        return member?.role || 'EMPLOYEE';
    };

    const userRole = getUserRole();
    const isExternal = userRole === 'EXTERNAL';

    // Derive effective visibility from resource record, falling back to role
    const effectiveVisibility = useMemo((): ResourceVisibility | null => {
        if (!project || !user) return null;
        if (project.ownerId === user.id) return 'all';
        if (userRole === 'MANAGER') return 'all';
        if (currentResource) return currentResource.visibility;
        if (userRole === 'EXTERNAL') return 'none';
        if (userRole === 'EMPLOYEE') return 'standard';
        return null;
    }, [project, user, userRole, currentResource]);

    // Project tabs from the module registry (Phase 5 slot takeover): module
    // manifests declare each tab's destination, order and role/visibility
    // branch membership — core/shell/projectTabAccess.ts preserves the old
    // allowedTabs precedence verbatim — and the registry has already dropped
    // modules the active org hasn't enabled. Labels stay in SUB_LABELS here.
    const tabContributions = useSlot('projectTabs');
    const allowedTabs = useMemo(() => {
        const ctx: ProjectTabContext = {
            userRole,
            visibility: effectiveVisibility,
            isPartnerResource: currentResource?.kind === 'partner',
        };
        return tabContributions
            .filter(c => c.isAllowed(ctx))
            .map(c => ({ key: c.key as TabKey, label: c.label }));
    }, [tabContributions, userRole, effectiveVisibility, currentResource]);

    // Derive the 5 fixed destinations from allowedTabs (source of truth for access).
    // A destination only appears when the user may access ≥1 of its keys, so
    // restricted roles collapse naturally (e.g. CLIENT → Overblik + Mere/Dokumenter).
    const destinations = useMemo(() => {
        const allowedKeySet = new Set(allowedTabs.map(t => t.key));
        return DESTINATION_DEFS
            .map(d => ({ ...d, keys: d.keys.filter(k => allowedKeySet.has(k)) }))
            .filter(d => d.keys.length > 0);
    }, [allowedTabs]);

    // Active destination = the one containing the current ?tab= key, so old
    // deep links (e.g. ?tab=punch-list) still select the right destination.
    const activeDestination = destinations.find(d => d.keys.includes(activeTabKey)) ?? destinations[0];
    const mereDestination = destinations.find(d => d.id === 'mere');

    const handleDestinationSelect = (destId: DestinationId) => {
        if (destId === 'mere') {
            // "Mere" never changes the tab itself — it opens the bottom sheet.
            setMereOpen(true);
            return;
        }
        const dest = destinations.find(d => d.id === destId);
        if (!dest || dest.keys.includes(activeTabKey)) return;
        handleTabChange(dest.keys[0]);
    };

    // Redirect if user is on a forbidden tab (incl. initial load with no tab param)
    useEffect(() => {
        if (!loading && project && allowedTabs.length > 0 && !allowedTabs.some(t => t.key === activeTabKey)) {
            handleTabChange(allowedTabs[0].key);
        }
    }, [activeTabKey, allowedTabs, loading, project]);

    const handleExportProjectExcel = async () => {
        if (!project || !id || !reportingEnabled) return;
        setIsExportingExcel(true);
        try {
            const [timeEntries, documentation, partners] = await Promise.all([
                timeEnabled ? getTimeEntriesForProject(id) : Promise.resolve([]),
                fieldEnabled ? listProjectDocumentation(id) : Promise.resolve([]),
                listPartnerInvitesForProject(id),
            ]);

            const partnerStats: PartnerExportStats[] = await Promise.all(
                partners
                    .filter(p => p.status === 'accepted' && p.taskIds?.length)
                    .map(async (p) => {
                        const overviews = await getPartnerTasksOverview(id, p.taskIds!);
                        return {
                            inviteId: p.id,
                            totalTimeLoggedHours: overviews.reduce((s, o) => s + o.timeLoggedHours, 0),
                            doneTaskCount: overviews.filter(o => o.status === 'Udført').length,
                        };
                    })
            );

            exportProjectToExcel(project, projectTasks, timeEntries, documentation, partners, partnerStats);
        } catch {
            showToast('Kunne ikke eksportere til Excel', 'error');
        } finally {
            setIsExportingExcel(false);
        }
    };

    if (loading) return (
        <div className="bg-bg-subtle dark:bg-bg-dark min-h-screen px-4 pt-4 space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="grow space-y-2">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <SkeletonList count={3} label="Indlæser projekt…" />
        </div>
    );
    if (!project || !id) return (
        <div className="bg-bg-subtle dark:bg-bg-dark min-h-screen p-4">
            <Alert
                variant="danger"
                title="Projekt ikke fundet"
                action={
                    <Button size="sm" variant="outline" onClick={() => navigate('/projects')}>
                        Til projekter
                    </Button>
                }
            >
                Projektet findes ikke, eller du har ikke adgang.
            </Alert>
        </div>
    );

    const renderTabContent = () => {
        // Double check permission before rendering
        if (!allowedTabs.some(t => t.key === activeTabKey)) return null;

        switch (activeTabKey) {
            case 'overblik': return (
                <ProjectOverviewTab
                    project={project}
                    projectId={id}
                    onGenerateReport={() => handleGenerateReport()}
                    onNavigate={(tab) => handleTabChange(tab as TabKey)}
                    user={user}
                    healthSlot={!isExternal && userRole !== 'CLIENT' ? (
                        aiEnabled
                            ? <IntelligenceIndexCard project={project} tasks={projectTasks} purchases={projectPurchases} />
                            : <ModuleUpsellCard moduleId="ai" />
                    ) : undefined}
                />
            );
            case 'opgaver': return <ProjectTasksTab projectId={id} project={project} user={user} resourceVisibility={effectiveVisibility ?? undefined} notifMap={taskNotifMap} onTaskNotifRead={handleMarkTaskNotifsRead} />;
            case 'tid-plan': return <TimeManagementTabContent project={project} projectId={id} timerState={activeTimerState} resourceVisibility={effectiveVisibility ?? undefined} />;
            case 'budget': return <BudgetTabContent projectId={id} project={project} userRole={userRole} />;
            case 'indkob': return <PurchasingTabContent projectId={id} project={project} tasks={projectTasks} />;
            case 'partnere': return (
                <div className="space-y-4">
                    {reportingEnabled && (
                        <div className="flex justify-end px-4 pt-4">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleExportProjectExcel}
                                loading={isExportingExcel}
                                iconLeft={<DownloadIcon className="w-4 h-4" />}
                            >
                                {isExportingExcel ? 'Eksporterer...' : 'Eksporter projekt (Excel)'}
                            </Button>
                        </div>
                    )}
                    <PartnerInvitesPanel
                        mode="manager"
                        projectId={id}
                        onInvitePartner={() => setShowInvitePartner(true)}
                    />
                </div>
            );
            case 'opfølgning': return <FollowUpTabContent projectId={id} userId={user?.id} resourceVisibility={effectiveVisibility ?? undefined} />;
            case 'punch-list': return <PunchListTabContent projectId={id} />;
            case 'pamindelser': return <ProjectRemindersTab projectId={id} userId={user?.id} resourceVisibility={effectiveVisibility ?? undefined} />;
            case 'dokumenter': return <DocumentsTabContent projectId={id} documents={documents} onUpload={fetchDocuments} onFilterChange={() => {}} isManager={userRole === 'OWNER' || userRole === 'MANAGER'} />;
            case 'tilbud': return <QuotationsTabContent project={project} projectId={id} userRole={userRole} />;
            case 'detaljer': return <ProjectDetailsTabContent project={project} projectId={id} tasks={projectTasks} onGenerateReport={() => handleGenerateReport()} isGeneratingReport={isGeneratingReport} user={user} />;
            default: return null;
        }
    };
    
    const handleGenerateReport = async () => {
        if (!aiEnabled || !reportingEnabled) {
            showToast('Afleveringsrapport kræver modulerne AI-assistent og Rapporter & Eksport.', 'warning');
            return;
        }
        setIsGeneratingReport(true);
        try {
            const logs = await getActivityLog(id!);
            const content = await generateHandoverReport(project!, projectTasks, logs, project!.team);
            setReportContent(content);
            setShowReportModal(true);
        } catch (error) {
            console.error("Failed to generate report", error);
            showToast("Kunne ikke generere rapport. Prøv igen.", 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };
    
    const handleDownloadPdf = async () => {
        const element = document.getElementById('handover-report-container');
        if (!element) return;
        
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas-pro'),
                import('jspdf'),
            ]);

            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.width / imgProps.height;
            const heightInPdf = pdfWidth / ratio;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, heightInPdf);
            
            let remainingHeight = heightInPdf - pdfHeight;
            while (remainingHeight > 0) {
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -(heightInPdf - remainingHeight), pdfWidth, heightInPdf);
                remainingHeight -= pdfHeight;
            }
            
            pdf.save(`Overdragelsesrapport_${project!.projectNumber}.pdf`);
            void logAiHandoverReport(id!);
            setShowReportModal(false);
        } catch (error) {
            console.error("PDF generation failed", error);
            showToast("Kunne ikke generere PDF.", 'error');
        }
    }

    return (
        <div className="bg-bg-subtle dark:bg-bg-dark min-h-screen flex flex-col pb-24">
             <div className="sticky top-topbar z-20 bg-bg dark:bg-bg-dark-surface border-b border-border dark:border-border-dark px-4 pt-2 pb-2.5 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <BackButton to="/projects" />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-heading text-text-primary dark:text-text-dark-primary truncate">{project.name}</h1>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary flex items-center gap-1.5 min-w-0">
                            <span className="truncate">#{project.projectNumber} · Du er: {ROLE_LABELS[userRole] ?? userRole}</span>
                            {isExternal && <Badge variant="warning" className="shrink-0">Ekstern</Badge>}
                        </p>
                    </div>
                    {/* The old top-right "Start tid" button was removed — the draggable
                        FloatingTimer now defaults to the bottom-right and is the
                        single start-time control. */}
                </div>
                {activeDestination && (
                    <>
                        <SegmentedControl<DestinationId>
                            label="Projektområde"
                            size="sm"
                            fullWidth
                            value={activeDestination.id}
                            onChange={handleDestinationSelect}
                            options={destinations.map(d => ({
                                value: d.id,
                                label: (
                                    <span className="inline-flex items-center gap-1">
                                        {d.label}
                                        {d.keys.some(k => tabNotifMap[k] > 0) && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" aria-hidden="true" />
                                        )}
                                    </span>
                                ),
                            }))}
                        />
                        {activeDestination.id !== 'mere' && activeDestination.keys.length > 1 && (
                            <SegmentedControl<TabKey>
                                label="Visning"
                                size="sm"
                                fullWidth
                                className="mt-2"
                                value={activeTabKey}
                                onChange={handleTabChange}
                                options={activeDestination.keys.map(k => ({
                                    value: k,
                                    label: (
                                        <span className="inline-flex items-center gap-1">
                                            {SUB_LABELS[k]}
                                            {tabNotifMap[k] > 0 && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" aria-hidden="true" />
                                            )}
                                        </span>
                                    ),
                                }))}
                            />
                        )}
                    </>
                )}
             </div>
             
             {/* "Projekt-sundhed" (IntelligenceIndexCard) is injected into
                 ProjectOverviewTab via healthSlot — hero-first per approved order. */}
             {<Suspense fallback={<div className="flex h-[40vh] items-center justify-center"><div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>}>{renderTabContent()}</Suspense>}

             {userRole !== 'CLIENT' && timeEnabled && (
                 <FloatingTimer
                    timerState={activeTimerState}
                    projectTasks={projectTasks}
                    onOpenTimeTab={() => handleTabChange('tid-plan')}
                    onSaveLog={handleSaveLog}
                    user={user}
                 />
             )}
             
             {mereDestination && (
                 <BottomSheet open={mereOpen} onClose={() => setMereOpen(false)} title="Mere">
                     <div className="-mx-5">
                         {mereDestination.keys.map(k => (
                             <ListRow
                                 key={k}
                                 leading={
                                     <span className="w-9 h-9 rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light flex items-center justify-center">
                                         {MERE_META[k]?.icon}
                                     </span>
                                 }
                                 title={SUB_LABELS[k]}
                                 subtitle={MERE_META[k]?.hint}
                                 trailing={tabNotifMap[k] > 0 ? <Badge variant="danger" dot>{tabNotifMap[k]}</Badge> : undefined}
                                 onClick={() => {
                                     setMereOpen(false);
                                     handleTabChange(k);
                                 }}
                             />
                         ))}
                     </div>
                 </BottomSheet>
             )}

             <InvitePartnerModal
                 open={showInvitePartner}
                 projectId={id}
                 projectName={project.name}
                 onClose={() => setShowInvitePartner(false)}
                 onInvited={() => {
                     setShowInvitePartner(false);
                     showToast('Partnerinvitation sendt.', 'success');
                 }}
             />

             {showReportModal && reportContent && project && (
                <GenericModal 
                    title="Forhåndsvisning af Rapport" 
                    onClose={() => setShowReportModal(false)}
                    fullScreen
                    footer={
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowReportModal(false)} className="px-4 py-2 border rounded-lg font-semibold text-text-primary dark:text-text-dark-primary">Luk</button>
                            <button onClick={handleDownloadPdf} className="px-4 py-2 bg-brand-primary text-white rounded-lg font-semibold flex items-center gap-2">
                                <DownloadIcon className="w-5 h-5"/> Download PDF
                            </button>
                        </div>
                    }
                >
                    <div className="flex justify-center bg-bg-muted dark:bg-bg-dark py-8 min-h-full">
                        <HandoverReportTemplate project={project} content={reportContent} />
                    </div>
                </GenericModal>
             )}
        </div>
    );
};

export default ProjectDetailPage;
