import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, Input, ListRow, Modal, SkeletonList, cn } from '../ui';
import { BuildingIcon, PlusIcon, UsersIcon } from '../icons';
import { useAuth } from '../../contexts/AuthProvider';
import { useOrg } from '../../core/org/OrgProvider';
import { useToast } from '../../contexts/ToastContext';
import { useTeamViewMode, useOrgChartData, OrgChartView } from '../../modules/team';
import {
    OrgMember,
    OrgRole,
    acceptOrgInvite,
    createOrganization,
    inviteOrgMember,
    listOrgMembers,
    notifyOrgInvite,
    removeOrgMember,
} from '../../services/organizations';
import { findUserByEmail } from '../../modules/tasks';

/**
 * "Organisation" section on the Settings page (BYG 3.0 Phase 2).
 *
 * Shows the active org + its members, lets owners/admins invite by e-mail
 * (non-team-backed orgs only — team-backed orgs manage members via the
 * Stripe-billed team-seat flow until Phase 8), lets invitees accept pending
 * invites, and lets anyone create a new organization.
 */

const roleBadge = (role: OrgRole) => {
    if (role === 'owner') return <Badge variant="brand">Ejer</Badge>;
    if (role === 'admin') return <Badge variant="info">Admin</Badge>;
    return <Badge variant="neutral">Medlem</Badge>;
};

const CreateOrgModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [cvr, setCvr] = useState('');
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        setSaving(true);
        try {
            await createOrganization(name, cvr || undefined);
            showToast('Organisationen er oprettet.', 'success');
            onCreated();
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Kunne ikke oprette organisationen.', 'error');
            setSaving(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Opret organisation"
            description="Du bliver ejer og skifter automatisk til den nye organisation."
            size="sm"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>Annuller</Button>
                    <Button onClick={handleCreate} loading={saving} disabled={name.trim().length < 2}>Opret</Button>
                </>
            }
        >
            <div className="space-y-4">
                <Input
                    label="Navn"
                    placeholder="F.eks. Hansen Byg ApS"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <Input
                    label="CVR (valgfrit)"
                    placeholder="12345678"
                    value={cvr}
                    onChange={(e) => setCvr(e.target.value)}
                />
            </div>
        </Modal>
    );
};

