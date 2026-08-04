import React, { useEffect, useState } from 'react';
import { UsersIcon } from '../../../components/icons';
import {
    Avatar,
    Button,
    EmptyState,
    Input,
    Modal,
    Select,
    SegmentedControl,
    Skeleton,
} from '../../../components/ui';
import { listPartnerContacts } from '../../partners';
import type { PartnerContact } from '../../partners';
import {
    grantTaskAccess,
    inviteTaskAccessByEmailNoAccount,
    findUserByEmail,
    findUserByPhone,
    notifyTaskInvite,
} from '../../tasks';
import type { TaskAccessRole } from '../../tasks';
import { useModuleGate } from '../../../core/entitlements/ModuleGate';

const ROLE_LABELS: Record<TaskAccessRole, string> = {
    owner: 'Ejer',
    responsible: 'Ansvarlig',
    worker: 'Medarbejder',
    viewer: 'Kigger',
};

type InviteMode = 'contacts' | 'email' | 'phone';

// ─── Invite Task Member Modal ─────────────────────────────────────────────────
// Replaces the two near-duplicate DelegateQuickTaskModal copies
// (pages/TaskDetailPage, pages/GlobalTasksPage). Three ways to grant access:
// from an existing connection, by looking up an email/phone against a real
// account, or — email only — inviting someone with no BygSmart account yet
// (handle_new_user() auto-links it once they sign up with that address).

export const InviteTaskMemberModal: React.FC<{
    taskId: string;
    existingUserIds: string[];
    onClose: () => void;
    onGranted: () => void;
}> = ({ taskId, existingUserIds, onClose, onGranted }) => {
    const [mode, setMode] = useState<InviteMode>('contacts');
    const [role, setRole] = useState<TaskAccessRole>('worker');

    const [contacts, setContacts] = useState<PartnerContact[]>([]);
    const [contactsLoading, setContactsLoading] = useState(true);

    const [emailInput, setEmailInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [lookupState, setLookupState] = useState<'idle' | 'searching' | 'not-found'>('idle');

    const [busyId, setBusyId] = useState<string | null>(null);

    // `partners` gates the connections/contacts picker only — email and phone
    // lookup below stay available so internal team members can still be invited.
    const partnersEnabled = useModuleGate('partners');

    useEffect(() => {
        if (!partnersEnabled) { setContactsLoading(false); return; }
        listPartnerContacts()
            .then(setContacts)
            .finally(() => setContactsLoading(false));
    }, [partnersEnabled]);

    const grantAndNotify = async (params: { userId?: string; email?: string }) => {
        const key = params.userId ?? params.email ?? '';
        setBusyId(key);
        try {
            if (params.userId) {
                await grantTaskAccess(taskId, params.userId, role);
                await notifyTaskInvite({ taskId, granteeUserId: params.userId });
            } else if (params.email) {
                await inviteTaskAccessByEmailNoAccount(taskId, params.email, role);
                await notifyTaskInvite({ taskId, granteeEmail: params.email });
            }
            onGranted();
        } finally {
            setBusyId(null);
        }
    };

    const uninvitedContacts = contacts.filter(c => !existingUserIds.includes(c.id));

    const handleEmailLookup = async () => {
        const email = emailInput.trim();
        if (!email) return;
        setLookupState('searching');
        const found = await findUserByEmail(email);
        setLookupState('idle');
        if (found) {
            await grantAndNotify({ userId: found.id });
        } else {
            await grantAndNotify({ email });
        }
        setEmailInput('');
    };

    const handlePhoneLookup = async () => {
        const phone = phoneInput.trim();
        if (!phone) return;
        setLookupState('searching');
        const found = await findUserByPhone(phone);
        if (found) {
            setLookupState('idle');
            await grantAndNotify({ userId: found.id });
            setPhoneInput('');
        } else {
            setLookupState('not-found');
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={
                <span className="inline-flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 text-brand-primary" />
                    Tilføj til opgaven
                </span>
            }
            footer={<Button variant="outline" fullWidth onClick={onClose}>Luk</Button>}
        >
            <div className="space-y-4">
                <Select
                    label="Rolle"
                    value={role}
                    onChange={e => setRole(e.target.value as TaskAccessRole)}
                >
                    {(Object.keys(ROLE_LABELS) as TaskAccessRole[]).map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                </Select>

                <SegmentedControl<InviteMode>
                    label="Find person via"
                    value={mode}
                    onChange={setMode}
                    options={[
                        { label: 'Fra kontakter', value: 'contacts' },
                        { label: 'E-mail', value: 'email' },
                        { label: 'Telefon', value: 'phone' },
                    ]}
                />

                {mode === 'contacts' && (
                    contactsLoading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : uninvitedContacts.length === 0 ? (
                        <EmptyState
                            icon={<UsersIcon />}
                            title="Ingen kontakter at tilføje"
                            description="Alle dine kontakter har allerede adgang, eller du har ingen forbindelser endnu."
                        />
                    ) : (
                        <div className="space-y-2">
                            {uninvitedContacts.map(c => (
                                <div key={c.id} className="flex items-center gap-3 rounded-control bg-bg-subtle px-3 py-2.5 dark:bg-bg-dark-muted/50">
                                    <Avatar name={c.name} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-label font-semibold text-text-primary dark:text-text-dark-primary">{c.name}</p>
                                        <p className="truncate text-caption text-text-secondary dark:text-text-dark-secondary">{c.role}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => grantAndNotify({ userId: c.id })}
                                        disabled={!!busyId}
                                        loading={busyId === c.id}
                                        className="shrink-0"
                                    >
                                        Tilføj
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {mode === 'email' && (
                    <div className="space-y-2">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Input
                                    label="E-mailadresse"
                                    type="email"
                                    value={emailInput}
                                    onChange={e => setEmailInput(e.target.value)}
                                    placeholder="navn@firma.dk"
                                    onKeyDown={e => e.key === 'Enter' && handleEmailLookup()}
                                />
                            </div>
                            <Button
                                onClick={handleEmailLookup}
                                loading={lookupState === 'searching' || busyId === emailInput.trim()}
                                disabled={!emailInput.trim()}
                                className="shrink-0"
                            >
                                Inviter
                            </Button>
                        </div>
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                            Har personen allerede en BygSmart-konto, får de adgang med det samme. Ellers sender vi en invitation på e-mail — adgangen kobles automatisk til kontoen, når de opretter sig med samme e-mailadresse.
                        </p>
                    </div>
                )}

                {mode === 'phone' && (
                    <div className="space-y-2">
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Input
                                    label="Telefonnummer"
                                    type="tel"
                                    value={phoneInput}
                                    onChange={e => { setPhoneInput(e.target.value); setLookupState('idle'); }}
                                    placeholder="+45 12 34 56 78"
                                    onKeyDown={e => e.key === 'Enter' && handlePhoneLookup()}
                                />
                            </div>
                            <Button
                                onClick={handlePhoneLookup}
                                loading={lookupState === 'searching' || busyId === phoneInput.trim()}
                                disabled={!phoneInput.trim()}
                                className="shrink-0"
                            >
                                Søg
                            </Button>
                        </div>
                        {lookupState === 'not-found' && (
                            <p className="text-caption text-warning-strong dark:text-warning">
                                Ingen bruger fundet med dette telefonnummer. Telefonopslag virker kun for personer, der allerede har en BygSmart-konto — prøv e-mail i stedet.
                            </p>
                        )}
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary">
                            Telefonnummeret bruges kun til at finde personens eksisterende konto.
                        </p>
                    </div>
                )}
            </div>
        </Modal>
    );
};
