import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  SkeletonList,
  StatCard,
} from '../../../../components/ui';
import { ChevronRightIcon, ClockIcon, CalendarIcon, CheckSquareIcon, DownloadIcon, UsersIcon } from '../../../../components/icons';
import { ModuleGate } from '../../../../core/entitlements/ModuleGate';
import { useAuth } from '../../../../contexts/AuthProvider';
import { useToast } from '../../../../contexts/ToastContext';
import { listOrgMembers } from '../../../../services/organizations';
import {
  isoWeekNumber,
  listRegistrationsForWeek,
  listTimeResponsibles,
  payloadToTimeEntries,
  shiftWeek,
  weekStartOf,
  type RegistrationListRow,
} from '../../services/timeRegistrations';
import { RegistrationDetail } from './RegistrationDetail';
import { RegistrationsTable } from './RegistrationsTable';
import { DecisionModal } from './DecisionModal';
import { AnsvarligeSection } from './AnsvarligeSection';

interface ManagerOverviewProps {
  orgId: string;
  ownerUserId: string;
  /** CEO (org owner) also manages the ansvarlig-mapping and sees the whole org. */
  isCeo: boolean;
}

/**
 * The CEO/manager landing view of /tidsregistrering: week selector, insight
 * tiles (total hours, days worked, tasks worked, staff missing), the
 * registrations table (task-line rows, quick godkend/afvis, note modal),
 * week Excel export, and (CEO only) the Ansvarlige assignment section.
 * RLS scopes the data: managers see their assigned staff, the owner all.
 */
export const ManagerOverview: React.FC<ManagerOverviewProps> = ({ orgId, ownerUserId, isCeo }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [rows, setRows] = useState<RegistrationListRow[]>([]);
  const [missingNames, setMissingNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RegistrationListRow | null>(null);
  const [decision, setDecision] = useState<{ row: RegistrationListRow; kind: 'approve' | 'reject' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const regs = await listRegistrationsForWeek(orgId, weekStart);
      setRows(regs);
      setError(null);

      // "Mangler at indsende": my staff scope (CEO = everyone but the owner;
      // manager = the members I'm ansvarlig for) minus those whose week is
      // submitted or approved.
      try {
        const [members, responsibles] = await Promise.all([
          listOrgMembers(orgId),
          listTimeResponsibles(orgId),
        ]);
        const active = members.filter((m) => m.status === 'active' && m.userId && m.userId !== ownerUserId);
        const scope = isCeo
          ? active
          : active.filter((m) =>
              responsibles.some((r) => r.staffUserId === m.userId && r.responsibleUserId === user?.id)
            );
        const covered = new Set(
          regs.filter((r) => r.status === 'submitted' || r.status === 'approved').map((r) => r.userId)
        );
        setMissingNames(scope.filter((m) => !covered.has(m.userId!)).map((m) => m.name));
      } catch {
        setMissingNames(null); // insight unavailable — table still works
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente registreringer.');
    } finally {
      setLoading(false);
    }
  }, [orgId, weekStart, ownerUserId, isCeo, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const insights = useMemo(() => {
    const counted = rows.filter((r) => r.status === 'submitted' || r.status === 'approved');
    const dates = new Set<string>();
    const taskIds = new Set<string>();
    let minutes = 0;
    for (const r of counted) {
      minutes += r.totalMinutes;
      for (const t of r.payload.tasks ?? []) {
        for (const d of Object.keys(t.days)) dates.add(d);
        if (Object.keys(t.days).length > 0) taskIds.add(t.taskId);
      }
    }
    return { hours: minutes / 60, days: dates.size, tasks: taskIds.size };
  }, [rows]);

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'submitted').length, [rows]);

  const handleWeekExport = async () => {
    setIsExporting(true);
    try {
      const { exportTimeEntriesToExcel } = await import('../../../reporting');
      const entries = rows.flatMap((r) => payloadToTimeEntries(r, r.staffName));
      exportTimeEntriesToExcel(entries, `Tidsregistrering uge ${isoWeekNumber(weekStart)}`);
    } catch {
      showToast('Kunne ikke eksportere til Excel.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Week selector */}
      <div className="flex items-center justify-center gap-3 py-1">
        <button
          type="button"
          aria-label="Forrige uge"
          onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
          className="flex w-9 h-9 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4 rotate-180" />
        </button>
        <span className="text-label font-bold text-text-primary dark:text-text-dark-primary min-w-24 text-center">
          Uge {isoWeekNumber(weekStart)}
        </span>
        <button
          type="button"
          aria-label="Næste uge"
          disabled={weekStart >= weekStartOf(new Date())}
          onClick={() => setWeekStart(shiftWeek(weekStart, 1))}
          className="flex w-9 h-9 items-center justify-center rounded-control border border-border bg-bg text-text-secondary hover:text-text-primary hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed dark:border-border-dark dark:bg-bg-dark-surface dark:text-text-dark-secondary transition-colors"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard
          label="Timer i alt"
          value={insights.hours.toFixed(1).replace('.', ',')}
          icon={<ClockIcon className="w-5 h-5" />}
          tone="brand"
          loading={loading}
        />
        <StatCard
          label="Dage med arbejde"
          value={insights.days}
          icon={<CalendarIcon className="w-5 h-5" />}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Opgaver arbejdet på"
          value={insights.tasks}
          icon={<CheckSquareIcon className="w-5 h-5" />}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Mangler at indsende"
          value={missingNames === null ? '—' : missingNames.length}
          icon={<UsersIcon className="w-5 h-5" />}
          tone={missingNames && missingNames.length > 0 ? 'warning' : 'default'}
          loading={loading}
          title={missingNames && missingNames.length > 0 ? missingNames.join(', ') : undefined}
        />
      </div>

      {pendingCount > 0 && (
        <Alert variant="info">
          {pendingCount} {pendingCount === 1 ? 'registrering afventer' : 'registreringer afventer'} din godkendelse.
        </Alert>
      )}

      {loading ? (
        <SkeletonList count={3} label="Henter registreringer…" />
      ) : error ? (
        <Alert variant="danger" title="Kunne ikke hente registreringer">{error}</Alert>
      ) : rows.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<ClockIcon className="w-7 h-7" />}
            title="Ingen registreringer denne uge"
            description="Indsendte tidsregistreringer fra dine medarbejdere vises her."
          />
        </Card>
      ) : (
        <>
          <RegistrationsTable
            rows={rows}
            onOpen={setSelected}
            onApprove={(row) => setDecision({ row, kind: 'approve' })}
            onReject={(row) => setDecision({ row, kind: 'reject' })}
          />

          <ModuleGate moduleId="reporting" mode="hide">
            <Button
              variant="outline"
              fullWidth
              iconLeft={<DownloadIcon className="w-4 h-4" />}
              onClick={handleWeekExport}
              loading={isExporting}
            >
              Eksporter ugen (Excel)
            </Button>
          </ModuleGate>
        </>
      )}

      {isCeo && <AnsvarligeSection orgId={orgId} ownerUserId={ownerUserId} />}

      {selected && (
        <RegistrationDetail
          registration={selected}
          onClose={() => setSelected(null)}
          onDecided={load}
        />
      )}

      {decision && (
        <DecisionModal
          registration={decision.row}
          decision={decision.kind}
          onClose={() => setDecision(null)}
          onDecided={load}
        />
      )}
    </div>
  );
};
