# BYG SMART — "Opret Projekt" Masterplan v3.0

**Created:** 2026-06-13 · **Scope:** Project & task creation only (`/projects/new` wizard)
**Builds on:** `plan13062026.md` (v2.0 JSON prompt) — this document supersedes and extends it.
**Stack:** React 18 + TypeScript + Tailwind + inline SVG + Zustand + Framer Motion + Supabase (Edge Functions) + multi-provider AI gateway.

---

## 1. Executive Summary

The current "Nyt Projekt" wizard (in `pages/TasksPage.tsx`, 8 steps) is visually charming but professionally too coarse, buggy (stale state, mispositioned tooltips), single-zone only, and its AI features are bolted on rather than woven in.

This plan delivers:

1. **A compressed, smarter flow** — 8 steps → **5 steps**, with two entry paths: *AI-first* ("Beskriv dit projekt") and *Visual* (tap the building).
2. **State-of-the-art UI** — detailed multi-zone building illustrations (15 exterior zones, 3 floors, apartment block variant), motion design spec, dark mode, on-site-friendly contrast.
3. **AI wired into every step** — natural-language project intake, photo-to-scope, task suggestions, bundle recommendations, and a pre-create plan review — all through a **provider-agnostic AI gateway** where the admin selects one primary provider and one fallback.
4. **All 10 known bugs/UX issues fixed** (BUG_001–003, UX_001–008 from v2 plan).

Out of scope: everything after project creation (scheduling execution, time tracking, reports).

---

## 2. New Flow Architecture

### 2.1 Step map (8 → 5)

| New | Title (DA) | Replaces old steps | Purpose |
|---|---|---|---|
| **Entry** | Opret Projekt (vælg metode) | — | AI-first vs Visual vs Hurtig (QuickProjectModal) |
| **0** | Vælg Projekttype | (new) | 6 type cards; drives illustration variant + task catalog |
| **1** | Vælg Område | old Trin 1 | Multi-zone select on interactive building |
| **2** | Vælg Opgaver | old Trin 2–3 (komponenter + beskrivelse) | Zone tabs, trade filter, bundles, quantity, AI suggestions |
| **3** | Detaljer | old Trin 4–6 (navn, adresse, team, datoer) | One consolidated form; BBR autofill from address |
| **4** | Gennemse & Opret | old Trin 7–8 (regler, review) | AI plan review, phase/Gantt preview, regulations preview, create |

Old steps 4–6 collapse into one form because every field is short; old "værktøjer/beregnere" step becomes an optional inline action in Step 2 (per-zone "Beregn mængder" button reusing `SmartToolCard` + `utils/onboardingCalculations.ts`).

### 2.2 Entry screen

Full-screen sheet with three cards (staggered fade-up entrance):

- **✨ Beskriv med AI** — "Fortæl hvad du skal lave — AI bygger udkastet" → opens AI intake (text + voice + photos). Output pre-fills steps 0–2; user lands on Step 1 with zones already selected and a glowing "AI-forslag" badge.
- **🏠 Vælg visuelt** — classic path, starts at Step 0.
- **⚡ Hurtigt projekt** — existing `QuickProjectModal` (name + type only, fill in later).

### 2.3 Step 0 — Vælg Projekttype

As specified in v2 plan §`new_step_0`: 2×3 grid, 6 types (`nybyg`, `renovering`, `vedligehold`, `tilbygning`, `lejlighed`, `let_erhverv`). Each card: 64 px icon, bold label, muted description. Selection: spring scale (1 → 1.03 → 1), 2 px brand ring, checkmark draw-in (SVG stroke-dashoffset, 200 ms). Tap auto-advances after 350 ms (with reduced-motion fallback: instant).

Project type drives: illustration variant, available area tabs, preselected zones, and task filter (`vedligehold` → maintenance tasks only).

### 2.4 Step 1 — Vælg Område

Implements v2 plan §`step_1_redesign` in full:

