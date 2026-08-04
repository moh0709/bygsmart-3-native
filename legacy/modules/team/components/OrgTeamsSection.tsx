import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthProvider';
import { useToast } from '../../../contexts/ToastContext';
import { useOrg } from '../../../core/org/OrgProvider';
import { Alert, Badge, Button, Card, Input, cn } from '../../../components/ui';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { PlusIcon, TrashIcon, UsersIcon } from '../../../components/icons';
import {
    OrgTeam,
    createOrgTeam,
    deleteOrgTeam,
    inviteOrgTeamMember,
    listOrgTeams,
    removeOrgTeamMember,
    respondToOrgTeamInvite,
    setOrgTeamLeader,
} from '../services/orgTeams';

/**
 * "Arbejdshold" (Teams v2 T1): the org owner creates any number of work
 * teams, invites members by e-mail and appoints a leader; everyone sees the
 * teams they belong to and accepts invitations here.
 */
export const OrgTeamsSection: React.FC = () => {
    const { user } = useAuth();
    const { activeOrg } = useOrg();
    const { showToast } = useToast();

    const [teams, setTeams] = useState<OrgTeam[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newTeamName, setNewTeamName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<OrgTeam | null>(null);

    const isOwner = !!activeOrg && user?.id === activeOrg.createdBy;

    const reload = useCallback(async () => {
        setTeams(await listOrgTeams());
        setIsLoading(false);
    }, []);

    useEffect(() => { reload(); }, [reload]);

    if (!activeOrg) return null;

    const myPendingInvites = teams.filter(t =>
        t.members.some(m => m.userId === user?.id && m.status === 'pending'));

    const run = async (fn: () => Promise<unknown>, okMsg: string) => {
        try {
            await fn();
            await reload();
            showToast(okMsg, 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Handlingen mislykkedes.', 'error');
        }
    };

    const handleCreate = async () => {
        const name = newTeamName.trim();
        if (!name) return;
        setIsCreating(true);
        await run(() => createOrgTeam(activeOrg.id, name), `Holdet "${name}" er oprettet.`);
        setNewTeamName('');
        setIsCreating(false);
    };

    const handleInvite = async (teamId: string) => {
        const email = inviteEmail.trim();
        if (!email) return;
        setIsInviting(true);
        await run(() => inviteOrgTeamMember(teamId, email), 'Invitationen er sendt — personen accepterer under Mine hold.');
        setInviteEmail('');
        setIsInviting(false);
    };

    return (
        <section className="flex flex-col gap-3" aria-label="Arbejdshold">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-heading text-text-primary dark:text-text-dark-primary">Arbejdshold</h3>
                {!isLoading && (
                    <Badge variant="neutral">{teams.length} {teams.length === 1 ? 'hold' : 'hold'}</Badge>
                )}
            </div>

            {/* My pending invitations */}
            {myPendingInvites.map(team => (
                <Alert
                    key={team.id}
                    variant="info"
                    title={`Du er inviteret til holdet "${team.name}"`}
                    action={
                        <div className="flex gap-2">
                            <Button size="sm" onClick={() => run(() => respondToOrgTeamInvite(team.id, true), `Du er nu med på "${team.name}".`)}>
                                Acceptér
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => run(() => respondToOrgTeamInvite(team.id, false), 'Invitationen er afvist.')}>
                                Afvis
                            </Button>
                        </div>
                    }
                >
                    Som medlem kan holdet tildeles projekter og opgaver samlet.
                </Alert>
            ))}

            {/* Create (org owner) */}
            {isOwner && (
                <Card padding="md">
                    <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <Input
                                label="Nyt arbejdshold"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="fx Sjak 1 — Tømrer"
                            />
                        </div>
                        <Button
                            iconLeft={<PlusIcon className="w-4 h-4" />}
                            onClick={handleCreate}
                            disabled={isCreating || !newTeamName.trim()}
                        >
                            Opret
                        </Button>
                    </div>
                </Card>
            )}

            {/* Teams */}
            {!isLoading && teams.length === 0 ? (
                <Card padding="md">
                    <p className="text-body text-text-secondary dark:text-text-dark-secondary">
                        {isOwner
                            ? 'Ingen arbejdshold endnu — opret det første ovenfor og invitér dine folk.'
                            : 'Du er ikke med på et arbejdshold endnu. Organisationens ejer opretter hold og sender invitationer.'}
                    </p>
                </Card>
            ) : (
                teams.map(team => {
                    const leader = team.members.find(m => m.role === 'leader');
                    const activeMembers = team.members.filter(m => m.status === 'active');
                    const pendingMembers = team.members.filter(m => m.status === 'pending');
                    const canManage = isOwner || team.leaderId === user?.id;
                    const expanded = expandedId === team.id;
                    return (
                        <Card key={team.id} padding="none" className="overflow-hidden">
                            <button
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                                onClick={() => setExpandedId(expanded ? null : team.id)}
                                aria-expanded={expanded ? 'true' : 'false'}
                            >
                                <span className="flex w-10 h-10 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-primary dark:bg-brand-subtle-dark dark:text-brand-light" aria-hidden="true">
                                    <UsersIcon className="w-5 h-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-label font-bold text-text-primary dark:text-text-dark-primary truncate">{team.name}</span>
                                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                                        {leader ? `Holdleder: ${leader.name}` : 'Ingen holdleder endnu'}
                                        {' · '}{activeMembers.length} {activeMembers.length === 1 ? 'medlem' : 'medlemmer'}
                                        {pendingMembers.length > 0 ? ` · ${pendingMembers.length} afventer` : ''}
                                    </span>
                                </span>
                            </button>

                            {expanded && (
                                <div className="border-t border-border dark:border-border-dark px-4 py-3 space-y-3">
                                    <ul className="divide-y divide-border dark:divide-border-dark">
                                        {team.members.map(m => (
                                            <li key={m.userId} className="flex items-center gap-3 py-2.5">
                                                <span className="flex w-8 h-8 shrink-0 items-center justify-center rounded-full bg-bg-muted dark:bg-bg-dark-muted text-caption font-bold text-text-primary dark:text-text-dark-primary" aria-hidden="true">
                                                    {m.initials}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className={cn('block text-label truncate', m.status === 'pending' ? 'text-text-secondary dark:text-text-dark-secondary' : 'text-text-primary dark:text-text-dark-primary font-semibold')}>
                                                        {m.name}
                                                    </span>
                                                </span>
                                                {m.role === 'leader'
                                                    ? <Badge variant="brand">Holdleder</Badge>
                                                    : m.status === 'pending'
                                                        ? <Badge variant="neutral">Afventer</Badge>
                                                        : canManage && (
                                                            <Button size="sm" variant="ghost" onClick={() => run(() => setOrgTeamLeader(team.id, m.userId), `${m.name} er nu holdleder.`)}>
                                                                Gør til leder
                                                            </Button>
                                                        )}
                                                {canManage && m.userId !== user?.id && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        aria-label={`Fjern ${m.name}`}
                                                        onClick={() => run(() => removeOrgTeamMember(team.id, m.userId), `${m.name} er fjernet fra holdet.`)}
                                                    >
                                                        <TrashIcon className="w-4 h-4 text-danger" />
                                                    </Button>
                                                )}
                                            </li>
                                        ))}
                                        {team.members.length === 0 && (
                                            <li className="py-2.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                                                Ingen medlemmer endnu.
                                            </li>
                                        )}
                                    </ul>

                                    {canManage && (
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    label="Invitér medlem (e-mail)"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    placeholder="kollega@firma.dk"
                                                    autoComplete="email"
                                                />
                                            </div>
                                            <Button onClick={() => handleInvite(team.id)} disabled={isInviting || !inviteEmail.trim()}>
                                                Invitér
                                            </Button>
                                        </div>
                                    )}

                                    {isOwner && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            iconLeft={<TrashIcon className="w-4 h-4" />}
                                            className="text-danger"
                                            onClick={() => setConfirmDelete(team)}
                                        >
                                            Slet hold
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card>
                    );
                })
            )}

            <ConfirmDialog
                isOpen={!!confirmDelete}
                title="Slet arbejdshold"
                message={`Er du sikker på, at du vil slette "${confirmDelete?.name}"? Medlemmerne mister deres tilknytning til holdet.`}
                confirmLabel="Slet hold"
                onConfirm={() => {
                    if (confirmDelete) run(() => deleteOrgTeam(confirmDelete.id), 'Holdet er slettet.');
                    setConfirmDelete(null);
                }}
                onCancel={() => setConfirmDelete(null)}
            />
        </section>
    );
};
