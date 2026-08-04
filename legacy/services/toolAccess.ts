// ─────────────────────────────────────────────────────────────────────────────
// Client service for the tool access layer (/api/tools/access/*).
//
// `getToolAccess` returns the server-resolved access map for the current user.
// Admin functions back the ToolAccessPanel.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient';

const TOOL_ACCESS_BASE = '/api/tools/access';

// ── Types ────────────────────────────────────────────────────────────────────

export type AccessLevel = 'free' | 'pro' | 'campaign';
export type AdvancedAccessLevel = 'free' | 'pro' | 'campaign' | 'inherit';
export type AccessReason = 'free' | 'campaign' | 'pro' | 'pro-locked';

export interface ToolAccessEntry {
  allowed: boolean;
  advancedAllowed: boolean;
  reason: AccessReason;
  advancedReason: AccessReason;
  campaignUntil: string | null;
  advancedCampaignUntil: string | null;
}

export interface ToolAccessMap {
  [toolId: string]: ToolAccessEntry;
}

export interface ToolAccessResponse {
  accessMap: ToolAccessMap;
  source: 'db' | 'legacy';
}

export interface ToolAccessConfig {
  tool_id: string;
  access_level: AccessLevel;
  campaign_until: string | null;
  advanced_access_level: AdvancedAccessLevel;
  advanced_campaign_until: string | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ToolAccessAdminResponse {
  configs: ToolAccessConfig[];
}

export interface SaveToolAccessPayload {
  accessLevel?: AccessLevel;
  campaignUntil?: string | null;
  advancedAccessLevel?: AdvancedAccessLevel;
  advancedCampaignUntil?: string | null;
  note?: string;
}

// ── Internals ────────────────────────────────────────────────────────────────

const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const authedFetch = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };

  const accessToken = await getAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `Serverfejl (${response.status}).`);
  }

  return data;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const getToolAccess = (): Promise<ToolAccessResponse> =>
  authedFetch<ToolAccessResponse>(TOOL_ACCESS_BASE);

export const listToolAccessAdmin = (): Promise<ToolAccessAdminResponse> =>
  authedFetch<ToolAccessAdminResponse>(`${TOOL_ACCESS_BASE}/admin`);

export const saveToolAccess = (
  toolId: string,
  payload: SaveToolAccessPayload
): Promise<{ config: ToolAccessConfig }> =>
  authedFetch<{ config: ToolAccessConfig }>(
    `${TOOL_ACCESS_BASE}/admin/${encodeURIComponent(toolId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  );
