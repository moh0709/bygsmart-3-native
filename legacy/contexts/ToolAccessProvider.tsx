// ─────────────────────────────────────────────────────────────────────────────
// ToolAccessProvider — resolves per-tool access for the current user.
//
// Combines the server-side access map (campaigns resolved server-side, no
// client trust) with the local subscription context (isPro).
//
// Falls back to legacy PRO_TOOLS_IDS behaviour when the endpoint is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';
import { useSubscription } from './SubscriptionContext';
import { getToolAccess, ToolAccessMap, AccessReason } from '../services/toolAccess';
import { PRO_TOOLS_IDS } from '../config/subscriptionPlans';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolAccessResult {
  /** Whether the user may open the tool at all. */
  allowed: boolean;
  /** Whether the user may use the advanced mode. */
  advancedAllowed: boolean;
  /** Why this access level was granted/denied. */
  reason: AccessReason;
  advancedReason: AccessReason;
  /** ISO timestamp until which a campaign is active (or null). */
  campaignUntil: string | null;
  advancedCampaignUntil: string | null;
}

interface ToolAccessContextType {
  /** Look up effective access for a given tool ID. */
  getAccess: (toolId: string) => ToolAccessResult;
  /** True while the initial fetch is in-flight. */
  isLoading: boolean;
  /** Refetch access map (e.g. after login). */
  refresh: () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const FREE_ACCESS: ToolAccessResult = {
  allowed: true,
  advancedAllowed: true,
  reason: 'free',
  advancedReason: 'free',
  campaignUntil: null,
  advancedCampaignUntil: null,
};

const ToolAccessContext = createContext<ToolAccessContextType>({
  getAccess: () => FREE_ACCESS,
  isLoading: false,
  refresh: () => undefined,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export const ToolAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { features } = useSubscription();
  const isPro = features.advancedCalculators;

  const [accessMap, setAccessMap] = useState<ToolAccessMap | null>(null);
  const [useLegacy, setUseLegacy] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  const doFetch = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const result = await getToolAccess();
      setAccessMap(result.accessMap);
      setUseLegacy(result.source === 'legacy');
    } catch {
      // Fail open — use legacy defaults
      setUseLegacy(true);
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
      setAccessMap(null);
      setUseLegacy(false);
      fetchedRef.current = false;
    }
  }, [isAuthenticated, doFetch]);

  const getAccess = useCallback(
    (toolId: string): ToolAccessResult => {
      // No map yet — use legacy defaults while loading
      if (!accessMap || useLegacy) {
        const isLegacyPro = PRO_TOOLS_IDS.includes(toolId);
        if (!isLegacyPro) return FREE_ACCESS;
        return {
          allowed: isPro,
          advancedAllowed: isPro,
          reason: isPro ? 'pro' : 'pro-locked',
          advancedReason: isPro ? 'pro' : 'pro-locked',
          campaignUntil: null,
          advancedCampaignUntil: null,
        };
      }

      const entry = accessMap[toolId];
      if (!entry) return FREE_ACCESS;

      return {
        allowed: entry.allowed,
        advancedAllowed: entry.advancedAllowed,
        reason: entry.reason,
        advancedReason: entry.advancedReason,
        campaignUntil: entry.campaignUntil ?? null,
        advancedCampaignUntil: entry.advancedCampaignUntil ?? null,
      };
    },
    [accessMap, useLegacy, isPro]
  );

  return (
    <ToolAccessContext.Provider value={{ getAccess, isLoading, refresh: doFetch }}>
      {children}
    </ToolAccessContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useToolAccess = (toolId: string): ToolAccessResult => {
  const { getAccess } = useContext(ToolAccessContext);
  return getAccess(toolId);
};

export const useToolAccessContext = (): ToolAccessContextType =>
  useContext(ToolAccessContext);
