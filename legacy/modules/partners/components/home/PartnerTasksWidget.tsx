import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAcceptedPartnerTasks } from '../../services/partners';
import type { AcceptedPartnerTask } from '../../services/partners';
import { Badge } from '../../../../components/ui';
import { SectionHeader } from '../../../../components/dashboard/SectionHeader';
import { HomePartnerTaskCard } from './HomePartnerTaskCard';

/** Worker "Partneropgaver" — accepted partner-task cards (formerly inline in HomePage). */
export const PartnerTasksWidget: React.FC = () => {
    const navigate = useNavigate();
    const [partnerTasks, setPartnerTasks] = useState<AcceptedPartnerTask[]>([]);

    useEffect(() => {
        let alive = true;
        getMyAcceptedPartnerTasks()
            .then((tasks) => { if (alive) setPartnerTasks(tasks); })
            .catch((e) => console.error('PartnerTasksWidget fetch failed:', e));
        return () => { alive = false; };
    }, []);

    if (partnerTasks.length === 0) return null;
    return (
        <>
            <SectionHeader
                title="Partneropgaver"
                badge={<Badge variant="brand">{partnerTasks.length}</Badge>}
            />
            <div className="space-y-3">
                {partnerTasks.map(task => (
                    <HomePartnerTaskCard
                        key={`${task.inviteId}-${task.id}`}
                        task={task}
                        onClick={() => navigate(`/task/${task.id}`)}
                    />
                ))}
            </div>
        </>
    );
};
