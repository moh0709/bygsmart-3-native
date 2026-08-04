
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    ClockIcon,
    PlayIcon,
    PauseIcon,
    ListIcon,
    PieChartIcon,
    TrendingUpIcon,
    CalendarClockIcon,
    UserIcon,
    FileTextIcon,
    AlertTriangleIcon,
    UsersIcon,
    DownloadIcon
} from '../../../components/icons';
import { getTasksForProject } from '../../tasks';
import { logTimeEntry, getTimeEntriesForProject } from '../services/timeEntries';
import { getProjectBudgetSummary, getTaskBudgetRates } from '../../budget';
import { exportTimeEntriesToExcel } from '../../reporting';
import { useModuleGate, ModuleGate } from '../../../core/entitlements/ModuleGate';
import type { Project, Task, TimeEntry, UserRole, ResourceVisibility } from '../../../types';
import { useAuth } from '../../../contexts/AuthProvider';
import { StandardTooltip } from '../../../components/ui/StandardTooltip';
import { useToast } from '../../../contexts/ToastContext';
import {
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    EmptyState,
    Input,
    ListRow,
    ProgressBar,
    SegmentedControl,
    Select,
    SkeletonList,
    StatCard,
    cn,
} from '../../../components/ui';

export interface TimerState {
    isRunning: boolean;
    isPaused: boolean;
    seconds: number;
    taskId: string;
    startedAt?: number;
    eightHourReminderSent?: boolean;
    start: (taskId?: string) => void;
    stop: () => void;
    pause: () => void;
    log: () => void;
}

interface TimeManagementTabContentProps {
    project: Project;
    projectId: string;
    timerState: TimerState;
    resourceVisibility?: ResourceVisibility;
}

type SubTab = 'dashboard' | 'log' | 'timeline' | 'history';

// da-DK number formatter for hours (11,5 — never "11.50")
const nfHours = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKr = (n: number) => `${Math.round(n).toLocaleString('da-DK')} kr.`;

// Helper for mock data
const generateMockLogs = (userId: string, userName: string, projectId: string): TimeEntry[] => {
    const entries: TimeEntry[] = [];
    const today = new Date();

    // Today
    entries.push({ id: 'm1', projectId, userId, userName, hours: 1.5, date: new Date().toISOString(), description: 'Møde med bygherre' });
    entries.push({ id: 'm2', projectId, userId, userName, hours: 2.0, date: new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString(), description: 'Gennemgang af tegninger' });

    // Yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    entries.push({ id: 'm3', projectId, userId, userName, hours: 4.0, date: yesterday.toISOString(), description: 'Opstart på byggeplads' });

    // 2 days ago
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);
    entries.push({ id: 'm4', projectId, userId, userName, hours: 3.5, date: dayBefore.toISOString(), description: 'Materialebestilling' });

    return entries;
};

const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Extracted Sub-Components ---

