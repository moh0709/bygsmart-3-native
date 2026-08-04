import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, Task } from '../../types';
import { ChevronRightIcon } from '../icons';
import { AnimatedNumber } from '../../modules/tools';

export const StatCard: React.FC<{
    icon: React.FC<{ className?: string }>;
    label: string;
    value: number;
    color: string;
    onClick?: () => void;
}> = ({ icon: Icon, label, value, color, onClick }) => {
    const baseClasses = `bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-card border border-border dark:border-border-dark flex items-center gap-4 text-left transition-all duration-150 ${onClick ? 'cursor-pointer hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong active:scale-[0.99]' : ''}`;
    const inner = (
        <>
            <div className={`p-3 rounded-control shrink-0 ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
                <div className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">
                    <AnimatedNumber value={value} />
                </div>
                <p className="text-sm font-medium text-text-secondary dark:text-text-dark-secondary">{label}</p>
            </div>
        </>
    );
    return onClick ? (
        <button type="button" onClick={onClick} className={`w-full ${baseClasses}`}>
            {inner}
        </button>
    ) : (
        <div className={baseClasses}>{inner}</div>
    );
};

export const FocusTaskItem: React.FC<{ task: Task }> = ({ task }) => {
    const navigate = useNavigate();
    return (
        <button
            type="button"
            onClick={() => navigate(`/task/${task.id}`)}
            className="w-full min-h-[44px] text-left bg-bg dark:bg-bg-dark-surface p-3 rounded-card shadow-card border border-border dark:border-border-dark hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong transition-all duration-150 flex items-center justify-between gap-3"
        >
            <div className="min-w-0">
                <p className="font-semibold text-text-primary dark:text-text-dark-primary truncate">{task.title}</p>
                <p className="text-xs text-text-secondary dark:text-text-dark-secondary">{task.projectName} &bull; Forfalder: {new Date(task.dueDate).toLocaleDateString('da-DK')}</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 shrink-0 text-text-tertiary dark:text-text-dark-tertiary" />
        </button>
    );
};

export const ProjectPulseCard: React.FC<{ project: Project }> = ({ project }) => {
    const navigate = useNavigate();
    return (
        <button
            type="button"
            onClick={() => navigate(`/project-detail/${project.id}`)}
            className="flex-shrink-0 w-72 text-left bg-bg dark:bg-bg-dark-surface rounded-card shadow-card border border-border dark:border-border-dark p-4 space-y-3 cursor-pointer hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong transition-all duration-150"
        >
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-semibold text-base text-text-primary dark:text-text-dark-primary truncate">{project.name}</h3>
                <div className="flex -space-x-2 shrink-0">
                    {project.team.slice(0, 3).map(member => (
                        <div key={member.id} className="w-8 h-8 bg-bg-muted dark:bg-bg-dark-muted rounded-full flex items-center justify-center font-bold text-xs text-text-secondary dark:text-text-dark-secondary border-2 border-bg dark:border-bg-dark-surface" title={member.name}>
                            {member.initials}
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <div className="flex justify-between text-xs font-medium text-text-secondary dark:text-text-dark-secondary mb-1">
                    <span>Fremgang</span>
                    <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-bg-muted dark:bg-bg-dark-muted rounded-full h-2" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Fremgang for ${project.name}`}>
                    <div className="bg-brand-primary h-2 rounded-full transition-all duration-300" style={{ width: `${project.progress}%` }}></div>
                </div>
            </div>
            <div>
                <p className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">Næste milepæl</p>
                <p className="font-semibold text-sm text-text-primary dark:text-text-dark-primary">{project.milestone.title}</p>
            </div>
        </button>
    );
};

export const QuickActionCard: React.FC<{
    icon: React.FC<{ className?: string }>;
    label: string;
    onClick: () => void;
}> = ({ icon: Icon, label, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="bg-bg dark:bg-bg-dark-surface p-4 rounded-card shadow-card border border-border dark:border-border-dark hover:shadow-card-hover hover:border-border-strong dark:hover:border-border-dark-strong transition-all duration-150 flex flex-col items-center justify-center text-center gap-2"
    >
        <div className="bg-brand-subtle dark:bg-brand-subtle-dark p-3 rounded-control">
            <Icon className="w-6 h-6 text-brand-primary dark:text-brand-light" />
        </div>
        <p className="font-semibold text-sm text-text-primary dark:text-text-dark-primary">{label}</p>
    </button>
);

export const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-6 animate-fade-in">
        <h2 className="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-3">{title}</h2>
        {children}
    </section>
);
