import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProjects } from '../../services/projects';
import { useAuth } from '../../../../contexts/AuthProvider';
import { UsersIcon, ChevronRightIcon } from '../../../../components/icons';

/**
 * Worker "Kræver handling" card: pending project invitations addressed to me
 * (formerly inline in HomePage's action section). Renders null when none.
 */
export const ProjectInvitesActionWidget: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        let alive = true;
        getProjects(user.id)
            .then((projects) => {
                if (!alive) return;
                const pending = projects.filter(p =>
                    p.status === 'I gang' && p.team.find(m => m.id === user.id)?.status === 'PENDING'
                );
                setPendingCount(pending.length);
            })
            .catch((e) => console.error('ProjectInvitesActionWidget fetch failed:', e));
        return () => { alive = false; };
    }, [user]);

    if (pendingCount === 0) return null;
    return (
        <button
            type="button"
            onClick={() => navigate('/projects')}
            className="w-full min-h-11 rounded-card bg-brand-primary p-4 text-left text-white shadow-card transition-all duration-150 hover:shadow-card-hover active:scale-[0.99] flex items-center justify-between gap-3"
            aria-label={`Du har ${pendingCount} nye projektinvitationer — se detaljer`}
        >
            <span className="flex items-center gap-3 min-w-0">
                <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
                    <UsersIcon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                    <span className="block text-label font-bold truncate">
                        Du har {pendingCount} {pendingCount === 1 ? 'ny invitation' : 'nye invitationer'}
                    </span>
                    <span className="block text-caption text-white/80">Tryk for at se detaljer</span>
                </span>
            </span>
            <ChevronRightIcon className="w-5 h-5 shrink-0" />
        </button>
    );
};