const Dashboard = React.memo(({ stats, userRole }: { stats: any, userRole: UserRole }) => {

    const showTeamStats = userRole === 'OWNER' || userRole === 'MANAGER';

    const sortedUserStats = Object.entries(stats.userStats).sort((a: any, b: any) => b[1] - a[1]);

    return (
    <div className="space-y-4 animate-fade-in">
        {/* Status banner */}
        <Alert
            variant={stats.alert.type === 'danger' ? 'danger' : stats.alert.type === 'warning' ? 'warning' : 'success'}
            title={showTeamStats ? 'Projektstatus' : 'Din status'}
            icon={<TrendingUpIcon className="w-5 h-5" />}
        >
            {stats.alert.msg}
        </Alert>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2.5">
            <div className="relative">
                <StatCard
                    value={`${nfHours.format(stats.totalLoggedHours)} t`}
                    label={stats.totalEstimatedHours > 0 ? `af ${nfHours.format(stats.totalEstimatedHours)} estimerede` : 'Timer registreret'}
                    tone="brand"
                    icon={<ClockIcon className="w-5 h-5" />}
                    className="w-full"
                />
                <div className="absolute top-2 right-2">
                    <StandardTooltip
                        title="Total Tid Brugt"
                        description="Den samlede mængde arbejdstid, der er registreret på dette projekt på tværs af alle opgaver og medarbejdere."
                        calculation="Summen af timer fra alle tidsregistreringer (både stopur og manuelle) på projektet."
                    />
                </div>
            </div>

            {showTeamStats ? (
                <div className="relative">
                    <StatCard
                        value={`${stats.progressPercent.toFixed(0)} %`}
                        label="Budget brugt"
                        tone={stats.progressPercent >= 80 ? 'warning' : 'info'}
                        icon={<PieChartIcon className="w-5 h-5" />}
                        className="w-full"
                    />
                    <div className="absolute top-2 right-2">
                        <StandardTooltip
                            title="Budget Burn Rate"
                            description="En indikator for, hvor meget af det planlagte tidsbudget der er opbrugt."
                            calculation="(Registrerede timer / Estimerede timer på alle opgaver) × 100%. Hvis over 100%, er budgettet overskredet."
                        />
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <StatCard
                        value={`${nfHours.format(stats.totalLoggedHours)} t`}
                        label="Dine timer i alt"
                        tone="info"
                        icon={<ClockIcon className="w-5 h-5" />}
                        className="w-full"
                    />
                    <div className="absolute top-2 right-2">
                        <StandardTooltip
                            title="Dine Personlige Timer"
                            description="Den tid du personligt har registreret på dette projekt."
                            calculation="Summen af tidsregistreringer, hvor din bruger-ID er tilknyttet."
                        />
                    </div>
                </div>
            )}

            <div className="relative">
                <StatCard
                    value={stats.overdueCount}
                    label="Overskredne deadlines"
                    tone={stats.overdueCount > 0 ? 'danger' : 'success'}
                    icon={<AlertTriangleIcon className="w-5 h-5" />}
                    className="w-full"
                />
                <div className="absolute top-2 right-2">
                    <StandardTooltip
                        title="Overskredne Deadlines"
                        description="Antal opgaver på projektet, der skulle have været færdige nu, men som stadig er åbne."
                        calculation="Antal opgaver hvor (Forfaldsdato < I dag) OG (Status ≠ 'Udført')."
                    />
                </div>
            </div>

            {showTeamStats && (
                <div className="relative">
                    <StatCard
                        value={stats.activeTeamCount}
                        label="Aktivt mandskab"
                        tone="info"
                        icon={<UsersIcon className="w-5 h-5" />}
                        className="w-full"
                    />
                    <div className="absolute top-2 right-2">
                        <StandardTooltip
                            title="Aktivt Mandskab"
                            description="Antal unikke medarbejdere, der har bidraget med timer til projektet."
                            calculation="Antal unikke bruger-profiler, der har mindst én tidsregistrering i projektets historik."
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Budget burn bar (managers) */}
        {showTeamStats && stats.totalEstimatedHours > 0 && (
            <Card padding="md">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Forbrug</span>
                    <span className="text-caption tabular-nums text-text-secondary dark:text-text-dark-secondary">{stats.progressPercent.toFixed(0)}%</span>
                </div>
                <ProgressBar
                    value={stats.progressPercent}
                    tone={stats.progressPercent >= 100 ? 'danger' : stats.progressPercent >= 80 ? 'warning' : 'brand'}
                    label="Tidsbudget-forbrug"
                />
                {stats.hasLaborRate && (
                    <p className="mt-2 text-caption text-text-secondary dark:text-text-dark-secondary">
                        Svarer til ca. {fmtKr(stats.totalLaborCostKr)} i arbejdsomkostning
                    </p>
                )}
            </Card>
        )}

        {/* Team effort */}
        {showTeamStats && (
            <Card padding="none" className="overflow-hidden">
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <UserIcon className="w-5 h-5 text-brand-primary" aria-hidden="true" />
                    <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Team-indsats</h3>
                </div>
                {sortedUserStats.length === 0 ? (
                    <p className="px-4 pb-4 text-label text-text-secondary dark:text-text-dark-secondary">Ingen tid registreret endnu.</p>
                ) : (
                    <div className="divide-y divide-border dark:divide-border-dark">
                        {sortedUserStats.map(([name, hours], idx) => (
                            <ListRow
                                key={name}
                                leading={<Avatar name={name} size="sm" />}
                                title={name}
                                trailing={
                                    <>
                                        {idx === 0 && <Badge variant="warning">Top</Badge>}
                                        <span className="text-label font-bold tabular-nums text-text-primary dark:text-text-dark-primary">
                                            {nfHours.format(hours as number)} t
                                        </span>
                                    </>
                                }
                            />
                        ))}
                    </div>
                )}
            </Card>
        )}
    </div>
)});

const TimeLogger = ({
    timerState,
    tasks,
    activeTasks,
    onManualLog
}: {
    timerState: TimerState,
    tasks: Task[],
    activeTasks: Task[],
    onManualLog: (hours: number, taskId: string, desc: string) => Promise<void>
}) => {
    const { isRunning, isPaused, seconds, taskId: currentTimerTaskId, start: startTimer, stop: stopTimer, pause: pauseTimer } = timerState;
    const [selectedTaskId, setSelectedTaskId] = useState<string>('');
    const [manualHours, setManualHours] = useState('1');
    const [manualTaskId, setManualTaskId] = useState('');
    const [manualDescription, setManualDescription] = useState('');

    const handleLogClick = async () => {
        await onManualLog(parseFloat(manualHours), manualTaskId, manualDescription);
        setManualHours('1');
        setManualDescription('');
    };

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Stopwatch Card */}
            <Card
                padding="lg"
                className={cn(
                    'transition-all duration-300',
                    isRunning && (isPaused
                        ? 'bg-warning-subtle border-warning-border dark:bg-warning-subtle-dark dark:border-warning/30'
                        : 'bg-success-subtle border-success-border dark:bg-success-subtle-dark dark:border-success/30')
                )}
            >
                <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4 flex items-center gap-2">
                    <ClockIcon className={cn(
                        'w-6 h-6',
                        isRunning && !isPaused
                            ? 'text-success-strong dark:text-success animate-pulse'
                            : 'text-text-secondary dark:text-text-dark-secondary'
                    )} aria-hidden="true" />
                    Stopur
                </h3>

                <div className="text-center mb-6">
                    <div className={cn(
                        'text-display font-mono tabular-nums tracking-wider',
                        isRunning
                            ? (isPaused ? 'text-warning-strong dark:text-warning' : 'text-success-strong dark:text-success')
                            : 'text-text-primary dark:text-text-dark-primary'
                    )}>
                        {formatTime(seconds)}
                    </div>
                    {isRunning && currentTimerTaskId === 'administration' && <p className="text-label font-semibold text-success-strong dark:text-success mt-2">Arbejder på: Administration</p>}
                    {isRunning && currentTimerTaskId && currentTimerTaskId !== 'administration' && <p className="text-label font-semibold text-success-strong dark:text-success mt-2">Arbejder på: {tasks.find(t => t.id === currentTimerTaskId)?.title}</p>}
                    {isRunning && !currentTimerTaskId && <p className="text-label font-semibold text-success-strong dark:text-success mt-2">Generelt projektarbejde</p>}
                    {isPaused && <p className="text-caption font-bold uppercase tracking-wider text-warning-strong dark:text-warning mt-1">Pauset</p>}
                </div>

                {!isRunning ? (
                    <div className="space-y-3">
                        <Select
                            aria-label="Vælg opgave til stopur"
                            value={selectedTaskId}
                            onChange={(e) => setSelectedTaskId(e.target.value)}
                        >
                            <option value="">Generelt (Projekt)</option>
                            {activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </Select>
                        <Button
                            fullWidth
                            iconLeft={<PlayIcon className="w-5 h-5" />}
                            onClick={() => startTimer(selectedTaskId)}
                        >
                            Start tid
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {isPaused ? (
                            <Button fullWidth iconLeft={<PlayIcon className="w-5 h-5" />} onClick={() => startTimer()}>
                                Genoptag
                            </Button>
                        ) : (
                            <Button fullWidth variant="secondary" iconLeft={<PauseIcon className="w-5 h-5" />} onClick={pauseTimer}>
                                Pause
                            </Button>
                        )}
                        <Button
                            fullWidth
                            variant="danger"
                            iconLeft={<span className="w-3 h-3 rounded-[2px] bg-current" aria-hidden="true" />}
                            onClick={stopTimer}
                        >
                            Stop
                        </Button>
                    </div>
                )}
            </Card>

            {/* Manual Entry Card */}
            <Card padding="lg">
                <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4 flex items-center gap-2">
                    <ListIcon className="w-5 h-5 text-text-secondary dark:text-text-dark-secondary" aria-hidden="true" />
                    Manuel registrering
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Timer"
                            type="number"
                            value={manualHours}
                            onChange={e => setManualHours(e.target.value)}
                        />
                        <Select
                            label="Opgave"
                            value={manualTaskId}
                            onChange={(e) => setManualTaskId(e.target.value)}
                        >
                            <option value="">Generelt...</option>
                            {activeTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </Select>
                    </div>
                    <Input
                        label="Beskrivelse"
                        type="text"
                        value={manualDescription}
                        onChange={e => setManualDescription(e.target.value)}
                        placeholder="Hvad har du lavet?"
                    />
                    <Button fullWidth variant="secondary" onClick={handleLogClick}>
                        Tilføj post
                    </Button>
                </div>
            </Card>
        </div>
    );
};

const LogsView = React.memo(({ groupedLogs, projectName }: { groupedLogs: Record<string, TimeEntry[]>; projectName?: string }) => {
    const { showToast } = useToast();
    const handleExportCSV = () => {
        // Flatten entries
        const allEntries = Object.values(groupedLogs).flat();
        if (allEntries.length === 0) {
            showToast("Ingen data at eksportere.", 'info');
            return;
        }

        // Create CSV Content
        const headers = ["Dato", "Bruger", "Timer", "Beskrivelse", "Opgave ID"];
        const rows = allEntries.map(e => [
            new Date(e.date).toLocaleDateString('da-DK'),
            e.userName,
            e.hours.toString().replace('.', ','),
            `"${e.description.replace(/"/g, '""')}"`,
            e.taskId || ''
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `timeregistrering_eksport_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportExcel = () => {
        const allEntries = Object.values(groupedLogs).flat();
        if (allEntries.length === 0) {
            showToast("Ingen data at eksportere.", 'info');
            return;
        }
        exportTimeEntriesToExcel(allEntries, projectName);
    };

    return (
    <div className="space-y-5 animate-fade-in pb-20">
        <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" iconLeft={<DownloadIcon className="w-4 h-4" />} onClick={handleExportCSV}>
                Eksporter CSV
            </Button>
            <ModuleGate moduleId="reporting" mode="hide">
                <Button size="sm" variant="outline" iconLeft={<DownloadIcon className="w-4 h-4" />} onClick={handleExportExcel}>
                    Eksporter Excel
                </Button>
            </ModuleGate>
        </div>

        {Object.entries(groupedLogs).map(([dateGroup, entries]) => (
            <section key={dateGroup} aria-label={dateGroup}>
                <h4 className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary px-1 mb-2">{dateGroup}</h4>
                <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                    {entries.map(entry => (
                        <ListRow
                            key={entry.id}
                            leading={<Avatar name={entry.userName} size="sm" />}
                            title={entry.description}
                            subtitle={
                                <>
                                    {entry.userName}
                                    {' · kl. '}
                                    {new Date(entry.date).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                                    {entry.taskId && ' · Opgave'}
                                </>
                            }
                            trailing={
                                <span className="text-label font-bold tabular-nums text-text-primary dark:text-text-dark-primary">
                                    {nfHours.format(entry.hours)} t
                                </span>
                            }
                        />
                    ))}
                </Card>
            </section>
        ))}
        {Object.keys(groupedLogs).length === 0 && (
            <Card padding="none">
                <EmptyState
                    icon={<FileTextIcon className="w-8 h-8" />}
                    title="Ingen tidsregistreringer"
                    description="Start stopuret eller tilføj en manuel post for at registrere tid på projektet."
                />
            </Card>
        )}
    </div>
)});

const Timeline = React.memo(({ tasks }: { tasks: Task[] }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Window: 7 days before today → 14 days after today (21 days total)
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 7);
    const daysToShow = 21;

    const visibleTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate);
        const start = new Date(due);
        start.setDate(start.getDate() - 7);
        const startOffsetDays = (start.getTime() - windowStart.getTime()) / (1000 * 3600 * 24);
        const widthPct = (7 / daysToShow) * 100;
        const leftPct = (startOffsetDays / daysToShow) * 100;
        return !(leftPct > 100 || (leftPct + widthPct) < 0);
    });

    return (
        <Card padding="md" className="animate-fade-in overflow-x-auto">
            <h3 className="text-heading text-text-primary dark:text-text-dark-primary mb-4 flex items-center gap-2">
                <CalendarClockIcon className="w-5 h-5 text-brand-primary" aria-hidden="true" />
                3-ugers tidslinje
            </h3>

            {visibleTasks.length === 0 ? (
                <EmptyState
                    icon={<CalendarClockIcon className="w-8 h-8" />}
                    title="Ingen opgaver i tidslinjen"
                    description="Ingen aktive opgaver med deadline i de næste 3 uger."
                />
            ) : (
                <div className="min-w-[640px]">
                    {/* Header Days */}
                    <div className="flex border-b border-border dark:border-border-dark pb-2 mb-2">
                        <div className="w-1/4 text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Opgave</div>
                        <div className="w-3/4 flex">
                            {Array.from({length: daysToShow}).map((_, i) => {
                                const d = new Date(windowStart);
                                d.setDate(d.getDate() + i);
                                const isToday = d.toDateString() === today.toDateString();
                                return (
                                    <div key={i} className={cn(
                                        'flex-1 text-center text-caption tabular-nums',
                                        isToday ? 'font-bold text-brand-primary' : 'text-text-secondary dark:text-text-dark-secondary',
                                        (d.getDay() === 0 || d.getDay() === 6) && 'bg-bg-subtle dark:bg-bg-dark-muted'
                                    )}>
                                        {d.getDate()}/{d.getMonth()+1}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tasks Rows */}
                    {visibleTasks.map(task => {
                        const due = new Date(task.dueDate!);
                        const start = new Date(due);
                        start.setDate(start.getDate() - 7);

                        const startOffsetDays = (start.getTime() - windowStart.getTime()) / (1000 * 3600 * 24);
                        const durationDays = 7;

                        const leftPct = (startOffsetDays / daysToShow) * 100;
                        const rawWidthPct = (durationDays / daysToShow) * 100;
                        const clampedLeft = Math.max(0, leftPct);
                        const clampedWidth = Math.max(3, Math.min(100 - clampedLeft, rawWidthPct));

                        const isDone = task.status === 'Udført';
                        const isOverdue = task.status === 'Forfalden';
                        const barClass = isDone
                            ? 'bg-success text-white'
                            : isOverdue
                            ? 'bg-danger text-white'
                            : 'bg-brand-primary text-white';

                        return (
                            <div key={task.id} className="flex items-center py-2 border-b border-border dark:border-border-dark last:border-0">
                                <div className="w-1/4 pr-2 truncate text-label font-semibold text-text-primary dark:text-text-dark-primary" title={task.title}>{task.title}</div>
                                <div className="w-3/4 relative h-6 bg-bg-muted dark:bg-bg-dark-muted rounded-full overflow-hidden">
                                    <div
                                        className={cn('absolute top-1 bottom-1 rounded-full text-caption font-semibold flex items-center px-2 whitespace-nowrap', barClass)}
                                        style={{ left: `${clampedLeft}%`, width: `${clampedWidth}%` }}
                                    >
                                        {task.status}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
});


// --- Main Component ---

const TimeManagementTabContent: React.FC<TimeManagementTabContentProps> = ({ project, projectId, timerState, resourceVisibility }) => {
    const { user } = useAuth();
    // `tasks` is an always-free foundation module; gated here for consistency.
    // `budget` is a paid module — the audit found getProjectBudgetSummary/
    // getTaskBudgetRates were gated only by user role, not module entitlement;
    // the module check is added alongside (not instead of) that role check.
    const tasksEnabled = useModuleGate('tasks');
    const budgetEnabled = useModuleGate('budget');
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('dashboard');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [laborRateDkk, setLaborRateDkk] = useState<number | null>(null);
    const [taskRates, setTaskRates] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const isOwnerOrManager = project.ownerId === user?.id ||
                project.team.find(m => m.id === user?.id)?.role === 'MANAGER';
            // `canSeeBudget` also controls whether the user sees teammates' time
            // entries (restrictedUserId below) — that resource-visibility check
            // is independent of the `budget` module, so only the budget data
            // fetches themselves are additionally gated on budgetEnabled.
            const canSeeBudget = isOwnerOrManager || resourceVisibility === 'all';
            const restrictedUserId = canSeeBudget
                ? undefined
                : user?.id;
            const canFetchBudgetData = canSeeBudget && budgetEnabled;

            const [fetchedTasks, fetchedEntries, budgetSummary, rates] = await Promise.all([
                tasksEnabled ? getTasksForProject(projectId, user?.id) : Promise.resolve([]),
                getTimeEntriesForProject(projectId, restrictedUserId),
                canFetchBudgetData ? getProjectBudgetSummary(projectId) : Promise.resolve(null),
                canFetchBudgetData ? getTaskBudgetRates(projectId) : Promise.resolve({}),
            ]);
            setTasks(fetchedTasks);
            setLaborRateDkk(budgetSummary?.laborRateDkkPerHour ?? null);
            setTaskRates(rates);

            // Only seed mock data if user is OWNER and there are no entries,
            // otherwise rely on real filtered entries from API.
            if (fetchedEntries.length === 0 && user && (project.ownerId === user.id || (!project.ownerId && user.id === 'user1'))) {
                setTimeEntries(generateMockLogs(user.id, user.name, projectId));
            } else {
                setTimeEntries(fetchedEntries);
            }

            setLoading(false);
        };
        fetchData();
    }, [projectId, user, project.ownerId, resourceVisibility, tasksEnabled, budgetEnabled]);

    const handleManualLog = useCallback(async (hours: number, taskId: string, description: string) => {
        if (hours > 0 && user) {
            const newEntry: Omit<TimeEntry, 'id'> = {
                projectId,
                taskId: taskId || undefined,
                userId: user.id,
                userName: user.name,
                hours: hours,
                date: new Date().toISOString(),
                description: description || 'Manuel registrering'
            };
            const savedEntry = await logTimeEntry(newEntry);
            setTimeEntries(prev => [savedEntry, ...prev]);
        }
    }, [projectId, user]);

    // --- Statistics Calculation ---
    const stats = useMemo(() => {
        const totalLoggedHours = timeEntries.reduce((sum, e) => sum + e.hours, 0);

        // Calculate estimated total from tasks
        const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);

        // User breakdown
        const userStats: Record<string, number> = {};
        timeEntries.forEach(e => {
            userStats[e.userName] = (userStats[e.userName] || 0) + e.hours;
        });

        // Progress & Burn Rate
        const effectiveEstimate = totalEstimatedHours > 0 ? totalEstimatedHours : (totalLoggedHours > 0 ? totalLoggedHours * 1.5 : 10);
        const progressPercent = Math.min((totalLoggedHours / effectiveEstimate) * 100, 100);

        // Task Completion vs Time Used
        const completedTasks = tasks.filter(t => t.status === 'Udført').length;
        const totalTasks = tasks.length;
        const taskCompletionPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // NEW: Overdue Deadlines
        const now = new Date();
        now.setHours(0,0,0,0);

        // We prioritize Project End Date status first, then overdue tasks
        const projectEndDate = new Date(project.endDate);
        const isProjectOverdue = projectEndDate < now && project.progress < 100;

        const overdueCount = tasks.filter(t => {
            if (!t.dueDate || t.status === 'Udført') return false;
            const due = new Date(t.dueDate);
            return due < now;
        }).length;

        // NEW: Active Workforce (Unique users who have logged time)
        const activeTeamCount = Object.keys(userStats).length;

        // Labor cost: each entry priced at its task's rate override, falling
        // back to the project's default rate (services/api.ts getTaskBudgetRates
        // / getProjectBudgetSummary — same resolution as the get_project_budget_summary RPC).
        const hasLaborRate = laborRateDkk != null;
        const totalLaborCostKr = timeEntries.reduce((sum, e) => {
            const rate = (e.taskId ? taskRates[e.taskId] : undefined) ?? laborRateDkk ?? 0;
            return sum + e.hours * rate;
        }, 0);

        // Smart Alert Logic
        let alert = { type: 'success', msg: 'Projektet kører efter planen.' };

        if (isProjectOverdue) {
             alert = {
                type: 'danger',
                msg: `Projektets deadline (${projectEndDate.toLocaleDateString()}) er overskredet!`
            };
        } else if (overdueCount > 0) {
            alert = {
                type: 'warning',
                msg: `${overdueCount} opgave${overdueCount > 1 ? 'r' : ''} har overskredet deadline.`
            };
        } else if (totalEstimatedHours > 0) {
            if (totalLoggedHours > totalEstimatedHours) {
                alert = { type: 'danger', msg: `Tidsbudget overskredet med ${(totalLoggedHours - totalEstimatedHours).toFixed(1)} timer!` };
            } else if (totalLoggedHours / totalEstimatedHours > 0.8 && taskCompletionPercent < 50) {
                alert = { type: 'warning', msg: 'Højt tidsforbrug ift. færdiggørelse. Risiko for overskridelse.' };
            }
        }

        return {
            totalLoggedHours,
            totalEstimatedHours,
            userStats,
            progressPercent,
            taskCompletionPercent,
            overdueCount,
            activeTeamCount,
            hasLaborRate,
            totalLaborCostKr,
            alert
        };
    }, [timeEntries, tasks, project.endDate, project.progress, laborRateDkk, taskRates]);

    const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'Udført'), [tasks]);

    // --- Grouped Logs Helper ---
    const groupedLogs = useMemo(() => {
        const groups: Record<string, TimeEntry[]> = {};
        const today = new Date().toDateString();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        timeEntries.forEach(entry => {
            const d = new Date(entry.date).toDateString();
            let key = d;
            if (d === today) key = "I dag";
            else if (d === yesterdayStr) key = "I går";
            else key = new Date(entry.date).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' });

            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        });
        return groups;
    }, [timeEntries]);

    // Determine User Role for View Logic
    const userRole: UserRole = useMemo(() => {
        if (!user) return 'EMPLOYEE';
        if (project.ownerId === user.id || (!project.ownerId && user.id === 'user1')) return 'OWNER';
        const member = project.team.find(m => m.id === user.id);
        return member?.role || 'EMPLOYEE';
    }, [project, user]);

    return (
        <div className="p-4 pb-24 min-h-[calc(100vh-200px)] bg-bg-subtle dark:bg-bg-dark space-y-4">
            <SegmentedControl<SubTab>
                label="Skift tidsvisning"
                value={activeSubTab}
                onChange={setActiveSubTab}
                options={[
                    { label: 'Oversigt', value: 'dashboard', icon: <PieChartIcon className="w-4 h-4" /> },
                    { label: 'Registrer', value: 'log', icon: <ClockIcon className="w-4 h-4" /> },
                    { label: 'Tidslinje', value: 'timeline', icon: <ListIcon className="w-4 h-4" /> },
                    { label: 'Logs', value: 'history', icon: <FileTextIcon className="w-4 h-4" /> },
                ]}
            />

            {loading ? (
                <SkeletonList count={3} label="Indlæser tidsdata…" />
            ) : (
                <>
                    {activeSubTab === 'dashboard' && <Dashboard stats={stats} userRole={userRole} />}
                    {activeSubTab === 'log' && (
                        <TimeLogger
                            timerState={timerState}
                            tasks={tasks}
                            activeTasks={activeTasks}
                            onManualLog={handleManualLog}
                        />
                    )}
                    {activeSubTab === 'timeline' && <Timeline tasks={tasks} />}
                    {activeSubTab === 'history' && <LogsView groupedLogs={groupedLogs} projectName={project.name} />}
                </>
            )}
        </div>
    );
};

export default TimeManagementTabContent;
