

import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../../types';
import {
    getUserConnections,
    searchUsersToConnect,
    sendConnectionRequest,
    getPendingConnectionRequests,
    acceptConnectionRequest,
    rejectConnectionRequest,
    getSentConnectionRequests,
    createConnectionInvite,
    type PendingConnectionRequest,
} from '../../services/api';
import {
    UserIcon, PlusIcon, SearchIcon, CheckCircleIcon, UsersIcon,
    SendIcon, BriefcaseIcon, CheckIcon, XIcon, ClockIcon,
} from '../icons';
import { useAuth } from '../../contexts/AuthProvider';
import { useToast } from '../../contexts/ToastContext';
import {
    Avatar,
    Badge,
    Button,
    Card,
    EmptyState,
    Input,
    ListRow,
    Modal,
    SegmentedControl,
    SkeletonList,
} from '../ui';

interface ConnectionManagerModalProps {
    onClose: () => void;
}

export const ConnectionManagerModal: React.FC<ConnectionManagerModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'mine' | 'requests' | 'find'>('mine');
    const [connections, setConnections] = useState<User[]>([]);
    const [pendingRequests, setPendingRequests] = useState<PendingConnectionRequest[]>([]);
    const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [targetRole, setTargetRole] = useState<UserRole>('EMPLOYEE');

    const connectedIds = new Set(connections.map(c => c.id));

    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [conns, reqs, sent] = await Promise.all([
            getUserConnections(user.id),
            getPendingConnectionRequests(),
            getSentConnectionRequests(),
        ]);
        setConnections(conns);
        setPendingRequests(reqs);
        setSentRequestIds(sent);
        setLoading(false);
    }, [user]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) { setSearchResults([]); return; }
        if (!user) return;
        const results = await searchUsersToConnect(user.id, query);
        setSearchResults(results);
    };

    const handleSendRequest = async (targetUser: User) => {
        if (!user) return;
        try {
            await sendConnectionRequest(targetUser.id, targetRole);
            setSentRequestIds(prev => new Set([...prev, targetUser.id]));
            showToast(`Forbindelsesanmodning sendt til ${targetUser.name}.`, 'success');
        } catch (err: any) {
            if (err?.message?.includes('Allerede forbundet')) {
                showToast('Du er allerede forbundet med denne bruger.', 'info');
            } else {
                showToast('Anmodningen kunne ikke sendes. Prøv igen.', 'error');
            }
        }
    };

    const handleAccept = async (req: PendingConnectionRequest) => {
        try {
            await acceptConnectionRequest(req.requestId);
            showToast(`${req.name} er nu tilføjet til dine forbindelser.`, 'success');
            await fetchAll();
        } catch {
            showToast('Kunne ikke acceptere anmodningen. Prøv igen.', 'error');
        }
    };

    const handleReject = async (req: PendingConnectionRequest) => {
        try {
            await rejectConnectionRequest(req.requestId);
            setPendingRequests(prev => prev.filter(r => r.requestId !== req.requestId));
            showToast('Anmodning afvist.', 'info');
        } catch {
            showToast('Kunne ikke afvise anmodningen. Prøv igen.', 'error');
        }
    };

    const handleInviteEmail = async () => {
        if (!inviteEmail.trim() || !user) return;
        const result = await createConnectionInvite(inviteEmail.trim(), targetRole);
        if (result.alreadyMember) {
            showToast(result.message || 'Denne person har allerede en BygSmart-konto.', 'info');
        } else if (result.success && result.emailSent) {
            showToast(result.message || `Invitation sendt til ${inviteEmail}.`, 'success');
        } else if (result.success) {
            showToast(result.message || `Invitation til ${inviteEmail} er registreret.`, 'success');
        } else {
            showToast(result.message || 'Invitationen kunne ikke sendes. Prøv igen.', 'error');
        }
        setInviteEmail('');
    };

    const getConnectButtonState = (userId: string) => {
        if (connectedIds.has(userId)) return 'connected';
        if (sentRequestIds.has(userId)) return 'pending';
        return 'none';
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="inline-flex items-center gap-2 flex-wrap">
                    Mit Netværk
                    {user?.teamRole === 'leader' && (
                        <Badge variant="warning">👑 Du er team leder</Badge>
                    )}
                </span>
            }
            footer={<Button variant="secondary" fullWidth onClick={onClose}>Luk</Button>}
        >
            {/* Tabs */}
            <SegmentedControl
                label="Netværksvisning"
                className="mb-4"
                value={activeTab}
                onChange={(v) => setActiveTab(v as 'mine' | 'requests' | 'find')}
                options={[
                    { label: `Forbindelser (${connections.length})`, value: 'mine' },
                    {
                        label: (
                            <span className="inline-flex items-center gap-1.5">
                                Anmodninger
                                {pendingRequests.length > 0 && (
                                    <Badge variant="danger">{pendingRequests.length}</Badge>
                                )}
                            </span>
                        ),
                        value: 'requests',
                    },
                    { label: 'Find & Tilføj', value: 'find' },
                ]}
            />

            {/* ── Tab: Mine Forbindelser ── */}
            {activeTab === 'mine' && (
                <div className="max-h-72 overflow-y-auto">
                    {loading ? (
                        <SkeletonList count={3} label="Indlæser forbindelser…" />
                    ) : connections.length > 0 ? (
                        <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                            {connections.map(conn => {
                                const isCompany = conn.name.includes('ApS') || conn.name.includes('A/S');
                                return (
                                    <ListRow
                                        key={conn.id}
                                        leading={
                                            isCompany ? (
                                                <span className="w-10 h-10 rounded-full bg-warning-subtle dark:bg-warning-subtle-dark text-warning-strong dark:text-warning flex items-center justify-center shrink-0">
                                                    <BriefcaseIcon className="w-5 h-5" />
                                                </span>
                                            ) : (
                                                <Avatar name={conn.name} size="md" />
                                            )
                                        }
                                        title={conn.name}
                                        subtitle={`@${conn.username}`}
                                        trailing={
                                            <span className="flex flex-col items-end gap-1">
                                                {isCompany
                                                    ? <Badge variant="warning">Firma</Badge>
                                                    : <CheckCircleIcon className="w-5 h-5 text-success" aria-label="Forbundet" />}
                                                {conn.teamRole === 'staff' && (
                                                    <Badge variant="info">Team Staff</Badge>
                                                )}
                                                {conn.teamRole === 'leader' && (
                                                    <Badge variant="warning">👑 Team Leder</Badge>
                                                )}
                                            </span>
                                        }
                                    />
                                );
                            })}
                        </Card>
                    ) : (
                        <EmptyState
                            icon={<UsersIcon className="w-8 h-8" />}
                            title="Ingen forbindelser endnu"
                            description="Find kollegaer og underentreprenører, og byg dit netværk op."
                            action={
                                <Button size="sm" variant="outline" onClick={() => setActiveTab('find')}>
                                    Find kollegaer
                                </Button>
                            }
                        />
                    )}
                </div>
            )}

            {/* ── Tab: Anmodninger ── */}
            {activeTab === 'requests' && (
                <div className="max-h-72 overflow-y-auto">
                    {loading ? (
                        <SkeletonList count={2} label="Indlæser anmodninger…" />
                    ) : pendingRequests.length > 0 ? (
                        <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                            {pendingRequests.map(req => (
                                <ListRow
                                    key={req.requestId}
                                    leading={<Avatar name={req.name} size="md" />}
                                    title={req.name}
                                    subtitle={`@${req.username}`}
                                    trailing={
                                        <span className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleAccept(req)}
                                                iconLeft={<CheckIcon className="w-3.5 h-3.5" />}
                                            >
                                                Accepter
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleReject(req)}
                                                iconLeft={<XIcon className="w-3.5 h-3.5" />}
                                            >
                                                Afvis
                                            </Button>
                                        </span>
                                    }
                                />
                            ))}
                        </Card>
                    ) : (
                        <EmptyState
                            icon={<ClockIcon className="w-8 h-8" />}
                            title="Ingen ventende anmodninger"
                            description="Nye forbindelsesanmodninger vises her."
                        />
                    )}
                </div>
            )}

            {/* ── Tab: Find & Tilføj ── */}
            {activeTab === 'find' && (
                <div className="space-y-5">
                    {/* Role selector */}
                    <div>
                        <p className="text-caption font-bold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider mb-2">
                            Tilføj som
                        </p>
                        <SegmentedControl
                            label="Tilføj som"
                            value={targetRole === 'EXTERNAL' ? 'EXTERNAL' : 'EMPLOYEE'}
                            onChange={(v) => setTargetRole(v as UserRole)}
                            options={[
                                { label: 'Medarbejder', value: 'EMPLOYEE', icon: <UserIcon className="w-3.5 h-3.5" /> },
                                { label: 'Underentreprenør', value: 'EXTERNAL', icon: <BriefcaseIcon className="w-3.5 h-3.5" /> },
                            ]}
                        />
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary dark:text-text-dark-tertiary pointer-events-none" />
                        <Input
                            value={searchQuery}
                            onChange={e => handleSearch(e.target.value)}
                            placeholder="Søg efter navn eller brugernavn..."
                            className="pl-9"
                            autoFocus
                            aria-label="Søg efter brugere"
                        />
                    </div>

                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        {searchResults.map(res => {
                            const state = getConnectButtonState(res.id);
                            return (
                                <ListRow
                                    key={res.id}
                                    className="rounded-control"
                                    leading={<Avatar name={res.name} size="sm" />}
                                    title={res.name}
                                    subtitle={`@${res.username}`}
                                    trailing={
                                        state === 'connected' ? (
                                            <Badge variant="success" dot>Forbundet</Badge>
                                        ) : state === 'pending' ? (
                                            <Badge>Afventende</Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSendRequest(res)}
                                                iconLeft={<PlusIcon className="w-3.5 h-3.5" />}
                                            >
                                                Send anmodning
                                            </Button>
                                        )
                                    }
                                />
                            );
                        })}
                        {searchQuery.length >= 2 && searchResults.length === 0 && (
                            <p className="text-center text-label text-text-secondary dark:text-text-dark-secondary py-2">
                                Ingen brugere fundet.
                            </p>
                        )}
                    </div>

                    {/* Email invite */}
                    <div className="border-t border-border dark:border-border-dark pt-4">
                        <h4 className="text-label font-bold text-text-primary dark:text-text-dark-primary mb-2 flex items-center gap-2">
                            <SendIcon className="w-4 h-4" /> Inviter via email
                        </h4>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <Input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={e => setInviteEmail(e.target.value)}
                                    placeholder="mail@eksempel.dk"
                                    aria-label="E-mail til invitation"
                                />
                            </div>
                            <Button
                                onClick={handleInviteEmail}
                                disabled={!inviteEmail.trim()}
                            >
                                Send
                            </Button>
                        </div>
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary mt-2">
                            Inviter en kollega, der endnu ikke har en profil, til at deltage i Bygge App.
                        </p>
                    </div>
                </div>
            )}
        </Modal>
    );
};
