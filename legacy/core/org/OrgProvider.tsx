// ─────────────────────────────────────────────────────────────────────────────
// OrgProvider — the caller's organizations + active-org state (Phase 2).
//
// Sits right after AuthProvider in the chain (Auth → Org → Subscription →
// Entitlements → …) so later providers can become org-aware (Phase 3 keys
// entitlements by active org).
//
// Fail-soft: on any error memberships resolve empty and activeOrg null —
// nothing in Phase 2 gates on org state, the UI simply hides org affordances.
// Authorization never trusts activeOrg: RLS always evaluates the row's
// org_id against membership (set_active_org() RPC validates on write).
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthProvider';
import {
    OrgMembership,
    OrgStorageUsage,
    Organization,
    getActiveOrgId,
    getOrgStorageUsage,
    listMyOrganizations,
    switchActiveOrg,
} from '../../services/organizations';

interface OrgContextType {
    /** Pending + active memberships with their orgs. */
    memberships: OrgMembership[];
    /** The org the UI is scoped to (null until resolved / when unauthenticated). */
    activeOrg: Organization | null;
    /** Metered storage usage for the active org (null until the nightly job has data). */
    storageUsage: OrgStorageUsage | null;
    /** True while the initial fetch is in-flight. */
    isLoading: boolean;
    /** Switch active org (server-validated) and update local state. */
    switchOrg: (orgId: string) => Promise<void>;
    /** Refetch memberships + active org (e.g. after create/accept). */
    refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType>({
    memberships: [],
    activeOrg: null,
    storageUsage: null,
    isLoading: false,
    switchOrg: async () => undefined,
    refresh: async () => undefined,
});

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();

    const [memberships, setMemberships] = useState<OrgMembership[]>([]);
    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fetchedRef = useRef(false);

    const doFetch = useCallback(async () => {
        if (!isAuthenticated) return;
        setIsLoading(true);
        try {
            const [mine, activeId] = await Promise.all([listMyOrganizations(), getActiveOrgId()]);
            setMemberships(mine);
            const activeIsValid = mine.some((m) => m.org.id === activeId && m.status === 'active');
            const fallback = mine.find((m) => m.status === 'active')?.org.id ?? null;
            setActiveOrgId(activeIsValid ? activeId : fallback);
        } catch (error) {
            console.error('OrgProvider fetch error:', error);
            setMemberships([]);
            setActiveOrgId(null);
        } finally {
            setIsLoading(false);
            fetchedRef.current = true;
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated && !fetchedRef.current) {
            doFetch();
        }
        if (!isAuthenticated) {
            setMemberships([]);
            setActiveOrgId(null);
            fetchedRef.current = false;
        }
    }, [isAuthenticated, doFetch]);

    const switchOrg = useCallback(async (orgId: string) => {
        await switchActiveOrg(orgId);
        setActiveOrgId(orgId);
    }, []);

    const activeOrg = useMemo(
        () => memberships.find((m) => m.org.id === activeOrgId && m.status === 'active')?.org ?? null,
        [memberships, activeOrgId]
    );

    // Storage usage for the active org (nightly-metered; fail-soft to null).
    const [storageUsage, setStorageUsage] = useState<OrgStorageUsage | null>(null);
    useEffect(() => {
        let cancelled = false;
        if (!activeOrg) { setStorageUsage(null); return; }
        getOrgStorageUsage(activeOrg.id).then((usage) => {
            if (!cancelled) setStorageUsage(usage);
        });
        return () => { cancelled = true; };
    }, [activeOrg]);

    return (
        <OrgContext.Provider value={{ memberships, activeOrg, storageUsage, isLoading, switchOrg, refresh: doFetch }}>
            {children}
        </OrgContext.Provider>
    );
};

export const useOrg = (): OrgContextType => useContext(OrgContext);
