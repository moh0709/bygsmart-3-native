import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../../../../types';
import { getProjects } from '../../services/projects';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useDragScroll } from '../../../../hooks/useDragScroll';
import { Button, Card, EmptyState, SkeletonList } from '../../../../components/ui';
import { SectionHeader } from '../../../../components/dashboard/SectionHeader';
import { FolderIcon, FilePlusIcon } from '../../../../components/icons';
import { ProjectPulseCard } from './ProjectPulseCard';

/** "Projekt puls" — horizontal snap scroll of active projects (formerly HomePage section 7). */
export const ProjectPulseWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Desktop click-drag scrolling (touch scrolls natively).
    const { ref: pulseScrollRef, dragScrollProps } = useDragScroll<HTMLDivElement>();
    const [isLoading, setIsLoading] = useState(true);
    const [activeProjects, setActiveProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        getProjects(user.id)
            .then((projects) => { if (alive) setActiveProjects(projects.filter(p => p.status === 'I gang')); })
            .catch((e) => console.error('ProjectPulseWidget fetch failed:', e))
            .finally(() => { if (alive) setIsLoading(false); });
        return () => { alive = false; };
    }, [user]);

    return (
        <>
            <SectionHeader title="Projekt puls" />
            {isLoading ? (
                <SkeletonList count={1} label="Indlæser projekter…" />
            ) : activeProjects.length > 0 ? (
                <div
                    ref={pulseScrollRef}
                    {...dragScrollProps}
                    className="flex gap-3 overflow-x-auto snap-x pb-2 -mx-4 px-4 md:-mx-6 md:px-6 hide-scrollbar md:cursor-grab md:active:cursor-grabbing"
                >
                    {activeProjects.map(p => (
                        <ProjectPulseCard key={p.id} project={p} onClick={() => navigate(`/project-detail/${p.id}`)} />
                    ))}
                </div>
            ) : (
                <Card padding="none">
                    <EmptyState
                        icon={<FolderIcon />}
                        title="Ingen aktive projekter"
                        description="Opret dit første projekt og få overblik over fremdrift, opgaver og indkøb."
                        className="py-8"
                        action={
                            <Button size="sm" iconLeft={<FilePlusIcon className="w-4 h-4" />} onClick={() => navigate('/projects/new')}>
                                Nyt Projekt
                            </Button>
                        }
                    />
                </Card>
            )}
        </>
    );
};