- **Exterior:** 15 hotspot zones (tag/skorsten, loft/tagetage, solceller, facade 1. sal, vinduer 1. sal, altan, facade stueetage, vinduer & døre, garage/carport, terrasse, indkørsel, have/hegn, fundament/sokkel, kælder udvendig, kloak/forsyning).
- **Interior:** floor tabs **Stueetage / 1. Sal / Kælder**, each a clickable floor plan (6/6/3 rooms). Cross-fade 150 ms between floors.
- **Apartment variant** for `lejlighed`: 7-zone cross-section (tag, facade, lejlighed, fællesarealer, kælder/teknik, altaner, elevator/trapper).
- **Multi-select:** tap toggles; selected zone = 40 % color overlay + 24 px white checkmark badge popping in at centroid (spring, 250 ms). Summary chip bar fixed above footer, chips removable (exit: scale+fade 150 ms).
- **Tooltip fix (BUG_002):** `@floating-ui/react`, anchored to hotspot bbox, placement `top` w/ flip; on touch devices a bottom sheet (drag-dismissable) with label, sublabel, task count and "Vælg" button.
- Shortcuts: "Vælg alle udvendige", "Vælg alle indvendige", "Ryd valg".
- **AI layer:** if entry was AI-first, AI-selected zones pulse once (ring expand) and the chip bar shows "✨ 4 områder foreslået af AI — justér frit".

### 2.5 Step 2 — Vælg Opgaver

Implements v2 plan §`step_2_redesign` + AI:

- **Zone tabs** (one per selected zone, count badge; horizontal scroll w/ snap on mobile; active tab underline slides via `layoutId`).
- **Trade filter chips** (Alle, Tømrer, El, VVS, Maler, Murer, Tagdækker, Blikkenslager, Gulvlægger, Diverse) + debounced search (150 ms) + sort.
- **Bundles** at top of relevant zones (7 packages incl. Komplet Badeværelse, Komplet Tag, Nyt Køkken, Energirenovering Facade, Solcellepakke). Selecting a bundle checks its tasks with a 30 ms stagger cascade — visibly "filling in".
- **Task cards v2:** checkbox, trade icon, name, trade, complexity dots (●○○–●●●), duration badge, "ofte valgt sammen" hint. Virtualized grid (`@tanstack/react-virtual`) when > 20 cards.
- **Quantity stepper** per zone ("Antal ens enheder: 3" → duplicates zone task set at creation with suffix " — Enhed 2/3").
- **AI suggestions strip:** after 3+ tasks selected in a zone, a dismissible strip appears: "✨ Projekter som dette inkluderer ofte: [Ventilation] [+ Vandtætning]". One tap to add. Powered by `suggest_tasks` (see §4). Never auto-selects.
- **Summary panel:** desktop right sidebar; mobile bottom drawer (snap 30 %/80 %, drag handle). **BUG_001 fix:** panel reads exclusively from the wizard's Zustand store, which is **created per wizard mount** (`createWizardStore()` factory, not a module singleton) — stale data is impossible by construction. Draft autosave goes to `localStorage` under a draft key and is only restored via an explicit "Fortsæt kladde?" prompt.

### 2.6 Step 3 — Detaljer

Single scrollable form: projektnavn (AI pre-suggested from scope, e.g. "Tagrenovering — Solvej 12"), adresse w/ DAWA autocomplete → **BBR autofill** (`services/bbr.ts`: byggeår, areal, tagtype — shown as confirmable chips), kunde, team (avatar multi-select from `MOCK_TEAM`/real team), startdato + ønsket varighed (AI-estimated total from task durations, editable), notes (RichTextEditor).

### 2.7 Step 4 — Gennemse & Opret

- Animated build-up summary: zones → task counts per trade → phase timeline (mini-Gantt from `PHASES`, bars grow in staggered).
- **AI Plan Review card** (streaming): gateway runs `review_plan` → flags missing prerequisites ("Du har valgt Ny Tagbelægning uden Stillads"), dependency ordering, relevant regulations (reusing `findRelevantRegulationsForTask`), and a confidence note. Each finding = one tappable fix-chip.
- "Opret Projekt" CTA → `createProjectWithPlan` → success: confetti-free professional moment — checkmark draw + card morph into the new project card, navigate to ProjectDetailPage.

---

## 3. Design System & Motion

### 3.1 Tokens (extends existing Tailwind config)

