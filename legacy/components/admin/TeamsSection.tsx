import React, { useEffect, useState } from 'react';
import { StatCard, SkeletonList, Card, Badge, EmptyState, ListRow } from '../ui';
import { PeriodDelta } from './PeriodDelta';
import type { AdminPeriodValue } from './DateRangeFilter';
import type { AdminTeamsData, AdminTeam } from '../../types';

const formatDate = (iso: string | null): string => {
    if (!iso) return '–';
    try { return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' }); } catch { return '–'; }
};

const SEAT_STATUS_LABEL: Record<string, string> = {
    active: 'Aktiv',
    pending: 'Afventer',
    declined: 'Afvist',
};

const SEAT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
    active: 'success',
    pending: 'warning',
    declined: 'neutral',
};

const TeamNode: React.FC<{ team: AdminTeam }> = ({ team }) => {
    const [open, setOpen] = useState(false);
    return (
        <Card padding="sm">
            <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 text-left">
                <span className="min-w-0">
                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">{team.name}</span>
                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                        Leder: {team.leaderName || team.leaderEmail || '–'} · oprettet {formatDate(team.createdAt)}
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    <Badge variant="success">{team.activeSeatCount} aktive</Badge>
                    {team.pendingSeatCount > 0 && <Badge variant="warning">{team.pendingSeatCount} afventer</Badge>}
                    <span className="text-text-secondary dark:text-text-dark-secondary" aria-hidden="true">{open ? '−' : '+'}</span>
                </span>
            </button>
            {open && (
                <div className="mt-3 pl-3 border-l-2 border-border dark:border-border-dark">
                    {team.seats.length === 0 ? (
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Ingen sæder oprettet.</p>
                    ) : (
                        <div className="divide-y divide-border dark:divide-border-dark">
                            {team.seats.map((s) => (
                                <ListRow
                                    key={s.id}
                                    className="px-0 py-2"
                                    title={s.name || s.email}
                                    subtitle={[s.name ? s.email : null, s.jobTitle].filter(Boolean).join(' · ') || (s.status === 'pending' ? 'Afventer registrering' : undefined)}
                                    trailing={(
                                        <span className="flex flex-col items-end gap-1">
                                            <Badge variant={SEAT_STATUS_VARIANT[s.status] || 'neutral'}>{SEAT_STATUS_LABEL[s.status] || s.status}</Badge>
                                            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Tilføjet {formatDate(s.createdAt)}</span>
                                        </span>
                                    )}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

export const TeamsSection: React.FC<{
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
    period: AdminPeriodValue;
}> = ({ apiFetch, period }) => {
    const [data, setData] = useState<AdminTeamsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);
        const qs = new URLSearchParams({ from: period.from, to: period.to, compare: period.compare });
        apiFetch(`/api/admin/teams?${qs.toString()}`)
            .then(async (res) => {
                const payload = await res.json();
                if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
                if (!cancelled) setData(payload);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ukendt fejl'); });
        return () => { cancelled = true; };
    }, [apiFetch, period.from, period.to, period.compare]);

    if (error) return <Card><p className="text-caption text-danger-strong dark:text-danger">{error}</p></Card>;
    if (!data) return <Card><SkeletonList count={3} /></Card>;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard value={data.totals.teamCount} label="Teams" tone="brand" />
                <StatCard value={data.totals.activeSeats} label="Aktive sæder" tone="success" />
                <StatCard value={data.totals.pendingSeats} label="Afventende sæder" tone="warning" />
                <StatCard value={`${data.totals.utilizationPct}%`} label="Sædeudnyttelse" />
            </div>
            <Card className="flex flex-wrap gap-x-6 gap-y-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye teams i perioden</span>
                    <PeriodDelta delta={data.period.newTeams} goodDirection="up" />
                </span>
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Gns. sæder pr. team</span>
                    <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">{data.totals.avgSeatsPerTeam}</span>
                </span>
            </Card>

            <p className="text-caption font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wide pt-1">Organisationsdiagram</p>
            {data.teams.length === 0 ? (
                <EmptyState title="Ingen teams oprettet endnu." />
            ) : (
                <div className="space-y-2">
                    {data.teams.map((t) => <TeamNode key={t.id} team={t} />)}
                </div>
            )}
        </div>
    );
};

export default TeamsSection;
