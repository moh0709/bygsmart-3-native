import React, { useEffect, useMemo, useState } from 'react';
import { Task } from '../../../types';
import {
    invitePartner, kronerToOre, listPartnerContacts, type PartnerContact,
} from '../services/partners';
import { Avatar, Badge, Button, EmptyState, Input, Modal, SkeletonList, Textarea, cn } from '../../../components/ui';
import { useToast } from '../../../contexts/ToastContext';

interface InvitePartnerModalProps {
    open: boolean;
    projectId: string;
    projectName?: string;
    onClose: () => void;
    /** Called with the new invite id after a successful invitation. */
    onInvited?: (inviteId: string) => void;
    /** Task ids to pre-select when the modal opens (e.g. when delegating a single task). */
    initialTaskIds?: string[];
}

/**
 * Manager flow: pick a connected partner (Underleverandør), select the
 * project tasks the partner may see, write a message and optionally attach
 * an opening price. The partner only ever sees the selected tasks plus
 * project name/description/deadline — enforced by RLS, not this UI.
 */
export const InvitePartnerModal: React.FC<InvitePartnerModalProps> = ({
    open,
    projectId,
    projectName,
    onClose,
    onInvited,
    initialTaskIds,
}) => {
    const { showToast } = useToast();

    const [contacts, setContacts] = useState<PartnerContact[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [partnerId, setPartnerId] = useState<string>('');
    const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
    const [priceKr, setPriceKr] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        // tasks' card components statically import partners (formatOre), so
        // partners loads task data via dynamic import to keep the edge one-way.
        Promise.all([listPartnerContacts(), import('../../tasks').then((m) => m.getTasksForProject(projectId))])
            .then(([loadedContacts, loadedTasks]) => {
                if (cancelled) return;
                setContacts(loadedContacts);
                setTasks(loadedTasks);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, projectId]);

    // Reset form state when the modal is reopened. When initialTaskIds is
    // provided (e.g. delegating a single task), those tasks start pre-selected.
    useEffect(() => {
        if (!open) return;
        setPartnerId('');
        setSelectedTaskIds(new Set(initialTaskIds ?? []));
        setMessage('');
        setPriceKr('');
        setFormError(null);
    }, [open]);

    const toggleTask = (taskId: string) => {
        setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    };

    const priceOre = useMemo(() => {
        if (!priceKr.trim()) return undefined;
        const ore = kronerToOre(priceKr);
        return ore > 0 ? ore : undefined;
    }, [priceKr]);

    const canSubmit = !!partnerId && selectedTaskIds.size > 0 && !submitting;

    const handleSubmit = async () => {
        if (!partnerId) { setFormError('Vælg en partner.'); return; }
        if (selectedTaskIds.size === 0) { setFormError('Vælg mindst én opgave.'); return; }
        setFormError(null);
        setSubmitting(true);
        try {
            const inviteId = await invitePartner(
                projectId,
                partnerId,
                Array.from(selectedTaskIds),
                message.trim(),
                priceOre
            );
            showToast('Invitationen er sendt til partneren.', 'success');
            onInvited?.(inviteId);
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('allerede tilknyttet')) {
                showToast('Partneren er allerede tilknyttet projektet.', 'info');
            } else {
                showToast('Invitationen kunne ikke sendes. Prøv igen.', 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Inviter underleverandør"
            description={projectName ? `Projekt: ${projectName}` : 'Partneren ser kun projektnavn, beskrivelse, deadline og de valgte opgaver.'}
            size="lg"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Annuller
                    </Button>
                    <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                        Send invitation
                    </Button>
                </>
            }
        >
            {loading ? (
                <SkeletonList count={3} label="Indlæser kontakter og opgaver…" />
            ) : (
                <div className="space-y-5">
                    {/* Partner picker */}
                    <fieldset>
                        <legend className="block text-label font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                            Vælg partner <span className="text-danger" aria-hidden="true">*</span>
                        </legend>
                        {contacts.length === 0 ? (
                            <EmptyState
                                title="Ingen forbindelser"
                                description="Du har endnu ingen forbindelser at invitere. Tilføj en underleverandør via Mit Netværk først."
                                className="py-6"
                            />
                        ) : (
                            <div className="space-y-2 max-h-52 overflow-y-auto pr-1" role="radiogroup" aria-label="Vælg partner">
                                {contacts.map(contact => {
                                    const selected = partnerId === contact.id;
                                    return (
                                        <button
                                            key={contact.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => setPartnerId(contact.id)}
                                            className={cn(
                                                'w-full flex items-center gap-3 p-3 min-h-11 rounded-control border text-left transition-colors duration-150',
                                                selected
                                                    ? 'border-brand-primary bg-brand-subtle dark:bg-brand-subtle-dark'
                                                    : 'border-border dark:border-border-dark hover:bg-bg-muted dark:hover:bg-bg-dark-muted'
                                            )}
                                        >
                                            <Avatar name={contact.name} size="sm" />
                                            <span className="min-w-0 grow">
                                                <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                                                    {contact.name}
                                                </span>
                                                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                                                    @{contact.username}
                                                </span>
                                            </span>
                                            {contact.role === 'EXTERNAL' && (
                                                <Badge variant="warning">Underleverandør</Badge>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </fieldset>

                    {/* Task allowlist */}
                    <fieldset>
                        <legend className="block text-label font-medium text-text-primary dark:text-text-dark-primary mb-1.5">
                            Opgaver partneren inviteres til <span className="text-danger" aria-hidden="true">*</span>
                        </legend>
                        <p className="text-caption text-text-tertiary dark:text-text-dark-tertiary mb-2">
                            Partneren får kun adgang til de valgte opgaver — aldrig budget eller øvrige opgaver.
                        </p>
                        {tasks.length === 0 ? (
                            <EmptyState
                                title="Ingen opgaver"
                                description="Projektet har endnu ingen opgaver at invitere til."
                                className="py-6"
                            />
                        ) : (
                            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                                {tasks.map(task => (
                                    <label
                                        key={task.id}
                                        className="flex items-center gap-3 p-2.5 min-h-11 rounded-control border border-border dark:border-border-dark hover:bg-bg-muted dark:hover:bg-bg-dark-muted cursor-pointer transition-colors duration-150"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.has(task.id)}
                                            onChange={() => toggleTask(task.id)}
                                            className="w-4 h-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary shrink-0"
                                        />
                                        <span className="min-w-0 grow">
                                            <span className="block text-label font-medium text-text-primary dark:text-text-dark-primary truncate">
                                                {task.step ? `${task.step} · ` : ''}{task.title}
                                            </span>
                                            {task.dueDate && (
                                                <span className="block text-caption text-text-secondary dark:text-text-dark-secondary">
                                                    Frist: {task.dueDate}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        {selectedTaskIds.size > 0 && (
                            <p className="mt-1.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                                {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'opgave valgt' : 'opgaver valgt'}
                            </p>
                        )}
                    </fieldset>

                    <Textarea
                        label="Besked til partneren"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Beskriv opgaven, omfang og forventninger…"
                        rows={3}
                    />

                    <Input
                        label="Åbningstilbud (DKK)"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={priceKr}
                        onChange={e => setPriceKr(e.target.value)}
                        placeholder="F.eks. 12500"
                        hint="Valgfrit. Beløbet sendes som dit første tilbud i forhandlingen."
                    />

                    {formError && (
                        <p role="alert" className="text-label text-danger">{formError}</p>
                    )}
                </div>
            )}
        </Modal>
    );
};

export default InvitePartnerModal;