- Brand primary `#2563EB`, accent `#F59E0B`, success `#10B981`, destructive `#DC2626`; text `#111827`/`#6B7280`; bg `#F9FAFB`; card `#FFFFFF`; border `#E5E7EB`. Zone colors per v2 plan (each zone has fixed `highlight_color`).
- **AI identity:** gradient `#7C3AED → #2563EB`, always paired with ✨ icon and the word "AI" — AI-generated content is *always* visually distinguishable.
- Dark mode via existing `dark:` classes; SVG illustrations get a dusk palette (sky `#1E293B`, warm interior light in windows — small delight, no extra zones).
- Outdoor readability: min contrast 4.5:1, 16 px+ body, 44×44 px touch targets.

### 3.2 Motion spec (Framer Motion, all ≤ 300 ms, respect `prefers-reduced-motion`)

| Interaction | Animation |
|---|---|
| Step transition | Horizontal slide 24 px + fade, 250 ms, `easeOut`; direction-aware (back slides right) |
| Progress bar | Continuous bar (replaces dots), width animates spring; step label crossfades |
| Card select | Spring scale 1→1.03→1 (stiffness 400, damping 25) + ring |
| Zone select | Overlay fade-in 150 ms + checkmark spring pop at centroid |
| Zone deselect | Overlay fade 120 ms, badge scale-out |
| Bundle apply | Task checkboxes cascade-check, 30 ms stagger |
| Chip add/remove | `AnimatePresence` scale+fade 150 ms; bar uses `layout` for reflow |
| Tab underline | Shared `layoutId="tab-underline"` slide |
| Drawer | Spring drag w/ snap points; velocity-based settle |
| AI streaming | Shimmer skeleton → text streams in; suggestion strip slides up 200 ms |
| Number changes | Existing `AnimatedNumber` for totals/counts |
| Create success | SVG checkmark stroke draw 400 ms → card morph (`layoutId`) into project list |

Haptics (PWA: `navigator.vibrate(10)`) on zone select, bundle apply, create.

### 3.3 SVG illustrations

Follow v2 plan §`svg_illustration_specification` exactly (inline SVG, `<g data-zone-id>`, non-overlapping hotspots, centroid markers, viewBox-responsive). Keep the existing `SceneHouseCrossSection` charm (cloud drift, pulse markers) but: drop per-frame drop-shadow filters (CSS class toggle only), add the 11 new zones, and split `SceneInterior` into per-floor plans. New file set under `components/wizard/illustrations/`.

---

## 4. AI Architecture — Multi-Provider Gateway

### 4.1 Principle

**Admin selects exactly one primary provider and one fallback** (org-level setting). The app never talks to providers directly from the client; all calls go through one Supabase Edge Function: `ai-gateway`. API keys live in Supabase secrets — never in the bundle (fixes the current client-side `@google/genai` exposure in `services/gemini.ts`).

```
Client (services/ai/index.ts)
   └─ POST /functions/v1/ai-gateway  { feature, payload, stream? }
        ├─ loads org ai_settings (primary, fallback, model tier)
        ├─ builds feature prompt + JSON schema
        ├─ ProviderAdapter.call(primary)   ──fail/timeout──▶ ProviderAdapter.call(fallback)
        ├─ validates output against zod schema (1 retry w/ repair prompt)
        └─ logs usage → ai_usage_log
```

### 4.2 Provider adapters

Common interface; ship three:

```ts
interface AIProvider {
  id: 'anthropic' | 'google' | 'openai';
  complete(req: { system: string; messages: Msg[]; schema?: JSONSchema;
                  maxTokens: number; stream?: boolean }): AsyncIterable<Chunk> | Completion;
}
```

| Provider | Fast tier (suggestions) | Quality tier (intake, review) | Notes |
|---|---|---|---|
| Anthropic | claude-haiku-4-5 | claude-sonnet-4-6 | Tool-use JSON mode; excellent Danish |
| Google | gemini-flash | gemini-pro | Reuse existing prompt assets from `services/gemini.ts` |
| OpenAI | gpt-4o-mini-class | gpt-4o-class | Optional third adapter |

