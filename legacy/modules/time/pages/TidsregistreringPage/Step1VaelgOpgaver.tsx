import React, { useEffect, useState } from 'react';
import type { Project, Task } from '../../../../types';
import { getProjects } from '../../../projects';
import { getTasksForProject, getMyQuickTasks } from '../../../tasks';
import { useAuth } from '../../../../contexts/AuthProvider';
import { Alert, Badge, Card, SkeletonList, cn } from '../../../../components/ui';
import { FolderIcon, ZapIcon, ChevronDownIcon } from '../../../../components/icons';
import type { RegistrationStoreHook } from '../../stores/registrationStore';

interface ProjectWithTasks {
  project: Project;
  tasks: Task[];
}

/**
 * Trin 1 — "Vælg projekt & opgaver": one expandable card per project with
 * checkbox multi-select of its tasks, plus an "Interne opgaver" card for the
 * user's quick tasks (the design's "Intern Opgave" badge).
 */
export const Step1VaelgOpgaver: React.FC<{ useStore: RegistrationStoreHook }> = ({ useStore }) => {
  const { user } = useAuth();
  const tasksSelected = useStore((s) => s.tasks);
  const toggleTask = useStore((s) => s.toggleTask);

  const [projectTasks, setProjectTasks] = useState<ProjectWithTasks[]>([]);
  const [quickTasks, setQuickTasks] = useState<Task[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const projects = (await getProjects(user?.id)).filter(
          (p) => !['Afsluttet', 'ARCHIVED', 'CANCELLED'].includes(p.status ?? '')
        );
        const withTasks = await Promise.all(
          projects.map(async (project) => ({
            project,
            tasks: await getTasksForProject(project.id, user?.id),
          }))
        );
        const quick = await getMyQuickTasks();
        if (!active) return;
        setProjectTasks(withTasks.filter((pt) => pt.tasks.length > 0));
        setQuickTasks(quick);
        setError(null);
      } catch {
        if (active) setError('Kunne ikke hente projekter og opgaver. Prøv igen.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const isSelected = (taskId: string) => tasksSelected.some((t) => t.taskId === taskId);

  const taskRow = (task: Task, projectId: string | null, projectName: string | null, projectNumber: string | null = null) => (
    <label
      key={task.id}
      className="flex items-center justify-between gap-3 p-2.5 min-h-11 rounded-control cursor-pointer transition-colors border border-transparent hover:bg-bg-subtle hover:border-border dark:hover:bg-bg-dark-muted dark:hover:border-border-dark"
    >
      <span className="text-body text-text-primary dark:text-text-dark-primary min-w-0 truncate">{task.title}</span>
      <input
        type="checkbox"
        checked={isSelected(task.id)}
        onChange={() =>
          toggleTask({ taskId: task.id, taskTitle: task.title, projectId, projectName, projectNumber })
        }
        className="w-6 h-6 shrink-0 rounded accent-brand-primary"
        aria-label={`Vælg ${task.title}`}
      />
    </label>
  );

  if (loading) return <SkeletonList count={3} label="Henter projekter…" />;
  if (error) return <Alert variant="danger" title="Kunne ikke hente data">{error}</Alert>;

  if (projectTasks.length === 0 && quickTasks.length === 0) {
    return (
      <Alert variant="info" title="Ingen opgaver at registrere på">
        Du har ingen aktive projekter med opgaver eller interne opgaver endnu.
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-title text-text-primary dark:text-text-dark-primary">Vælg projekt & opgaver</h2>
        <p className="text-body text-text-secondary dark:text-text-dark-secondary mt-1">
          Vælg et projekt fra listen for at registrere tid på specifikke opgaver.
        </p>
      </div>

      {projectTasks.map(({ project, tasks }) => {
        const isOpen = expanded === project.id;
        const selectedCount = tasks.filter((t) => isSelected(t.id)).length;
        return (
          <Card key={project.id} padding="none" className={cn('overflow-hidden', isOpen && 'border-brand-primary/50')}>
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : project.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
              <span className="flex items-center gap-3 min-w-0">
                <FolderIcon className={cn('w-5 h-5 shrink-0', isOpen ? 'text-brand-primary' : 'text-text-secondary dark:text-text-dark-secondary')} />
                <span className="min-w-0">
                  <span className="block text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{project.name}</span>
                  <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                    #{project.projectNumber}{project.address ? ` · ${project.address}` : ''}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {selectedCount > 0 && <Badge variant="brand">{selectedCount}</Badge>}
                <ChevronDownIcon className={cn('w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary transition-transform', isOpen && 'rotate-180')} />
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-border dark:border-border-dark flex flex-col gap-1">
                {tasks.map((t) => taskRow(t, project.id, project.name, project.projectNumber ?? null))}
              </div>
            )}
          </Card>
        );
      })}

      {quickTasks.length > 0 && (
        <Card padding="none" className={cn('overflow-hidden', expanded === '__quick' && 'border-brand-primary/50')}>
          <button
            type="button"
            onClick={() => setExpanded(expanded === '__quick' ? null : '__quick')}
            aria-expanded={expanded === '__quick'}
            className="w-full flex items-center justify-between gap-3 p-4 text-left"
          >
            <span className="flex items-center gap-3 min-w-0">
              <ZapIcon className={cn('w-5 h-5 shrink-0', expanded === '__quick' ? 'text-brand-primary' : 'text-warning')} />
              <span className="min-w-0">
                <span className="block text-label font-bold text-text-primary dark:text-text-dark-primary">Interne opgaver</span>
                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">Hurtigopgaver uden projekt</span>
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {quickTasks.filter((t) => isSelected(t.id)).length > 0 && (
                <Badge variant="brand">{quickTasks.filter((t) => isSelected(t.id)).length}</Badge>
              )}
              <ChevronDownIcon className={cn('w-5 h-5 text-text-tertiary dark:text-text-dark-tertiary transition-transform', expanded === '__quick' && 'rotate-180')} />
            </span>
          </button>
          {expanded === '__quick' && (
            <div className="px-3 pb-3 pt-1 border-t border-border dark:border-border-dark flex flex-col gap-1">
              {quickTasks.map((t) => taskRow(t, null, null))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
