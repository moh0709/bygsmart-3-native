import React, { useState } from 'react';
import { useToast } from '../../../../contexts/ToastContext';
import {
    Alert,
    Button,
    Modal,
} from '../../../../components/ui';
import { submitTaskCompletion, uploadSignature } from '../../services/taskWorkspace';
import SignatureCanvas from '../../../../components/SignatureCanvas';

// ─── FaerdigmeldModal ─────────────────────────────────────────────────────────

export const FaerdigmeldModal: React.FC<{
    taskId: string;
    projectId: string;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ taskId, projectId, onClose, onSuccess }) => {
    const [sigDataUrl, setSigDataUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            let signaturePath: string | undefined;
            if (sigDataUrl) {
                signaturePath = await uploadSignature(sigDataUrl);
            }
            await submitTaskCompletion(taskId, projectId, { signaturePath });
            onSuccess();
        } catch (err: any) {
            showToast(err?.message ?? 'Fejl ved færdigmelding', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open
            title="Færdigmeld opgave"
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Annuller</Button>
                    <Button onClick={handleSubmit} disabled={!sigDataUrl} loading={submitting}>
                        Færdigmeld
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Alert variant="info" title="Sådan foregår det">
                    Du færdigmelder opgaven med din underskrift. Mesteren modtager en notifikation og kan herefter godkende eller afvise.
                </Alert>
                <SignatureCanvas
                    label="Din underskrift (påkrævet — bekræfter at arbejdet er udført)"
                    onSignatureChange={setSigDataUrl}
                />
            </div>
        </Modal>
    );
};