Fallback triggers: HTTP 5xx/429, > 12 s timeout, or 2× schema-validation failure. Fallback events logged + surfaced in admin dashboard.

### 4.3 Admin settings

Supabase table `ai_settings` (org-scoped, RLS admin-only write):

```sql
create table ai_settings (
  org_id uuid primary key references organizations,
  primary_provider text not null default 'anthropic',
  fallback_provider text not null default 'google',
  quality_model text, fast_model text,        -- optional overrides
  monthly_token_budget int,                    -- soft cap, warn at 80 %
  features_enabled jsonb default '{"intake":true,"photo_scope":true,"suggest":true,"review":true}',
  updated_at timestamptz default now()
);
create table ai_usage_log (
  id uuid default gen_random_uuid() primary key,
  org_id uuid, user_id uuid, feature text, provider text, model text,
  in_tokens int, out_tokens int, latency_ms int, fell_back bool default false,
  created_at timestamptz default now()
);
```

Admin UI: new card in `SettingsPage` → "AI-indstillinger": two dropdowns (Primær / Fallback, cannot be equal), model-tier override, feature toggles, usage chart.

### 4.4 AI features in the wizard

| # | Feature | Trigger | Model tier | Output (zod-validated) |
|---|---|---|---|---|
| 1 | **Projekt-intake (NL→plan)** | Entry "Beskriv med AI" — text/voice ("Vi skal totalrenovere et badeværelse og lægge nyt tag på en villa fra 1962 i Holbæk") | Quality | `{ projectType, zones: [{zoneId, floorId?, confidence}], tasks: Record<zoneId, taskId[]>, suggestedName, notes, clarifying_questions? }` — only IDs from the static catalog; unknown work → `notes` |
| 2 | **Foto-til-omfang** | Intake: attach site photos (roof damage, bathroom) | Quality (vision) | Same schema; photo analysis maps to zones/tasks ("Tagrender hænger — foreslår Tagrender & Nedløb") |
| 3 | **Opgaveforslag** | Step 2, ≥3 tasks selected in a zone (debounced) | Fast | `{ suggestions: [{taskId, reason}] }` max 3, excludes already-selected |
| 4 | **Pakke-anbefaling** | Step 2 zone-tab open, selection overlaps ≥60 % of a bundle | Local (no AI call) | "Du er 2 opgaver fra Komplet Tag-pakken" |
| 5 | **Varigheds-estimat** | Step 3 | Local first (sum task durations), AI refinement optional | `{ total_days_min, total_days_max, critical_path: taskId[] }` |
| 6 | **Plan-review** | Step 4 mount | Quality, streaming | `{ findings: [{type:'missing_prereq'│'order'│'regulation'│'risk', severity, message_da, fix?: {addTaskId?}}] }` |

Rules: AI **suggests, never decides** — every output is editable/dismissible; all AI text in Danish; deterministic catalog-ID grounding (model picks from provided ID list, never free-text task names); intake includes max 2 clarifying questions when confidence < 0.6.

### 4.5 Client service layer

Replace direct `services/gemini.ts` usage in the wizard with:

```
services/ai/
  index.ts          // callAI(feature, payload, {stream}) → typed result
  schemas.ts        // zod schemas per feature (shared types w/ edge function)
  prompts.ts        // system prompts (DA output, EN instructions)
supabase/functions/ai-gateway/
  index.ts          // router, settings load, fallback orchestration
  providers/{anthropic,google,openai}.ts
```

`services/gemini.ts` remains during migration as the Google adapter's prompt source; regulation lookup (`findRelevantRegulationsForTask`) moves behind the gateway too.

---

## 5. Data Model

### 5.1 TypeScript (extends v2 plan interfaces)

