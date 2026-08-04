import React, { useState } from 'react';
import { Alert, Badge, Button, Modal } from '../../../../components/ui';
import { DownloadIcon } from '../../../../components/icons';
import { ModuleGate } from '../../../../core/entitlements/ModuleGate';
import { useToast } from '../../../../contexts/ToastContext';
import { RegistrationSummary } from './RegistrationSummary';
import { DecisionModal } from './DecisionModal';
import {
  formatHours,
  isoWeekNumber,
  payloadToTimeEntries,
  type RegistrationListRow,
} from '../../services/timeRegistrations';

export const STATUS_BADGE: Record<string, { variant: 'info' | 'success' | 'danger' | 'neutral'; label: string }> = {
  submitted: { variant: 'info', label: 'Indsendt' },
  approved: { variant: 'success', label: 'Godkendt' },
  rejected: { variant: 'danger', label: 'Afvist' },
  draft: { variant: 'neutral', label: 'Kladde' },
};

interface RegistrationDetailProps {
  registration: RegistrationListRow;
  onClose: () => void;
  /** Called after a successful approve/reject so the list refreshes. */
  onDecided: () => void;
}

/**
 * Manager/CEO detail view of one submitted week: read-only breakdown +
 * Godkend / Afvis (shared DecisionModal) + Excel export (gated on the
 * reporting module).
 */
export const RegistrationDetail: React.FC<RegistrationDetailProps> = ({ registration, onClose, onDecided }) => {
  const { showToast } = useToast();
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const badge = STATUS_BADGE[registration.status] ?? STATUS_BADGE.draft;
  const canDecide = registration.status === 'submitted';

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { exportTimeEntriesToExcel } = await import('../../../reporting');
      exportTimeEntriesToExcel(
        payloadToTimeEntries(registration, registration.staffName),
        `Tidsregistrering uge ${isoWeekNumber(registration.weekStart)} — ${registration.staffName}`
      );
    } catch {
      showToast('Kunne ikke eksportere til Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          {registration.staffName} — uge {isoWeekNumber(registration.weekStart)}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </span>
      }
      footer={
        <div className="flex items-center gap-2 w-full">
          <ModuleGate moduleId="reporting" mode="hide">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<DownloadIcon className="w-4 h-4" />}
              onClick={handleExport}
              loading={isExporting}
            >
              Excel
            </Button>
          </ModuleGate>
          <div className="grow" />
          {canDecide ? (
            <>
              <Button variant="outline" className="text-danger border-danger/40" onClick={() => setDecision('reject')}>
                Afvis
              </Button>
              <Button onClick={() => setDecision('approve')}>Godkend</Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>Luk</Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {registration.decisionComment && (
          <Alert variant={registration.status === 'rejected' ? 'warning' : 'info'} title="Kommentar">
            {registration.decisionComment}
          </Alert>
        )}
        <p className="text-label text-text-secondary dark:text-text-dark-secondary">
          I alt <span className="font-bold text-text-primary dark:text-text-dark-primary">{formatHours(registration.totalMinutes)}</span>
          {registration.submittedAt && ` · indsendt ${new Date(registration.submittedAt).toLocaleDateString('da-DK', { dateStyle: 'medium' })}`}
        </p>
        <RegistrationSummary tasks={registration.payload.tasks} weekStart={registration.weekStart} />
      </div>

      {decision && (
        <DecisionModal
          registration={registration}
          decision={decision}
          onClose={() => setDecision(null)}
          onDecided={() => {
            onDecided();
            onClose();
          }}
        />
      )}
    </Modal>
  );
};
