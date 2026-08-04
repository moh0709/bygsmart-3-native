import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Task, TimeEntry, UserRole, ProjectBudgetSummary, ProjectBudgetRevision, ProjectBudgetCategory } from '../../../types';
import {
    getProjectBudgetSummary, createProjectBudgetBaseline, createProjectBudgetRevision,
    updateProjectLaborRate, getProjectBudgetRevisions,
    getTaskBudgetRates, updateTaskHourlyRate, BUDGET_CATEGORIES,
} from '../services/budget';
import { getTasksForProject } from '../../tasks';
import { getTimeEntriesForProject } from '../../time';
import { computeBudget, BudgetLineItem } from '../../tools';
import { useModuleGate, ModuleGate } from '../../../core/entitlements/ModuleGate';
import { useToast } from '../../../contexts/ToastContext';
import { PlusIcon, TrashIcon, ShoppingCartIcon, ClockIcon, UsersIcon, FileTextIcon, CheckIcon } from '../../../components/icons';
import {
    Alert, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Input, Modal, ProgressBar,
    Select, SkeletonList, StatCard, Textarea,
} from '../../../components/ui';
import type { ProgressTone } from '../../../components/ui';

const fmtKr = (n: number) => `${Math.round(n).toLocaleString('da-DK')} kr.`;

const CATEGORY_LABELS: Record<ProjectBudgetCategory, string> = {
    materials: 'Materialer',
    labor: 'Arbejdsløn',
    subcontractors: 'Underleverandører',
    other: 'Andet',
};

const CATEGORY_ICONS: Record<ProjectBudgetCategory, React.ReactNode> = {
    materials: <ShoppingCartIcon className="w-4 h-4" />,
    labor: <ClockIcon className="w-4 h-4" />,
    subcontractors: <UsersIcon className="w-4 h-4" />,
    other: <FileTextIcon className="w-4 h-4" />,
};

const utilizationTone = (ratio: number): ProgressTone => {
    if (ratio <= 0.9) return 'success';
    if (ratio <= 1.0) return 'warning';
    return 'danger';
};

/* ─────────── create baseline modal ─────────── */

interface DraftLine { id: string; name: string; type: 'material' | 'labor' | 'other'; amount: string; }

const CreateBudgetModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    projectId: string;
}> = ({ isOpen, onClose, onCreated, projectId }) => {
    const { showToast } = useToast();
    const toolsEnabled = useModuleGate('tools');
    const [lines, setLines] = useState<DraftLine[]>([{ id: '1', name: '', type: 'material', amount: '' }]);
    const [contingencyPct, setContingencyPct] = useState('10');
    const [overheadPct, setOverheadPct] = useState('0');
    const [includeVat, setIncludeVat] = useState(true);
    const [laborRate, setLaborRate] = useState('');
    const [saving, setSaving] = useState(false);

    const items: BudgetLineItem[] = lines
        .filter(l => l.name.trim() && parseFloat(l.amount) > 0)
        .map(l => ({ name: l.name, amount: parseFloat(l.amount) || 0, type: l.type }));

    // `tools` is an always-free foundation module (effectively always entitled) —
    // gated here for consistency with the rest of the app's cross-module pattern.
    const result = toolsEnabled
        ? computeBudget({
            items,
            contingencyPct: parseFloat(contingencyPct) || 0,
            overheadPct: parseFloat(overheadPct) || 0,
            includeVat,
        })
        : { materialTotal: 0, laborTotal: 0, otherTotal: 0, subtotal: 0, overhead: 0, contingency: 0, totalExVat: 0, vat: 0, total: 0 };

    const addLine = () => setLines(prev => [...prev, { id: `${Date.now()}`, name: '', type: 'material', amount: '' }]);
    const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));
    const updateLine = (id: string, patch: Partial<DraftLine>) =>
        setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

    const handleSave = async () => {
        if (items.length === 0) { showToast('Tilføj mindst én linje', 'error'); return; }
        setSaving(true);
        try {
            const other = result.otherTotal + result.overhead + result.contingency + result.vat;
            await createProjectBudgetBaseline(
                projectId,
                [
                    { category: 'materials', amountKr: result.materialTotal },
                    { category: 'labor', amountKr: result.laborTotal },
                    { category: 'subcontractors', amountKr: 0 },
                    {
                        category: 'other',
                        amountKr: other,
                        note: `Inkl. ${overheadPct}% overhead, ${contingencyPct}% buffer${includeVat ? ' og moms' : ''}`,
                    },
                ],
                laborRate ? parseFloat(laborRate) : undefined
            );
            showToast('Budget oprettet', 'success');
            onCreated();
            onClose();
        } catch {
            showToast('Kunne ikke oprette budget', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Opret budget"
            size="lg"
            footer={
                <Button fullWidth onClick={handleSave} loading={saving}>
                    Opret budget — {fmtKr(result.total)}
                </Button>
            }
        >
            <div className="space-y-4">
                <p className="text-body text-text-secondary dark:text-text-dark-secondary">
                    Tilføj de forventede omkostninger. Dette bliver projektets godkendte budgetbaseline — senere ændringer registreres som revisioner med en årsag.
                </p>

                <div className="space-y-3">
                    {lines.map(line => (
                        <div key={line.id} className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input
                                    label="Beskrivelse"
                                    value={line.name}
                                    onChange={e => updateLine(line.id, { name: e.target.value })}
                                    placeholder="F.eks. Tømrerarbejde"
                                />
                            </div>
                            <div className="w-32">
                                <Select
                                    label="Type"
                                    value={line.type}
                                    onChange={e => updateLine(line.id, { type: e.target.value as DraftLine['type'] })}
                                >
                                    <option value="material">Materiale</option>
                                    <option value="labor">Arbejde</option>
                                    <option value="other">Andet</option>
                                </Select>
                            </div>
                            <div className="w-28">
                                <Input
                                    label="Kr."
                                    type="number"
                                    inputMode="decimal"
                                    value={line.amount}
                                    onChange={e => updateLine(line.id, { amount: e.target.value })}
                                />
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => removeLine(line.id)} aria-label="Fjern linje">
                                <TrashIcon className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addLine} iconLeft={<PlusIcon className="w-4 h-4" />}>
                        Tilføj linje
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Input label="Buffer (%)" type="number" inputMode="decimal" value={contingencyPct} onChange={e => setContingencyPct(e.target.value)} />
                    <Input label="Overhead (%)" type="number" inputMode="decimal" value={overheadPct} onChange={e => setOverheadPct(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-label text-text-primary dark:text-text-dark-primary">
                    <input type="checkbox" checked={includeVat} onChange={e => setIncludeVat(e.target.checked)} className="rounded" />
                    Inkl. moms (25%)
                </label>
                <Input
                    label="Standard timepris (kr./time) — valgfri"
                    type="number"
                    inputMode="decimal"
                    value={laborRate}
                    onChange={e => setLaborRate(e.target.value)}
                    hint="Bruges til at omregne registrerede timer til arbejdsomkostning. Kan differentieres pr. opgave senere i budgettet."
                />

                <div className="rounded-card border border-border dark:border-border-dark p-3 space-y-1 text-label">
                    <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmtKr(result.subtotal)}</span></div>
                    {result.overhead > 0 && (
                        <div className="flex justify-between text-text-secondary dark:text-text-dark-secondary"><span>Overhead</span><span className="tabular-nums">{fmtKr(result.overhead)}</span></div>
                    )}
                    {result.contingency > 0 && (
                        <div className="flex justify-between text-text-secondary dark:text-text-dark-secondary"><span>Buffer</span><span className="tabular-nums">{fmtKr(result.contingency)}</span></div>
                    )}
                    {includeVat && (
                        <div className="flex justify-between text-text-secondary dark:text-text-dark-secondary"><span>Moms (25%)</span><span className="tabular-nums">{fmtKr(result.vat)}</span></div>
                    )}
                    <div className="flex justify-between font-semibold pt-1 border-t border-border dark:border-border-dark"><span>Total</span><span className="tabular-nums">{fmtKr(result.total)}</span></div>
                </div>
            </div>
        </Modal>
    );
};

/* ─────────── add revision modal ─────────── */

const AddRevisionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    projectId: string;
}> = ({ isOpen, onClose, onSaved, projectId }) => {
    const { showToast } = useToast();
    const [reason, setReason] = useState('');
    const [deltas, setDeltas] = useState<Record<ProjectBudgetCategory, string>>({
        materials: '', labor: '', subcontractors: '', other: '',
    });
    const [saving, setSaving] = useState(false);

    const totalDelta = BUDGET_CATEGORIES.reduce((sum, c) => sum + (parseFloat(deltas[c]) || 0), 0);

    const reset = () => {
        setReason('');
        setDeltas({ materials: '', labor: '', subcontractors: '', other: '' });
    };

    const handleSave = async () => {
        if (!reason.trim()) { showToast('Angiv en årsag', 'error'); return; }
        if (totalDelta === 0) { showToast('Angiv mindst én ændring', 'error'); return; }
        setSaving(true);
        try {
            await createProjectBudgetRevision(
                projectId,
                reason.trim(),
                BUDGET_CATEGORIES
                    .filter(c => parseFloat(deltas[c]))
                    .map(c => ({ category: c, deltaKr: parseFloat(deltas[c]) || 0 }))
            );
            showToast('Revision tilføjet', 'success');
            onSaved();
            onClose();
            reset();
        } catch {
            showToast('Kunne ikke gemme revision', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={() => { onClose(); reset(); }}
            title="Tilføj budgetrevision"
            size="md"
            footer={
                <Button fullWidth onClick={handleSave} loading={saving} disabled={!reason.trim() || totalDelta === 0}>
                    Gem revision ({totalDelta >= 0 ? '+' : ''}{fmtKr(totalDelta)})
                </Button>
            }
        >
            <div className="space-y-4">
                <Textarea
                    label="Årsag"
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="F.eks. Kunde har tilføjet ekstra rum til projektet"
                />
                <div className="grid grid-cols-2 gap-3">
                    {BUDGET_CATEGORIES.map(c => (
                        <Input
                            key={c}
                            label={`${CATEGORY_LABELS[c]} (+/- kr.)`}
                            type="number"
                            inputMode="decimal"
                            value={deltas[c]}
                            onChange={e => setDeltas(prev => ({ ...prev, [c]: e.target.value }))}
                        />
                    ))}
                </div>
            </div>
        </Modal>
    );
};

/* ─────────── main tab ─────────── */

export const BudgetTabContent: React.FC<{
    project: Project;
    projectId: string;
    userRole: UserRole;
}> = ({ project, projectId, userRole }) => {
    const { showToast } = useToast();
    // `tasks` is an always-free foundation module; `time` is a paid module —
    // when disabled, skip fetching time entries entirely (labor-cost-from-time
    // figures are hidden below instead of blocking the whole Budget tab).
    const tasksEnabled = useModuleGate('tasks');
    const timeEnabled = useModuleGate('time');
    const [summary, setSummary] = useState<ProjectBudgetSummary | null>(null);
    const [revisions, setRevisions] = useState<ProjectBudgetRevision[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
    const [taskRates, setTaskRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [rateDraft, setRateDraft] = useState('');
    const [savingRate, setSavingRate] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [taskRateDraft, setTaskRateDraft] = useState('');

    const canEdit = userRole === 'OWNER' || userRole === 'MANAGER';

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [s, t, te, rates] = await Promise.all([
            getProjectBudgetSummary(projectId),
            tasksEnabled ? getTasksForProject(projectId) : Promise.resolve([]),
            timeEnabled ? getTimeEntriesForProject(projectId) : Promise.resolve([]),
            getTaskBudgetRates(projectId),
        ]);
        setSummary(s);
        setTasks(t);
        setTimeEntries(te);
        setTaskRates(rates);
        setRateDraft(s?.laborRateDkkPerHour != null ? String(s.laborRateDkkPerHour) : '');
        setRevisions(s?.hasBaseline ? await getProjectBudgetRevisions(projectId) : []);
        setLoading(false);
    }, [projectId, tasksEnabled, timeEnabled]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const hoursByTask = useMemo(() => {
        const map: Record<string, number> = {};
        for (const te of timeEntries) {
            if (!te.taskId) continue;
            map[te.taskId] = (map[te.taskId] || 0) + te.hours;
        }
        return map;
    }, [timeEntries]);

    const tasksWithHours = useMemo(
        () => tasks.filter(t => (hoursByTask[t.id] || 0) > 0 || taskRates[t.id] != null),
        [tasks, hoursByTask, taskRates]
    );

    const handleSaveLaborRate = async () => {
        const rate = parseFloat(rateDraft);
        if (isNaN(rate) || rate < 0) { showToast('Angiv en gyldig timepris', 'error'); return; }
        setSavingRate(true);
        try {
            await updateProjectLaborRate(projectId, rate);
            showToast('Timepris opdateret', 'success');
            await fetchAll();
        } catch {
            showToast('Kunne ikke opdatere timepris', 'error');
        } finally {
            setSavingRate(false);
        }
    };

    const handleSaveTaskRate = async (taskId: string) => {
        const raw = taskRateDraft.trim();
        const rate = raw === '' ? null : parseFloat(raw);
        if (rate !== null && (isNaN(rate) || rate < 0)) { showToast('Angiv en gyldig timepris', 'error'); return; }
        try {
            await updateTaskHourlyRate(taskId, rate);
            setEditingTaskId(null);
            await fetchAll();
        } catch {
            showToast('Kunne ikke opdatere timepris', 'error');
        }
    };

    if (loading) {
        return <div className="p-4"><SkeletonList count={3} label="Indlæser budget…" /></div>;
    }

    if (!summary?.hasBaseline) {
        return (
            <div className="p-4">
                <EmptyState
                    icon={<ShoppingCartIcon />}
                    title="Intet budget endnu"
                    description={
                        canEdit
                            ? 'Opret et budget for at følge planlagte omkostninger op mod det faktiske forbrug.'
                            : 'Projektets budget er ikke oprettet endnu. Kontakt projektejeren.'
                    }
                    action={canEdit ? (
                        <Button onClick={() => setShowCreateModal(true)} iconLeft={<PlusIcon className="w-5 h-5" />}>
                            Opret budget
                        </Button>
                    ) : undefined}
                />
                {canEdit && (
                    <CreateBudgetModal
                        isOpen={showCreateModal}
                        onClose={() => setShowCreateModal(false)}
                        onCreated={fetchAll}
                        projectId={projectId}
                    />
                )}
            </div>
        );
    }

    const utilizationRatio = summary.plannedTotalKr > 0 ? summary.actualTotalKr / summary.plannedTotalKr : 0;

    return (
        <div className="p-4 space-y-4 pb-8">
            <div className="grid grid-cols-3 gap-3">
                <StatCard label="Budget" value={fmtKr(summary.plannedTotalKr)} />
                <StatCard label="Forbrugt" value={fmtKr(summary.actualTotalKr)} tone={utilizationTone(utilizationRatio)} />
                <StatCard label="Resterer" value={fmtKr(summary.remainingKr)} tone={summary.remainingKr < 0 ? 'danger' : 'default'} />
            </div>

            <Card>
                <CardHeader><CardTitle>Budget pr. kategori</CardTitle></CardHeader>
                <div className="space-y-4">
                    {BUDGET_CATEGORIES.map(cat => {
                        const planned = summary.plannedByCategory[cat];
                        const actual = cat === 'materials'
                            ? summary.actualPurchasesCommittedKr + summary.actualPurchasesReceivedKr
                            : cat === 'labor'
                                ? summary.actualLaborKr
                                : cat === 'subcontractors'
                                    ? summary.actualSubcontractorsKr
                                    : 0;
                        const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                        return (
                            <div key={cat}>
                                <div className="flex items-center justify-between text-label mb-1">
                                    <span className="flex items-center gap-1.5 font-medium text-text-primary dark:text-text-dark-primary">
                                        {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                                    </span>
                                    <span className="text-text-secondary dark:text-text-dark-secondary tabular-nums">
                                        {fmtKr(actual)} / {fmtKr(planned)}
                                    </span>
                                </div>
                                <ProgressBar value={pct} tone={utilizationTone(planned > 0 ? actual / planned : 0)} />
                                {cat === 'other' && (
                                    <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-1">
                                        Ingen automatisk datakilde for denne kategori.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                {summary.actualPurchasesForecastKr > 0 && (
                    <Alert variant="info" className="mt-4">
                        Inkl. afventende indkøb ({fmtKr(summary.actualPurchasesForecastKr)}) bliver det samlede forbrug {fmtKr(summary.forecastTotalKr)}.
                    </Alert>
                )}
            </Card>

            <Card>
                <CardHeader><CardTitle>Arbejdsomkostning</CardTitle></CardHeader>
                <div className="space-y-4">
                    {canEdit ? (
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Input
                                    label="Standard timepris (kr./time)"
                                    type="number"
                                    inputMode="decimal"
                                    value={rateDraft}
                                    onChange={e => setRateDraft(e.target.value)}
                                />
                            </div>
                            <Button onClick={handleSaveLaborRate} loading={savingRate}>Gem</Button>
                        </div>
                    ) : (
                        <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                            Standard timepris: {summary.laborRateDkkPerHour != null ? `${summary.laborRateDkkPerHour} kr./time` : 'Ikke angivet'}
                        </p>
                    )}

                    {/* Per-task hours/cost breakdown is derived from time entries — clearly
                        surface that it requires the Tid module instead of silently showing
                        0 timer for tasks that only have a rate override set. */}
                    <ModuleGate moduleId="time" mode="upsell">
                    {tasksWithHours.length > 0 && (
                        <div className="divide-y divide-border dark:divide-border-dark border-t border-border dark:border-border-dark">
                            {tasksWithHours.map(t => {
                                const hours = hoursByTask[t.id] || 0;
                                const rate = taskRates[t.id] ?? summary.laborRateDkkPerHour ?? 0;
                                const cost = hours * rate;
                                const isEditing = editingTaskId === t.id;
                                return (
                                    <div key={t.id} className="py-2.5 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-label font-medium text-text-primary dark:text-text-dark-primary truncate">{t.title}</p>
                                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{hours} timer · {fmtKr(cost)}</p>
                                        </div>
                                        {canEdit && (
                                            isEditing ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        className="w-24"
                                                        type="number"
                                                        inputMode="decimal"
                                                        placeholder="kr./t"
                                                        value={taskRateDraft}
                                                        onChange={e => setTaskRateDraft(e.target.value)}
                                                    />
                                                    <Button size="sm" onClick={() => handleSaveTaskRate(t.id)} aria-label="Gem sats">
                                                        <CheckIcon className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setEditingTaskId(t.id);
                                                        setTaskRateDraft(taskRates[t.id] != null ? String(taskRates[t.id]) : '');
                                                    }}
                                                >
                                                    {taskRates[t.id] != null ? `${taskRates[t.id]} kr./t` : 'Sæt sats'}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </ModuleGate>
                </div>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Revisionshistorik</CardTitle>
                    {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setShowRevisionModal(true)} iconLeft={<PlusIcon className="w-4 h-4" />}>
                            Tilføj revision
                        </Button>
                    )}
                </CardHeader>
                {revisions.length === 0 ? (
                    <p className="text-label text-text-secondary dark:text-text-dark-secondary">
                        Ingen ændringer registreret siden budgettet blev oprettet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {revisions.map(rev => {
                            const authorName = project.team.find(m => m.id === rev.createdBy)?.name;
                            return (
                                <div key={rev.id} className="rounded-card border border-border dark:border-border-dark p-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                            #{rev.revisionNumber} · {new Date(rev.createdAt).toLocaleDateString('da-DK')}
                                        </span>
                                        <Badge variant={rev.totalDeltaKr >= 0 ? 'warning' : 'success'}>
                                            {rev.totalDeltaKr >= 0 ? '+' : ''}{fmtKr(rev.totalDeltaKr)}
                                        </Badge>
                                    </div>
                                    <p className="text-label text-text-secondary dark:text-text-dark-secondary">{rev.reason}</p>
                                    {authorName && (
                                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mt-1">Af {authorName}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {canEdit && (
                <AddRevisionModal
                    isOpen={showRevisionModal}
                    onClose={() => setShowRevisionModal(false)}
                    onSaved={fetchAll}
                    projectId={projectId}
                />
            )}
        </div>
    );
};
