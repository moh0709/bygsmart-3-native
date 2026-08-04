import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { useToast } from '../contexts/ToastContext';
import { Modal, Input, Button } from './ui';
import { SendIcon } from './icons';
import { createConnectionInvite } from '../services/api';

interface InviteModalProps {
    onClose: () => void;
}

const PITCH_POINTS = [
    'Projekter, opgaver og tidsregistrering samlet ét sted',
    'Tilbud, indkøb og kvalitetssikring uden løse tråde',
    'Indbygget AI-assistent og 80+ byggeberegnere',
];

/** Global "Invite" entry point — invites someone who does not yet have a
 * BygSmart account by email, with a short pitch and a signup link. */
export const InviteModal: React.FC<InviteModalProps> = ({ onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        const trimmed = email.trim();
        if (!trimmed || !user || isSending) return;
        setIsSending(true);
        try {
            const result = await createConnectionInvite(trimmed, 'EMPLOYEE');
            if (result.alreadyMember) {
                showToast(result.message || 'Denne person har allerede en BygSmart-konto.', 'info');
            } else if (result.success && result.emailSent) {
                showToast(result.message || `Invitation sendt til ${trimmed}.`, 'success');
                onClose();
            } else if (result.success) {
                showToast(result.message || `Invitation til ${trimmed} er registreret.`, 'success');
            } else {
                showToast(result.message || 'Invitationen kunne ikke sendes. Prøv igen.', 'error');
            }
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            title="Invitér til BygSmart"
            description="Modtageren får en e-mail med et kort overblik og et link til at oprette en gratis konto."
            size="sm"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" onClick={onClose}>Annullér</Button>
                    <Button
                        onClick={handleSend}
                        disabled={!email.trim() || isSending}
                        iconLeft={<SendIcon className="w-4 h-4" />}
                    >
                        {isSending ? 'Sender...' : 'Send invitation'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Input
                    type="email"
                    label="E-mailadresse"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kollega@eksempel.dk"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && email.trim() && !isSending) handleSend(); }}
                />
                <div className="rounded-card bg-bg-subtle dark:bg-bg-dark-muted p-3">
                    <p className="text-caption font-bold text-text-primary dark:text-text-dark-primary mb-1.5">
                        Modtageren får at vide:
                    </p>
                    <ul className="space-y-1">
                        {PITCH_POINTS.map((point) => (
                            <li key={point} className="text-caption text-text-secondary dark:text-text-dark-secondary flex gap-1.5">
                                <span aria-hidden="true">•</span>{point}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </Modal>
    );
};
