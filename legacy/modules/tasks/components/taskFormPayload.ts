import { Task, ChecklistItem, TaskStatus, TaskPriority, Comment, User } from '../../../types';

export interface BuildTaskSaveResultParams {
  task?: Task;
  user?: Pick<User, 'name' | 'initials'> | null;
  title: string;
  desc: string;
  due: string;
  status: TaskStatus;
  priority: TaskPriority;
  isMilestone: boolean;
  estimatedHours: string;
  linkText: string;
  linkUrl: string;
  assignees: Task['assignees'];
  suggestedRegulations: Array<{ id: string; title: string }>;
  attachments: Task['attachments'];
  checklist: ChecklistItem[];
  /** Injected clock so the result is deterministic/testable (component passes Date.now()). */
  nowMs: number;
  nowIso: string;
}

/**
 * Pure builder for the TaskFormModal save payload plus its Danish change-log.
 * Extracted verbatim from TaskFormModal.handleSave so the diffing logic can be
 * unit-tested in isolation (TaskFormModal.save.test.tsx). No behaviour change.
 */
export const buildTaskSaveResult = ({
  task, user, title, desc, due, status, priority, isMilestone, estimatedHours,
  linkText, linkUrl, assignees, suggestedRegulations, attachments, checklist, nowMs, nowIso,
}: BuildTaskSaveResultParams): Omit<Task, 'id'> => {
  const logEntries: Comment[] = [];
  let logSeq = 0;
  const pushLog = (text: string) => {
    logEntries.push({
      id: `log-${nowMs}-${logSeq++}`,
      user: user?.name ?? 'System',
      userInitials: user?.initials ?? 'SY',
      text,
      timestamp: nowIso,
      type: 'log',
    });
  };

  if (task) {
    if (title !== task.title) pushLog(`Titel ændret til "${title}"`);
    if (desc !== (task.description || '')) pushLog('Beskrivelse opdateret');
    if (due !== task.dueDate) pushLog(`Deadline ændret til ${due}`);
    if (status !== task.status) pushLog(`Status ændret til ${status}`);
    if (priority !== (task.priority || 'Mellem')) pushLog(`Prioritet ændret til ${priority}`);
    if (isMilestone !== !!task.isMilestone) pushLog(isMilestone ? 'Markeret som milepæl' : 'Fjernet som milepæl');

    const prevHours = task.estimatedHours ?? 0;
    const newHours = parseFloat(estimatedHours) || 0;
    if (newHours !== prevHours) pushLog(`Estimeret tid ændret til ${newHours} timer`);

    const prevLink = task.relatedLink;
    const newLink = linkText && linkUrl ? { text: linkText, url: linkUrl } : undefined;
    if ((prevLink?.url || '') !== (newLink?.url || '') || (prevLink?.text || '') !== (newLink?.text || '')) {
      if (newLink && !prevLink) pushLog(`Link tilføjet: ${newLink.text}`);
      else if (!newLink && prevLink) pushLog(`Link fjernet: ${prevLink.text}`);
      else if (newLink) pushLog(`Link opdateret: ${newLink.text}`);
    }

    const prevAssignees = task.assignees ?? [];
    assignees.filter(a => !prevAssignees.some(pa => pa.id === a.id)).forEach(a => pushLog(`Ansvarlig tilføjet: ${a.name}`));
    prevAssignees.filter(pa => !assignees.some(a => a.id === pa.id)).forEach(pa => pushLog(`Ansvarlig fjernet: ${pa.name}`));

    const prevRegs = task.suggestedRegulations ?? [];
    suggestedRegulations.filter(r => !prevRegs.some(pr => pr.id === r.id)).forEach(r => pushLog(`Reglement tilføjet: ${r.title}`));
    prevRegs.filter(pr => !suggestedRegulations.some(r => r.id === pr.id)).forEach(pr => pushLog(`Reglement fjernet: ${pr.title}`));

    const prevAttachments = task.attachments ?? [];
    (attachments ?? []).filter(a => !prevAttachments.some(pa => pa.name === a.name)).forEach(a => pushLog(`Fil vedhæftet: ${a.name}`));
    prevAttachments.filter(pa => !(attachments ?? []).some(a => a.name === pa.name)).forEach(pa => pushLog(`Fil fjernet: ${pa.name}`));

    const prevChecklist = task.checklist ?? [];
    checklist.filter(c => !prevChecklist.some(pc => pc.id === c.id)).forEach(c => pushLog(`Tjekpunkt tilføjet: "${c.text}"`));
    prevChecklist.filter(pc => !checklist.some(c => c.id === pc.id)).forEach(pc => pushLog(`Tjekpunkt fjernet: "${pc.text}"`));
    checklist.forEach(c => {
      const pc = prevChecklist.find(p => p.id === c.id);
      if (!pc) return;
      if (pc.checked !== c.checked) pushLog(`${c.checked ? 'Afkrydset' : 'Flueben fjernet'}: "${c.text}"`);
      else if (pc.text !== c.text) pushLog(`Tjekpunkt omdøbt: "${pc.text}" → "${c.text}"`);
    });
  }

  return {
    title, description: desc, dueDate: due, status, priority,
    relatedLink: linkText && linkUrl ? { text: linkText, url: linkUrl } : undefined,
    attachments, isMilestone, assignees, estimatedHours: parseFloat(estimatedHours) || 0, checklist,
    suggestedRegulations: suggestedRegulations.map(({ id, title: regTitle }) => ({ id, title: regTitle })),
    comments: [...(task?.comments ?? []), ...logEntries],
  };
};