```ts
type ProjectTypeId = 'nybyg'|'renovering'|'vedligehold'|'tilbygning'|'lejlighed'|'let_erhverv';
type TradeId = 'Tømrer'|'El'|'VVS'|'Maler'|'Murer'|'Tagdækker'|'Blikkenslager'|'Gulvlægger'|'Materiel'|'Diverse';

interface Task { id: string; label: string; trade: TradeId; icon: string;
  complexity: 1|2|3; duration: string; durationDaysMin: number; durationDaysMax: number;
  isMaintenance?: boolean; dependsOn?: string[]; coSelectedWith?: string[]; phase: 1|2|3|4; }

interface ZoneConfig { id: string; label: string; sublabel: string; highlightColor: string;
  icon: string; view: 'exterior'|'interior'|'apartment'; floorId?: string; tasksKey: string;
  dimensionFields?: DimensionField[]; }   // reuse existing calculator fields

interface ZoneSelection { zoneId: string; floorId?: string; quantity: number; source: 'user'|'ai'; }

interface WizardState {
  entryMode: 'ai'|'visual'|'quick';
  currentStep: 0|1|2|3|4;
  projectType: ProjectTypeId|null;
  selectedZones: ZoneSelection[];
  selectedTasks: Record<string,string[]>;
  activeZoneTab: string|null;
  details: { name: string; address?: Address; bbr?: BBRData; team: string[];
             startDate?: string; notes?: string };
  ai: { intakeResult?: IntakeResult; reviewFindings?: Finding[]; pending: Record<Feature,boolean> };
}
```

### 5.2 Catalog

Full 16-zone / 150+ task library per v2 plan §`full_task_data_model`, stored as static typed data in `data/wizardCatalog.ts` (replacing/extending `RENOVATION_ZONES` in `data/tasksData.ts`; keep `dimensionFields` + `keywords` per zone for calculators and AI grounding). Bundles in `data/bundles.ts` (7 packages). No runtime fetch during the wizard.

### 5.3 State (BUG_001 fix, definitive)

- `createWizardStore()` Zustand factory instantiated in `NytProjektWizard` via `useRef` — one store per wizard mount, garbage-collected on unmount.
- Zone deselection prunes `selectedTasks[zoneId]` atomically in the same action.
- Draft persistence: serialized snapshot to `localStorage['bygsmart.wizard.draft']` (debounced 1 s); restored only on explicit user confirm; cleared on create/cancel.

---

## 6. Component Architecture

```
pages/NytProjektWizardPage.tsx          // replaces wizard portion of TasksPage.tsx
components/wizard/
  WizardShell.tsx                       // progress bar, footer, step transitions (AnimatePresence)
  EntryModeSheet.tsx
  Step0_ProjectType.tsx                 // + ProjectTypeCard
  Step1_VaelgOmraade.tsx                // ViewToggle, FloorTabBar, ZoneSummaryChips, SelectAllShortcuts
  Step2_VaelgOpgaver.tsx                // ZoneTabBar, TradeFilterChips, TaskSearchBar,
                                        //   BundleSection, TaskCardGrid (virtual), TaskCard,
                                        //   SelectedTasksPanel (sidebar/drawer), ZoneQuantityStepper,
                                        //   AiSuggestionStrip
  Step3_Detaljer.tsx                    // AddressBBRField, TeamPicker, DurationEstimate
  Step4_Review.tsx                      // PlanSummary, MiniGantt, AiReviewCard, CreateButton
  illustrations/
    HouseExteriorSVG.tsx                // 15 zones (evolved SceneHouseCrossSection)
    FloorPlanSVG.tsx                    // props: floorId
    ApartmentBlockSVG.tsx
    HouseUnderConstructionSVG.tsx
    HotspotZone.tsx  ZoneTooltip.tsx    // floating-ui; BottomSheet on touch
  ai/AiIntakeModal.tsx                  // text + voice (existing mic permission) + photo upload
stores/wizardStore.ts                   // createWizardStore factory
data/wizardCatalog.ts  data/bundles.ts
services/ai/{index,schemas,prompts}.ts
supabase/functions/ai-gateway/…
```

New deps: `framer-motion`, `@floating-ui/react`, `@tanstack/react-virtual`, `zustand`, `zod` (~45 kB gz total; three.js already dwarfs this).

---

## 7. Bug & UX Issue Resolution Map

