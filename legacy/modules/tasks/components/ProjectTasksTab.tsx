
// ... imports remain the same
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Task, Project, TaskStatus, User, UserRole, ResourceVisibility } from '../../../types';
import { getTasksForProject, createTaskForProject, updateTask, deleteTask, archiveTask, restoreTask } from '../services/tasks';
import {
    PlusIcon, SearchIcon, CalendarIcon,
    CheckSquareIcon, PinIcon, UserIcon, GripVerticalIcon,
    FolderTreeIcon, ListIcon, ChevronRightIcon, CornerDownRightIcon,
    MoreVerticalIcon, TrashIcon, UsersIcon
} from '../../../components/icons';
import { TaskFormModal } from './TaskFormModal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { InvitePartnerModal } from '../../partners';
import { useModuleGate, ModuleGate } from '../../../core/entitlements/ModuleGate';
import {
    Alert,
    AvatarGroup,
    Badge,
    Button,
    Chip,
    EmptyState,
    FAB,
    Input,
    ProgressBar,
    SkeletonList,
    cn,
} from '../../../components/ui';
import { STATUS_VARIANT, statusLabel, formatDate, isOverdue } from './taskCards';

const MAX_LEVELS = 3;

// ... helper functions (parseStep, getLevel, sortTasks, normalizeHierarchy, StatusBadge) remain the same
const parseStep = (step: string | null | undefined) => (step || "").split('.').map(Number);
const getLevel = (step: string | null | undefined) => Math.max(0, (step || "").split('.').length - 1);

const sortTasks = (a: Task, b: Task) => {
  if (!a.step && !b.step) return a.title.localeCompare(b.title);
  if (!a.step) return 1;
  if (!b.step) return -1;
  const stepA = parseStep(a.step);
  const stepB = parseStep(b.step);
  const len = Math.max(stepA.length, stepB.length);
  for (let i = 0; i < len; i++) {
    const valA = stepA[i] || 0;
    const valB = stepB[i] || 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
};

const normalizeHierarchy = (tasks: Task[]): Task[] => {
  if (!tasks.length) return [];
  const counters = [0, 0, 0];
  const normalized: Task[] = [];
  let previousLevel = -1;

  tasks.forEach((task) => {
    let currentLevel = getLevel(task.step || "1");
    if (currentLevel > previousLevel + 1) currentLevel = previousLevel + 1;
    if (currentLevel >= MAX_LEVELS) currentLevel = MAX_LEVELS - 1;

    counters[currentLevel]++;
    for (let i = currentLevel + 1; i < MAX_LEVELS; i++) counters[i] = 0;

    const stepParts = [];
    for (let i = 0; i <= currentLevel; i++) stepParts.push(counters[i]);

    normalized.push({ ...task, step: stepParts.join('.') });
    previousLevel = currentLevel;
  });

  return normalized;
};

/** Read-only status pill — kit Badge with dot (unified task-card anatomy). */
const StatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => (
    <Badge variant={STATUS_VARIANT[status]} dot className="shrink-0">{statusLabel(status)}</Badge>
);

const isDueToday = (dateStr: string): boolean => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
};

/** Due-date badge: danger when overdue, "I dag" when due today, neutral date otherwise. */
const DueBadge: React.FC<{ dueDate: string; overdue: boolean }> = ({ dueDate, overdue }) => {
    if (overdue) return <Badge variant="danger" dot>{formatDate(dueDate)}</Badge>;
    if (isDueToday(dueDate)) return <Badge variant="info">I dag</Badge>;
    return <Badge>{formatDate(dueDate)}</Badge>;
};

