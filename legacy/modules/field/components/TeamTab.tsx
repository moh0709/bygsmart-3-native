import React, { useCallback, useEffect, useState } from 'react';
import type { Task } from '../../../types';
import { Avatar, Badge, Button, Card, CardHeader, CardTitle, EmptyState, Skeleton, cn } from '../../../components/ui';
import { UsersIcon, PlusIcon, XIcon } from '../../../components/icons';
import { listTaskAccess, revokeTaskAccess, revokeTaskAccessByEmail } from '../../tasks';
import type { TaskAccessEntry, TaskAccessRole } from '../../tasks';
import { InviteTaskMemberModal } from './InviteTaskMemberModal';
import { ICON_BTN } from '../pages/TaskDetailPage/constants';

const ROLE_LABELS: Record<TaskAccessRole, string> = {
    owner: 'Ejer',
    responsible: 'Ansvarlig',
    worker: 'Medarbejder',
    viewer: 'Kigger',
};

const PROJECT_ROLE_LABELS: Record<string, string> = {
    OWNER: 'Ejer',
    MANAGER: 'Projektleder',
    EMPLOYEE: 'Medarbejder',
    EXTERNAL: 'Underentreprenør',
    CLIENT: 'Kunde',
};

// ─── Team tab ──────────────────────────────────────────────────────────────
// Two sections: the project's own team roster (read-only listing — assigning
// project members is still done via TaskFormModal's edit form until Edit mode
// lands in this shared workspace), and "Yderligere adgang" — the per-task
// quick_task_access grants, which now work for project tasks too, not just
// quick tasks. `canManage` gates the "+"/revoke actions; TaskWorkspaceContent
// passes its existing isOwnerOrManager check (same criterion already used to
// gate the Dokumentation/Indstillinger tabs).

export const TeamTab: React.FC<{
    task: Task;
    canManage: boolean;
    /** Lets the parent (which also caches this list for chat/assignee derivations) refresh in step. */
    onAccessChanged?: () => void;
}> = ({ task, canManage, onAccessChanged }) => {
    const [access, setAccess] = useState<TaskAccessEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const loadAccess = useCallback(async () => {
        setLoading(true);
        const rows = await listTaskAccess(task.id);
        setAccess(rows);
        setLoading(false);
    }, [task.id]);

    useEffect(() => { loadAccess(); }, [loadAccess]);

    const handleRevoke = async (entry: TaskAccessEntry) => {
        const key = entry.userId ?? entry.inviteEmail ?? '';
        setBusyKey(key);
        try {
            if (entry.userId) await revokeTaskAccess(task.id, entry.userId);
            else if (entry.inviteEmail) await revokeTaskAccessByEmail(task.id, entry.inviteEmail);
            await loadAccess();
            onAccessChanged?.();
        } finally {
            setBusyKey(null);
        }
    };

    const existingUserIds = access.map(a => a.userId).filter((id): id is string => !!id);

    return (
        <div className="space-y-4">
            {!!task.projectId && (task.projectTeam?.length ?? 0) > 0 && (
                <Card>
                    <CardHeader className="mb-3">
                        <CardTitle className="flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                            Projektteam
                        </CardTitle>
                    </CardHeader>
                    <div className="space-y-2">
                        {(task.projectTeam ?? []).map(member => (
                            <div key={member.id} className="flex items-center gap-3">
                                <Avatar name={member.name} size="sm" />
                                <p className="min-w-0 flex-1 truncate text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                    {member.name}
                                </p>
                                <Badge className="shrink-0">{PROJECT_ROLE_LABELS[member.role] ?? member.role}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card>
                <CardHeader className="mb-3">
                    <CardTitle className="flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                        Yderligere adgang
                    </CardTitle>
                    {canManage && (
                        <Button
                            size="sm"
                            variant="outline"
                            iconLeft={<PlusIcon className="h-4 w-4" />}
                            onClick={() => setShowInvite(true)}
                            className="shrink-0"
                        >
                            Tilføj
                        </Button>
                    )}
                </CardHeader>
                {loading ? (
                    <Skeleton className="h-16 w-full" />
                ) : access.length === 0 ? (
                    <EmptyState
                        icon={<UsersIcon />}
                        title="Ingen yderligere adgang"
                        description="Tilføj en person for at give adgang til denne opgave."
                    />
                ) : (
                    <div className="space-y-2">
                        {access.map(entry => {
                            const key = entry.userId ?? entry.inviteEmail ?? '';
                            const isBusy = busyKey === key;
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <Avatar name={entry.name || entry.inviteEmail || '?'} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-label font-semibold text-text-primary dark:text-text-dark-primary">
                                            {entry.name || entry.inviteEmail}
                                        </p>
                                        <div className="mt-0.5 flex items-center gap-1.5">
                                            <Badge variant="brand">{ROLE_LABELS[entry.role]}</Badge>
                                            <Badge variant={entry.status === 'active' ? 'success' : 'warning'}>
                                                {entry.status === 'active' ? 'Aktiv' : entry.userId ? 'Afventer' : 'Afventer konto'}
                                            </Badge>
                                        </div>
                                    </div>
                                    {canManage && (
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(entry)}
                                            disabled={isBusy}
                                            aria-label={`Fjern adgang for ${entry.name || entry.inviteEmail}`}
                                            title="Fjern adgang"
                                            className={cn(ICON_BTN, 'shrink-0 hover:text-danger dark:hover:text-danger')}
                                        >
                                            <XIcon className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {showInvite && (
                <InviteTaskMemberModal
                    taskId={task.id}
                    existingUserIds={existingUserIds}
                    onClose={() => setShowInvite(false)}
                    onGranted={() => { setShowInvite(false); loadAccess(); onAccessChanged?.(); }}
                />
            )}
        </div>
    );
};
