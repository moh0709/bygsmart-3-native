
import React, { useState, useEffect } from 'react';
import { Project, Task, User, TimeEntry, PurchaseItem, PunchListItem, ProjectResource, ResourceKind, ResourceVisibility, ProjectBudgetSummary } from '../../../types';
import { UserIcon, MapPinIcon, UsersIcon, SparklesIcon, PlusIcon, LockIcon, ClockIcon, TrendingUpIcon, CheckCircleIcon, AlertTriangleIcon, MoreVerticalIcon, CheckSquareIcon } from '../../../components/icons';
import { AnimatedNumber } from '../../tools';
import { getUserConnections } from '../../../services/api';
import { addProjectMember, getProjectResources, addProjectResource, updateProjectResource, removeProjectResource } from '../services/projectResources';
import { closeProject, archiveProject, cancelProject, reopenProject } from '../services/projectLifecycle';
import { terminateProjectMember, TerminateMemberResult } from '../services/projectMembers';
import { getProjectBudgetSummary } from '../../budget';
import { getPunchListForProject } from '../../quality';
import { getTimeEntriesForProject } from '../../time';
import { computeBudgetUtilization } from '../../ai';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { Gatekeeper } from '../../../components/ui/Gatekeeper';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { ModuleGate, useModuleGate } from '../../../core/entitlements/ModuleGate';
import {
    Alert, Badge, Button, Card, ConfirmDialog, Input, ListRow, Modal,
    ProgressBar, SegmentedControl, Select, cn,
} from '../../../components/ui';
import type { BadgeVariant } from '../../../components/ui';

interface ProjectDetailsTabContentProps {
    project: Project;
    projectId: string;
    tasks: Task[];
    onGenerateReport: () => void;
    isGeneratingReport: boolean;
    user?: User | null;
    onProjectStatusChange?: () => void;
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
    'I gang': 'info',
    'Afsluttet': 'success',
    'ARCHIVED': 'neutral',
    'CANCELLED': 'danger',
};

const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={STATUS_VARIANTS[status] ?? 'neutral'} dot className="shrink-0">{status}</Badge>
);

/** Initials bubble that respects the member's stored initials (pending → warning tone). */
const InitialsBubble: React.FC<{ initials: string; pending?: boolean; size?: 'md' | 'lg' }> = ({ initials, pending, size = 'md' }) => (
    <span
        className={cn(
            'rounded-full flex items-center justify-center font-bold shrink-0',
            size === 'lg' ? 'w-12 h-12 text-body' : 'w-10 h-10 text-label',
            pending
                ? 'bg-warning-subtle text-warning-strong dark:bg-warning-subtle-dark dark:text-warning'
                : 'bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light'
        )}
        aria-hidden="true"
    >
        {initials}
    </span>
);