// Status-coloured styling for the manager-only "Skift status" dropdown — mirrors StatusBadge's semantics.
const STATUS_SELECT_STYLES: Record<TaskStatus, string> = {
    'Igangværende': 'bg-info-subtle text-info-strong border-info-border dark:bg-info-subtle-dark dark:text-info dark:border-info/30',
    'Udført': 'bg-success-subtle text-success-strong border-success-border dark:bg-success-subtle-dark dark:text-success dark:border-success/30',
    'Forfalden': 'bg-danger-subtle text-danger-strong border-danger-border dark:bg-danger-subtle-dark dark:text-danger dark:border-danger/30',
    'To Do': 'bg-bg-muted text-text-secondary border-border dark:bg-bg-dark-muted dark:text-text-dark-secondary dark:border-border-dark',
    'Annulleret': 'bg-bg-muted text-text-tertiary border-border dark:bg-bg-dark-muted dark:text-text-dark-tertiary dark:border-border-dark',
};

// The "Skift status" dropdown only offers these four transitions. Statuses outside this
// set (e.g. legacy 'Annulleret' tasks) have no matching <option>, so we fall back to the
// read-only StatusBadge rather than render a select stuck on a blank/invalid value.
const EDITABLE_STATUSES: TaskStatus[] = ['To Do', 'Igangværende', 'Forfalden', 'Udført'];

/**
 * Manager-only per-card controls: a "Skift status" dropdown (mirrors the Deadlines tab)
 * and a 3-dot settings menu (Udeleger / Slet). Every handler stops propagation so the
 * card body's edit-modal onClick is never triggered.
 */
