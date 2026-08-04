# BygSmart 2.1 — UI/UX Overhaul Plan

**Version:** 1.0 (draft for approval)
**Date:** 2026-07-02
**Goal:** Maximum user experience across the entire app — structured, fantastic overview, team cooperation, mobile/tablet-first, SOTA app-design best practices.
**Mockups:** `docs/mockups/ui-overhaul-mockup.html` (open in a browser — includes light/dark toggle)

---

## 1. Design principles (the quality bar)

1. **Glanceable first** — a builder with gloves on a scaffold gets the answer in 3 seconds. Every screen leads with *what needs attention now*, not raw data.
2. **One design system, zero exceptions** — every screen renders from the same tokens and primitives. No raw `bg-gray-*`, no hand-rolled modals, no 8px text.
3. **Thumb-reachable** — primary actions in the bottom 40% of the screen; 44–48px touch targets everywhere; safe-area correct on notched devices.
4. **Progressive disclosure** — summaries first, detail on demand. The AI briefing is 3 bullets + expand, not a wall of text. Project health is a chip, not a red "E" scare-grade.
5. **Team-visible** — who did what, who's where, what's blocked: presence, activity, and handovers are first-class UI.
6. **Calm color** — color communicates status (success/warning/danger), never decoration. Red is reserved for genuinely broken things.
7. **Dark mode as a first-class citizen** — derived from semantic tokens, not 2,498 hand-written `dark:` overrides.
8. **WCAG 2.1 AA** — contrast, focus rings, keyboard/reader paths, reduced motion.

---

## 2. Current state (audit summary)

**What's good (keep & extend):**
- Token system in `src/index.css` (`@theme` — brand, status, text, surface, border, radius, elevation, motion tokens)
- Modern primitives: `Button`, `Card`, `Badge`, `Tabs` (full ARIA), `Field`, `Modal` (focus trap, bottom-sheet on mobile), `Skeleton`, `EmptyState`
- `ThemeContext` (light/dark/system), `ToastContext`, `DashboardWidgets.tsx` as reference pattern
- Bottom nav concept (floating pill, sliding highlight)
- v3 wizard (framer-motion + zustand) as the motion/interaction benchmark

**What's broken (measured):**
| Problem | Evidence |
|---|---|
| Design system ignored by ~90% of screens | 2,123 raw palette classes in 183 files; only ~23 files import `components/ui` |
| Hand-maintained dark mode | 2,498 `dark:` utilities, mixing `slate-800`/`gray-900`/`bg-dark-surface` |
| Two token sources that disagree | `tailwind.config.js` (partial v3) vs `src/index.css` (full v4) |
| Duplicated primitives | 2× Input, 2× StatCard, 4× Badge/pill, 5× modal patterns, 2× spinners, 2 icon systems |
| Safe-area is a no-op | `viewport-fit=cover` missing in `index.html`; phantom `pt-safe`/`pb-safe` classes (no plugin) |
| Brand color fork | `#1E5FFF` (tokens) vs `#00529B` (manifest, theme-color, WelcomePage) |
| Illegible micro-type | `text-[8px]` nav labels, pervasive `text-[10px]` |
| Project hub overload | 11 tabs in a horizontal scroll strip (owner view) |
| Dashboard = unstructured scroll | KPI cards show "6.00 / 0.00 / 14.00"; AI briefing is a text wall; no hierarchy |
| Overlapping UI | "Start Tid" button covers the project title; "E 59/100" red grade dominates an on-track project |
| Inconsistent loading | Skeletons exist but most screens use spinners/plain text |
| a11y regressions | `<div onClick>` cards, `focus:outline-none`, low-contrast text on gradients |
| 29 screens hand-pad `pb-16…pb-32` | to dodge the floating nav; some collide, some over-pad |

---

## 3. Workstream A — Design System 2.0 (foundations)

### A1. Single token source
- `src/index.css` `@theme` becomes the **only** token source; `tailwind.config.js` keeps only `content`, `darkMode`, plugins.
- De-dupe `src/index.css` (lines ~123–193 repeated at ~223–309).
- Resolve brand fork → **`#1E5FFF`** everywhere (manifest `theme_color`, `<meta theme-color>`, WelcomePage, PWA icons).

