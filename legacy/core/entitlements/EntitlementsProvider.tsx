// ─────────────────────────────────────────────────────────────────────────────
// EntitlementsProvider — resolves the active module set for the current user.
//
// Server-authoritative (GET /api/modules/entitlements); mirrors
// contexts/ToolAccessProvider.tsx: refresh() exposed, and FAIL-OPEN — on any
// error or while loading, every module counts as enabled so an outage can
// never hide paid capability. The only fail-closed path is the admin
// kill-switch, which the server resolves.
//
// Org-aware (Phase 3): refetches when the active org changes and subscribes
// to postgres_changes on that org's org_module_entitlements rows — an admin
// flip re-assembles the UI live, no reload (PRD §10.6 Case A; follows the
// project-resources-evict realtime precedent).
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthProvider';
import { useOrg } from '../org/OrgProvider';
import { supabase } from '../../services/supabaseClient';
import {
  getModuleEntitlements,
  ModuleEntitlementEntry,
  ModuleEntitlementsResponse,
} from '../../services/moduleEntitlements';
import { listHiddenModules } from '../../services/orgModulePrefs';
import { MODULE_IDS, ModuleId } from '../registry/types';

// ── Defaults (fail-open) ─────────────────────────────────────────────────────

const ALL_MODULES: ReadonlySet<ModuleId> = new Set<ModuleId>(MODULE_IDS);
const NO_HIDDEN: ReadonlySet<ModuleId> = new Set<ModuleId>();
const KNOWN_MODULE_IDS = new Set<string>(MODULE_IDS);

const OPEN_ENTRY: ModuleEntitlementEntry = {
  enabled: true,
  source: 'legacy',
  validUntil: null,
};

interface EntitlementsContextType {
  /**
   * The set of enabled module ids that drives ALL gating (nav/routes/tabs/
   * widgets). Fail-open: all of them until resolved, then billing-entitled
   * MINUS the owner's deactivated (hidden) set.
   */
  enabledModules: ReadonlySet<ModuleId>;
  /** Full entry for a module (source/validUntil) — fail-open default when unknown. */
  getEntitlement: (moduleId: ModuleId) => ModuleEntitlementEntry;
  /**
   * Modules the org owner has deactivated from the marketplace (presentation
   * only — their billing entry stays intact in getEntitlement). Subtracted
   * from enabledModules above. Empty until resolved / when unauthenticated /
   * when the org_module_prefs migration hasn't been applied.
   */
  hiddenModules: ReadonlySet<ModuleId>;
  /** Raw server response meta (null until first successful fetch). */
  meta: Pick<ModuleEntitlementsResponse, 'orgId' | 'grandfathered' | 'source'> | null;
  /** True while the initial fetch is in-flight. */
  isLoading: boolean;
  /** Refetch the entitlement set (e.g. after an admin flip). */
  refresh: () => void;
  /** Refetch the deactivated (hidden) set (e.g. after an owner toggles a module). */
  refreshHidden: () => void;
}

const EntitlementsContext = createContext<EntitlementsContextType>({
  enabledModules: ALL_MODULES,
  getEntitlement: () => OPEN_ENTRY,
  hiddenModules: NO_HIDDEN,
  meta: null,
  isLoading: false,
  refresh: () => undefined,
  refreshHidden: () => undefined,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export const EntitlementsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { activeOrg } = useOrg();
  const activeOrgId = activeOrg?.id ?? null;

  const [modules, setModules] = useState<Record<string, ModuleEntitlementEntry> | null>(null);
  const [meta, setMeta] = useState<EntitlementsContextType['meta']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<ReadonlySet<ModuleId>>(NO_HIDDEN);

  const doFetch = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const result = await getModuleEntitlements();
      setModules(result.modules);
      setMeta({ orgId: result.orgId, grandfathered: result.grandfathered, source: result.source });
    } catch {
      // Fail open — treat every module as enabled.
      setModules(null);
      setMeta(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on login and whenever the active org changes.
  useEffect(() => {
    if (isAuthenticated) {
      doFetch();
    } else {
      setModules(null);
      setMeta(null);
    }
  }, [isAuthenticated, activeOrgId, doFetch]);

  // The owner's deactivated (hidden) module set — resolved per active org.
  // Fail-safe: listHiddenModules never throws (returns [] when the migration
  // isn't applied), so gating stays exactly as before until an owner opts in.
  const doFetchHidden = useCallback(async () => {
    if (!isAuthenticated || !activeOrgId) {
      setHiddenModules(NO_HIDDEN);
      return;
    }
    const list = await listHiddenModules(activeOrgId);
    const known = new Set<ModuleId>(
      list.filter((id): id is ModuleId => KNOWN_MODULE_IDS.has(id))
    );
    setHiddenModules(known.size ? known : NO_HIDDEN);
  }, [isAuthenticated, activeOrgId]);

  useEffect(() => {
    doFetchHidden();
  }, [doFetchHidden]);

  // Live flips: an org_module_entitlements change for the active org
  // re-resolves entitlements without a reload.
  useEffect(() => {
    if (!isAuthenticated || !activeOrgId) return;
    const channel = supabase
      .channel(`org-entitlements:${activeOrgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_module_entitlements', filter: `org_id=eq.${activeOrgId}` },
        () => doFetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, activeOrgId, doFetch]);

  // Live deactivations: an org_module_prefs change for the active org refreshes
  // the hidden set without a reload (mirrors the entitlements subscription). If
  // the table isn't in the realtime publication yet the channel simply receives
  // no events — never an error.
  useEffect(() => {
    if (!isAuthenticated || !activeOrgId) return;
    const channel = supabase
      .channel(`org-prefs:${activeOrgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_module_prefs', filter: `org_id=eq.${activeOrgId}` },
        () => doFetchHidden()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, activeOrgId, doFetchHidden]);

  const enabledModules = useMemo<ReadonlySet<ModuleId>>(() => {
    // Fast path: fully fail-open with nothing deactivated.
    if (!modules && hiddenModules.size === 0) return ALL_MODULES;
    const enabled = new Set<ModuleId>();
    for (const id of MODULE_IDS) {
      // Unknown ids fail open — a newer server may know modules this build doesn't gate yet.
      const entitled = modules ? modules[id]?.enabled !== false : true;
      // Subtract the owner's deactivated set (presentation-layer only).
      if (entitled && !hiddenModules.has(id)) enabled.add(id);
    }
    return enabled;
  }, [modules, hiddenModules]);

  const getEntitlement = useCallback(
    (moduleId: ModuleId): ModuleEntitlementEntry => modules?.[moduleId] ?? OPEN_ENTRY,
    [modules]
  );

  return (
    <EntitlementsContext.Provider
      value={{
        enabledModules,
        getEntitlement,
        hiddenModules,
        meta,
        isLoading,
        refresh: doFetch,
        refreshHidden: doFetchHidden,
      }}
    >
      {children}
    </EntitlementsContext.Provider>
  );
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export const useEntitlements = (): EntitlementsContextType => useContext(EntitlementsContext);

export const useModuleEnabled = (moduleId: ModuleId): boolean =>
  useContext(EntitlementsContext).enabledModules.has(moduleId);
