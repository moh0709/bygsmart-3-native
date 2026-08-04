
import React, { useEffect, useState, useMemo } from 'react';
import { Project, ActivityLogItem, Task, PurchaseItem, User, ProjectMember, ProjectBudgetSummary } from '../../../types';
import { getActivityLog } from '../../../services/api';
import { getProjectBudgetSummary } from '../../budget';
import { getPunchListForProject } from '../../quality';
import { evaluateProjectDeadline } from '../../ai';
import { ModuleGate, useModuleGate } from '../../../core/entitlements/ModuleGate';
import {
    CalendarIcon,
    CheckCircleIcon,
    ShoppingCartIcon,
    ClockIcon,
    UserIcon,
    MapPinIcon,
    TrendingUpIcon,
    XIcon,
    SparklesIcon,
    FileTextIcon,
    AlertTriangleIcon,
    ChevronDownIcon,
} from '../../../components/icons';
import { resolveFileUrl } from '../../../utils/fileUtils';
// ProjectTimeline lives in modules/tasks (it renders TaskCards); reverse
// edges from projects stay dynamic (no module cycle).
const ProjectTimeline = React.lazy(() => import('../../tasks').then(m => m.loadProjectTimeline()));
import {
    Avatar,
    AvatarGroup,
    Badge,
    Button,
    Card,
    EmptyState,
    ListRow,
    Modal,
    ProgressBar,
    ProgressRing,
    Skeleton,
    SkeletonList,
    StatCard,
    cn,
} from '../../../components/ui';
import type { BadgeVariant, ProgressTone } from '../../../components/ui';

interface ProjectOverviewTabProps {
    project: Project;
    projectId: string;
    onGenerateReport: () => void;
    onNavigate: (tab: string) => void;
    user?: User | null;
    /** "Projekt-sundhed" card (IntelligenceIndexCard) injected by ProjectDetailPage,
        rendered between the hero and the KPI grid per the approved hierarchy. */
    healthSlot?: React.ReactNode;
}

interface GalleryItem {
    id: string;
    url: string;
    title: string;
    type: 'punch' | 'task';
    date: string;
}

/** da-DK integer formatting for KPI/money values (12.500, never 12500.00). */
const nf = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

const ImageViewModal: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
    const [resolvedSrc, setResolvedSrc] = useState('');

    useEffect(() => {
        resolveFileUrl(src).then(setResolvedSrc);
    }, [src]);

    return (
        <Modal open onClose={onClose} title="Billede" size="lg">
            {resolvedSrc ? (
                <img src={resolvedSrc} alt={alt} className="w-full max-h-[70vh] object-contain rounded-control" />
            ) : (
                <Skeleton className="w-full h-64" />
            )}
            <p className="mt-3 text-center text-caption text-text-secondary dark:text-text-dark-secondary">{alt}</p>
        </Modal>
    );
};

const HistoryModal: React.FC<{ logs: ActivityLogItem[]; onClose: () => void }> = ({ logs, onClose }) => (
    <Modal open onClose={onClose} title="Projekthistorik">
        {logs.length > 0 ? (
            <ul className="divide-y divide-border dark:divide-border-dark">
                {logs.map(log => (
                    <li key={log.id} className="py-3 flex gap-3">
                        <Avatar name={log.user} size="sm" />
                        <div className="min-w-0">
                            <p className="text-body text-text-primary dark:text-text-dark-primary">
                                <span className="font-bold text-brand-primary dark:text-brand-light">{log.user}</span> {log.description}
                            </p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1">{log.timestamp}</p>
                        </div>
                    </li>
                ))}
            </ul>
        ) : (
            <EmptyState
                icon={<CalendarIcon className="w-7 h-7" />}
                title="Ingen historik fundet"
                description="Handlinger på projektet vises her, efterhånden som teamet arbejder."
            />
        )}
    </Modal>
);

