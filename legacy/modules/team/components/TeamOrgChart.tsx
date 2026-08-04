import React, { useCallback, useState } from 'react';
import { Avatar, Badge, Button, EmptyState, Modal, SkeletonList } from '../../../components/ui';
import { UsersIcon } from '../../../components/icons';
import { useToast } from '../../../contexts/ToastContext';
import { removeOrgTeamMember, setOrgTeamLeader } from '../services/orgTeams';
import { OrgChartView, type ChartPerson, type OrgChartData } from './OrgChartView';

// ─────────────────────────────────────────────────────────────────────────────
// TeamOrgChart — the /team "Diagram" mode: renders the OrgChartView plus the
// person detail/edit modal. Owner-only, non-self actions ("Gør til holdleder",
// "Fjern fra hold") reuse the existing org-team services and refresh on success.
// Permission rule: canEdit = viewerIsOwner || person.userId === currentUserId.
// ─────────────────────────────────────────────────────────────────────────────

interface TeamOrgChartProps {
    data: OrgChartData | null;
    loading: boolean;
    viewerIsOwner: boolean;
    currentUserId?: string | null;
    onRefresh: () => Promise<void> | void;
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-center justify-between gap-3 rounded-control bg-bg-muted dark:bg-bg-dark-muted px-3 py-2">
        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">{label}</span>
        <span className="text-label font-semibold text-text-primary dark:text-text-dark-primary text-right truncate">{value}</span>
    </div>
);

export const TeamOrgChart: React.FC<TeamOrgChartProps> = ({ data, loading, viewerIsOwner, currentUserId, onRefresh }) => {
    const { showToast } = useToast();
    const [selected, setSelected] = useState<ChartPerson | null>(null);
    const [busy, setBusy] = useState(false);

    const canEditPerson = useCallback(
        (p: ChartPerson) => viewerIsOwner || (p.userId != null && p.userId === currentUserId),
        [viewerIsOwner, currentUserId]
    );

    if (loading) {
        return <SkeletonList count={3} label="Indlæser organisation…" className="mt-2" />;
    }

    const isEmpty = !data || (!data.owner && data.teams.length === 0 && data.unassigned.length === 0);
    if (isEmpty) {
        return (
            <EmptyState
                className="mt-2"
                icon={<UsersIcon className="w-7 h-7" />}
                title="Ingen organisation endnu"
                description="Der er endnu ingen medlemmer at vise i diagrammet."
            />
        );
    }

    const isSelf = selected?.userId != null && selected.userId === currentUserId;
    const canAct = viewerIsOwner && !isSelf && !!selected?.teamId && !!selected?.userId;

    const run = async (fn: () => Promise<void>, okMsg: string) => {
        setBusy(true);
        try {
            await fn();
            await onRefresh();
            showToast(okMsg, 'success');
            setSelected(null);
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Handlingen mislykkedes.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-2">
            <OrgChartView
                data={data}
                currentUserId={currentUserId}
                canEditPerson={canEditPerson}
                onSelect={setSelected}
            />

            <Modal
                open={!!selected}
                onClose={() => setSelected(null)}
                title={selected?.name}
                size="sm"
                footer={
                    canAct && selected ? (
                        <>
                            <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>
                                Luk
                            </Button>
                            {selected.teamRole !== 'leader' && (
                                <Button
                                    variant="outline"
                                    loading={busy}
                                    onClick={() => run(() => setOrgTeamLeader(selected.teamId!, selected.userId!), `${selected.name} er nu holdleder.`)}
                                >
                                    Gør til holdleder
                                </Button>
                            )}
                            <Button
                                variant="danger"
                                loading={busy}
                                onClick={() => run(() => removeOrgTeamMember(selected.teamId!, selected.userId!), `${selected.name} er fjernet fra holdet.`)}
                            >
                                Fjern fra hold
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" onClick={() => setSelected(null)}>
                            Luk
                        </Button>
                    )
                }
            >
                {selected && (
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <Avatar name={selected.name} size="lg" />
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-heading font-bold text-text-primary dark:text-text-dark-primary">{selected.name}</p>
                                {isSelf && <Badge variant="brand">Dig</Badge>}
                                {selected.email && (
                                    <p className="text-caption text-text-secondary dark:text-text-dark-secondary break-all">{selected.email}</p>
                                )}
                            </div>
                        </div>

                        <div className="w-full flex flex-col gap-2">
                            <InfoRow label="Rolle" value={selected.roleLabel} />
                            {selected.teamName && <InfoRow label="Arbejdshold" value={selected.teamName} />}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
