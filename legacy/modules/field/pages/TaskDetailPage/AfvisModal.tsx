import React, { useState } from 'react';
import { useToast } from '../../../../contexts/ToastContext';
import {
    Alert,
    Button,
    Modal,
    Textarea,
} from '../../../../components/ui';
import { rejectTaskHandover } from '../../services/taskWorkspace';

// ─── AfvisModal ───────────────────────────────────────────────────────────────

export const AfvisModal: React.FC<{
    taskId: string;
    projectId: string;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ taskId, projectId, onClose, onSuccess }) => {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const handleReject = async () => {
        const trimmed = reason.trim();
        if (!trimmed) { showToast('Angiv venligst en begrundelse', 'error'); return; }
        setSubmitting(true);
        try {
            await rejectTaskHandover(taskId, projectId, { reason: trimmed });
            onSuccess();
        } catch (err: any) {
            showToast(err?.message ?? 'Fejl ved afvisning', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open
            title="Afvis opgave"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button variant="danger" onClick={handleReject} disabled={!reason.trim()} loading={submitting}>
                        Afvis opgave
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Alert variant="warning" title="Opgaven sendes tilbage">
                    Opgaven sendes tilbage til medarbejderen med din kommentar. De vil blive notificeret.
                </Alert>
                <Textarea
                    label="Begrundelse for afvisning"
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Beskriv hvad der mangler eller skal rettes…"
                    rows={4}
                />
            </div>
        </Modal>
    );
};