const TaskCardControls: React.FC<{
    task: Task;
    onStatusChange: (status: TaskStatus) => void;
    onDelegate: () => void;
    onRequestDelete: () => void;
    /** Whether the `partners` module is entitled — hides "Udeleger" when it isn't. */
    canDelegate: boolean;
}> = ({ task, onStatusChange, onDelegate, onRequestDelete, canDelegate }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Outside-click closes the menu — same pattern as QuickTaskCard.
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div className="flex items-center gap-1">
            {/* Skift status — same four options as the Deadlines tab. Statuses outside that
                set (e.g. legacy 'Annulleret' tasks) fall back to the read-only StatusBadge so
                managers always see a valid current status instead of a blank selector. */}
            {EDITABLE_STATUSES.includes(task.status) ? (
                <select
                    aria-label="Skift status"
                    value={task.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { e.stopPropagation(); onStatusChange(e.target.value as TaskStatus); }}
                    className={cn(
                        'text-caption font-semibold rounded-control border px-2 py-1.5 outline-none cursor-pointer',
                        'transition-colors duration-150 focus:ring-2 focus:ring-brand-primary',
                        STATUS_SELECT_STYLES[task.status] ?? STATUS_SELECT_STYLES['To Do'],
                    )}
                >
                    <option value="To Do">Ikke startet</option>
                    <option value="Igangværende">Igangværende</option>
                    <option value="Forfalden">Forfalden</option>
                    <option value="Udført">Udført</option>
                </select>
            ) : (
                <StatusBadge status={task.status} />
            )}

            {/* Settings (3-dot) menu */}
            <div ref={menuRef} className="relative">
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                    className="inline-flex w-11 h-11 -my-1.5 -mr-1.5 items-center justify-center rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-muted dark:text-text-dark-secondary dark:hover:text-text-dark-primary dark:hover:bg-bg-dark-muted transition-colors duration-150"
                    aria-label="Muligheder"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                >
                    <MoreVerticalIcon className="w-4 h-4" />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-10 z-30 min-w-[180px] overflow-hidden rounded-card border border-border bg-bg shadow-raised dark:border-border-dark dark:bg-bg-dark-surface animate-fade-in" role="menu">
                        {canDelegate && (
                            <button
                                type="button"
                                role="menuitem"
                                onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelegate(); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-label text-text-primary dark:text-text-dark-primary hover:bg-bg-muted dark:hover:bg-bg-dark-muted transition-colors duration-150"
                            >
                                <UsersIcon className="w-4 h-4 text-warning-strong dark:text-warning" />
                                Udeleger
                            </button>
                        )}
                        <button
                            type="button"
                            role="menuitem"
                            onClick={e => { e.stopPropagation(); setMenuOpen(false); onRequestDelete(); }}
                            className="w-full flex items-center gap-2.5 px-4 py-3 min-h-11 text-label text-danger-strong dark:text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150 border-t border-border dark:border-border-dark"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Slet
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ProjectTasksTab: React.FC<{ projectId: string; project: Project; user?: User | null; resourceVisibility?: ResourceVisibility; notifMap?: Record<string, number>; onTaskNotifRead?: (taskId: string) => void }> = ({ projectId, project, user, resourceVisibility, notifMap, onTaskNotifRead }) => {
  const partnersEnabled = useModuleGate('partners');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ type: 'add' | 'edit' | null; task?: Task }>({ type: null });
  const [search, setSearch] = useState('');
  const [isTreeView, setIsTreeView] = useState(true);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [delegateTaskId, setDelegateTaskId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Determine user role and permissions
  const currentUserRole: UserRole = useMemo(() => {
    if (!user) return 'EMPLOYEE'; // Safe fallback
    if (project.ownerId === user.id || (!project.ownerId && user.id === 'user1')) return 'OWNER';
    const member = project.team.find(m => m.id === user.id);
    return member?.role || 'EMPLOYEE';
  }, [project, user]);

  const canDelete = currentUserRole === 'OWNER' || currentUserRole === 'MANAGER';
  // External and Client cannot create new tasks
  const canCreate = currentUserRole === 'OWNER' || currentUserRole === 'MANAGER' || currentUserRole === 'EMPLOYEE';
  const canReorder = currentUserRole === 'OWNER' || currentUserRole === 'MANAGER';

  // Check if user can edit a specific task
  const canEditTask = (task: Task) => {
    if (currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') return true;
    if (currentUserRole === 'EMPLOYEE') return true;
    // External can only edit assigned tasks
    if (currentUserRole === 'EXTERNAL') return task.assignees.some(a => a.id === user?.id);
    return false; // Client cannot edit
  };

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const [data, archived] = await Promise.all([
        getTasksForProject(projectId, user?.id, false),
        getTasksForProject(projectId, user?.id, true).then(all => all.filter(t => t.archivedAt)),
    ]);
    setTasks(isTreeView ? normalizeHierarchy(data.sort(sortTasks)) : data);
    setArchivedTasks(archived);
    setLoading(false);
  }, [projectId, isTreeView, user?.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleStepChange = (id: string, newStepValue: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, step: newStepValue } : t));

  const handleStepBlur = async () => {
      if (!isTreeView) return;
      const sorted = [...tasks].sort(sortTasks);
      const normalized = normalizeHierarchy(sorted);
      setTasks(normalized);
      for(const t of normalized) { await updateTask(t); }
  };

  const changeLevel = async (index: number, direction: 'in' | 'out') => {
    if (!isTreeView) return;
    const _tasks = [...tasks];
    const task = _tasks[index];
    let newLevel = getLevel(task.step);
    if (direction === 'in') newLevel++; else newLevel--;
    if (newLevel < 0) newLevel = 0;
    if (newLevel >= MAX_LEVELS) newLevel = MAX_LEVELS - 1;

    const parts = new Array(newLevel + 1).fill(1);
    task.step = parts.join('.');

    const normalized = normalizeHierarchy(_tasks);
    setTasks(normalized);
    for(const t of normalized) { await updateTask(t); }
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnter = (e: React.DragEvent, index: number) => { dragOverItem.current = index; };

  const onDragEnd = async (e: React.DragEvent) => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const _tasks = [...tasks];
    const draggedItemContent = _tasks[dragItem.current];
    _tasks.splice(dragItem.current, 1);
    _tasks.splice(dragOverItem.current, 0, draggedItemContent);

    if (isTreeView) {
        const normalized = normalizeHierarchy(_tasks);
        setTasks(normalized);
        for(const t of normalized) { await updateTask(t); }
    } else {
        setTasks(_tasks);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSaveTask = async (payload: Omit<Task, 'id'>, id?: string) => {
    if (id) {
        const existingTask = tasks.find(t => t.id === id);
        if (existingTask) {
            await updateTask({ ...existingTask, ...payload });
            await fetchTasks();
        }
    } else {
         let nextStep = "1";
         if (tasks.length > 0) {
             const lastTask = tasks[tasks.length - 1];
             const parts = parseStep(lastTask.step);
             parts[parts.length - 1]++;
             nextStep = parts.join('.');
         }
         await createTaskForProject(projectId, { ...payload, step: nextStep });
         await fetchTasks();
    }
  };

  const handleDeleteTask = async (id: string) => {
      if (!canDelete) return;
      await deleteTask(id);
      setModalState({type: null});
      await fetchTasks();
  };

  // Per-card status change — optimistic local update, refetch on failure.
  const handleStatusChange = async (task: Task, status: TaskStatus) => {
      if (!canDelete || status === task.status) return;
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
      try {
          const ok = await updateTask({ ...task, status });
          if (!ok) await fetchTasks();
      } catch {
          await fetchTasks();
      }
  };

  // Per-card delete — triggered from the settings menu after ConfirmDialog confirmation.
  const handleConfirmDeleteTask = async () => {
      if (!canDelete || !confirmDeleteId) return;
      const id = confirmDeleteId;
      setConfirmDeleteId(null);
      await deleteTask(id);
      await fetchTasks();
  };

  const handleArchiveTask = async (id: string) => {
      await archiveTask(id);
      setModalState({ type: null });
      await fetchTasks();
  };

  const handleRestoreTask = async (id: string) => {
      await restoreTask(id);
      await fetchTasks();
  };

  const displayedTasks = useMemo(() => {
      const isRestricted = resourceVisibility && resourceVisibility !== 'all' && currentUserRole !== 'OWNER' && currentUserRole !== 'MANAGER';
      return tasks.filter(t => {
          const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase());
          const matchesAssignee = isRestricted
              ? t.assignees.some(a => a.id === user?.id)
              : showMyTasksOnly
                  ? t.assignees.some(a => a.id === user?.id)
                  : true;
          return matchesSearch && matchesAssignee;
      });
  }, [tasks, search, showMyTasksOnly, user?.id, resourceVisibility, currentUserRole]);

  const doneCount = useMemo(() => tasks.filter(t => t.status === 'Udført').length, [tasks]);
  const progressPct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="p-4 space-y-4 pb-24 relative min-h-[calc(100vh-200px)] animate-fade-in">
        {(currentUserRole === 'EXTERNAL' || (resourceVisibility && resourceVisibility !== 'all' && currentUserRole !== 'OWNER' && currentUserRole !== 'MANAGER')) && (
             <Alert variant="info">Viser kun opgaver, du er ansvarlig for.</Alert>
        )}

        {/* Search + filter chips */}
        <div className="space-y-3">
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none" />
                <Input
                    aria-label="Søg opgaver"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Søg opgaver…"
                    className="pl-10"
                />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-1 px-1">
                {/* My Tasks Toggle — hidden when user is already forced to see only own tasks */}
                {currentUserRole !== 'EXTERNAL' && (!resourceVisibility || resourceVisibility === 'all' || currentUserRole === 'OWNER' || currentUserRole === 'MANAGER') && (
                    <Chip
                        selected={showMyTasksOnly}
                        icon={<UserIcon className="w-4 h-4" />}
                        onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
                    >
                        Mine opgaver
                    </Chip>
                )}
                {/* Archived Toggle */}
                {canDelete && archivedTasks.length > 0 && (
                    <Chip
                        selected={showArchived}
                        count={archivedTasks.length}
                        icon={<CalendarIcon className="w-4 h-4" />}
                        onClick={() => setShowArchived(!showArchived)}
                    >
                        Arkiverede
                    </Chip>
                )}
                {/* Tree/list view toggle */}
                <Chip
                    selected={isTreeView}
                    icon={isTreeView ? <FolderTreeIcon className="w-4 h-4" /> : <ListIcon className="w-4 h-4" />}
                    onClick={() => { setIsTreeView(!isTreeView); fetchTasks(); }}
                >
                    Hierarki
                </Chip>
            </div>
        </div>

        {/* Progress summary */}
        {!loading && tasks.length > 0 && (
            <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-caption font-bold uppercase tracking-wider text-text-secondary dark:text-text-dark-secondary">Fremgang</span>
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{doneCount} af {tasks.length} udført</span>
                </div>
                <ProgressBar value={progressPct} size="sm" tone={progressPct === 100 ? 'success' : 'brand'} label="Opgave-fremgang" />
            </div>
        )}

        {/* Archived tasks section */}
        {showArchived && archivedTasks.length > 0 && (
            <section className="space-y-2 border-t border-dashed border-warning-border dark:border-warning/30 pt-3">
                <h4 className="text-caption font-bold uppercase tracking-wider text-warning-strong dark:text-warning px-1">Arkiverede opgaver</h4>
                {archivedTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-card border border-warning-border dark:border-warning/30 bg-warning-subtle dark:bg-warning-subtle-dark opacity-80">
                        <div className="flex-1 min-w-0">
                            <p className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary truncate line-through">{task.title}</p>
                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-1 flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3" /> {task.dueDate || '—'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => handleRestoreTask(task.id)}>
                                Gendan
                            </Button>
                            {canDelete && (
                                <button
                                    type="button"
                                    onClick={() => deleteTask(task.id).then(fetchTasks)}
                                    className="min-h-11 px-3 rounded-control text-label font-semibold text-danger-strong dark:text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
                                >
                                    Slet
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </section>
        )}

        {loading ? (
            <SkeletonList count={4} label="Indlæser opgaver…" />
        ) : (
            <div className="space-y-2">
                {displayedTasks.map((task, index) => {
                    const level = isTreeView ? getLevel(task.step) : 0;
                    const paddingLeft = `${level * 24}px`;
                    const editable = canEditTask(task);
                    const isAssignedToMe = task.assignees.some(a => a.id === user?.id);
                    const overdue = isOverdue(task);

                    return (
                        <div
                            key={task.id}
                            draggable={isTreeView && canReorder}
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragEnter={(e) => onDragEnter(e, index)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            className={cn(
                                'group relative rounded-card border border-border bg-bg p-3 shadow-card transition-all duration-150',
                                'dark:border-border-dark dark:bg-bg-dark-surface',
                                editable && 'hover:shadow-card-hover cursor-pointer',
                                isAssignedToMe && 'border-l-4 border-l-brand-primary',
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {isTreeView && canReorder && (
                                    <div className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary dark:text-text-dark-tertiary dark:hover:text-text-dark-secondary p-1">
                                        <GripVerticalIcon className="w-5 h-5" />
                                    </div>
                                )}
                                {isTreeView && (
                                    <div style={{ marginLeft: paddingLeft }} className="flex items-center transition-all duration-300">
                                        {level > 0 && <CornerDownRightIcon className="w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary mr-1 -ml-2" />}
                                        <input
                                            disabled={!canReorder}
                                            aria-label="Trin-nummer"
                                            value={task.step || ""}
                                            onChange={(e) => handleStepChange(task.id, e.target.value)}
                                            onBlur={handleStepBlur}
                                            className="w-12 bg-transparent border-b border-transparent focus:border-brand-primary outline-none text-label font-mono font-bold text-text-secondary dark:text-text-dark-secondary focus:text-brand-primary transition-colors text-center"
                                        />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0" onClick={() => { if (editable) { onTaskNotifRead?.(task.id); setModalState({ type: 'edit', task }); } }}>
                                    <div className="flex items-center gap-2 mb-1 min-w-0">
                                        {task.isMilestone && <PinIcon className="w-4 h-4 text-brand-primary shrink-0" />}
                                        <p className={cn(
                                            'text-label font-semibold truncate',
                                            task.status === 'Udført'
                                                ? 'line-through text-text-secondary dark:text-text-dark-secondary'
                                                : 'text-text-primary dark:text-text-dark-primary',
                                        )}>
                                            {task.title}
                                        </p>
                                        {notifMap?.[task.id] > 0 && (
                                            <span className="w-2 h-2 bg-danger rounded-full shrink-0" aria-hidden="true" />
                                        )}
                                        {currentUserRole === 'EXTERNAL' && isAssignedToMe && (
                                            <Badge variant="warning" className="shrink-0">Ekstern</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        {task.dueDate && <DueBadge dueDate={task.dueDate} overdue={overdue} />}
                                        {task.assignees.length > 0 && (
                                            <AvatarGroup people={task.assignees.map(a => ({ name: a.name }))} size="sm" max={3} />
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {canDelete ? (
                                        <TaskCardControls
                                            task={task}
                                            onStatusChange={status => handleStatusChange(task, status)}
                                            onDelegate={() => setDelegateTaskId(task.id)}
                                            onRequestDelete={() => setConfirmDeleteId(task.id)}
                                            canDelegate={partnersEnabled}
                                        />
                                    ) : (
                                        <StatusBadge status={task.status} />
                                    )}
                                    {isTreeView && canReorder && (
                                        <div className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                aria-label="Ryk niveau ud"
                                                onClick={() => changeLevel(index, 'out')}
                                                disabled={level === 0}
                                                className="inline-flex w-9 h-9 items-center justify-center rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary disabled:opacity-30 transition-colors"
                                            >
                                                <ChevronRightIcon className="w-4 h-4 rotate-180" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label="Ryk niveau ind"
                                                onClick={() => changeLevel(index, 'in')}
                                                disabled={level >= MAX_LEVELS - 1}
                                                className="inline-flex w-9 h-9 items-center justify-center rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted text-text-secondary dark:text-text-dark-secondary disabled:opacity-30 transition-colors"
                                            >
                                                <ChevronRightIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {displayedTasks.length === 0 && (
                    tasks.length === 0 && !search ? (
                        <EmptyState
                            icon={<CheckSquareIcon className="w-8 h-8" />}
                            title="Ingen opgaver endnu"
                            description="Opret den første opgave for at komme i gang med projektet."
                            action={canCreate ? (
                                <Button size="sm" iconLeft={<PlusIcon className="w-4 h-4" />} onClick={() => setModalState({ type: 'add' })}>
                                    Ny opgave
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        <EmptyState
                            icon={<SearchIcon className="w-8 h-8" />}
                            title="Ingen opgaver fundet"
                            description="Prøv at justere din søgning eller dine filtre."
                        />
                    )
                )}
            </div>
        )}

      {canCreate && (
        <FAB
            aria-label="Ny opgave"
            draggable
            icon={<PlusIcon className="w-6 h-6" />}
            onClick={() => setModalState({ type: 'add' })}
        />
      )}

      {(modalState.type === 'add' || modalState.type === 'edit') && (
        <TaskFormModal
            task={modalState.task}
            projectTeam={project.team}
            project={project}
            onClose={() => setModalState({ type: null })}
            onSave={handleSaveTask}
            onDelete={modalState.type === 'edit' && canDelete ? handleDeleteTask : undefined}
            onArchive={modalState.type === 'edit' && canDelete ? handleArchiveTask : undefined}
        />
      )}

      {/* Per-card delete confirmation (settings menu → Slet) */}
      <ConfirmDialog
          isOpen={!!confirmDeleteId}
          title="Slet opgave"
          message="Er du sikker på, at du vil slette denne opgave? Handlingen kan ikke fortrydes."
          confirmLabel="Slet"
          onConfirm={handleConfirmDeleteTask}
          onCancel={() => setConfirmDeleteId(null)}
          danger
      />

      {/* Per-card delegation (settings menu → Udeleger) — task pre-selected via initialTaskIds.
          The "Udeleger" trigger is already hidden when `partners` isn't entitled; this gate
          is defense-in-depth so the modal can never open through a stale delegateTaskId. */}
      <ModuleGate moduleId="partners" mode="hide">
          <InvitePartnerModal
              open={!!delegateTaskId}
              projectId={projectId}
              projectName={project.name}
              initialTaskIds={delegateTaskId ? [delegateTaskId] : []}
              onClose={() => setDelegateTaskId(null)}
          />
      </ModuleGate>
    </div>
  );
};
