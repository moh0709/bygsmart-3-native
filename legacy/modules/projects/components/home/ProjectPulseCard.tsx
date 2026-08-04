import React from 'react';
import type { Project } from '../../../../types';
import { AvatarGroup, Badge, ProgressRing } from '../../../../components/ui';

// --- Projekt puls card (inline — the DashboardWidgets version is shared) ---

export const ProjectPulseCard: React.FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={`Åbn projekt: ${project.name}`}
        className="snap-start shrink-0 min-w-[250px] max-w-[280px] text-left rounded-card border border-border bg-bg p-4 shadow-card transition-all duration-150 hover:shadow-card-hover hover:border-border-strong active:scale-[0.99] dark:border-border-dark dark:bg-bg-dark-surface dark:hover:border-border-dark-strong"
    >
        <div className="flex items-start justify-between gap-2">
            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate min-w-0">
                {project.name}
            </p>
            <Badge variant={project.status === 'I gang' ? 'success' : 'neutral'} dot>{project.status}</Badge>
        </div>
        <div className="flex items-center gap-3 mt-3">
            <ProgressRing value={project.progress} diameter={48} label={`Fremgang for ${project.name}`} />
            <div className="min-w-0">
                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Næste milepæl</p>
                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                    {project.milestone.title}
                </p>
            </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
            <AvatarGroup people={project.team.map(m => ({ name: m.name }))} size="sm" max={3} />
            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary truncate">{project.clientName}</span>
        </div>
    </button>
);
