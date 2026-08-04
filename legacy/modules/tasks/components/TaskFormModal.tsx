
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { Task, ChecklistItem, TaskStatus, TaskPriority, Project, User, Comment } from '../../../types';
import { XIcon, FileTextIcon, ClipboardListIcon, LayersIcon, CalendarIcon, PaperclipIcon, UsersIcon, PlusIcon, SparklesIcon, UserIcon, CalculatorIcon, ClockIcon, CheckCircleIcon, MessageSquareIcon } from '../../../components/icons';
import type { CalculatorPickerResult } from '../../tools';
import { Badge, Button, Input, Modal, Select, Textarea, cn } from '../../../components/ui';
import { findRelevantRegulationsForTask, searchRegulationsWithAI, optimizeTaskWithAI, generateChecklistFromDescription, AISuggestedRegulation, QuotaExceededError } from '../../ai';
import { Link } from 'react-router-dom';
import FilePicker from '../../../components/FilePicker';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

// Chat lives in modules/field, which depends on THIS module (field
// requires:['tasks']) — load its pieces lazily so tasks never statically
// imports field (no module cycle, and the chat stack stays out of this chunk).
const TaskChatTab = lazy(() => import('../../field').then((m) => ({ default: m.TaskChatTab })));
const TaskChatUnreadBadge = lazy(() => import('../../field').then((m) => ({ default: m.TaskChatUnreadBadge })));
// modules/tools reaches back into tasks/quality/documents dynamically (calculator
// "save to project", picker) while these were statically importing modules/tools —
// a static cycle Rollup collapsed into one chunk (all 90 calculator pages + this
// modal's own code), which crashed /project-detail in prod ("TypeError: n is not
// a function"). Load both lazily, same rule as the chat stack above.
const CalculatorPickerModal = lazy(() => import('../../tools').then((m) => ({ default: m.CalculatorPickerModal })));
const TaskQualityControlTab = lazy(() => import('../../quality').then((m) => ({ default: m.TaskQualityControlTab })));
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { getUserConnections } from '../../../services/api';
import { AssigneeProfileModal } from './AssigneeProfileModal';
import { buildTaskSaveResult } from './taskFormPayload';