### A2. Token additions
- **Type scale** (mobile-first, min 11px): `display 28/34`, `title 22/28`, `heading 17/24`, `body 15/22`, `label 13/18`, `caption 11/14` — as `--text-*` tokens + utilities.
- **Spacing rhythm:** 4-pt grid; screen gutter token (16px phone / 24px tablet).
- **Semantic surfaces** used *instead of* raw palette: `surface`, `surface-raised`, `surface-sunken`, `surface-inverse` (+ auto dark values).
- **Status ramp** per status: `bg-subtle / border / text / solid` so alerts, chips, banners all derive from one definition.
- **Elevation:** 3 levels only (card, raised, overlay).
- Motion tokens shared with framer-motion via a `motion.ts` export (durations/eases read from CSS vars).

### A3. Primitive kit — add the missing 12 (kills the duplication)
| New primitive | Replaces |
|---|---|
| `AppScreen` (header + scroll area + safe-area + nav clearance) | 29 hand-padded screens |
| `AppHeader` (title, back, actions, large-title collapse) | per-screen ad-hoc headers |
| `StatCard` / `MetricTile` (integer formatting built in) | 2+ duplicated stat cards |
| `Alert`/`Callout` (info/success/warning/danger) | inline `bg-red-50…` divs |
| `Avatar` + `AvatarGroup` (initials, color-hashed, presence dot) | AA/BB/CC ad-hoc circles |
| `Chip`/`Tag` (filter + status variants) | 4 pill implementations |
| `Progress` (bar + ring) | hand-rolled bars/rings |
| `SegmentedControl` (kit-level) | `components/calculators/SegmentedControl` |
| `Tooltip` (on `@floating-ui/react`) | `StandardTooltip` |
| `ConfirmDialog` (on `Modal`) | legacy `ConfirmDialog` |
| `BottomSheet` (extracted from `Modal`) | ad-hoc sheets |
| `Toast` kit component (actions, undo, stacking, dedupe) | context-only toasts |
| `ListRow` (icon, title, meta, chevron, swipe-ready) | dozens of bespoke list items |
| `FAB` (primary quick action) | scattered "+" buttons |

- **Icons:** consolidate on **lucide-react** (current version bumped); retire `components/icons.tsx` via a codemod mapping. One visual weight everywhere.
- Retire: `FormElements.tsx` (duplicate Input/Textarea/Chip), `GenericModal` (migrate call sites to `Modal`), `StandardTooltip`, legacy `ConfirmDialog`.

### A4. Platform fixes
- `index.html`: add `viewport-fit=cover`; `apple-mobile-web-app-status-bar-style: black-translucent`; correct `theme-color` (light+dark media variants).
- Real safe-area utilities (`pt-safe`, `pb-safe`) defined in CSS — kills the phantom classes.
- `manifest.json`: proper maskable + any icons, add `screenshots` for install prompt.
- Toast position raised above the floating nav; nav clearance handled once in `AppScreen`.

---

## 4. Workstream B — Navigation & information architecture

### B1. App shell
- **Bottom nav v2** (phone): 5 items — `Hjem · Projekter · [Scan] · Opgaver · Værktøj`. Scan becomes a raised center action button (56px, brand-filled). Labels move to **11px** (legible). Keep dim-on-scroll but only opacity (no blur — GPU cost + readability).
- **Tablet/desktop (≥768px): nav rail** on the left (same 5 items + Team, Indstillinger), content in a max-width container; bottom nav hidden. This single change makes every screen tablet-first.
- **Unified `AppHeader`** on every screen: contextual title, back, actions, avatar/notifications on top-level screens. No more headerless or double-header screens.

### B2. Project hub IA — 11 tabs → 5 destinations
Owner/manager view (others see role-filtered subsets, same structure):

| New destination | Absorbs (existing tabs) |
|---|---|
| **Overblik** | Overblik + Detaljer (project info moves into an editable info card) + health |
| **Opgaver** | Opgaver + Punch List (as segmented sub-view: `Opgaver ▸ Punch`) |
| **Plan** | Tid & Plan + Påmindelser (calendar/gantt + reminders in one planning surface) |
| **Økonomi** | Indkøb + Tilbud & Rapport (money in one place) |
| **Mere** (bottom sheet) | Partnere, Opfølgning, Dokumenter, Rapportindstillinger, Eksport, Log |