const OrganisationSection: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { memberships, activeOrg, refresh } = useOrg();
    const { showToast } = useToast();

    const [members, setMembers] = useState<OrgMember[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    // Mirror the /team page's view choice (no toggle rendered here).
    const [viewMode] = useTeamViewMode();
    const chart = useOrgChartData({ enabled: viewMode === 'chart' });

    const activeMembership = memberships.find((m) => m.org.id === activeOrg?.id && m.status === 'active');
    const canManage = activeMembership?.role === 'owner' || activeMembership?.role === 'admin';
    const isTeamBacked = !!activeOrg?.sourceTeamId;
    const pendingInvites = memberships.filter((m) => m.status === 'pending');

    const loadMembers = useCallback(async () => {
        if (!activeOrg) { setMembers([]); return; }
        setMembers(await listOrgMembers(activeOrg.id));
    }, [activeOrg]);

    useEffect(() => { loadMembers(); }, [loadMembers]);

    const handleAccept = async (orgId: string) => {
        try {
            await acceptOrgInvite(orgId);
            showToast('Du er nu medlem af organisationen.', 'success');
            await refresh();
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Kunne ikke acceptere invitationen.', 'error');
        }
    };

    const handleInvite = async () => {
        if (!activeOrg) return;
        const email = inviteEmail.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showToast('Indtast en gyldig e-mailadresse.', 'error');
            return;
        }
        setInviting(true);
        try {
            const existing = await findUserByEmail(email);
            if (existing) {
                await inviteOrgMember(activeOrg.id, { userId: existing.id });
                await notifyOrgInvite({ orgId: activeOrg.id, granteeUserId: existing.id });
            } else {
                await inviteOrgMember(activeOrg.id, { email });
                await notifyOrgInvite({ orgId: activeOrg.id, granteeEmail: email });
            }
            showToast('Invitationen er sendt.', 'success');
            setInviteEmail('');
            await loadMembers();
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Kunne ikke sende invitationen.', 'error');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (member: OrgMember) => {
        if (!window.confirm(`Fjern ${member.name || member.inviteEmail} fra organisationen?`)) return;
        try {
            await removeOrgMember(member.id);
            showToast('Medlemmet er fjernet.', 'success');
            await loadMembers();
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Kunne ikke fjerne medlemmet.', 'error');
        }
    };

    return (
        <section className="flex flex-col gap-3" aria-label="Organisation">
            <h3 className="text-label font-semibold ml-1 text-text-secondary dark:text-text-dark-secondary">
                Organisation
            </h3>

            {/* Pending invites to me */}
            {pendingInvites.length > 0 && (
                <Card padding="none" className="overflow-hidden border-brand-border dark:border-brand-border-dark">
                    {pendingInvites.map((m) => (
                        <div key={m.org.id} className="flex items-center gap-3 px-4 py-3">
                            <BuildingIcon className="w-5 h-5 shrink-0 text-brand-primary" />
                            <div className="flex-1 min-w-0">
                                <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{m.org.name}</p>
                                <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Du er inviteret til denne organisation</p>
                            </div>
                            <Button size="sm" onClick={() => handleAccept(m.org.id)}>Acceptér</Button>
                        </div>
                    ))}
                </Card>
            )}

            <Card padding="none" className="overflow-hidden">
                {activeOrg ? (
                    <>
                        <ListRow
                            leading={<BuildingIcon className="w-5 h-5 text-brand-primary" />}
                            title={activeOrg.name}
                            subtitle={
                                <>
                                    {activeOrg.cvr ? `CVR ${activeOrg.cvr}` : 'Intet CVR'}
                                    {activeMembership && <> · {activeMembership.role === 'owner' ? 'Ejer' : activeMembership.role === 'admin' ? 'Admin' : 'Medlem'}</>}
                                </>
                            }
                        />

                        {/* Members — mirrors the /team view choice: list rows or a compact org diagram */}
                        {viewMode === 'chart' ? (
                            <div className="border-t border-border dark:border-border-dark p-3">
                                {chart.loading || !chart.data ? (
                                    <SkeletonList count={2} label="Indlæser diagram…" />
                                ) : (
                                    <OrgChartView data={chart.data} currentUserId={user?.id} compact />
                                )}
                            </div>
                        ) : (
                            <div className="border-t border-border dark:border-border-dark divide-y divide-border dark:divide-border-dark">
                                {members.map((member) => (
                                    <div key={member.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <Avatar name={member.name || member.inviteEmail || '?'} size="sm" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                                {member.name || member.inviteEmail}
                                            </p>
                                            <p className="text-caption text-text-secondary dark:text-text-dark-secondary">
                                                {member.status === 'pending' ? 'Afventer accept' : 'Aktiv'}
                                            </p>
                                        </div>
                                        {roleBadge(member.role)}
                                        {canManage && member.userId !== user?.id && member.role !== 'owner' && !isTeamBacked && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(member)}
                                                className="text-caption font-semibold text-danger hover:underline min-h-11 px-1"
                                                aria-label={`Fjern ${member.name || member.inviteEmail}`}
                                            >
                                                Fjern
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Invite (owner/admin, non-team-backed orgs) */}
                        {canManage && !isTeamBacked && (
                            <div className="border-t border-border dark:border-border-dark p-4 flex flex-col sm:flex-row gap-2">
                                <input
                                    type="email"
                                    placeholder="Invitér via e-mail…"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="flex-1 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-bg-dark-surface px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                                <Button size="sm" onClick={handleInvite} loading={inviting} disabled={!inviteEmail.trim()}>
                                    <PlusIcon className="w-4 h-4 mr-1" /> Invitér
                                </Button>
                            </div>
                        )}

                        {/* Team-backed orgs: members are billed seats */}
                        {isTeamBacked && (
                            <button
                                type="button"
                                onClick={() => navigate('/team')}
                                className={cn(
                                    'w-full flex items-center gap-2 px-4 py-3 border-t border-border dark:border-border-dark',
                                    'text-label font-semibold text-brand-primary text-left hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors'
                                )}
                            >
                                <UsersIcon className="w-4 h-4" />
                                Medlemmer administreres under Teams & sæder →
                            </button>
                        )}
                    </>
                ) : (
                    <div className="px-4 py-6 text-center text-label text-text-secondary dark:text-text-dark-secondary">
                        Ingen aktiv organisation endnu.
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 border-t border-border dark:border-border-dark text-label font-semibold text-text-primary dark:text-text-dark-primary text-left hover:bg-bg-subtle dark:hover:bg-bg-dark-muted/50 transition-colors"
                >
                    <PlusIcon className="w-4 h-4 text-brand-primary" />
                    Opret ny organisation
                </button>
            </Card>

            {createOpen && (
                <CreateOrgModal
                    onClose={() => setCreateOpen(false)}
                    onCreated={async () => {
                        setCreateOpen(false);
                        await refresh();
                    }}
                />
            )}
        </section>
    );
};

export default OrganisationSection;
