import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTasksForActiveProjects } from '../../services/tasks';
import { useAuth } from '../../../../contexts/AuthProvider';
import { Alert, Button } from '../../../../components/ui';

/**
 * "Kræver handling" alert for overdue deadlines (management context,
 * formerly inline in HomePage's action section). Renders null when none.
 */
export const OverdueAlertWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [overdueCount, setOverdueCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        getAllTasksForActiveProjects(user.id)
            .then((allTasks) => {
                if (!alive) return;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                setOverdueCount(allTasks.filter(t => new Date(t.dueDate) < today && t.status !== 'Udført').length);
            })
            .catch((e) => console.error('OverdueAlertWidget fetch failed:', e));
        return () => { alive = false; };
    }, [user]);

    if (overdueCount === 0) return null;
    return (
        <Alert
            variant="danger"
            title={overdueCount === 1 ? '1 overskredet deadline' : `${overdueCount} overskredne deadlines`}
            action={
                <Button size="sm" variant="outline" onClick={() => navigate('/tasks')} aria-label="Se forfaldne opgaver">
                    Se
                </Button>
            }
        >
            Gennemgå og opdater status på de forfaldne opgaver.
        </Alert>
    );
};
