import React, { useEffect, useState } from 'react';
import { StatCard, SkeletonList, Card } from '../ui';
import { PeriodDelta } from './PeriodDelta';
import type { AdminPeriodValue } from './DateRangeFilter';
import type { AdminDelegationData, AdminReportsData } from '../../types';

export const DelegationReportsSection: React.FC<{
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
    period: AdminPeriodValue;
}> = ({ apiFetch, period }) => {
    const [delegation, setDelegation] = useState<AdminDelegationData | null>(null);
    const [reports, setReports] = useState<AdminReportsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setDelegation(null);
        setReports(null);
        setError(null);
        const qs = new URLSearchParams({ from: period.from, to: period.to, compare: period.compare });
        Promise.all([
            apiFetch(`/api/admin/delegation?${qs.toString()}`).then((r) => r.json()),
            apiFetch(`/api/admin/reports?${qs.toString()}`).then((r) => r.json()),
        ])
            .then(([d, r]) => {
                if (cancelled) return;
                if (d.error) throw new Error(d.error);
                if (r.error) throw new Error(r.error);
                setDelegation(d);
                setReports(r);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ukendt fejl'); });
        return () => { cancelled = true; };
    }, [apiFetch, period.from, period.to, period.compare]);

    if (error) return <Card><p className="text-caption text-danger-strong dark:text-danger">{error}</p></Card>;
    if (!delegation || !reports) return <Card><SkeletonList count={3} /></Card>;

    return (
        <div className="space-y-4">
            <section>
                <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">Underleverandører</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <StatCard value={delegation.activeSubcontractors} label="Aktive" tone="success" />
                    <StatCard value={delegation.pendingSubcontractors} label="Afventende" tone="warning" />
                    <StatCard value={delegation.delegatedTasks} label="Delegerede opgaver" tone="brand" />
                    <StatCard value={delegation.delegatedTasksSolved} label="Løst af UL" tone="success" />
                </div>
                <Card className="flex flex-wrap gap-x-6 gap-y-2 mt-2.5">
                    <span className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye tilknytninger i perioden</span>
                        <PeriodDelta delta={delegation.period.newDelegations} goodDirection="up" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Opgaver løst i perioden</span>
                        <PeriodDelta delta={delegation.period.delegatedTasksSolved} goodDirection="up" />
                    </span>
                </Card>
            </section>

            <section>
                <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide mb-2">Overdragelsesrapporter</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <StatCard value={reports.taskHandovers.submitted} label="Opgave-overdragelser" />
                    <StatCard value={reports.terminationReports} label="Fratrædelsesrapporter" />
                    <StatCard value={reports.aiHandoverReports} label="AI-projektrapporter" />
                    <StatCard value={reports.totalReports} label="I alt" tone="brand" />
                </div>
                <Card className="flex flex-wrap gap-x-6 gap-y-2 mt-2.5">
                    <span className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Genereret i perioden</span>
                        <PeriodDelta delta={reports.period.totalReports} goodDirection="up" />
                    </span>
                    <span className="flex flex-col gap-0.5">
                        <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Accepteret / afvist</span>
                        <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">
                            {reports.taskHandovers.accepted} / {reports.taskHandovers.rejected}
                        </span>
                    </span>
                </Card>
            </section>
        </div>
    );
};

export default DelegationReportsSection;