const ResolvedGalleryImage: React.FC<{ item: GalleryItem, onClick: () => void }> = ({ item, onClick }) => {
    const [src, setSrc] = useState('');

    useEffect(() => {
        let active = true;
        resolveFileUrl(item.url).then(url => {
            if (active) setSrc(url);
        });
        return () => { active = false; };
    }, [item.url]);

    if (!src) return <Skeleton className="w-24 h-24 shrink-0 rounded-card" />;

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={`Vis billede: ${item.title}`}
            className="relative w-24 h-24 shrink-0 rounded-card overflow-hidden border border-border dark:border-border-dark shadow-card snap-start group"
        >
            <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-slow group-hover:scale-110" />
            <span
                className={cn('absolute top-1 right-1 w-2 h-2 rounded-full', item.type === 'punch' ? 'bg-danger' : 'bg-info')}
                aria-hidden="true"
            />
        </button>
    );
};

const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Ejer',
    MANAGER: 'Projektleder',
    EMPLOYEE: 'Medarbejder',
    EXTERNAL: 'Underentreprenør',
    CLIENT: 'Kunde',
};

const MemberProfileModal: React.FC<{ member: ProjectMember; onClose: () => void }> = ({ member, onClose }) => {
    const roleLabel = ROLE_LABELS[member.role] ?? member.role;
    const isExternal = member.role === 'EXTERNAL';

    return (
        <Modal open onClose={onClose} title="Profil" size="sm">
            <div className="flex flex-col items-center gap-4 py-2">
                <Avatar name={member.name} size="lg" />
                <div className="text-center">
                    <p className="text-heading text-text-primary dark:text-text-dark-primary">{member.name}</p>
                    <Badge variant={isExternal ? 'warning' : 'info'} className="mt-1.5">{roleLabel}</Badge>
                </div>
                <dl className="w-full divide-y divide-border dark:divide-border-dark">
                    <div className="flex justify-between gap-3 py-2.5">
                        <dt className="text-label text-text-secondary dark:text-text-dark-secondary">Email</dt>
                        <dd className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate max-w-[60%] text-right">
                            {member.email ?? <span className="italic text-text-tertiary dark:text-text-dark-tertiary">Ikke registreret</span>}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                        <dt className="text-label text-text-secondary dark:text-text-dark-secondary">Rolle</dt>
                        <dd className="text-label font-medium text-text-primary dark:text-text-dark-primary">{roleLabel}</dd>
                    </div>
                </dl>
            </div>
        </Modal>
    );
};