interface TaskFormModalProps {
  task?: Task;
  projectTeam: Project['team'];
  project?: Project;
  onClose: () => void;
  onSave: (payload: Omit<Task, 'id'>, id?: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ task, projectTeam, project, onClose, onSave, onDelete, onArchive }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const toolsEnabled = useModuleGate('tools');
  const qualityEnabled = useModuleGate('quality');
  const aiEnabled = useModuleGate('ai');
  const [activeTab, setActiveTab] = useState<'beskrivelse' | 'reglementer' | 'deadlines' | 'filer' | 'team' | 'tjekliste' | 'tidslinje' | 'kvalitetssikring' | 'chat'>('beskrivelse');
  const [title, setTitle] = useState(task?.title || '');
  const [desc, setDesc] = useState(task?.description || '');
  const [due, setDue] = useState(task?.dueDate || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'To Do');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Mellem');
  const [linkText, setLinkText] = useState(task?.relatedLink?.text || '');
  const [linkUrl, setLinkUrl] = useState(task?.relatedLink?.url || '');
  const [attachments, setAttachments] = useState<Task['attachments']>(task?.attachments || []);
  const [isMilestone, setIsMilestone] = useState(task?.isMilestone || false);
  const [assignees, setAssignees] = useState<Task['assignees']>(task?.assignees || []);
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours?.toString() || '0');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist || []);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [showCalcPicker, setShowCalcPicker] = useState(false);

  const tabBarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const hasDragged = useRef(false);

  const handleTabBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tabBarRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    dragScrollLeft.current = tabBarRef.current.scrollLeft;
    tabBarRef.current.style.cursor = 'grabbing';
    tabBarRef.current.style.userSelect = 'none';
  };

  const handleTabBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !tabBarRef.current) return;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) > 5) hasDragged.current = true;
    tabBarRef.current.scrollLeft = dragScrollLeft.current - delta;
    e.preventDefault();
  };

  const handleTabBarMouseUp = () => {
    isDragging.current = false;
    if (tabBarRef.current) {
      tabBarRef.current.style.cursor = 'grab';
      tabBarRef.current.style.userSelect = '';
    }
  };

  const handleTabBarMouseLeave = () => {
    isDragging.current = false;
    if (tabBarRef.current) {
      tabBarRef.current.style.cursor = 'grab';
      tabBarRef.current.style.userSelect = '';
    }
  };

  // Assignee profile modal
  const [selectedAssigneeForProfile, setSelectedAssigneeForProfile] = useState<Task['assignees'][0] | null>(null);

  // Assignee change state
  const [isChangingAssignee, setIsChangingAssignee] = useState(false);
  const [networkConnections, setNetworkConnections] = useState<User[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  const handleCalculatorResult = (res: CalculatorPickerResult) => {
    const labelMap: Record<string, string> = {
      areaL: 'Længde', areaW: 'Bredde', tileL: 'Flise L', tileW: 'Flise B',
      grout: 'Fuge', wastage: 'Spild', width: 'Bredde', height: 'Højde', length: 'Længde',
    };
    const inputsLine = Object.entries(res.inputs)
      .map(([key, value]) => `${labelMap[key] ?? key}: ${value}`)
      .join('  |  ');
    const provenance = `📐 ${res.calculatorName}\n${inputsLine}\n→ Resultat: ${res.result.toLocaleString('da-DK')} ${res.unit}`;
    setDesc(prev => (prev.trim() ? `${prev.trimEnd()}\n\n${provenance}` : provenance));
    showToast(`Resultat indsat: ${res.result.toLocaleString('da-DK')} ${res.unit}`, 'success');
  };

  const handleOptimizeTask = async () => {
    setIsOptimizing(true);
    try {
      const res = await optimizeTaskWithAI(title, desc);
      setTitle(res.newTitle);
      setDesc(res.newDescription);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
      } else {
        console.error('Optimization failed:', error);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateChecklist = async () => {
    setIsGeneratingChecklist(true);
    try {
      const items = await generateChecklistFromDescription(title, desc);
      setChecklist(prev => {
        const existingTexts = new Set(prev.map(c => c.text.toLowerCase()));
        const fresh = items.filter(i => !existingTexts.has(i.text.toLowerCase()));
        return [...prev, ...fresh];
      });
      showToast('Tjekliste genereret', 'success');
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
      } else {
        showToast('Kunne ikke generere tjekliste', 'error');
      }
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  const [suggestedRegulations, setSuggestedRegulations] = useState<AISuggestedRegulation[]>(
    task?.suggestedRegulations?.map(r => ({ ...r, description: 'Gemt med opgaven.' })) || []
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [regulationSearchTerm, setRegulationSearchTerm] = useState('');
  const [isSearchingRegulations, setIsSearchingRegulations] = useState(false);
  const [searchedRegulations, setSearchedRegulations] = useState<AISuggestedRegulation[]>([]);
  const [lastScanTs, setLastScanTs] = useState<number>(() => {
    if (!task?.id) return 0;
    const stored = localStorage.getItem('bygRegScan_' + task.id);
    return stored ? parseInt(stored, 10) : 0;
  });

  const handleAiRegulationScan = async () => {
    setIsAiLoading(true);
    try {
      const suggestions = await findRelevantRegulationsForTask(title, desc);
      if (suggestions.length > 0) {
        setSuggestedRegulations(prev => [
          ...prev,
          ...suggestions.filter(s => !prev.some(p => p.id === s.id)),
        ]);
      }
      if (task?.id) {
        const ts = Date.now();
        localStorage.setItem('bygRegScan_' + task.id, ts.toString());
        setLastScanTs(ts);
      }
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        showToast('Du har nået din daglige AI-grænse. Opgrader for mere.', 'warning');
      } else {
        showToast('AI-scanning fejlede. Prøv igen.', 'error');
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const isOwner = useMemo(() => {
    if (!user) return false;
    if (user.id === task?.ownerId) return true;
    return projectTeam.find(m => m.id === user.id)?.role === 'OWNER';
  }, [user, task?.ownerId, projectTeam]);

  // Can this user assign tasks?
  const canAssign = useMemo(() => {
    if (!user) return false;
    if (user.appRole === 'admin' || user.teamRole === 'leader') return true;
    const currentUser = projectTeam.find(m => m.id === user.id);
    return currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER' || user.id === 'user1';
  }, [user, projectTeam]);

  // Fetch network connections when "Skift" edit mode is opened
  const openAssigneeEditor = useCallback(async () => {
    setIsChangingAssignee(true);
    if (!user || networkConnections.length > 0) return;
    setIsLoadingConnections(true);
    try {
      const conns = await getUserConnections(user.id);
      setNetworkConnections(conns);
    } catch {
      // silently ignore — projectTeam still shown
    } finally {
      setIsLoadingConnections(false);
    }
  }, [user, networkConnections.length]);

  // Merged list: project team + network connections (deduped by id)
  const selectableMembers = useMemo(() => {
    const seen = new Set(projectTeam.map(m => m.id));
    const extras = networkConnections.filter(c => !seen.has(c.id)).map(c => ({
      id: c.id,
      name: c.name,
      initials: c.initials || c.name.slice(0, 2).toUpperCase(),
      role: 'MANAGER' as const,
    }));
    return [...projectTeam, ...extras];
  }, [projectTeam, networkConnections]);

  const handleSave = () => {
    const payload = buildTaskSaveResult({
      task, user, title, desc, due, status, priority, isMilestone, estimatedHours,
      linkText, linkUrl, assignees, suggestedRegulations, attachments, checklist,
      nowMs: Date.now(), nowIso: new Date().toISOString(),
    });
    onSave(payload, task?.id);
    onClose();
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachments(prev => [...(prev || []), {
        url: ev.target?.result as string,
        type: file.type.startsWith('image/') ? 'image' : 'pdf',
        name: file.name,
      }]);
    };
    reader.readAsDataURL(file);
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItemText.trim()) return;
    setChecklist(prev => [...prev, { id: Date.now().toString(), text: newChecklistItemText, checked: false, ruleId: '', ruleRef: '' }]);
    setNewChecklistItemText('');
  };

  const handleSearchRegulations = async () => {
    if (!regulationSearchTerm.trim()) return;
    setIsSearchingRegulations(true);
    try {
      const results = await searchRegulationsWithAI(regulationSearchTerm);
      setSearchedRegulations(results);
    } catch {
      showToast('Søgning fejlede. Prøv igen.', 'error');
    } finally {
      setIsSearchingRegulations(false);
    }
  };

  const handleAssigneeToggle = (memberId: string) => {
    if (!memberId) return;
    const member = selectableMembers.find(m => m.id === memberId);
    if (!member) return;
    const isAssigned = assignees.some(a => a.id === memberId);
    if (isAssigned) {
      setAssignees(prev => prev.filter(a => a.id !== memberId));
    } else {
      setAssignees(prev => [...prev, { ...member, isOwner: false }]);
    }
  };

  // Timeline log entries (newest first)
  const logEntries = useMemo(() =>
    [...(task?.comments ?? []).filter(c => c.type === 'log')].reverse(),
    [task?.comments]
  );

  // Timeline entries grouped by calendar day, each carrying an hh:mm:ss time label
  const timelineGroups = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; entries: (Comment & { timeLabel: string })[] }[] = [];
    logEntries.forEach(entry => {
      const d = new Date(entry.timestamp);
      const valid = !isNaN(d.getTime());
      const dateKey = valid ? d.toDateString() : 'legacy';
      const dateLabel = valid
        ? d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Tidligere hændelser';
      const timeLabel = valid
        ? d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : entry.timestamp;
      let group = groups.find(g => g.dateKey === dateKey);
      if (!group) {
        group = { dateKey, dateLabel, entries: [] };
        groups.push(group);
      }
      group.entries.push({ ...entry, timeLabel });
    });
    return groups;
  }, [logEntries]);

  const tabs = [
    { id: 'beskrivelse', label: 'Beskrivelse', icon: FileTextIcon },
    { id: 'tjekliste', label: 'Tjekliste', icon: ClipboardListIcon },
    ...(aiEnabled ? [{ id: 'reglementer', label: 'Reglementer', icon: LayersIcon }] as const : []),
    { id: 'deadlines', label: 'Deadlines', icon: CalendarIcon },
    { id: 'filer', label: 'Filer', icon: PaperclipIcon },
    { id: 'team', label: 'Team', icon: UsersIcon },
    ...(qualityEnabled ? [{ id: 'kvalitetssikring', label: 'Kvalitetssikring', icon: CheckCircleIcon }] as const : []),
    { id: 'chat', label: 'Chat', icon: MessageSquareIcon },
    { id: 'tidslinje', label: 'Tidslinje', icon: ClockIcon },
  ] as const;

  const scanLimited = task?.id ? (lastScanTs > 0 && Date.now() - lastScanTs < 86_400_000) : false;
  const ksProjectId = project?.id ?? task?.projectId;
  const taskTeam = useMemo(() => {
    const allowedIds = new Set([
      task?.ownerId,
      ...(task?.assignees ?? assignees).map(member => member.id),
    ].filter((id): id is string => Boolean(id)));
    const members = projectTeam.filter(member => allowedIds.has(member.id));
    if (user?.id && allowedIds.has(user.id) && !members.some(member => member.id === user.id)) {
      members.push({
        id: user.id,
        name: user.name,
        initials: user.initials,
        role: 'EMPLOYEE',
        status: 'ACTIVE',
        joinedAt: new Date().toISOString(),
      });
    }
    return members;
  }, [assignees, projectTeam, task?.assignees, task?.ownerId, user]);
  // Full project team when available, so @mentions can reach any project member;
  // falls back to the task-scoped list only for standalone/quick tasks with no project team.
  const mentionableTeam = useMemo(
    () => (projectTeam.length > 0 ? projectTeam : taskTeam),
    [projectTeam, taskTeam]
  );

  /** Subtle panel styling shared by rows/sections inside the modal. */
  const panel = 'bg-bg-subtle dark:bg-bg-dark-muted rounded-control border border-border dark:border-border-dark';

  return (<>
    <Modal
      open
      onClose={onClose}
      title={task ? 'Rediger Opgave' : 'Ny Opgave'}
      footer={
        <div className="flex justify-between items-center w-full gap-2">
          <div className="flex gap-1">
            {task && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="h-11 px-4 inline-flex items-center justify-center rounded-control text-label font-semibold text-danger hover:bg-danger-subtle dark:hover:bg-danger-subtle-dark transition-colors duration-150"
              >
                Slet
              </button>
            )}
            {task && onArchive && !task.archivedAt && (
              <button
                type="button"
                onClick={() => { onArchive(task.id); onClose(); }}
                className="h-11 px-4 inline-flex items-center justify-center rounded-control text-label font-semibold text-warning-strong hover:bg-warning-subtle dark:text-warning dark:hover:bg-warning-subtle-dark transition-colors duration-150"
              >
                Arkivér
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Annuller</Button>
            <Button onClick={handleSave} disabled={!title.trim()}>{task ? 'Gem' : 'Opret'}</Button>
          </div>
        </div>
      }
    >
      {/* Tab bar */}
      <div
        ref={tabBarRef}
        className="px-5 pt-1 pb-0 border-b border-border dark:border-border-dark overflow-x-auto hide-scrollbar flex gap-2 mb-4 -mx-5"
        style={{ cursor: 'grab' }}
        onMouseDown={handleTabBarMouseDown}
        onMouseMove={handleTabBarMouseMove}
        onMouseUp={handleTabBarMouseUp}
        onMouseLeave={handleTabBarMouseLeave}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { if (!hasDragged.current) setActiveTab(tab.id as any); }}
            aria-current={activeTab === tab.id ? 'true' : undefined}
            className={cn(
              'flex items-center gap-2 px-3 min-h-11 text-label font-semibold rounded-t-control border-b-2 whitespace-nowrap transition-colors duration-150',
              activeTab === tab.id
                ? 'text-brand-primary border-brand-primary'
                : 'text-text-secondary dark:text-text-dark-secondary border-transparent hover:text-text-primary dark:hover:text-text-dark-primary'
            )}
          >
            <tab.icon className="w-4 h-4" /><span>{tab.label}</span>
            {tab.id === 'chat' && task?.id && user?.id && (
              <Suspense fallback={null}>
                <TaskChatUnreadBadge taskId={task.id} userId={user.id} isChatActive={activeTab === 'chat'} />
              </Suspense>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4">

        {/* ── BESKRIVELSE ─────────────────────────────────────────────── */}
        {activeTab === 'beskrivelse' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Titel" value={title} onChange={e => setTitle(e.target.value)} placeholder="Opgavetitel" />
              </div>
              {aiEnabled && (
                <Button
                  variant="secondary"
                  iconLeft={<SparklesIcon className="w-4 h-4" />}
                  loading={isOptimizing}
                  onClick={handleOptimizeTask}
                  aria-label="Optimer titel og beskrivelse med AI"
                >
                  AI
                </Button>
              )}
            </div>

            {/* Ansvarlig section */}
            <div className={cn('p-3', panel)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">Ansvarlig</span>
                {canAssign && !isChangingAssignee && (
                  <button
                    type="button"
                    onClick={openAssigneeEditor}
                    className="text-caption text-brand-primary font-semibold hover:underline flex items-center gap-1 p-2 -m-2"
                  >
                    <UserIcon className="w-3 h-3" /> Skift
                  </button>
                )}
                {isChangingAssignee && (
                  <button
                    type="button"
                    onClick={() => setIsChangingAssignee(false)}
                    className="text-caption text-text-secondary dark:text-text-dark-secondary font-semibold hover:underline p-2 -m-2"
                  >
                    Luk
                  </button>
                )}
              </div>

              {/* Display chips — click to open profile modal */}
              <div className="flex flex-wrap gap-2 min-h-[28px]">
                {assignees.length > 0 ? assignees.map(a => {
                  const isExternal = projectTeam.find(m => m.id === a.id)?.role === 'EXTERNAL';
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => !isChangingAssignee && setSelectedAssigneeForProfile(a)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold border transition-opacity hover:opacity-80',
                        isExternal
                          ? 'bg-warning-subtle text-warning-strong border-warning-border dark:bg-warning-subtle-dark dark:text-warning dark:border-warning/30'
                          : 'bg-info-subtle text-info-strong border-info-border dark:bg-info-subtle-dark dark:text-info dark:border-info/30'
                      )}
                    >
                      {a.name}
                      {isChangingAssignee && (
                        <span
                          role="button"
                          aria-label={`Fjern ${a.name}`}
                          onClick={e => { e.stopPropagation(); handleAssigneeToggle(a.id); }}
                          className="hover:text-danger ml-0.5 cursor-pointer"
                        >
                          <XIcon className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                }) : <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary italic">Ingen tildelt</span>}
              </div>

              {/* Edit mode: pick from project team + network */}
              {isChangingAssignee && (
                <div className="mt-3 pt-3 border-t border-border dark:border-border-dark">
                  {isLoadingConnections ? (
                    <p className="text-caption text-center text-text-tertiary dark:text-text-dark-tertiary py-2">Henter netværk...</p>
                  ) : (
                    <div>
                      <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary mb-2 flex items-center gap-1"><UserIcon className="w-3 h-3" /> Medarbejdere</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {selectableMembers.filter(m => m.role !== 'EXTERNAL').map(m => (
                          <label key={m.id} className="flex items-center gap-2 p-1.5 rounded-control hover:bg-bg-muted dark:hover:bg-bg-dark-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={assignees.some(a => a.id === m.id)}
                              onChange={() => handleAssigneeToggle(m.id)}
                              className="w-4 h-4 accent-brand-primary"
                            />
                            <span className="w-6 h-6 bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info rounded-full flex items-center justify-center text-caption font-bold flex-shrink-0">{m.initials}</span>
                            <span className="text-label text-text-primary dark:text-text-dark-primary truncate">{m.name}</span>
                          </label>
                        ))}
                        {selectableMembers.filter(m => m.role !== 'EXTERNAL').length === 0 && (
                          <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary italic px-1">Ingen medarbejdere</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-label font-medium text-text-secondary dark:text-text-dark-secondary">Beskrivelse</span>
                {isOwner && aiEnabled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<SparklesIcon className="w-4 h-4" />}
                    loading={isGeneratingChecklist}
                    onClick={handleGenerateChecklist}
                  >
                    {isGeneratingChecklist ? 'Genererer…' : 'AI Tjekliste'}
                  </Button>
                )}
              </div>
              <Textarea
                value={desc}
                onChange={isOwner ? e => setDesc(e.target.value) : undefined}
                rows={5}
                placeholder="Beskrivelse..."
                aria-label="Beskrivelse"
                readOnly={!isOwner}
                className={!isOwner ? 'opacity-60 cursor-not-allowed' : ''}
              />
            </div>
            {!isOwner && <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary -mt-2">Kun opgaveejer kan redigere beskrivelsen.</p>}

            {toolsEnabled && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={<CalculatorIcon className="w-4 h-4" />}
                  disabled={!isOwner}
                  onClick={() => {
                    if (!isOwner) {
                      showToast('Kontakt opgaveejer for at udføre beregninger.', 'warning');
                      return;
                    }
                    setShowCalcPicker(true);
                  }}
                >
                  Beregn mængde
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── TJEKLISTE ───────────────────────────────────────────────── */}
        {activeTab === 'tjekliste' && (
          <div className="flex flex-col gap-3">
            {checklist.length === 0 ? (
              <div className="text-center py-10 text-label text-text-secondary dark:text-text-dark-secondary italic">Ingen punkter endnu — tilføj det første nedenfor</div>
            ) : (
              <div className="space-y-2">
                {checklist.map((item, idx) => (
                  <div key={item.id} className={cn('flex items-center gap-3 p-2.5', panel)}>
                    <input
                      type="checkbox"
                      aria-label={item.text}
                      checked={item.checked}
                      onChange={() => setChecklist(prev => prev.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c))}
                      className="w-4 h-4 accent-brand-primary flex-shrink-0"
                    />
                    <span className={cn('flex-1 text-label', item.checked ? 'line-through text-text-tertiary dark:text-text-dark-tertiary' : 'text-text-primary dark:text-text-dark-primary')}>{item.text}</span>
                    <button
                      type="button"
                      aria-label="Slet punkt"
                      onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))}
                      className="text-text-tertiary hover:text-danger dark:text-text-dark-tertiary flex-shrink-0 p-2 -m-2 transition-colors"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {checklist.length > 0 && (
              <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary text-right">{checklist.filter(c => c.checked).length} / {checklist.length} gennemført</p>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-border dark:border-border-dark">
              <Input
                value={newChecklistItemText}
                onChange={e => setNewChecklistItemText(e.target.value)}
                placeholder="Nyt tjeklistepunkt..."
                aria-label="Nyt tjeklistepunkt"
                onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem()}
              />
              <Button variant="primary" onClick={handleAddChecklistItem} iconLeft={<PlusIcon className="w-4 h-4" />} className="shrink-0">Tilføj</Button>
            </div>
          </div>
        )}

        {/* ── REGLEMENTER ─────────────────────────────────────────────── */}
        {activeTab === 'reglementer' && aiEnabled && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary">AI-forslag baseret på opgave</h4>
                {isOwner && (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft={<SparklesIcon className="w-4 h-4" />}
                    loading={isAiLoading}
                    disabled={scanLimited}
                    title={scanLimited ? 'Allerede scannet i dag' : 'Scan med AI'}
                    onClick={handleAiRegulationScan}
                  >
                    {isAiLoading ? 'Scanner…' : 'AI'}
                  </Button>
                )}
              </div>
              {isAiLoading ? (
                <div className="text-center py-8 text-label text-text-secondary dark:text-text-dark-secondary">Analyserer opgave…</div>
              ) : suggestedRegulations.length === 0 ? (
                <div className="text-center py-8 text-label text-text-secondary dark:text-text-dark-secondary italic">
                  Udfyld titel og beskrivelse for at få AI-forslag til relevante reglementer.
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestedRegulations.map(reg => (
                    <div key={reg.id} className="flex items-start justify-between p-3 bg-info-subtle dark:bg-info-subtle-dark rounded-control border border-info-border dark:border-info/30">
                      <div className="flex-1 min-w-0">
                        <Link to={`/reglementer/${reg.id}`} className="text-label font-semibold text-brand-primary hover:underline block truncate">{reg.title}</Link>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">{reg.description}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Fjern reglementet"
                        onClick={() => setSuggestedRegulations(prev => prev.filter(r => r.id !== reg.id))}
                        className="text-text-tertiary hover:text-danger dark:text-text-dark-tertiary ml-3 flex-shrink-0 p-2 -m-2 transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border dark:border-border-dark">
              <h4 className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary mb-2">Søg manuelt i BR18</h4>
              <div className="flex items-center gap-2">
                <Input
                  value={regulationSearchTerm}
                  onChange={e => setRegulationSearchTerm(e.target.value)}
                  placeholder="Søg i BR18…"
                  aria-label="Søg i BR18"
                  onKeyDown={e => e.key === 'Enter' && handleSearchRegulations()}
                />
                <Button variant="outline" onClick={handleSearchRegulations} loading={isSearchingRegulations} className="shrink-0">
                  {isSearchingRegulations ? 'Søger…' : 'Søg'}
                </Button>
              </div>
              {searchedRegulations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {searchedRegulations.map(reg => (
                    <div key={reg.id} className={cn('flex items-center justify-between p-2.5', panel)}>
                      <span className="text-label text-text-primary dark:text-text-dark-primary">{reg.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!suggestedRegulations.some(r => r.id === reg.id))
                            setSuggestedRegulations(prev => [...prev, reg]);
                          setSearchedRegulations([]);
                        }}
                        className="text-caption text-brand-primary font-semibold hover:underline ml-2 flex-shrink-0 p-2 -m-2"
                      >
                        Tilføj
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── DEADLINES ───────────────────────────────────────────────── */}
        {activeTab === 'deadlines' && (
          <div className="flex flex-col gap-4">
            <Select
              label="Status"
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
            >
              <option value="To Do">At gøre</option>
              <option value="Igangværende">Igangværende</option>
              <option value="Forfalden">Forfalden</option>
              <option value="Udført">Udført</option>
            </Select>

            <Select
              label="Prioritet"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
            >
              <option value="Høj">Høj</option>
              <option value="Mellem">Mellem</option>
              <option value="Lav">Lav</option>
            </Select>

            <Input label="Forfaldsdato" type="date" value={due} onChange={e => setDue(e.target.value)} />

            <Input label="Estimerede timer" type="number" min="0" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(e.target.value)} />

            <label className={cn('flex items-center gap-3 p-3 cursor-pointer', panel)}>
              <input
                type="checkbox"
                checked={isMilestone}
                onChange={e => setIsMilestone(e.target.checked)}
                className="w-4 h-4 accent-brand-primary"
              />
              <div>
                <span className="text-label font-medium block text-text-primary dark:text-text-dark-primary">Markér som milepæl</span>
                <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Milepæle vises fremhævet i projektets tidslinje</span>
              </div>
            </label>

            <div className="h-px bg-border dark:bg-border-dark" />

            <h4 className="text-label font-semibold text-text-secondary dark:text-text-dark-secondary">Relateret link</h4>
            <Input label="Linktekst" value={linkText} onChange={e => setLinkText(e.target.value)} placeholder="f.eks. Tegning 1.1" />
            <Input label="URL" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        )}

        {/* ── FILER ───────────────────────────────────────────────────── */}
        {activeTab === 'filer' && (
          <div className="flex flex-col gap-4">
            <FilePicker onFileSelect={handleFileSelect} accept="image/*,.pdf" />
            {attachments && attachments.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {attachments.map((att, idx) => (
                  <div key={idx} className={cn('relative group overflow-hidden', panel)}>
                    {att.type === 'image' ? (
                      <img src={att.url} alt={att.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="h-28 flex items-center justify-center bg-danger-subtle dark:bg-danger-subtle-dark">
                        <FileTextIcon className="w-10 h-10 text-danger" />
                      </div>
                    )}
                    <div className="p-2 flex items-center justify-between gap-1">
                      <span className="text-caption truncate text-text-secondary dark:text-text-dark-secondary flex-1">{att.name}</span>
                      <button
                        type="button"
                        aria-label="Slet fil"
                        onClick={() => setAttachments(prev => prev?.filter((_, i) => i !== idx))}
                        className="text-text-tertiary hover:text-danger dark:text-text-dark-tertiary flex-shrink-0 p-2 -m-1 transition-colors"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-label text-text-secondary dark:text-text-dark-secondary italic">
                Ingen filer vedhæftet endnu — brug knappen ovenfor
              </div>
            )}
          </div>
        )}

        {/* ── TEAM ────────────────────────────────────────────────────── */}
        {activeTab === 'team' && (
          <div className="space-y-2">
            {projectTeam.length === 0 && (
              <div className="text-center py-10 text-label text-text-secondary dark:text-text-dark-secondary italic">Ingen teammedlemmer på dette projekt</div>
            )}
            {projectTeam.map(member => (
              <div key={member.id} className={cn('flex items-center justify-between p-2.5', panel)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-info-subtle text-info-strong dark:bg-info-subtle-dark dark:text-info rounded-full flex items-center justify-center font-bold text-caption">{member.initials}</div>
                  <div>
                    <span className="font-semibold block text-label text-text-primary dark:text-text-dark-primary">{member.name}</span>
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{member.role === 'EXTERNAL' ? 'Underentreprenør' : member.role === 'OWNER' ? 'Ejer' : member.role === 'MANAGER' ? 'Projektleder' : 'Medarbejder'}</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  aria-label={`Tildel ${member.name}`}
                  checked={assignees.some(a => a.id === member.id)}
                  onChange={() => handleAssigneeToggle(member.id)}
                  className="w-5 h-5 accent-brand-primary"
                  disabled={!canAssign}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── KVALITETSSIKRING ────────────────────────────────────────── */}
        {activeTab === 'kvalitetssikring' && qualityEnabled && (
          !task?.id || !ksProjectId ? (
            <div className="text-center py-10 text-label text-text-secondary dark:text-text-dark-secondary italic">
              Gem opgaven først for at tilføje kvalitetssikring.
            </div>
          ) : (
            <Suspense fallback={null}>
              <TaskQualityControlTab
                taskId={task.id}
                projectId={ksProjectId}
                task={task}
                project={project}
                projectTeam={projectTeam}
                currentUserId={user?.id ?? ''}
                currentUserName={user?.name ?? ''}
                isOwnerOrManager={isOwner || canAssign}
              />
            </Suspense>
          )
        )}

        {/* ── CHAT ─────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          !task?.id ? (
            <div className="py-10 text-center text-label italic text-text-secondary dark:text-text-dark-secondary">
              Gem opgaven først for at starte chatten.
            </div>
          ) : (
            <Suspense fallback={<div className="py-10 text-center text-label text-text-secondary dark:text-text-dark-secondary">Indlæser chat…</div>}>
              <TaskChatTab
                taskId={task.id}
                projectId={project?.id ?? task.projectId ?? null}
                projectTeam={mentionableTeam}
                currentUserId={user?.id ?? ''}
                currentUserName={user?.name ?? ''}
              />
            </Suspense>
          )
        )}

        {/* ── TIDSLINJE ───────────────────────────────────────────────── */}
        {activeTab === 'tidslinje' && (
          <div className="space-y-2">
            {logEntries.length === 0 ? (
              <div className="text-center py-10 text-label text-text-secondary dark:text-text-dark-secondary italic">
                Ingen hændelser endnu — log opdateres automatisk når opgaven gemmes med ændringer.
              </div>
            ) : (
              <div className="relative pl-5">
                <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-border dark:bg-border-dark" />
                <div className="space-y-6">
                  {timelineGroups.map(group => (
                    <div key={group.dateKey}>
                      <div className="relative flex items-center mb-3">
                        <div className="absolute -left-[17px] w-3 h-3 rounded-full border-2 border-bg dark:border-bg-dark-surface bg-brand-primary flex-shrink-0" />
                        <Badge variant="brand">{group.dateLabel}</Badge>
                      </div>
                      <div className="space-y-4">
                        {group.entries.map(entry => (
                          <div key={entry.id} className="relative flex gap-3">
                            <div className="absolute -left-[17px] top-1.5 w-3 h-3 rounded-full border-2 border-bg dark:border-bg-dark-surface bg-border-strong dark:bg-border-dark-strong flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-caption text-text-secondary dark:text-text-dark-secondary mb-1">
                                <span className="font-semibold text-text-primary dark:text-text-dark-primary">{entry.user}</span>
                                {' · '}
                                {entry.timeLabel}
                              </p>
                              <div className={cn('px-3 py-2', panel)}>
                                <p className="text-label text-text-primary dark:text-text-dark-primary">{entry.text}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>

    {toolsEnabled && (
      <Suspense fallback={null}>
        <CalculatorPickerModal open={showCalcPicker} onClose={() => setShowCalcPicker(false)} onResult={handleCalculatorResult} />
      </Suspense>
    )}

    {selectedAssigneeForProfile && (
      <AssigneeProfileModal
        assignee={selectedAssigneeForProfile}
        projectTeam={projectTeam}
        onClose={() => setSelectedAssigneeForProfile(null)}
      />
    )}
  </>);
};