- Rendered as a **sticky segmented tab bar** (5 fixed, no horizontal scrolling, ARIA tablist from kit `Tabs`).
- Deep links preserved: old `?tab=` keys redirect to new destinations (no broken links/bookmarks).

### B3. Global navigation hygiene
- Notifications become a proper **Notification Center** (sheet from the bell: grouped by project, mark-read, deep-link).
- Profile menu → standardized sheet (Dashboard/Netværk/Team/Indstillinger/Abonnement/Log ud).
- Search gets scoped tabs (Reglement / Projekter / Opgaver) — one search to find anything.

---

## 5. Workstream C — Screen-by-screen redesign (complete coverage)

Every surface in the app, grouped in delivery clusters. "DS migration" = tokens + primitives + AppScreen + a11y + dark-mode-via-tokens (applies to **all** rows).

### C1. Home / Dashboard (`pages/HomePage.tsx`)
**Projektledelse mode** — new hierarchy (top→bottom):
1. **Header**: greeting + date, avatar, bell (badged), tier chip
2. **Kræver handling** (only if non-empty): invitations, negotiation replies (Forhandling), overdue items — as action cards with inline accept/counter buttons
3. **KPI row**: 4 compact stat tiles — *integers* (6, not 6.00), tap → StatDetailsModal; overdue tile uses warning/danger ramp
4. **Fokus i dag**: top 3–5 tasks with project chip + due chip, checkbox complete, "se alle" → /tasks
5. **Dagens briefing (AI)**: collapsed card — 3 bullet summary + expand; "Pro briefing" upsell inline; weather compacted into the briefing card header
6. **Projekt puls**: horizontal snap-scroll cards (progress ring, next milestone, avatar group, unread badge)
7. **Hurtige handlinger**: 4-icon row (Nyt projekt, Tjekliste, Reglement, Punch-foto)

**Min Arbejdsdag mode** (worker): current task hero card (big *Start tid*, checklist progress), my tasks today, hours-this-week mini bar, punch quick-add. Same components, worker-relevant order.

### C2. Projects (`pages/ProjectsPage.tsx` + `pages/ProjectDetailPage.tsx` + 11 tab components)
- **Projects list**: search + status filter chips; project cards with progress ring, health chip, avatar group, next milestone, unread dot. Tablet: grid → two-pane (list + detail).
- **Project detail hero** (fixes screenshot bugs): compact header (back, name, status chip, ⋯ menu). Info card: client, address, dates, ID. **Start tid** becomes a proper header action / floating chip — never overlapping the title. KPI strip (Åbne opgaver, Dage tilbage, Indkøb, Materialer).
- **Intelligensindeks** → **"Projekt-sundhed"** chip + expandable panel: 5 compact metric bars, AI "Genberegn" secondary, PDF export in ⋯. No more full-width red "E" hero.
- **All 11 tab contents** regrouped per B2 and rebuilt on kit: task lists → `ListRow`, purchases → money-formatted rows with status chips, documents → grid/list toggle with type icons + upload FAB, follow-up (Opfølgning) → timeline pattern, punch list → photo-first cards with annotation state, reminders → grouped by date, quotations/reports → document cards with preview.
- **Partner view** (`components/partner/PartnerProjectPage.tsx`): same design language, clearly scoped ("Du ser en partner-visning" banner), negotiation thread as chat-style UI (see C5).

### C3. Tasks (`pages/GlobalTasksPage.tsx`, `pages/TaskDetailPage.tsx`)
- **Global tasks**: view switcher (Liste/Gruppe/Opdelt/Kanban) → kit `SegmentedControl` + icon toggle; filter chips scrollable row; Kanban with proper column headers + counts + drag affordance; virtualized lists.
- **Task detail**: header with status stepper (To Do → Igang → Review → Udført); 5 tabs → segmented (Overblik/Filer/Chat/Dokumentation/Indstillinger); **handover flow** as guided stepper with signature step (`SignatureCanvas`) and confirmation screen; sticky action bar (Start tid / Markér udført).
- Quick tasks & partner tasks: same card anatomy, distinguishing chip only.