const AddMemberModal: React.FC<{ onClose: () => void; onAdd: (user: { id?: string, name: string, initials: string, email?: string, kind: ResourceKind }) => void }> = ({ onClose, onAdd }) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<'connections' | 'email'>('connections');
    const [connections, setConnections] = useState<User[]>([]);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [selectedKind, setSelectedKind] = useState<ResourceKind>('staff');

    useEffect(() => {
        if (user) {
            getUserConnections(user.id).then(setConnections);
        }
    }, [user]);

    const handleAddExisting = (u: User) => {
        onAdd({ id: u.id, name: u.name, initials: u.initials, kind: selectedKind });
        onClose();
    };

    const handleAddEmail = () => {
        if (!email) return;
        const initials = name ? name.substring(0, 2).toUpperCase() : email.substring(0, 2).toUpperCase();
        onAdd({ email, name: name || email, initials, kind: selectedKind });
        onClose();
    };

    return (
        <Modal
            open
            title="Tilføj deltager"
            onClose={onClose}
            footer={<Button variant="ghost" onClick={onClose}>Annuller</Button>}
        >
            <div className="space-y-4">
                <SegmentedControl
                    label="Invitationsmetode"
                    value={mode}
                    onChange={v => setMode(v as 'connections' | 'email')}
                    options={[
                        { label: 'Mit netværk', value: 'connections' },
                        { label: 'Email-invitation', value: 'email' },
                    ]}
                />

                <div>
                    <Select label="Type" value={selectedKind} onChange={(e) => setSelectedKind(e.target.value as ResourceKind)}>
                        <option value="staff">Intern (Staff)</option>
                        <option value="partner">Underleverandør (Partner)</option>
                    </Select>
                    {selectedKind === 'partner' && (
                        <p className="text-caption text-warning-strong dark:text-warning mt-1">Underleverandøren ser kun opgaver tildelt direkte til dem.</p>
                    )}
                </div>

                {mode === 'connections' ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {connections.length > 0 ? connections.map(u => (
                            <button
                                key={u.id}
                                type="button"
                                onClick={() => handleAddExisting(u)}
                                className="w-full min-h-11 flex items-center gap-3 p-3 rounded-control text-left border border-transparent hover:bg-bg-subtle hover:border-border dark:hover:bg-bg-dark-muted/50 dark:hover:border-border-dark transition-colors duration-150"
                            >
                                <InitialsBubble initials={u.initials} />
                                <span className="min-w-0">
                                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{u.name}</span>
                                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">@{u.username}</span>
                                </span>
                                <PlusIcon className="w-4 h-4 ml-auto text-text-tertiary dark:text-text-dark-tertiary shrink-0" aria-hidden="true" />
                            </button>
                        )) : (
                            <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary py-4">Du har ingen forbindelser endnu. Tilføj dem via din profil.</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kollega@firma.dk" />
                        <Input label="Navn (valgfrit)" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Navn" />
                        <Button fullWidth className="mt-2" disabled={!email} onClick={handleAddEmail}>Send invitation</Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

const ManageMemberModal: React.FC<{ member: any; onClose: () => void; onRemove: (member: any) => void; canTerminate: boolean }> = ({ member, onClose, onRemove, canTerminate }) => {
    return (
        <Modal
            open
            title={`Administrer ${member.name}`}
            onClose={onClose}
            footer={<Button onClick={onClose}>Luk</Button>}
        >
            <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-card bg-bg-subtle dark:bg-bg-dark-muted/40">
                    <InitialsBubble initials={member.initials} size="lg" />
                    <div className="min-w-0">
                        <h4 className="text-heading text-text-primary dark:text-text-dark-primary truncate">{member.name}</h4>
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary">{member.role}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <button
                        type="button"
                        className="w-full min-h-11 px-3 rounded-control border border-border dark:border-border-dark flex items-center gap-2 text-label font-medium text-text-primary dark:text-text-dark-primary hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors duration-150"
                    >
                        <UserIcon className="w-4 h-4 shrink-0" aria-hidden="true" /> Skift rolle
                    </button>
                    {canTerminate && (
                        <button
                            type="button"
                            onClick={() => onRemove(member)}
                            className="w-full min-h-11 px-3 rounded-control border border-danger-border dark:border-danger/30 flex items-center gap-2 text-label font-medium text-danger-strong dark:text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                        >
                            <AlertTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" /> Opsig samarbejde
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const TerminateCooperationModal: React.FC<{
    member: any;
    isTerminating: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ member, isTerminating, onConfirm, onCancel }) => {
    return (
        <Modal
            open
            title="Opsig samarbejde"
            onClose={onCancel}
            footer={
                <>
                    <Button variant="ghost" onClick={onCancel} disabled={isTerminating}>Annuller</Button>
                    <Button variant="danger" onClick={onConfirm} loading={isTerminating}>Ja, opsig samarbejde</Button>
                </>
            }
        >
            <div className="space-y-4">
                {/* Member identity card */}
                <div className="flex items-center gap-4 p-4 rounded-card bg-bg-subtle dark:bg-bg-dark-muted/40">
                    <InitialsBubble initials={member.initials} size="lg" />
                    <div className="min-w-0">
                        <h4 className="text-heading text-text-primary dark:text-text-dark-primary truncate">{member.name}</h4>
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary">{member.role}</p>
                    </div>
                </div>

                {/* Konsekvenser */}
                <Alert variant="warning" title="Hvad sker der?">
                    <ul className="list-disc list-inside space-y-1.5">
                        <li>Medlemmet mister øjeblikkeligt al adgang til projektet og kan ikke længere se det.</li>
                        <li>En overdragelsesrapport (OVERDRAGELSESRAPPORT) genereres automatisk, indeholdende alt hvad medlemmet kunne se og hvad de har bidraget med.</li>
                        <li>Rapporten gemmes og sendes til medlemmets e-mailadresse.</li>
                        <li>Medlemmet modtager en notifikation i appen.</li>
                    </ul>
                </Alert>

                {/* Ansvarsfraskrivelse */}
                <Alert variant="danger" title="Ansvarsfraskrivelse">
                    BygSmart og OMNIWARE ApS påtager sig intet ansvar for konsekvenserne af denne opsigelse. Det er dit ansvar som projektejer at sikre, at opsigelsen sker i overensstemmelse med gældende aftaler og lovgivning.
                </Alert>

                {/* Final confirmation */}
                <p className="text-label font-bold text-text-primary dark:text-text-dark-primary text-center">
                    Er du sikker?
                </p>
            </div>
        </Modal>
    );
};

const TerminationResultModal: React.FC<{
    member: any;
    result: TerminateMemberResult;
    onClose: () => void;
}> = ({ member, result, onClose }) => {
    // The endpoint can return ok with no report URL when generation/upload
    // failed (a non-fatal step). Don't claim the report was generated unless a
    // URL is actually present.
    const hasReport = !!result.reportSignedUrl;
    return (
        <Modal
            open
            title="Samarbejde afsluttet"
            onClose={onClose}
            footer={<Button onClick={onClose}>Luk</Button>}
        >
            <div className="space-y-4">
                <div className="flex flex-col items-center text-center gap-2 py-2">
                    <div
                        className={cn(
                            'w-14 h-14 rounded-full flex items-center justify-center',
                            hasReport
                                ? 'bg-success-subtle dark:bg-success-subtle-dark'
                                : 'bg-warning-subtle dark:bg-warning-subtle-dark'
                        )}
                        aria-hidden="true"
                    >
                        {hasReport
                            ? <CheckCircleIcon className="w-8 h-8 text-success-strong dark:text-success" />
                            : <AlertTriangleIcon className="w-8 h-8 text-warning-strong dark:text-warning" />}
                    </div>
                    <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                        {member.name} er fjernet fra projektet.
                    </p>
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                        {hasReport
                            ? 'En overdragelsesrapport er genereret og gemt.'
                            : 'Medlemmets adgang er fjernet, men overdragelsesrapporten kunne ikke genereres. Prøv eventuelt igen senere.'}
                    </p>
                </div>

                {/* Email status — only meaningful when a report was actually produced */}
                {hasReport && result.emailStatus === 'sent' && (
                    <p className="text-label text-success-strong dark:text-success text-center">
                        Rapporten er sendt til {member.name}s e-mailadresse.
                    </p>
                )}
                {hasReport && result.emailStatus === 'failed' && (
                    <p className="text-label text-warning-strong dark:text-warning text-center">
                        E-mailen kunne ikke sendes – download rapporten her i stedet.
                    </p>
                )}
                {hasReport && result.emailStatus === 'skipped' && (
                    <p className="text-label text-warning-strong dark:text-warning text-center">
                        Ingen SMTP-server er konfigureret – download rapporten her.
                    </p>
                )}

                {/* Download button */}
                {result.reportSignedUrl && (
                    <a
                        href={result.reportSignedUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-11 bg-brand-primary text-white rounded-control text-label font-semibold flex items-center justify-center gap-2 hover:bg-brand-strong transition-colors duration-150"
                    >
                        Download overdragelsesrapport
                    </a>
                )}
            </div>
        </Modal>
    );
};

// Team Member Row Component
interface TeamMemberRowProps {
    member: any;
    tasks: Task[];
    timeEntries: TimeEntry[];
    onManage: (m: any) => void;
    canManage?: boolean;
    onVisibilityChange?: (resourceId: string, visibility: ResourceVisibility) => void;
}

const TeamMemberRow: React.FC<TeamMemberRowProps> = ({ member, tasks, timeEntries, onManage, canManage, onVisibilityChange }) => {
    const memberTasks = tasks.filter(t => t.assignees.some(a => a.id === member.id) && t.status !== 'Udført');
    const overdueTasks = memberTasks.filter(t => t.status === 'Forfalden' || (t.dueDate && new Date(t.dueDate) < new Date()));
    const totalHours = timeEntries.filter(e => e.userId === member.id).reduce((sum, e) => sum + e.hours, 0);

    return (
        <div className="flex items-center gap-3 p-3 rounded-card border border-border bg-bg shadow-card dark:border-border-dark dark:bg-bg-dark-surface transition-all duration-150 hover:border-border-strong dark:hover:border-border-dark-strong">
            <InitialsBubble initials={member.initials} pending={member.status === 'PENDING'} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{member.name}</p>
                    <Badge className="uppercase">
                        {member.kind === 'partner' ? 'UE' : member.role === 'MANAGER' || member.role === 'OWNER' ? 'Leder' : 'Partner'}
                    </Badge>
                    {canManage && member.resourceId && (
                        <select
                            aria-label={`Synlighed for ${member.name}`}
                            value={member.visibility ?? 'standard'}
                            onChange={(e) => onVisibilityChange?.(member.resourceId, e.target.value as ResourceVisibility)}
                            onClick={(e) => e.stopPropagation()}
                            className="ml-auto text-caption font-semibold min-h-9 px-2 py-1 rounded-control border border-border bg-bg text-text-secondary dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary cursor-pointer transition-colors duration-150 focus:ring-2 focus:ring-brand-primary outline-none"
                        >
                            <option value="all">Alt</option>
                            <option value="some">Noget</option>
                            <option value="standard">Standard</option>
                            <option value="none">Intet</option>
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                    <div className="flex items-center gap-1" title="Aktive opgaver">
                        <CheckSquareIcon className="w-3 h-3" aria-hidden="true" />
                        <span className={cn('tabular-nums', overdueTasks.length > 0 && 'text-danger-strong dark:text-danger font-bold')}>
                            {memberTasks.length} {overdueTasks.length > 0 && `(${overdueTasks.length} !)`}
                        </span>
                    </div>
                    <ModuleGate moduleId="time" mode="hide">
                        <div className="w-px h-3 bg-border dark:bg-border-dark" aria-hidden="true"></div>
                        <div className="flex items-center gap-1" title="Registrerede timer">
                            <ClockIcon className="w-3 h-3" aria-hidden="true" />
                            <span className="tabular-nums">{totalHours.toFixed(1)}t</span>
                        </div>
                    </ModuleGate>
                </div>
            </div>

            <button
                type="button"
                onClick={() => onManage(member)}
                aria-label={`Administrer ${member.name}`}
                className="inline-flex w-11 h-11 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150 shrink-0"
            >
                <MoreVerticalIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ProjectDetailsTabContent: React.FC<ProjectDetailsTabContentProps> = ({ project, projectId, tasks, onGenerateReport, isGeneratingReport, user, onProjectStatusChange }) => {
    const [performanceIndex, setPerformanceIndex] = useState(0);
    const [aiStats, setAiStats] = useState({ velocity: 0, budgetHealth: 0, quality: 0, trend: 'flat' as 'up' | 'down' | 'flat' });
    const [aiInsight, setAiInsight] = useState('');
    const [aiBottleneck, setAiBottleneck] = useState('');

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [managingMember, setManagingMember] = useState<any>(null);
    const { features, upgradeTo } = useSubscription();
    const { showToast } = useToast();

    // Entitlement gates for embedded cross-module content — nav/tab-level
    // gating doesn't cover figures embedded inside an already-unlocked tab.
    const budgetEnabled = useModuleGate('budget');
    const qualityEnabled = useModuleGate('quality');
    const timeEnabled = useModuleGate('time');
    const aiEnabled = useModuleGate('ai');

    // Lifecycle confirm dialog state
    type LifecycleAction = 'close' | 'archive' | 'cancel' | 'reopen';
    const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);
    const [memberToRemove, setMemberToRemove] = useState<any>(null);

    // Terminate cooperation flow state
    const [isTerminateOpen, setIsTerminateOpen] = useState(false);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationResult, setTerminationResult] = useState<TerminateMemberResult | null>(null);

    // Additional Data State
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
    const [punchList, setPunchList] = useState<PunchListItem[]>([]);
    const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
    const [budgetSummary, setBudgetSummary] = useState<ProjectBudgetSummary | null>(null);
    // Tracks whether the first project_resources fetch has completed. Until then
    // we fall back to the (possibly stale) project.team mirror; afterwards an
    // empty resources array is authoritative so terminated members cannot be
    // resurrected from project.team.
    const [resourcesLoaded, setResourcesLoaded] = useState(false);

    useEffect(() => {
        const fetchExtraData = async () => {
            const [tEntries, pItems, pList, resources, budget] = await Promise.all([
                timeEnabled ? getTimeEntriesForProject(projectId) : Promise.resolve([]),
                import('../../purchasing').then(m => m.getPurchaseInfoForProject(projectId)),
                qualityEnabled ? getPunchListForProject(projectId) : Promise.resolve([]),
                getProjectResources(projectId),
                budgetEnabled ? getProjectBudgetSummary(projectId) : Promise.resolve(null),
            ]);
            setTimeEntries(tEntries);
            setPurchases(pItems.items);
            setPunchList(pList);
            setProjectResources(resources);
            setBudgetSummary(budget);
            setResourcesLoaded(true);
        };
        fetchExtraData();
    }, [projectId, timeEnabled, qualityEnabled, budgetEnabled]);

    // Keep the Ressourcer section live: when a partner/staff invite is accepted
    // or otherwise changes, the project_resources row updates server-side. Listen
    // for those changes and refetch resources so the list updates without a full
    // page reload.
    useEffect(() => {
        if (!projectId) return;
        const channel = supabase
            .channel(`project_resources:${projectId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'project_resources', filter: `project_id=eq.${projectId}` },
                () => {
                    getProjectResources(projectId)
                        .then(resources => {
                            setProjectResources(resources);
                            setResourcesLoaded(true);
                        })
                        .catch(() => { /* transient refetch failure — keep existing list */ });
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [projectId]);

    useEffect(() => {
        if (!project.startDate || !project.endDate || tasks.length === 0) return;
        // The whole "AI Performance Index" card is an ai-module feature (its
        // composite score calls computeBudgetUtilization, imported from ../../ai) —
        // skip the computation entirely when ai isn't entitled; the card is hidden.
        if (!aiEnabled) return;

        // 1. Time / Velocity
        const start = new Date(project.startDate).getTime();
        const end = new Date(project.endDate).getTime();
        const now = new Date().getTime();
        const totalDuration = Math.max(1, end - start);
        const elapsed = Math.max(0, now - start);
        const timeProgress = Math.min(elapsed / totalDuration, 1);

        const completedTasks = tasks.filter(t => t.status === 'Udført').length;
        const totalTasks = tasks.length;
        const workProgress = totalTasks > 0 ? completedTasks / totalTasks : 0;

        // Velocity: Ratio of work done vs time elapsed. > 1 is ahead.
        const velocity = timeProgress > 0.1 ? workProgress / timeProgress : 1;

        // 2. Budget Health (shared with the Intelligence Index's budget dimension —
        // services/projectIntelligence.ts computeBudgetUtilization)
        const { ratio: budgetRatio } = computeBudgetUtilization(project, purchases, budgetSummary);
        const budgetHealth = Math.max(0, 1 - budgetRatio);

        // 3. Quality (Punch List ratio)
        const openPunchItems = punchList.filter(p => p.status !== 'Løst').length;
        // Penalize 5% per open item relative to total tasks
        const quality = Math.max(0, 1 - (openPunchItems * 0.05));

        // Composite Score (Weighted)
        // Velocity (40%), Budget (30%), Quality (30%)
        const rawScore = (Math.min(velocity, 1.2) * 40) + (budgetHealth * 30) + (quality * 30);
        const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

        setPerformanceIndex(finalScore);

        // Trend (Mock logic: compare to a "previous" state, here randomized slightly for demo effect or based on recent logs)
        // For stability, we'll base it on velocity. > 1.05 is up, < 0.95 is down.
        let trend: 'up' | 'down' | 'flat' = 'flat';
        if (velocity > 1.05) trend = 'up';
        else if (velocity < 0.95) trend = 'down';

        setAiStats({
            velocity: Math.round(Math.min(velocity, 1.5) * 100),
            budgetHealth: Math.round(budgetHealth * 100),
            quality: Math.round(quality * 100),
            trend
        });

        // Insights & Bottlenecks
        if (finalScore > 80) setAiInsight("Projektet kører effektivt. Høj kvalitet og budgetkontrol.");
        else if (finalScore > 50) setAiInsight("Rimelig fremdrift, men hold øje med budgettet.");
        else setAiInsight("Projektet er i risiko. Tidsplanen skrider.");

        const overdueCount = tasks.filter(t => t.status === 'Forfalden').length;
        if (overdueCount > 0) {
            const worstTask = tasks.find(t => t.status === 'Forfalden');
            setAiBottleneck(`Flaskehals: ${worstTask?.title || 'Ukendt opgave'} er forsinket.`);
        } else if (openPunchItems > 5) {
            setAiBottleneck("Flaskehals: Mange åbne mangler i Punch List.");
        } else {
            setAiBottleneck("Ingen kritiske flaskehalse identificeret.");
        }

    }, [project, tasks, purchases, punchList, budgetSummary, aiEnabled]);

    const handleAddMember = async (newMember: { id?: string; name: string; initials: string; email?: string; kind: ResourceKind }) => {
        await addProjectResource(projectId, {
            userId: newMember.id,
            email: newMember.email,
            name: newMember.name,
            initials: newMember.initials,
            kind: newMember.kind,
        });
        const resources = await getProjectResources(projectId);
        setProjectResources(resources);
        showToast('Deltager tilføjet til projektet.', 'success');
    };

    const handleRequestRemoveMember = (member: any) => {
        setMemberToRemove(member);
        setManagingMember(null);
        setIsTerminateOpen(true);
    };

    const handleConfirmTerminate = async () => {
        if (!memberToRemove) return;
        // memberToRemove.id may be userId or resourceId — find the resource
        const resource = projectResources.find(r => (r.userId ?? r.id) === memberToRemove.id);
        if (!resource) {
            showToast('Kunne ikke finde medlemmet i projektet.', 'error');
            setIsTerminateOpen(false);
            setMemberToRemove(null);
            return;
        }

        setIsTerminating(true);

        // Pending / email-only invitees have no linked user account. The
        // termination endpoint resolves the membership by user_id, so it cannot
        // act on them — delete the project_resources row directly instead. No
        // handover report applies to an invite that was never accepted.
        if (!resource.userId) {
            try {
                await removeProjectResource(resource.id);
                const resources = await getProjectResources(projectId);
                setProjectResources(resources);
                setResourcesLoaded(true);
                showToast(`${memberToRemove.name} er fjernet fra projektet.`, 'success');
            } catch {
                showToast('Deltageren kunne ikke fjernes. Prøv igen.', 'error');
            } finally {
                setIsTerminating(false);
                setIsTerminateOpen(false);
                setMemberToRemove(null);
            }
            return;
        }

        const result = await terminateProjectMember({
            projectId,
            removedUserId: resource.userId,
        });
        setIsTerminating(false);
        setIsTerminateOpen(false);

        if (result.ok) {
            const resources = await getProjectResources(projectId);
            setProjectResources(resources);
            setResourcesLoaded(true);
            // The endpoint treats report generation/upload as non-fatal and can
            // return ok with no downloadable URL. Surface that as secondary
            // feedback so the success modal does not overstate the outcome.
            if (!result.reportSignedUrl) {
                showToast('Medlemmet er fjernet, men overdragelsesrapporten kunne ikke genereres.', 'warning');
            }
            setTerminationResult(result);
        } else {
            showToast(result.error ?? 'Opsigelsen mislykkedes. Prøv igen.', 'error');
            setMemberToRemove(null);
        }
    };

    const handleLifecycleAction = async (action: 'close' | 'archive' | 'cancel' | 'reopen') => {
        try {
            if (action === 'close') await closeProject(projectId);
            else if (action === 'archive') await archiveProject(projectId);
            else if (action === 'cancel') await cancelProject(projectId);
            else if (action === 'reopen') await reopenProject(projectId);

            const labels: Record<string, string> = {
                close: 'Projektet er afsluttet.',
                archive: 'Projektet er arkiveret.',
                cancel: 'Projektet er annulleret.',
                reopen: 'Projektet er genåbnet.',
            };
            showToast(labels[action], 'success');
            onProjectStatusChange?.();
        } catch {
            showToast('Handlingen mislykkedes. Prøv igen.', 'error');
        }
        setConfirmAction(null);
    };

    const handleVisibilityChange = async (resourceId: string, visibility: ResourceVisibility) => {
        await updateProjectResource(resourceId, { visibility });
        const resources = await getProjectResources(projectId);
        setProjectResources(resources);
        showToast('Synlighed opdateret.', 'success');
    };

    // Determine permissions
    const currentMember = project.team.find(m => m.id === user?.id);
    const userRole = currentMember?.role || (user?.id === project.ownerId || (!project.ownerId && user?.id === 'user1') ? 'OWNER' : 'EMPLOYEE');
    const isOwner = userRole === 'OWNER';
    const canAddMembers = ['OWNER', 'MANAGER', 'EMPLOYEE', 'EXTERNAL'].includes(userRole);
    const canManageMembers = isOwner || userRole === 'MANAGER';

    const isProjectActive = !['Afsluttet', 'ARCHIVED', 'CANCELLED'].includes(project.status);
    // CANCELLED is a terminal state — only Afsluttet and ARCHIVED can be reopened.
    const canReopen = ['Afsluttet', 'ARCHIVED'].includes(project.status);

    // Group by kind — prefer project_resources; fall back to projects.team mirror
    // only until the first fetch completes. Once resourcesLoaded is true an empty
    // array is authoritative, so a just-terminated member is not repopulated.
    const staffResources = resourcesLoaded
        ? projectResources
            .filter(r => r.kind === 'staff')
            .map(r => ({
                id: r.userId ?? r.id,
                resourceId: r.id,
                name: r.name,
                initials: r.initials,
                role: r.visibility === 'all' ? 'MANAGER' : 'EMPLOYEE',
                status: r.status === 'active' ? 'ACTIVE' : 'PENDING',
                kind: 'staff' as ResourceKind,
                visibility: r.visibility,
            }))
        : project.team.filter(m => m.role !== 'EXTERNAL').map(m => ({ ...m, kind: 'staff' as ResourceKind, resourceId: undefined, visibility: undefined }));

    const partnerResources = resourcesLoaded
        ? projectResources
            .filter(r => r.kind === 'partner')
            .map(r => ({
                id: r.userId ?? r.id,
                resourceId: r.id,
                name: r.name,
                initials: r.initials,
                role: 'EXTERNAL',
                status: r.status === 'active' ? 'ACTIVE' : 'PENDING',
                kind: 'partner' as ResourceKind,
                visibility: r.visibility,
            }))
        : project.team.filter(m => m.role === 'EXTERNAL').map(m => ({ ...m, kind: 'partner' as ResourceKind, resourceId: undefined, visibility: undefined }));

    const internalTeam = staffResources;
    const externalTeam = partnerResources;

    const trendMeta = aiStats.trend === 'up'
        ? { variant: 'success' as BadgeVariant, label: 'Stigende' }
        : aiStats.trend === 'down'
            ? { variant: 'danger' as BadgeVariant, label: 'Faldende' }
            : { variant: 'neutral' as BadgeVariant, label: 'Stabil' };

    return (
        <div className="p-4 space-y-4 pb-24 relative min-h-[calc(100vh-200px)] animate-fade-in">

            {/* Header Card — title, status, progress + read-only meta rows */}
            <Card padding="none" className="overflow-hidden">
                <div className="p-4 sm:p-5">
                    <div className="flex justify-between items-start gap-3 mb-4">
                        <div className="min-w-0">
                            <h2 className="text-title text-text-primary dark:text-text-dark-primary truncate">{project.name}</h2>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">#{project.projectNumber}</p>
                        </div>
                        <StatusBadge status={project.status} />
                    </div>

                    {/* Progress */}
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Færdiggørelse</span>
                        <span className="text-caption font-semibold tabular-nums text-text-primary dark:text-text-dark-primary">{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress} label="Færdiggørelse" />
                </div>
                <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
                    <ListRow
                        leading={
                            <span className="flex w-10 h-10 items-center justify-center rounded-control bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary" aria-hidden="true">
                                <UserIcon className="w-5 h-5" />
                            </span>
                        }
                        title={project.clientName}
                        subtitle="Kunde"
                    />
                    <ListRow
                        leading={
                            <span className="flex w-10 h-10 items-center justify-center rounded-control bg-bg-muted text-text-secondary dark:bg-bg-dark-muted dark:text-text-dark-secondary" aria-hidden="true">
                                <MapPinIcon className="w-5 h-5" />
                            </span>
                        }
                        title={project.address}
                        subtitle="Adresse"
                    />
                </div>
            </Card>

            {/* AI Performance Index — the composite score is computed via
                computeBudgetUtilization, imported from the ai module barrel, so
                the whole card is gated on ai; the budget/quality sub-rows are
                additionally hidden on their own modules for when ai is entitled
                but budget/quality individually are not. */}
            <ModuleGate moduleId="ai" mode="hide">
            <Card padding="md">
                <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-brand-primary dark:text-brand-light" aria-hidden="true" /> Performance
                    </h3>
                    <Badge variant={trendMeta.variant} dot>{trendMeta.label}</Badge>
                </div>

                <div className="flex items-baseline gap-2">
                    <span className="text-display tabular-nums text-text-primary dark:text-text-dark-primary">
                        <AnimatedNumber value={performanceIndex} precision={0} />
                    </span>
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">/ 100</span>
                </div>
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1">{aiInsight}</p>

                {/* Sub-metrics */}
                <div className="mt-4 space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">Flow</span>
                            <span className="text-caption font-bold tabular-nums text-text-primary dark:text-text-dark-primary">{aiStats.velocity}%</span>
                        </div>
                        <ProgressBar value={aiStats.velocity} size="sm" tone="info" label="Flow" />
                    </div>
                    {budgetEnabled && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">Budget</span>
                                <span className="text-caption font-bold tabular-nums text-text-primary dark:text-text-dark-primary">{aiStats.budgetHealth}%</span>
                            </div>
                            <ProgressBar value={aiStats.budgetHealth} size="sm" tone="warning" label="Budget" />
                        </div>
                    )}
                    {qualityEnabled && (
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary">Kvalitet</span>
                                <span className="text-caption font-bold tabular-nums text-text-primary dark:text-text-dark-primary">{aiStats.quality}%</span>
                            </div>
                            <ProgressBar value={aiStats.quality} size="sm" tone="success" label="Kvalitet" />
                        </div>
                    )}
                </div>

                {/* Bottleneck */}
                <div className="mt-4 pt-3 border-t border-border dark:border-border-dark flex items-center gap-2 text-caption text-warning-strong dark:text-warning">
                    <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{aiBottleneck}</span>
                </div>
            </Card>
            </ModuleGate>

            {/* Team Management Dashboard */}
            <Card padding="md">
                <div className="flex justify-between items-center gap-3 mb-4">
                    <h3 className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" aria-hidden="true" /> Ressourcer
                    </h3>
                    {canAddMembers && (
                        <Button
                            size="sm"
                            disabled={!features.canInviteTeam}
                            iconLeft={features.canInviteTeam ? <PlusIcon className="w-3.5 h-3.5" /> : <LockIcon className="w-3.5 h-3.5" />}
                            onClick={() => setIsAddMemberOpen(true)}
                        >
                            Tilføj
                        </Button>
                    )}
                </div>

                <Gatekeeper
                    permission="canInviteTeam"
                    fallback={
                        <div className="p-4 rounded-card bg-bg-muted dark:bg-bg-dark-muted text-center">
                            <p className="text-label text-text-secondary dark:text-text-dark-secondary mb-2">Teamstyring kræver Pro</p>
                            <Button size="sm" onClick={() => upgradeTo('PRO')}>Opgrader</Button>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        {/* Internal Team */}
                        <div>
                            <h4 className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-2 pl-1">Interne</h4>
                            <div className="space-y-2">
                                {internalTeam.map(member => (
                                    <TeamMemberRow
                                        key={member.id}
                                        member={member}
                                        tasks={tasks}
                                        timeEntries={timeEntries}
                                        onManage={setManagingMember}
                                        canManage={canManageMembers}
                                        onVisibilityChange={handleVisibilityChange}
                                    />
                                ))}
                                {internalTeam.length === 0 && <p className="text-caption text-text-secondary dark:text-text-dark-secondary italic pl-1">Ingen interne medlemmer.</p>}
                            </div>
                        </div>

                        {/* Subcontractors */}
                        <div>
                            <h4 className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-2 pl-1">Underentreprenører</h4>
                            <div className="space-y-2">
                                {externalTeam.map(member => (
                                    <TeamMemberRow
                                        key={member.id}
                                        member={member}
                                        tasks={tasks}
                                        timeEntries={timeEntries}
                                        onManage={setManagingMember}
                                        canManage={canManageMembers}
                                        onVisibilityChange={handleVisibilityChange}
                                    />
                                ))}
                                {externalTeam.length === 0 && <p className="text-caption text-text-secondary dark:text-text-dark-secondary italic pl-1">Ingen underentreprenører tilknyttet.</p>}
                            </div>
                        </div>

                        {/* EXPLICIT ADD BUTTON - Shown if user is Owner, Manager, Employee or External */}
                        {canAddMembers && (
                            <button
                                type="button"
                                onClick={() => setIsAddMemberOpen(true)}
                                className="w-full min-h-12 py-3 mt-2 rounded-card border-2 border-dashed border-border-strong dark:border-border-dark-strong flex items-center justify-center gap-2 text-label font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted/50 transition-colors duration-150 group"
                            >
                                <span className="w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center group-hover:scale-110 transition-transform" aria-hidden="true">
                                    <PlusIcon className="w-4 h-4" />
                                </span>
                                Inviter deltager
                            </button>
                        )}
                    </div>
                </Gatekeeper>
            </Card>

            {/* Projektets livscyklus — owner only, danger zone */}
            {isOwner && (
                <Card padding="md" className="border-danger-border dark:border-danger/30">
                    <h3 className="text-caption font-bold uppercase tracking-wider text-danger-strong dark:text-danger mb-4">
                        Projektets livscyklus
                    </h3>
                    <div className="space-y-2">
                        {isProjectActive ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setConfirmAction('close')}
                                    className="w-full min-h-11 px-3 rounded-control border border-border dark:border-border-dark flex items-center gap-2 text-label font-medium text-text-primary dark:text-text-dark-primary hover:bg-success-subtle hover:border-success-border dark:hover:bg-success-subtle-dark transition-colors duration-150"
                                >
                                    <CheckCircleIcon className="w-4 h-4 text-success-strong dark:text-success shrink-0" aria-hidden="true" />
                                    Afslut projekt
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmAction('archive')}
                                    className="w-full min-h-11 px-3 rounded-control border border-border dark:border-border-dark flex items-center gap-2 text-label font-medium text-text-primary dark:text-text-dark-primary hover:bg-warning-subtle hover:border-warning-border dark:hover:bg-warning-subtle-dark transition-colors duration-150"
                                >
                                    <AlertTriangleIcon className="w-4 h-4 text-warning-strong dark:text-warning shrink-0" aria-hidden="true" />
                                    Arkivér projekt
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmAction('cancel')}
                                    className="w-full min-h-11 px-3 rounded-control border border-danger-border dark:border-danger/30 bg-danger-subtle dark:bg-danger-subtle-dark flex items-center gap-2 text-label font-medium text-danger-strong dark:text-danger hover:border-danger transition-colors duration-150"
                                >
                                    <AlertTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    Annuller projekt
                                </button>
                            </>
                        ) : canReopen ? (
                            <button
                                type="button"
                                onClick={() => setConfirmAction('reopen')}
                                className="w-full min-h-11 px-3 rounded-control border border-info-border dark:border-info/30 bg-info-subtle dark:bg-info-subtle-dark flex items-center gap-2 text-label font-medium text-info-strong dark:text-info hover:border-info transition-colors duration-150"
                            >
                                <TrendingUpIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                Genåbn projekt
                            </button>
                        ) : (
                            <p className="text-label text-text-secondary dark:text-text-dark-secondary italic p-3">
                                Annullerede projekter kan ikke genåbnes.
                            </p>
                        )}
                    </div>
                </Card>
            )}

            {/* Modals */}
            {isAddMemberOpen && <AddMemberModal onClose={() => setIsAddMemberOpen(false)} onAdd={handleAddMember} />}
            {managingMember && (
                <ManageMemberModal
                    member={managingMember}
                    onClose={() => setManagingMember(null)}
                    onRemove={handleRequestRemoveMember}
                    canTerminate={isOwner}
                />
            )}
            {isTerminateOpen && memberToRemove && (
                <TerminateCooperationModal
                    member={memberToRemove}
                    isTerminating={isTerminating}
                    onConfirm={handleConfirmTerminate}
                    onCancel={() => { setIsTerminateOpen(false); setMemberToRemove(null); }}
                />
            )}
            {terminationResult && memberToRemove && (
                <TerminationResultModal
                    member={memberToRemove}
                    result={terminationResult}
                    onClose={() => { setTerminationResult(null); setMemberToRemove(null); }}
                />
            )}

            {/* Lifecycle confirm dialogs */}
            <ConfirmDialog
                isOpen={confirmAction === 'close'}
                title="Afslut projekt"
                message="Er du sikker på, at du vil afslutte projektet? Status ændres til Afsluttet og tæller ikke som aktivt."
                confirmLabel="Afslut"
                onConfirm={() => handleLifecycleAction('close')}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction === 'archive'}
                title="Arkivér projekt"
                message="Projektet arkiveres og fjernes fra den aktive liste. Du kan genfinde det via filter."
                confirmLabel="Arkivér"
                onConfirm={() => handleLifecycleAction('archive')}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction === 'cancel'}
                title="Annuller projekt"
                message="Er du sikker? Projektet markeres som annulleret og kan ikke genåbnes igen."
                confirmLabel="Annuller projekt"
                danger
                onConfirm={() => handleLifecycleAction('cancel')}
                onCancel={() => setConfirmAction(null)}
            />
            <ConfirmDialog
                isOpen={confirmAction === 'reopen'}
                title="Genåbn projekt"
                message="Projektet sættes tilbage til 'I gang' og tæller igen som aktivt."
                confirmLabel="Genåbn"
                onConfirm={() => handleLifecycleAction('reopen')}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};
