import React, { useEffect, useMemo, useState } from 'react';
import { StatCard, SkeletonList, Card, Badge, EmptyState, ListRow, Input, Button, Alert } from '../ui';
import { PeriodDelta } from './PeriodDelta';
import { downloadCsv } from '../../services/csvExport';
import type { AdminPeriodValue } from './DateRangeFilter';
import type { AdminOrganizationsData, AdminOrganization } from '../../types';

const formatDate = (iso: string | null): string => {
    if (!iso) return '–';
    try { return new Date(iso).toLocaleDateString('da-DK', { dateStyle: 'medium' }); } catch { return '–'; }
};

const ROLE_LABEL: Record<string, string> = {
    owner: 'Ejer',
    admin: 'Admin',
    member: 'Medlem',
};

const ROLE_VARIANT: Record<string, 'brand' | 'info' | 'neutral'> = {
    owner: 'brand',
    admin: 'info',
    member: 'neutral',
};

const OrgNode: React.FC<{ org: AdminOrganization }> = ({ org }) => {
    const [open, setOpen] = useState(false);

    const ownerLine = [
        org.ownerName || org.ownerEmail || 'Ingen ejer',
        // For a demo org the owner's profile e-mail is the generated demo+…@
        // login address; the address the visitor typed is the useful one.
        org.isDemo ? org.demoContactEmail : org.ownerEmail,
    ].filter(Boolean);

    return (
        <Card padding="sm">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 text-left"
            >
                <span className="min-w-0">
                    <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary truncate">
                        {org.name}
                    </span>
                    <span className="block text-caption text-text-secondary dark:text-text-dark-secondary truncate">
                        Ejer: {ownerLine.join(' · ')} · oprettet {formatDate(org.createdAt)}
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    {org.isDemo && <Badge variant="warning">Demo</Badge>}
                    <Badge variant="success">{org.memberCount} medlem{org.memberCount === 1 ? '' : 'mer'}</Badge>
                    {org.pendingInviteCount > 0 && <Badge variant="warning">{org.pendingInviteCount} afventer</Badge>}
                    <span className="text-text-secondary dark:text-text-dark-secondary" aria-hidden="true">{open ? '−' : '+'}</span>
                </span>
            </button>

            {open && (
                <div className="mt-3 pl-3 border-l-2 border-border dark:border-border-dark space-y-3">
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-caption text-text-secondary dark:text-text-dark-secondary">
                        <span>CVR: <span className="font-medium text-text-primary dark:text-text-dark-primary">{org.cvr || '–'}</span></span>
                        <span>Projekter: <span className="font-medium text-text-primary dark:text-text-dark-primary tabular-nums">{org.projectCount}</span></span>
                        <span>Lagerkvote: <span className="font-medium text-text-primary dark:text-text-dark-primary tabular-nums">{org.storageAllowanceGb} GB</span></span>
                        <span>Abonnement: <span className="font-medium text-text-primary dark:text-text-dark-primary">{org.ownerTier || '–'}</span></span>
                        <span>Moduladgang: <span className="font-medium text-text-primary dark:text-text-dark-primary">{org.grandfathered ? 'Fuld adgang' : 'Lean'}</span></span>
                    </div>
                    {org.address && (
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Adresse: {org.address}</p>
                    )}

                    {org.members.length === 0 ? (
                        <p className="text-caption text-text-secondary dark:text-text-dark-secondary">Ingen aktive medlemmer.</p>
                    ) : (
                        <div className="divide-y divide-border dark:divide-border-dark">
                            {org.members.map((m) => (
                                <ListRow
                                    key={m.userId || m.email || m.name}
                                    className="px-0 py-2"
                                    title={(
                                        <span className="inline-flex items-center gap-2">
                                            {m.name}
                                            {m.isDemo && <Badge variant="warning">Demo</Badge>}
                                        </span>
                                    )}
                                    subtitle={m.email || undefined}
                                    trailing={(
                                        <span className="flex flex-col items-end gap-1">
                                            <Badge variant={ROLE_VARIANT[m.role] || 'neutral'}>{ROLE_LABEL[m.role] || m.role}</Badge>
                                            <span className="text-caption text-text-tertiary dark:text-text-dark-tertiary">Tilføjet {formatDate(m.joinedAt)}</span>
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

export const OrganizationsSection: React.FC<{
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
    period: AdminPeriodValue;
}> = ({ apiFetch, period }) => {
    const [data, setData] = useState<AdminOrganizationsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [demoOnly, setDemoOnly] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);
        const qs = new URLSearchParams({ from: period.from, to: period.to, compare: period.compare });
        apiFetch(`/api/admin/organizations?${qs.toString()}`)
            .then(async (res) => {
                const payload = await res.json();
                if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
                if (!cancelled) setData(payload);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ukendt fejl'); });
        return () => { cancelled = true; };
    }, [apiFetch, period.from, period.to, period.compare]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (data?.organizations || []).filter((o) => {
            if (demoOnly && !o.isDemo) return false;
            if (!q) return true;
            return (
                o.name.toLowerCase().includes(q)
                || (o.cvr || '').toLowerCase().includes(q)
                || (o.ownerName || '').toLowerCase().includes(q)
                || (o.ownerEmail || '').toLowerCase().includes(q)
                || (o.demoContactEmail || '').toLowerCase().includes(q)
            );
        });
    }, [data, query, demoOnly]);

    if (error) return <Card><p className="text-caption text-danger-strong dark:text-danger">{error}</p></Card>;
    if (!data) return <Card><SkeletonList count={3} /></Card>;

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard value={data.totals.orgCount} label="Organisationer" tone="brand" />
                <StatCard value={data.totals.demoOrgCount} label="Demo" tone="warning" />
                <StatCard value={data.totals.pendingInvites} label="Afventende invitationer" tone={data.totals.pendingInvites > 0 ? 'warning' : 'default'} />
                <StatCard value={data.totals.avgMembersPerOrg} label="Gns. medlemmer" />
            </div>

            <Card className="flex flex-wrap gap-x-6 gap-y-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye organisationer i perioden</span>
                    <PeriodDelta delta={data.period.newOrganizations} goodDirection="up" />
                </span>
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Med fuld moduladgang</span>
                    <span className="text-caption font-semibold text-text-primary dark:text-text-dark-primary tabular-nums">{data.totals.grandfatheredCount}</span>
                </span>
            </Card>

            {data.totals.truncated && (
                <Alert variant="warning">
                    Kun de 200 nyeste organisationer vises. Søgningen filtrerer i denne liste.
                </Alert>
            )}

            <Input
                aria-label="Søg organisationer"
                placeholder="Søg navn, CVR, ejer…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Button
                        variant={demoOnly ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setDemoOnly((v) => !v)}
                        aria-pressed={demoOnly}
                    >
                        Kun demo
                    </Button>
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">
                        Viser {filtered.length} af {data.organizations.length}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={filtered.length === 0}
                    onClick={() => downloadCsv(
                        `organisationer_${new Date().toISOString().slice(0, 10)}.csv`,
                        ['Organisation', 'CVR', 'Ejer', 'Ejer email', 'Demo', 'Demo-kontakt', 'Medlemmer', 'Afventer', 'Projekter', 'Abonnement', 'Moduladgang', 'Oprettet'],
                        filtered.map((o) => [
                            o.name,
                            o.cvr,
                            o.ownerName,
                            o.ownerEmail,
                            o.isDemo ? 'Ja' : 'Nej',
                            o.demoContactEmail,
                            o.memberCount,
                            o.pendingInviteCount,
                            o.projectCount,
                            o.ownerTier,
                            o.grandfathered ? 'Fuld adgang' : 'Lean',
                            formatDate(o.createdAt),
                        ])
                    )}
                >
                    Eksporter CSV
                </Button>
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    title="Ingen organisationer fundet."
                    description={query || demoOnly ? 'Prøv at justere søgningen eller filteret.' : undefined}
                />
            ) : (
                <div className="space-y-2">
                    {filtered.map((o) => <OrgNode key={o.id} org={o} />)}
                </div>
            )}
        </div>
    );
};

export default OrganizationsSection;
