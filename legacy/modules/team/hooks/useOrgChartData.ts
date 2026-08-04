import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '../../../core/org/OrgProvider';
import { listOrgMembers } from '../../../services/organizations';
import { listOrgTeams } from '../services/orgTeams';
import { chartFromOrg, type OrgChartData } from '../components/OrgChartView';

// ─────────────────────────────────────────────────────────────────────────────
// Assembles the normalized org-chart data from the active organisation:
// members (listOrgMembers) + work teams (listOrgTeams), with the owner resolved
// as activeOrg.createdBy. When there is no active org (edge: a billing-team user
// without a mirrored org) the caller can supply a memoized `fallback` builder
// (leader: team + seats; member: get_my_team_org RPC) used as the chart source.
// ─────────────────────────────────────────────────────────────────────────────

interface UseOrgChartDataOptions {
    /** Skip fetching entirely (e.g. while the list view is active). */
    enabled?: boolean;
    /** Chart source when there is no active org. Memoize with useCallback. */
    fallback?: (() => OrgChartData | null) | null;
}

interface UseOrgChartDataResult {
    data: OrgChartData | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

export function useOrgChartData({ enabled = true, fallback = null }: UseOrgChartDataOptions = {}): UseOrgChartDataResult {
    const { activeOrg } = useOrg();
    const [data, setData] = useState<OrgChartData | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!enabled) {
            setLoading(false);
            return;
        }
        if (!activeOrg) {
            setData(fallback ? fallback() : null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [members, teams] = await Promise.all([listOrgMembers(activeOrg.id), listOrgTeams()]);
            setData(chartFromOrg(members, teams, activeOrg.createdBy));
        } catch (error) {
            console.error('useOrgChartData error:', error);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [enabled, activeOrg, fallback]);

    useEffect(() => {
        load();
    }, [load]);

    return { data, loading, refresh: load };
}