export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({ project, projectId, onGenerateReport, onNavigate, user, healthSlot }) => {
    const [activityLog, setActivityLog] = useState<ActivityLogItem[]>([]);
    const [fullActivityLog, setFullActivityLog] = useState<ActivityLogItem[]>([]);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
    const [budgetSummary, setBudgetSummary] = useState<ProjectBudgetSummary | null>(null);
    const [stats, setStats] = useState({
        openTasks: 0,
        totalTasks: 0,
        overdueTasks: 0,
        pendingPurchases: 0,
        daysLeft: 0,
    });
    const [galleryImages, setGalleryImages] = useState<GalleryItem[]>([]);
    const [selectedImage, setSelectedImage] = useState<GalleryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showAllMembers, setShowAllMembers] = useState(false);
    const [selectedMember, setSelectedMember] = useState<ProjectMember | null>(null);
    const [healthReport, setHealthReport] = useState<{ probability: number; status: string; analysis: string; key_risks: string[] } | null>(null);

    // Entitlement gates for embedded cross-module content (budget/quality figures,
    // AI deadline analysis) — nav/tab-level gating doesn't cover content embedded
    // inside an already-unlocked tab.
    const budgetEnabled = useModuleGate('budget');
    const qualityEnabled = useModuleGate('quality');
    const aiEnabled = useModuleGate('ai');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const [logs, projectTasks, purchases, punchList, budget] = await Promise.all([
                getActivityLog(projectId),
                import('../../tasks').then(m => m.getTasksForProject(projectId, user?.id)),
                import('../../purchasing').then(m => m.getPurchaseInfoForProject(projectId, user?.id)),
                qualityEnabled ? getPunchListForProject(projectId) : Promise.resolve([]),
                budgetEnabled ? getProjectBudgetSummary(projectId) : Promise.resolve(null),
            ]);

            setFullActivityLog(logs);
            setActivityLog(logs.slice(0, 5));
            setTasks(projectTasks);
            setPurchaseItems(purchases.items);
            setBudgetSummary(budget);

            const openTasks = projectTasks.filter(t => t.status !== 'Udført').length;
            const overdueTasks = projectTasks.filter(t => t.status === 'Forfalden').length;
            const pendingPurchasesCount = purchases.items.filter(i => i.status === 'Afventer').length;

            const end = new Date(project.endDate);
            const now = new Date();
            const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            setStats({
                openTasks,
                totalTasks: projectTasks.length,
                overdueTasks,
                pendingPurchases: pendingPurchasesCount,
                daysLeft,
            });

            const images: GalleryItem[] = [];
            punchList.forEach(item => {
                if (item.photoUrl) images.push({ id: item.id, url: item.photoUrl, title: item.description, type: 'punch', date: item.timestamp });
            });
            projectTasks.forEach(task => {
                task.attachments?.forEach((att, idx) => {
                    if (att.type === 'image') images.push({ id: `${task.id}-${idx}`, url: att.url, title: `Opgave: ${task.title}`, type: 'task', date: new Date().toISOString() });
                });
            });
            setGalleryImages(images.reverse().slice(0, 8));
            setLoading(false);
        };
        fetchData();
    }, [projectId, project.endDate, user?.id, budgetEnabled, qualityEnabled]);

    const handleAiAnalysis = async () => {
        if (!aiEnabled) return;
        setIsAnalyzing(true);
        const report = await evaluateProjectDeadline(project, tasks, fullActivityLog, purchaseItems);
        setHealthReport(report);
        setIsAnalyzing(false);
    };

    // Determine permissions based on current user's role in the project
    const currentMember = project.team.find(m => m.id === user?.id);
    const userRole = currentMember?.role || (user?.id === project.ownerId || (!project.ownerId && user?.id === 'user1') ? 'OWNER' : 'EMPLOYEE');

    // Hide financials for External and Client roles
    const showFinancials = (purchaseItems.length > 0 || (project.ownerId === user?.id)) && userRole !== 'EXTERNAL' && userRole !== 'CLIENT';

    // Determine if external user
    const isExternal = userRole === 'EXTERNAL';

    // Status badge: same decision logic as before, expressed as kit Badge variants
    const statusInfo = useMemo((): { variant: BadgeVariant; text: string } => {
        const { daysLeft, openTasks, totalTasks } = stats;

        let variant: BadgeVariant = 'success';
        let text = 'I rute';

        if (project.status === 'Afsluttet') {
            variant = 'neutral';
            text = 'Afsluttet';
        } else if (daysLeft < 0 && openTasks > 0) {
            variant = 'danger';
            text = 'Forsinket';
        } else if (daysLeft < 5 && openTasks > 0) {
            variant = 'warning';
            text = 'Risiko';
        } else if (openTasks === 0 && totalTasks > 0) {
            variant = 'success';
            text = 'Færdig';
        }

        return { variant, text };
    }, [stats, project.status]);

    const daysLeftText = stats.daysLeft > 0
        ? `${nf.format(stats.daysLeft)} dage`
        : stats.daysLeft < 0
            ? `${nf.format(Math.abs(stats.daysLeft))} dage over`
            : 'I dag';

    const plannedMaterialsKr = budgetSummary?.plannedByCategory.materials ?? 0;
    const actualMaterialsKr = (budgetSummary?.actualPurchasesCommittedKr ?? 0) + (budgetSummary?.actualPurchasesReceivedKr ?? 0);
    const materialsBudgetPct = plannedMaterialsKr > 0 ? Math.min(100, (actualMaterialsKr / plannedMaterialsKr) * 100) : 0;
    const materialsBudgetTone: ProgressTone = materialsBudgetPct > 100 ? 'danger' : materialsBudgetPct > 90 ? 'warning' : 'success';

    const healthTone: ProgressTone = healthReport
        ? healthReport.probability > 80 ? 'success' : healthReport.probability > 50 ? 'warning' : 'danger'
        : 'brand';

    if (loading) return (
        <div className="p-4 space-y-4 animate-fade-in">
            <Card padding="lg">
                <Skeleton className="h-6 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3 mb-5" />
                <Skeleton className="h-2 w-full" />
            </Card>
            <div className="grid grid-cols-2 gap-3" aria-hidden="true">
                <Skeleton className="h-[72px]" />
                <Skeleton className="h-[72px]" />
                <Skeleton className="h-[72px]" />
                <Skeleton className="h-[72px]" />
            </div>
            <SkeletonList count={2} label="Indlæser oversigt…" />
        </div>
    );

    return (
        <div className="p-4 space-y-4 animate-fade-in">
            {/* 1. Hero: project info, status, dates, progress, members */}
            <Card padding="lg">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-title text-text-primary dark:text-text-dark-primary truncate">{project.name}</h2>
                            {isExternal && <Badge variant="warning">Ekstern</Badge>}
                        </div>
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary mt-0.5">#{project.projectNumber}</p>
                    </div>
                    <Badge variant={statusInfo.variant} dot className="shrink-0 mt-1">{statusInfo.text}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption font-medium text-text-secondary dark:text-text-dark-secondary">
                    <span className="inline-flex items-center gap-1.5">
                        <ClockIcon className="w-3.5 h-3.5" aria-hidden="true" /> {daysLeftText}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <CheckCircleIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="font-bold text-text-primary dark:text-text-dark-primary">{nf.format(stats.openTasks)}</span>/{nf.format(stats.totalTasks)} opgaver
                    </span>
                </div>

                <div className="flex flex-col gap-2.5 mt-4">
                    <div className="flex items-center gap-3 text-label text-text-secondary dark:text-text-dark-secondary">
                        <span className="w-8 h-8 rounded-full bg-bg-muted dark:bg-bg-dark-muted flex items-center justify-center shrink-0" aria-hidden="true">
                            <UserIcon className="w-4 h-4" />
                        </span>
                        <span className="font-medium truncate">{project.clientName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-label text-text-secondary dark:text-text-dark-secondary">
                        <span className="w-8 h-8 rounded-full bg-bg-muted dark:bg-bg-dark-muted flex items-center justify-center shrink-0" aria-hidden="true">
                            <MapPinIcon className="w-4 h-4" />
                        </span>
                        <span className="font-medium truncate">{project.address}</span>
                    </div>
                </div>

                {project.team.length > 0 && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setShowAllMembers(v => !v)}
                            aria-expanded={showAllMembers ? 'true' : 'false'}
                            aria-label={`Projektmedlemmer (${project.team.length})`}
                            className="flex w-full min-h-11 items-center gap-3 text-left rounded-control px-1 -mx-1 hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors duration-150"
                        >
                            <AvatarGroup people={project.team.map(m => ({ name: m.name }))} max={5} />
                            <span className="grow text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                {project.team.length} {project.team.length === 1 ? 'medlem' : 'medlemmer'}
                            </span>
                            <ChevronDownIcon
                                className={cn('w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary transition-transform duration-150', showAllMembers && 'rotate-180')}
                                aria-hidden="true"
                            />
                        </button>
                        {showAllMembers && (
                            <div className="flex flex-wrap gap-2 mt-2 animate-fade-in">
                                {project.team.map(member => (
                                    <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => setSelectedMember(member)}
                                        aria-label={`Vis profil: ${member.name}`}
                                        className="flex min-h-11 items-center gap-2 rounded-full border border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted px-3 py-1.5 hover:border-border-strong dark:hover:border-border-dark-strong transition-colors duration-150"
                                    >
                                        <Avatar name={member.name} size="xs" />
                                        <span className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate max-w-[120px]">{member.name}</span>
                                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{ROLE_LABELS[member.role] ?? member.role}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="border-t border-border dark:border-border-dark mt-4 pt-4">
                    <React.Suspense fallback={null}>
                        <ProjectTimeline project={project} tasks={tasks} onNavigate={onNavigate} />
                    </React.Suspense>
                </div>
            </Card>

            {/* 2. "Projekt-sundhed" (IntelligenceIndexCard) — injected by
                ProjectDetailPage for internal roles, hero-first per approved order. */}
            {healthSlot}

            {/* AI deadline analysis result (on demand via handleAiAnalysis) */}
            {healthReport && (
                <Card padding="lg" className="animate-fade-in">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <h3 className="text-heading text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-brand-primary dark:text-brand-light" aria-hidden="true" />
                            AI tidsplan-analyse
                        </h3>
                        <button
                            type="button"
                            onClick={() => setHealthReport(null)}
                            aria-label="Luk analyse"
                            className="shrink-0 -m-2 p-3 rounded-control text-text-tertiary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-tertiary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150"
                        >
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-5">
                        <ProgressRing
                            value={healthReport.probability}
                            tone={healthTone}
                            diameter={72}
                            strokeWidth={7}
                            label={`Sandsynlighed for at nå deadline: ${healthReport.probability}%`}
                        />
                        <div className="min-w-0">
                            <p className={cn(
                                'text-heading font-bold',
                                healthReport.status === 'On Track'
                                    ? 'text-success-strong dark:text-success'
                                    : 'text-warning-strong dark:text-warning'
                            )}>
                                {healthReport.status}
                            </p>
                            <p className="text-label text-text-secondary dark:text-text-dark-secondary mt-1 leading-snug">{healthReport.analysis}</p>
                        </div>
                    </div>
                    {healthReport.key_risks.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border dark:border-border-dark">
                            <p className="text-caption font-bold uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary mb-2">Risikofaktorer</p>
                            <ul className="space-y-1.5">
                                {healthReport.key_risks.map((risk, i) => (
                                    <li key={i} className="text-label text-text-secondary dark:text-text-dark-secondary flex items-start gap-2">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-danger shrink-0" aria-hidden="true" />
                                        {risk}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>
            )}

            {/* 3. KPI grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label={stats.overdueTasks > 0
                        ? `Åbne opgaver · ${nf.format(stats.overdueTasks)} ${stats.overdueTasks === 1 ? 'kritisk' : 'kritiske'}`
                        : 'Åbne opgaver'}
                    value={stats.openTasks}
                    tone={stats.overdueTasks > 0 ? 'danger' : 'info'}
                    icon={stats.overdueTasks > 0 ? <AlertTriangleIcon className="w-5 h-5" /> : <CheckCircleIcon className="w-5 h-5" />}
                    onClick={() => onNavigate('opgaver')}
                />
                <StatCard
                    label="Dage tilbage"
                    value={stats.daysLeft > 0 ? stats.daysLeft : 0}
                    tone="brand"
                    icon={<ClockIcon className="w-5 h-5" />}
                    onClick={() => onNavigate('tid-plan')}
                />
                {showFinancials && (
                    <>
                        <StatCard
                            label="Indkøb afventer"
                            value={stats.pendingPurchases}
                            tone="warning"
                            icon={<ShoppingCartIcon className="w-5 h-5" />}
                            onClick={() => onNavigate('indkob')}
                        />
                        <ModuleGate moduleId="budget" mode="hide">
                            <Card padding="sm" className="flex flex-col justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <span
                                        className="flex w-10 h-10 items-center justify-center rounded-control bg-success-subtle text-success-strong dark:bg-success-subtle-dark dark:text-success shrink-0"
                                        aria-hidden="true"
                                    >
                                        <TrendingUpIcon className="w-5 h-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-label font-bold tabular-nums text-text-primary dark:text-text-dark-primary truncate">
                                            {nf.format(actualMaterialsKr)} kr
                                        </span>
                                        <span className="block text-caption font-semibold text-text-secondary dark:text-text-dark-secondary truncate">
                                            {plannedMaterialsKr > 0 ? `Materialer · af ${nf.format(plannedMaterialsKr)} kr budget` : 'Materialer · bestilt/modtaget'}
                                        </span>
                                    </span>
                                </div>
                                {plannedMaterialsKr > 0 ? (
                                    <ProgressBar value={materialsBudgetPct} tone={materialsBudgetTone} size="sm" label="Budgetforbrug" />
                                ) : (
                                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Intet budget angivet endnu</p>
                                )}
                            </Card>
                        </ModuleGate>
                    </>
                )}
            </div>

            {/* 4. Action pair: AI evaluation + handover report */}
            <div className="grid grid-cols-2 gap-3">
                <ModuleGate moduleId="ai" mode="upsell">
                    <Button
                        variant="secondary"
                        fullWidth
                        loading={isAnalyzing}
                        onClick={handleAiAnalysis}
                        iconLeft={<SparklesIcon className="w-4 h-4" />}
                        className="rich-hero-ai border-transparent"
                    >
                        {isAnalyzing ? 'Analyserer…' : 'Evaluér tidsplan (AI)'}
                    </Button>
                </ModuleGate>
                <Button
                    variant="outline"
                    fullWidth
                    onClick={onGenerateReport}
                    iconLeft={<FileTextIcon className="w-4 h-4" />}
                >
                    Overdragelse (PDF)
                </Button>
            </div>

            {/* 5. Activity & photos */}
            <Card padding="none" className="overflow-hidden">
                <div className="px-4 sm:px-5 py-3.5 border-b border-border dark:border-border-dark">
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-brand-primary dark:text-brand-light" aria-hidden="true" />
                        Aktivitet &amp; billeder
                    </h3>
                </div>
                {galleryImages.length > 0 && (
                    <div className="p-4 border-b border-border dark:border-border-dark bg-bg-subtle dark:bg-bg-dark-muted/30">
                        <div className="flex justify-between items-end mb-2">
                            <h4 className="text-caption font-bold uppercase tracking-wide text-text-secondary dark:text-text-dark-secondary">Seneste filer</h4>
                            <span className="text-caption font-medium text-text-secondary dark:text-text-dark-secondary">{nf.format(galleryImages.length)} filer</span>
                        </div>
                        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 snap-x">
                            {galleryImages.map((img) => (
                                <ResolvedGalleryImage key={img.id} item={img} onClick={() => setSelectedImage(img)} />
                            ))}
                        </div>
                    </div>
                )}
                {activityLog.length > 0 ? (
                    <div className="divide-y divide-border dark:divide-border-dark">
                        {activityLog.map(log => (
                            <ListRow
                                key={log.id}
                                leading={<Avatar name={log.user} size="sm" />}
                                title={log.user}
                                subtitle={log.description}
                                trailing={
                                    <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary whitespace-nowrap">
                                        {log.timestamp}
                                    </span>
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={<CalendarIcon className="w-7 h-7" />}
                        title="Ingen aktivitet registreret endnu."
                        description="Handlinger på projektet vises her, efterhånden som teamet arbejder."
                    />
                )}
                {fullActivityLog.length > 0 && (
                    <div className="border-t border-border dark:border-border-dark">
                        <Button variant="ghost" fullWidth className="rounded-none" onClick={() => setShowHistoryModal(true)}>
                            Se fuld historik
                        </Button>
                    </div>
                )}
            </Card>

            {showHistoryModal && <HistoryModal logs={fullActivityLog} onClose={() => setShowHistoryModal(false)} />}
            {selectedImage && <ImageViewModal src={selectedImage.url} alt={selectedImage.title} onClose={() => setSelectedImage(null)} />}
            {selectedMember && <MemberProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} />}
        </div>
    );
};