### C4. Team & collaboration (`pages/TeamManagementPage.tsx`, `TeamInvitePage.tsx`, `LogPage.tsx`, chat)
- **Team**: member cards → `ListRow` + `Avatar` (presence dot), role chips (Ejer/Projektleder/Medarbejder/Kunde), seat usage meter, invite flow as bottom sheet with link/QR/e-mail options.
- **Aktivitetslog**: filterable timeline (person/projekt/type) with day grouping — becomes the team's "what happened" feed.
- **Task chat**: message bubbles on tokens, @mentions, photo replies, unread markers.
- **Notification center** (new, B3) ties collaboration together.

### C5. Partner / Forhandling (negotiation) flow
- Negotiation thread → **chat-style timeline** with distinct offer bubbles: Tilbud/Modtilbud as amount cards (state color, timestamp, "gælder til"), sticky composer with amount field + quick actions (Accepter / Nyt modtilbud / Afvis).
- Invitation cards on Home: clear roles ("Inviteret af…"), age, one primary action.
- Partner invites panel + task invitation carousel: unified card anatomy.

### C6. Tools & calculators (`ToolsConfiguratorPage`, `CalculationToolsPage`, `components/calculators/CalculatorPage.tsx` + ~80 calculators)
- **Configurator**: "Hvad skal du bygge?" → visual category grid (icon tiles), recent/favorite tools pinned first.
- **Catalog**: searchable, grouped by 16 categories, Pro badge on gated tools, favorites (star).
- **Calculator shell** (one fix, 80 screens win): consistent hero (name, category chip, help), inputs via kit `Field` with unit suffixes, sticky result card (number + gauge + compliance state), actions row (Gem til projekt / Del / PDF), `HelpDrawer` on `BottomSheet`. Result animations kept (`AnimatedNumber`).
- **AR Scan / RoomMapper**: onboarding hint overlay, capture button per HIG (72px), results → "Gem som rum / Send til beregner".
- `ProToolGate`/lock screens: consistent upsell card (feature list + price + one CTA).

### C7. Onboarding & project creation (Welcome, Onboarding, Login/Register/Forgot/Reset, wizards)
- **Welcome/Login/Register**: re-brand to `#1E5FFF` tokens; local hero asset (no Unsplash dependency); kit `Field`/`Button`; password strength meter; Turnstile styled-in.
- **Onboarding carousel**: 3–4 value-prop slides with real UI screenshots, skip always visible.
- **Wizard consolidation**: **v3 (`NytProjektWizardPage`) becomes the only flow** — flag flipped default-on, v2 (`pages/TasksPage.tsx` + `components/onboarding/**`) retired after parity check (AI plan, regulations step, purchase step ported). Entry modes: AI / Visuel / Hurtig via `EntryModeSheet`.
- `CreateProjectModal` / `QuickProjectModal` → merged into wizard entry modes.

### C8. Search & knowledge (`SearchPage`, `RegulationDetailPage`, `BuildingGuidePage`, `HelpPage`)
- **Search**: kit `Tabs`, real buttons for results (a11y), highlighted match text, recent searches, empty/loading skeletons.
- **Regulation detail**: readable article layout (max-width, 15px/22 body), § anchor links, AI explanation section as collapsible `Callout`, "Gem til projekt".
- **Building guide**: step cards with progress, images lazy.
- **Help**: FAQ accordions (kit), article view via `Modal`/route (not bespoke overlay), contact card.

### C9. Settings, admin & system (`SettingsPage`, `AdminDashboardPage`, legal ×4, `NotFoundPage`, chatbot)
- **Settings**: grouped `ListRow` sections (Profil / Udseende / Sikkerhed / Integrationer / AI / Abonnement / Data & konto); each modal (EditProfile, MFA, Integrations, SMTP, Subscription) on kit `Modal`; danger zone isolated.
- **SubscriptionModal**: tier comparison cards (Free/Pro/Premium), current-plan state, single upgrade CTA.
- **Admin dashboard**: stat tiles + data tables on tokens (desktop-first is fine here).
- **Legal pages**: shared `LegalLayout` (typography, TOC).
- **404**: friendly illustration + "Til forsiden".
- **Chatbot**: FAB deconflicted with nav/toasts (single floating-element coordinator); panel on tokens; hands-free overlay + subtitles restyled.
- `CookieConsentBanner` restyled to token design.