| ID | Fix | Where |
|---|---|---|
| BUG_001 stale panel | Per-mount store factory + atomic prune (§5.3) | `stores/wizardStore.ts` |
| BUG_002 tooltip corner | floating-ui anchored to hotspot bbox; bottom sheet on touch | `ZoneTooltip.tsx` |
| BUG_003 phantom scrollbar | `overflow-x:hidden` + virtualized vertical grid | `TaskCardGrid` |
| UX_001 4 zones | 15 exterior zones | `HouseExteriorSVG` |
| UX_002 single-zone | Multi-select + chips | Step 1 |
| UX_003 no project type | Step 0 | `Step0_ProjectType` |
| UX_004 no trade filter | Trade chips + search | Step 2 |
| UX_005 no bundles | 7 bundle packages | `BundleSection` |
| UX_006 no quantity | Zone quantity stepper | `ZoneQuantityStepper` |
| UX_007 text-only cards | Icons + complexity + duration | `TaskCard` |
| UX_008 single floor | Floor tabs + apartment variant | `FloorPlanSVG`, `ApartmentBlockSVG` |

---

## 8. Accessibility & Performance

Adopt v2 plan lists verbatim, plus:

- Hotspots: `role="button"`, `tabIndex=0`, `aria-pressed`, arrow-key roving focus between zones; visible focus ring on SVG `<g>` (outline polygon).
- AI content: `aria-live="polite"` for suggestion strip and streaming review; "✨ AI" badge has text label, not icon-only.
- `prefers-reduced-motion`: all transitions → opacity-only ≤ 100 ms.
- Budgets: wizard route chunk < 180 kB gz (lazy-load illustrations per variant); zone select feedback < 16 ms (class toggle only); AI fast-tier P95 < 2.5 s, quality-tier streamed with skeleton ≤ 800 ms to first token.
- Offline (PWA): visual flow fully offline (static catalog); AI actions queue-disabled with clear "AI kræver internet" state — never block the flow.

---

## 9. Implementation Roadmap

| Phase | Content | Est. |
|---|---|---|
| **P0 — Foundation** | Wizard store factory (BUG_001), `wizardCatalog.ts` full data, WizardShell + progress bar + step transitions, deps install | 1 wk |
| **P1 — Core flow** | Step 0; HouseExteriorSVG 15 zones; multi-select + chips + tooltip fix; floor tabs + FloorPlanSVGs; Step 2 (tabs, filters, search, cards, bundles, quantity, drawer) | 2–3 wk |
| **P2 — AI gateway** | `ai-gateway` edge function + 3 adapters + fallback; `ai_settings`/`ai_usage_log` + admin UI; intake (text) + suggest_tasks + plan review | 2 wk |
| **P3 — Consolidation** | Step 3 (BBR autofill), Step 4 (mini-Gantt, streaming review, create), voice + photo intake, apartment & construction illustration variants | 1–2 wk |
| **P4 — Polish** | Motion pass, dark-mode SVG palettes, haptics, a11y audit, perf budgets, e2e (Playwright: full flow, AI-mocked), quality checklist (§10) | 1 wk |

Migration: build `NytProjektWizardPage` alongside `TasksPage.tsx` behind a feature flag (`?wizard=v3` → env flag → default); delete old wizard after 2 stable weeks.

---

## 10. Quality Checklist

All 25 items from v2 plan §`quality_checklist`, plus:

- [ ] Entry sheet offers AI / Visuel / Hurtig; all three reach a created project
- [ ] AI intake produces only catalog IDs; hallucinated IDs rejected by zod and repaired
- [ ] Provider fallback verified by forcing primary 500 in tests (mock)
- [ ] Admin can switch primary/fallback; takes effect without deploy
- [ ] AI features all individually toggleable; wizard fully functional with all AI off
- [ ] Draft restore prompt appears only with explicit saved draft; never silent
- [ ] Reduced-motion verified; Lighthouse a11y ≥ 95 on wizard route
- [ ] AI suggestions never auto-select; every AI element dismissible
- [ ] Offline: visual flow completes end-to-end with airplane mode

---

## 11. Companion Artifact

`mockup-opret-projekt.html` (same folder) — clickable single-file prototype of the entry sheet and Steps 0–2 incl. animations, multi-zone SVG selection, bundles, trade filters, and simulated AI intake. Use it for stakeholder validation before P1.
