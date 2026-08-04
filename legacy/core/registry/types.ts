// ─────────────────────────────────────────────────────────────────────────────
// Module registry contracts — the Kernel's vocabulary for the BYG 3.0
// modular monolith (PRD §10.2/§10.3).
//
// A module ships a ModuleManifest describing what it contributes into named
// shell slots (nav, routes, project tabs, …). The shell renders whatever the
// active (entitled) modules contributed — nothing module-specific is
// hard-coded in the Kernel.
//
// The server keeps its own copy of the ids in server/moduleCatalog.js
// (standalone-deploy constraint) — keep both lists in sync.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';
import type { UserRole, ResourceVisibility } from '../../types';

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
  icon: React.ComponentType<{ className?: string }>;
  /** Marks this item active for a pathname (defaults to a `to`-prefix match). */
  match?: (pathname: string) => boolean;
  /** 'bottom' items render in both BottomNavBar and NavRail; 'rail' items are rail-only extras. */
  surface: 'bottom' | 'rail';
  order: number;
  /** Raised center action (the Scan slot). */
  center?: boolean;
}

export interface RouteContribution {
  /** Hash-router path, e.g. '/budget' or '/tools/*'. */
  path: string;
  load: () => Promise<{ default: React.ComponentType }>;
  guard: 'public' | 'auth' | 'admin' | 'tool';
  /** Required when guard === 'tool' — wraps in ProtectedToolRoute. */
  toolId?: string;
  /** 'main' renders inside MainLayout chrome; 'bare' without. */
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
  /** Existing TabKey ids are preserved so ?tab= deep links keep working (Phase 5). */
  key: string;
  destination: 'overblik' | 'opgaver' | 'plan' | 'okonomi' | 'mere';
  label: string;
  order: number;
  /** Encodes the tab's branch of ProjectDetailPage's allowedTabs role/visibility gating. */
  isAllowed: (ctx: ProjectTabContext) => boolean;
  /** Phase 7: tab content loader once the tab component moves into the module.
   *  Until then ProjectDetailPage keeps its prop-wiring switch. */
  load?: () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
}

export interface HomeWidgetContribution {
  id: string;
  context: 'management' | 'worker' | 'both';
  /** Where on the dashboard the widget renders: 'action' inside the
   *  "Kræver handling" wrapper (render null when you have nothing —
   *  the section hides itself via CSS when empty), 'main' in the body.
   *  Defaults to 'main'. */
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
  /** Stable key within the source's result list. */
  id: string;
  title: string;
  /** Short preview text under the title. */
  snippet?: string;
  /** Badge rendered next to the title (e.g. regulation category). */
  badge?: string;
  /** Reference rendered as a small document badge (e.g. §-reference). */
  reference?: string;
  /** A few tag labels rendered under the snippet. */
  tags?: string[];
  /** Route navigated to when the result is clicked. */
  to: string;
}

export interface SearchSourceContribution {
  /** Doubles as the ?cat= deep-link value — keep ids stable (e.g. 'BR18'). */
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  order: number;
  /** Optional filter chips for this source; selected chips are passed to search(). */
  filters?: string[];
  search: (query: string, filters: string[]) => Promise<SearchResultItem[]>;
}

export interface QuickActionContribution {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  order: number;
}

// ── Manifest ─────────────────────────────────────────────────────────────────

export interface ModuleManifest {
  id: ModuleId;
  /** Danish display name, e.g. 'Beregnere'. */
  name: string;
  /** Marketplace copy ("Udvid din BygSmart"). */
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