---

## 6. Workstream D — Collaboration & overview upgrades (the "cooperation" goal)

1. **Notification Center** (bell → sheet): grouped, actionable, mark-all-read.
2. **Activity feed** on project Overblik (last 5 events + link to full log) — who did what, when.
3. **Presence & attribution**: `AvatarGroup` with presence dots on project cards/detail; "opdateret af X for 2 t siden" meta on tasks/documents.
4. **Handover ceremony**: guided stepper + signature + auto-notification to manager, confirmation state with report link.
5. **Assignment loop visibility**: task cards always show assignee avatar + status; "Review" state gets its own color ramp so managers spot approval work instantly.
6. **Unread markers** everywhere a team member can leave something: project cards, task chat, negotiation threads.

---

## 7. Workstream E — Tablet & responsive strategy

| Breakpoint | Layout |
|---|---|
| < 768px (phone) | Bottom nav, single column, sheets from bottom |
| 768–1023px (tablet portrait) | Nav rail, 2-col dashboard grid, list+detail two-pane for Projects/Tasks, modals centered |
| ≥ 1024px (tablet landscape / desktop) | Nav rail + wider content (max-w 1200px), Gantt/calendar get room, persistent detail panes |

- All new primitives are responsive by default (`AppScreen` handles gutters/rail offset).
- Gantt/Calendar (`components/planning/`) get most tablet benefit — full-width timelines.

---

## 8. Accessibility & quality bar (applies to every workstream)

- WCAG 2.1 AA contrast (automated check in CI via axe on Playwright screens)
- Min text 11px; min touch target 44px; visible focus for every interactive element
- All interactive elements are real `<button>`/`<a>` (kill `<div onClick>`)
- Every modal on kit `Modal` (focus trap, ESC, restore)
- `prefers-reduced-motion` respected in CSS **and** framer
- Loading = skeletons (not spinners) on all list/detail screens; every list has a designed `EmptyState`; every mutation has toast feedback

---

## 9. Implementation roadmap

| Phase | Scope | Deliverable | Est. |
|---|---|---|---|
| **0. Foundations** | A1–A4: tokens, type scale, platform fixes, kit additions, icon consolidation | DS 2.0 + Storybook-style demo page (`/design` dev route) | 1–1.5 wk |
| **1. App shell** | B1, B3: AppScreen/AppHeader, bottom nav v2, nav rail, notification center | New shell live on all routes (visual-only change) | 1 wk |
| **2. Home + Projects core** | C1, C2 (hero + Overblik + new tab IA) | The two most-used screens redesigned | 1.5 wk |
| **3. Tasks + collaboration** | C3, C4, C5, D | Tasks, team, negotiation, activity | 1.5 wk |
| **4. Tools & calculators** | C6 (shell-first, then category sweep) | 80 calculators on new shell | 1 wk |
| **5. Onboarding & auth** | C7 incl. wizard consolidation | Single v3 wizard, rebranded auth | 1 wk |
| **6. Long tail + polish** | C8, C9, E tablet pass, a11y sweep, dead-code deletion | Whole app consistent; audit re-run clean | 1 wk |

**Guardrails**
- Visual-only where possible: no business-logic changes; API/data layers untouched.
- Old `?tab=` deep links redirect; feature flag (`?ui=v2`) during phases 2–3 for instant rollback.
- Per-phase verification: `rtk vitest run`, Playwright screenshot pass (light+dark, 390px/768px/1024px), manual smoke of role-gated views (Owner/Employee/Client/Partner).
- Definition of done per screen: 0 raw palette classes, kit primitives only, AA contrast, skeleton+empty+error states present.

---

## 10. Success metrics

- Raw palette classes: 2,123 → **0** (CI grep gate)
- Files importing `components/ui`: 23 → **all screen files**
- Modal implementations: 5 → **1**; icon systems: 2 → **1**; token sources: 2 → **1**
- Lighthouse a11y ≥ 95 on core screens; contrast violations: 0
- Project hub: 11 scrolling tabs → 5 fixed destinations
- Every screen: skeleton, empty, error states designed
