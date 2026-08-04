// Module registry contracts — the Kernel's vocabulary. Harvested verbatim from
// legacy/core/registry/types.ts. A module ships a ModuleManifest describing what it
// contributes into named shell slots (nav, routes, project tabs, …); the shell renders
// whatever the active (entitled) modules contributed.
//
// React is imported TYPE-ONLY (erased at build) so packages/core carries no runtime React
// dependency — the pure registry logic in registry.ts never touches these component types.

import type React from 'react';
import type { UserRole, ResourceVisibility } from '../types';

// ── Module ids ───────────────────────────────────────────────────────────────
export const MODULE_IDS = [
  'projects',
  'tasks',
  'tools',
  'knowledge',
  'field',
  'quality',
  'time',
  'planning',
  'documents',
  'team',
  'budget',
  'purchasing',
  'quotations',
  'partners',
  'reporting',
  'client-portal',
  'ai',
  'ar',
  'integrations',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

// ── Slot contributions ───────────────────────────────────────────────────────
export interface NavContribution {
  to: string;
  label: string;
  /** Icon identifier — an emoji now, an icon name resolved by packages/ui icons in P1 1.6. */
  icon: string;
  /** Marks this item active for a pathname (defaults to a `to`-prefix match). */
  match?: (pathname: string) => boolean;
  /** 'bottom' items render in both bottom nav and rail; 'rail' items are rail-only extras. */
  surface: 'bottom' | 'rail';
  order: number;
  /** Raised center action (the Scan/Capture slot). */
  center?: boolean;
}

export interface RouteContribution {
  path: string;
  load: () => Promise<{ default: React.ComponentType }>;
  guard: 'public' | 'auth' | 'admin' | 'tool';
  /** Required when guard === 'tool'. */
  toolId?: string;
  layout: 'main' | 'bare';
}

export interface ProjectTabContext {
  userRole: UserRole;
  /** Per-project-member ResourceVisibility, or null when not resolved. */
  visibility: ResourceVisibility | null;
  /** True when the viewer's project resource is a partner delegation. */
  isPartnerResource: boolean;
}

export interface ProjectTabContribution {
  key: string;
  destination: 'overblik' | 'opgaver' | 'plan' | 'okonomi' | 'mere';
  label: string;
  order: number;
  /** Encodes the tab's branch of the allowedTabs role/visibility gating. */
  isAllowed: (ctx: ProjectTabContext) => boolean;
  load?: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
}

export interface HomeWidgetContribution {
  id: string;
  context: 'management' | 'worker' | 'both';
  section?: 'action' | 'main';
  order: number;
  load: () => Promise<{ default: React.ComponentType }>;
}

export interface SettingsSectionContribution {
  id: string;
  order: number;
  load: () => Promise<{ default: React.ComponentType }>;
}

export interface SearchResultItem {
  id: string;
  title: string;
  snippet?: string;
  badge?: string;
  reference?: string;
  tags?: string[];
  to: string;
}

export interface SearchSourceContribution {
  id: string;
  label: string;
  icon?: string;
  order: number;
  filters?: string[];
  search: (query: string, filters: string[]) => Promise<SearchResultItem[]>;
}

export interface QuickActionContribution {
  id: string;
  label: string;
  /** Icon identifier — an emoji now, an icon name resolved by packages/ui icons in P1 1.6. */
  icon: string;
  to: string;
  order: number;
}

// ── Manifest ─────────────────────────────────────────────────────────────────
export interface ModuleManifest {
  id: ModuleId;
  name: string;
  description: string;
  /** Declared module dependencies — a module renders only when its whole requires-closure is entitled. */
  requires: ModuleId[];
  entitlement: `module.${ModuleId}`;
  nav?: NavContribution[];
  routes?: RouteContribution[];
  projectTabs?: ProjectTabContribution[];
  homeWidgets?: HomeWidgetContribution[];
  settingsSections?: SettingsSectionContribution[];
  searchSources?: SearchSourceContribution[];
  quickActions?: QuickActionContribution[];
}

// ── Slot lookup helpers ──────────────────────────────────────────────────────
export interface SlotContributions {
  nav: NavContribution[];
  routes: RouteContribution[];
  projectTabs: ProjectTabContribution[];
  homeWidgets: HomeWidgetContribution[];
  settingsSections: SettingsSectionContribution[];
  searchSources: SearchSourceContribution[];
  quickActions: QuickActionContribution[];
}

export type SlotKey = keyof SlotContributions;
