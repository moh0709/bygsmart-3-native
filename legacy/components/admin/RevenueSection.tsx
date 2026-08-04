import React, { useEffect, useState } from 'react';
import { StatCard, SkeletonList, Card } from '../ui';
import { PeriodDelta } from './PeriodDelta';
import type { AdminPeriodValue } from './DateRangeFilter';
import type { AdminRevenueData } from '../../types';

const formatMoney = (ore: number, currency: string): string => {
    try {
        return new Intl.NumberFormat('da-DK', { style: 'currency', currency: (currency || 'DKK').toUpperCase(), maximumFractionDigits: 0 }).format((ore || 0) / 100);
    } catch {
        return `${((ore || 0) / 100).toFixed(0)} ${currency}`;
    }
};

const TIER_LABELS: Record<string, string> = { FREE: 'Gratis', PRO: 'Pro', PREMIUM: 'Premium', ENTERPRISE: 'Enterprise' };

export const RevenueSection: React.FC<{
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
    period: AdminPeriodValue;
}> = ({ apiFetch, period }) => {
    const [data, setData] = useState<AdminRevenueData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);
        const qs = new URLSearchParams({ from: period.from, to: period.to, compare: period.compare });
        apiFetch(`/api/admin/revenue?${qs.toString()}`)
            .then(async (res) => {
                const payload = await res.json();
                if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
                if (!cancelled) setData(payload);
            })
            .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Ukendt fejl'); });
        return () => { cancelled = true; };
    }, [apiFetch, period.from, period.to, period.compare]);

    if (error) {
        return <Card><p className="text-caption text-danger-strong dark:text-danger">{error}</p></Card>;
    }

    if (!data) {
        return <Card><SkeletonList count={2} /></Card>;
    }

    return (
        <div className="space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <StatCard value={formatMoney(data.mrrOre, data.currency)} label="MRR" tone="brand" />
                <StatCard value={formatMoney(data.arrOre, data.currency)} label="ARR" />
                <StatCard value={data.activeSubscriptions} label="Aktive abonnementer" tone="success" />
                <StatCard value={formatMoney(data.avgRevenuePerTeamOre, data.currency)} label="Gns. pr. team" />
            </div>
            {data.note && <p className="text-caption text-text-secondary dark:text-text-dark-secondary">{data.note}</p>}
            {Object.keys(data.byTier).length > 0 && (
                <Card className="flex flex-wrap gap-x-5 gap-y-1.5">
                    {Object.entries(data.byTier).map(([tier, count]) => (
                        <span key={tier} className="text-caption text-text-secondary dark:text-text-dark-secondary">
                            <span className="font-semibold text-text-primary dark:text-text-dark-primary">{count}</span> {TIER_LABELS[tier] || tier}
                        </span>
                    ))}
                </Card>
            )}
            <Card className="flex flex-wrap gap-x-6 gap-y-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Nye abonnementer i perioden</span>
                    <PeriodDelta delta={data.newSubscriptions} goodDirection="up" />
                </span>
                <span className="flex flex-col gap-0.5">
                    <span className="text-caption text-text-secondary dark:text-text-dark-secondary">Opsigelser i perioden</span>
                    <PeriodDelta delta={data.cancelledSubscriptions} goodDirection="down" />
                </span>
            </Card>
        </div>
    );
};

export default RevenueSection;
