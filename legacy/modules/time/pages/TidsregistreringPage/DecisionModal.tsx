import React, { useState } from 'react';
import { Button, Modal, Textarea } from '../../../../components/ui';
import { useToast } from '../../../../contexts/ToastContext';
import {
  approveRegistration,
  rejectRegistration,
  formatHours,
  isoWeekNumber,
  type RegistrationListRow,
} from '../../services/timeRegistrations';

interface DecisionModalProps {
  registration: RegistrationListRow;
  decision: 'approve' | 'reject';
  onClose: () => void;
  /** Called after a successful decision so lists/details refresh. */
  onDecided: () => void;
}

/**
 * Godkend (optional comment) / Afvis (required comment) — shared by the
 * manager table's quick-action icons and the RegistrationDetail footer.
 */
export const DecisionModal: React.FC<DecisionModalProps> = ({ registration, decision, onClose, onDecided }) => {
  const { showToast } = useToast();
  const [comment, setComment] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const handleDecide = async () => {
    if (decision === 'reject' && !comment.trim()) {
      showToast('En afvisning kræver en kommentar til medarbejderen.', 'warning');
      return;
    }
    setIsWorking(true);
    try {
      if (decision === 'approve') await approveRegistration(registration.id, comment);
      else await rejectRegistration(registration.id, comment);
      showToast(
        decision === 'approve'
          ? 'Registreringen er godkendt.'
          : 'Registreringen er afvist — medarbejderen får besked.',
        'success'
      );
      onDecided();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Handlingen mislykkedes.', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={decision === 'approve' ? 'Godkend registrering' : 'Afvis registrering'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isWorking}>
            Fortryd
          </Button>
          <Button
            variant={decision === 'reject' ? 'danger' : 'primary'}
            onClick={handleDecide}
            loading={isWorking}
          >
            {decision === 'approve' ? 'Godkend' : 'Afvis'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-body text-text-secondary dark:text-text-dark-secondary">
          {decision === 'approve'
            ? `Godkend ${registration.staffName}s registrering på ${formatHours(registration.totalMinutes)} for uge ${isoWeekNumber(registration.weekStart)}?`
            : `Afvis registreringen, og forklar hvad ${registration.staffName} skal rette. Medarbejderen kan derefter redigere og indsende igen.`}
        </p>
        <Textarea
          label={decision === 'approve' ? 'Kommentar (valgfri)' : 'Kommentar (påkrævet)'}
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={decision === 'approve' ? 'F.eks. “Ser fint ud”' : 'F.eks. “Onsdag mangler — du var på pladsen til kl. 17”'}
          required={decision === 'reject'}
        />
      </div>
    </Modal>
  );
};
