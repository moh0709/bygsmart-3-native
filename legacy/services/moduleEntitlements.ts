// ─────────────────────────────────────────────────────────────────────────────
// Client service for the module entitlement layer (/api/modules/entitlements).
//
// `getModuleEntitlements` returns the server-resolved module set for the
// current user. Admin functions back the ModuleEntitlementsPanel.
// The canonical module id list lives in core/registry/types.ts (ModuleId).
// ─────────────────────────────────────────────────────────────────────────────

import { authenticatedServerFetch } from './api/http';

const ENTITLEMENTS_BASE = '/modules/entitlements';

// ── Types ────────────────────────────────────────────────────────────────────

/** Why a module resolved on/off. 'trial' | 'purchase' | 'grandfathered' arrive with Phases 2-3. */
export type ModuleEntitlementSource =
  | 'legacy'
  | 'tier'
  | 'admin'
  | 'grandfathered'
  | 'trial'
  | 'purchase';

export interface ModuleEntitlementEntry {
  enabled: boolean;
  source: ModuleEntitlementSource;
  validUntil: string | null;
  /** Only meaningful for source==='purchase' — a pending native in-app cancel. */
  cancelAtPeriodEnd?: boolean;
  /** Only meaningful for source==='purchase' — when the current paid period ends. */
  currentPeriodEnd?: string | null;
}

export interface ModuleEntitlementsResponse {
  /** Placeholder until organizations land (Phase 2). */
  orgId: string | null;
  grandfathered: boolean;
  modules: Record<string, ModuleEntitlementEntry>;
  source: 'db' | 'tier-map' | 'legacy';
}

export interface ModuleAccessConfig {
  module_id: string;
  enabled: boolean;
  min_tier: 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ModuleConfigsAdminResponse {
  configs: ModuleAccessConfig[];
  moduleIds: string[];
  enforceTierMap: boolean;
}

export interface SaveModuleConfigPayload {
  enabled?: boolean;
  minTier?: 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | null;
  note?: string;
}

// ── Internals ────────────────────────────────────────────────────────────────

const jsonOrThrow = async <T>(response: Response): Promise<T> => {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Serverfejl (${response.status}).`);
  }
  return data;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const getModuleEntitlements = async (): Promise<ModuleEntitlementsResponse> =>
  jsonOrThrow<ModuleEntitlementsResponse>(await authenticatedServerFetch(ENTITLEMENTS_BASE));

// ── Native in-app cancel (graceful, period-end) ─────────────────────────────

export interface ModuleCancelResult {
  ok: true;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: string | null;
}

export const cancelModule = async (moduleId: string): Promise<ModuleCancelResult> =>
  jsonOrThrow<ModuleCancelResult>(
    await authenticatedServerFetch(`/modules/${encodeURIComponent(moduleId)}/cancel`, { method: 'POST' })
  );

export const reactivateModule = async (moduleId: string): Promise<ModuleCancelResult> =>
  jsonOrThrow<ModuleCancelResult>(
    await authenticatedServerFetch(`/modules/${encodeURIComponent(moduleId)}/reactivate`, { method: 'POST' })
  );

export const listModuleConfigsAdmin = async (): Promise<ModuleConfigsAdminResponse> =>
  jsonOrThrow<ModuleConfigsAdminResponse>(await authenticatedServerFetch(`${ENTITLEMENTS_BASE}/admin`));

export const saveModuleConfig = async (
  moduleId: string,
  payload: SaveModuleConfigPayload
): Promise<{ config: ModuleAccessConfig }> =>
  jsonOrThrow<{ config: ModuleAccessConfig }>(
    await authenticatedServerFetch(`${ENTITLEMENTS_BASE}/admin/${encodeURIComponent(moduleId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  );

// ── Per-org overrides (admin) ────────────────────────────────────────────────

export interface EntitlementAdminOrg {
  id: string;
  name: string;
  cvr: string | null;
  grandfathered: boolean;
  created_at: string;
}

export interface OrgModuleOverride {
  module_id: string;
  status: 'enabled' | 'disabled' | 'trial';
  source: 'tier' | 'purchase' | 'trial' | 'admin';
  valid_until: string | null;
  note: string | null;
  updated_at: string;
}

export interface SaveOrgOverridePayload {
  status: 'enabled' | 'disabled' | 'trial';
  validUntil?: string | null;
  note?: string;
}

export const listEntitlementOrgsAdmin = async (): Promise<{ orgs: EntitlementAdminOrg[] }> =>
  jsonOrThrow<{ orgs: EntitlementAdminOrg[] }>(
    await authenticatedServerFetch(`${ENTITLEMENTS_BASE}/admin/orgs`)
  );

export const listOrgOverridesAdmin = async (orgId: string): Promise<{ overrides: OrgModuleOverride[] }> =>
  jsonOrThrow<{ overrides: OrgModuleOverride[] }>(
    await authenticatedServerFetch(`${ENTITLEMENTS_BASE}/admin/org/${encodeURIComponent(orgId)}`)
  );

export const saveOrgOverride = async (
  orgId: string,
  moduleId: string,
  payload: SaveOrgOverridePayload
): Promise<{ override: OrgModuleOverride }> =>
  jsonOrThrow<{ override: OrgModuleOverride }>(
    await authenticatedServerFetch(
      `${ENTITLEMENTS_BASE}/admin/org/${encodeURIComponent(orgId)}/${encodeURIComponent(moduleId)}`,
      { method: 'PUT', body: JSON.stringify(payload) }
    )
  );

export const clearOrgOverride = async (orgId: string, moduleId: string): Promise<void> => {
  await jsonOrThrow<{ ok: boolean }>(
    await authenticatedServerFetch(
      `${ENTITLEMENTS_BASE}/admin/org/${encodeURIComponent(orgId)}/${encodeURIComponent(moduleId)}`,
      { method: 'DELETE' }
    )
  );
};
