# BygSmart 2.1 → Native Mobile Fork
## Part 1 — Technical Audit, Target Architecture & Fork Strategy

**Version:** 2.1 — revised after BMAD validation (Part 4), then partially superseded (see banner)
**Audit date:** 3 August 2026 · **Revision date:** 3 August 2026

> ### ⚑ PARTIALLY SUPERSEDED — read this first
> After this document was written it was established that **BygSmart 2.1 has no
> users and no customers.** That invalidates every part of this audit that exists
> to protect a live product:
>
> - **§8 (Brownfield integration & regression strategy) is void in full** — no
>   rollback matrix, no strangler shims, no bit-identity rule, no user
>   communication. Where a formula is wrong, fix it.
> - **§11 (Sequencing principle) is void** — "extract the core in place with the
>   web app as first consumer" was risk mitigation. Build the target directly.
> - **§10 Option B's costs and timeline are superseded** — the programme is now
>   **~7 months to a web launch, ≈28–34 person-months**, not 11–13 / 48–58.
> - **§13 gains D-12** (universality scope) and **resolves D-11 toward buying**
>   the sync layer.
> - The system is no longer a *fork* but **one universal Expo application**
>   (iOS + Android + web via React Native Web), shipping to web first, with
>   back-office staying DOM.
>
> **What remains fully valid:** the codebase inventory (§2), the stack (§3), the
> architecture assessment (§4), what helps and what blocks (§5–§6 — every
> technical correction still stands), and the **target architecture (§7)**, which
> is now easier to implement because the schema can be redesigned rather than
> extended.
>
> **Governing plan: `03_BUILD_PLAN.md` v3.0.**
**Audited repository:** `E:\01PROJEKTER\04 Mobil APPS\bygsmart 2.1\Byggeapp-2.1`
**Audited artefact:** local working tree, uncommitted work included

> ### ⚠ Reproducibility caveat — read before citing any number in this document
> The measurements below were taken from a **local working tree**, not a committed
> revision. No remote, branch or commit SHA was recorded. A second party cannot
> reproduce a single figure here.
>
> **Before this document is used to commit budget:** record `git remote -v`,
> `git rev-parse HEAD` and `git status --short` at the top of this section, and
> re-run the measurement against that revision. This is a ten-minute job and it is
> the difference between an audit and an anecdote.

---

## 0. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-03 | Initial audit |
| **2.0** | **2026-08-03** | Revised after BMAD Architect / PM / PO checklist validation and an adversarial technical fact-check. **12 factual corrections** (§0.1), **all estimates restated** (§0.2), and **four new sections** added: target architecture (§7), brownfield integration & regression strategy (§8), New Technology Additions (§3.3), and provenance. Full findings in `04_BMAD_VALIDATION_REPORT.md`. |

### 0.1 What was wrong in v1.0

Twelve corrections, verified against August 2026 sources. Each is stated here because a reader of v1.0 may have acted on it.

1. **NativeWind supports Tailwind v4.** v1.0 claimed the CSS-first `@theme` block had no native equivalent. **NativeWind v5 targets Tailwind v4 directly** — `@theme`, `@custom-variant`, `@utility` and `@source` are all supported and `tailwind.config.js` is optional. The B1/B2 styling fork was built on a false premise; decision D-03 is no longer blocking.
2. **`@react-three/fiber` does not run on the platform we are recommending.** R3F-over-`expo-gl` does not render under the New Architecture, and **Expo SDK 55 removed the Legacy Architecture entirely** — `newArchEnabled` no longer exists. The 3D configurator port as scoped is not possible.
3. **RoomPlan needs LiDAR, not iOS 16.** Setting the OS floor "for RoomPlan" was a category error: RoomPlan runs only on Pro iPhones and iPad Pros. The floor is now set by Expo (iOS 15.1 on SDK 55, 16.4 on SDK 56).
4. **The App Store billing analysis was ~12 months stale.** US external purchase links have been permitted with **no entitlement and no Apple commission** since May 2025. EU/DMA links run ~17–20 % all-in. Google Play permits link-outs in the US/UK/EU from 30 June 2026 at 20 %, 0 % in the US.
5. **"Sell nothing in-app" is not zero-risk.** Guideline 3.1.3(b) conditions multiplatform access on the same items being available as IAP; login-only B2B apps have been rejected under 3.1.1 on exactly this basis.
6. **RAM bundles are incompatible with Hermes**, and Hermes is already the default. Two of three stated bundling levers were wrong.
7. **ATT is not required and does not replace consent.** ATT covers cross-company advertising tracking; GDPR/ePrivacy consent for Sentry telemetry does not disappear on native.
8. **`expo-in-app-purchases` is unmaintained.** Expo lists `react-native-purchases` (RevenueCat) and `expo-iap`.
9. **The portability table used the wrong denominator.** It was labelled "frontend" but summed to 134,064 lines — the whole repo, including the 10,964-line Express server.
10. **Three different reuse percentages** appeared in one document (45–55 %, 40 %, 40–50 %).
11. **"Field-first MVP in ~4 months" was 2.5× optimistic** and contradicted the roadmap's own gate table.
12. **"Cuts this cost by 60–70 %"** was outside its own arithmetic (50–62 %).

### 0.2 What the estimates became

| Item | v1.0 | v2.0 | Driver |
|---|---|---|---|
| Offline engine — bespoke | 60–80 d | **100–160 d** | Scope is 5–8 specialist person-months, not 3–4 |
| Offline engine — on a sync platform | — | **35–55 d** + licence | New option (§7.2) |
| Calculators, schema-driven | 80–95 d | **120–160 d** | v1.0 contained no line for the SVG visualisation layer |
| 3D configurator | 15–25 d | **30–50 d** (WebGPU) / **8 d** (WebView) | Correction 2 |
| Server-side reports | 15–20 d | **25–35 d + infra** | Snapshot replacement needs a headless browser |
| React 19 upgrade of `apps/web` | — | **10–20 d** | Expo SDK 55 ships React 19.2 |
| Background upload after force-quit | — | **+8–12 d** | Expo background upload survives suspension, not termination |
| **R1 elapsed / effort** | 8.5–10 mo / ≈48 PM | **11–13 mo / ≈48–58 PM** | Gate G4 is a hard stop; Phases 4 and 5 cannot overlap |

---

## 1. Executive summary

BygSmart 2.1 is a **134,064-line React/TypeScript PWA** (of which ~123,100 is frontend) with a **Supabase Postgres backend**, an **11k-line Express API**, and a genuinely well-executed **modular-monolith architecture** ("BYG 3.0"): 19 business modules, each shipping a declarative manifest that contributes into named shell slots, gated by server-authoritative per-organisation entitlements.

**The strategic finding is favourable and survived review.** The module registry, the entitlement resolver and the services layer are DOM-free and transfer to React Native largely intact. The backend is ~95 % reusable. Forking to **Expo with a shared platform-agnostic core** is the right call, and no validation pass disputed it.

**Four things decide whether it succeeds.** The first three are unchanged from v1.0; the fourth was found by validation and is arguably the most urgent.

1. **There is no offline data layer.** The service worker documents plainly that `/api/` is never cached. A construction-site app whose primary persona stands in a basement cannot ship without one. This is the largest net-new subsystem — and **v1.0 never asked whether to build it or buy it.** Supabase lists PowerSync and ElectricSQL as partner integrations and documents WatermelonDB and Legend-State routes in its own engineering blog. That is a Phase 0 decision worth 50–100 dev-days.
2. **Store payment rules collide with the module marketplace.** The recommendation — the mobile app sells nothing — still stands, but it must be reached on 2026 numbers, and it is **not** the zero-risk option v1.0 called it.
3. **The ~90 calculators are 34,050 lines with maths welded into JSX.** The schema-driven approach remains right and remains the highest-leverage engineering decision. The saving is 50–60 %, not 60–70 %, and the cost is 120–160 dev-days, not 80–95.
4. **The plan changes the live system in eight places with no rollback for any of them.** Including — and this is the one that should stop the room — **changing the formula source of live Danish building-code calculators** (U-værdi, kabeldimensionering, faldsikring, brandkrav) whose outputs tradespeople act on and sign reports against, with no requirement that the new result equals the old one. §8 now specifies containment for all eight.

**Timeline:** R1 field MVP in **11–13 months**, ≈48–58 person-months at a 5.5 FTE peak. Full parity across R1–R3 in **~19–21 months**.

---

## 2. Codebase inventory

Measured from the working tree, excluding `node_modules`, `dist`, `coverage`, `playwright-report`, `test-results`, `.git`. Subject to the reproducibility caveat above.

### 2.1 Totals

| Metric | Value |
|---|---|
| TypeScript/JavaScript source files | **623** |
| Lines of TS/JS/TSX/JSX (whole repo) | **134,064** |
| — of which **frontend** (excl. `server/`) | **123,100** |
| — of which backend (`server/`) | 10,964 |
| Test files | 51 (8.2 % of files) |
| Test lines | 6,656 (**5.0 % of lines**) |
| SQL files (`supabase/`) | 87 · 13,691 lines |
| Supabase migrations | 90+ (Feb 2026 → Aug 2026) |
| Express route modules | 22 |
| Business modules | 19 |
| Calculator pages | ~90, in 16 categories |

> **The 5.0 % test coverage figure is not trivia.** It is the safety net the entire
> Phase 1 core extraction rests on (§8). Coverage thresholds are enforced on
> exactly two files.

### 2.2 Distribution by directory

| Directory | Files | Lines | Share of frontend | Role |
|---|---:|---:|---:|---|
| `modules/` | 354 | **83,417** | 67.8 % | The 19 business modules |
| `components/` | 98 | 14,517 | 11.8 % | Design system + shared UI |
| `services/` | 27 | 6,540 | 5.3 % | Cross-cutting data access |
| `pages/` | 26 | 5,479 | 4.5 % | Kernel-owned screens |
| `core/` | 16 | 2,422 | 2.0 % | Registry, entitlements, org, shell |
| `contexts/` | 9 | 1,379 | 1.1 % | Auth, theme, toast, subscription |
| `utils/` `config/` `hooks/` `tests/` `deploy/` | 14 | 1,759 | 1.4 % | Misc |
| *(unattributed — root-level `App.tsx`, `types.ts`, etc.)* | — | ~7,600 | 6.2 % | |
| `server/` *(backend, not frontend)* | 52 | 10,964 | — | Express API |
| `supabase/` (SQL) | 87 | 13,691 | — | Schema, RLS, RPCs |

### 2.3 Distribution by module

| Module | Files | Lines | Share of `modules/` | Group |
|---|---:|---:|---:|---|
| `tools` (calculators) | 125 | **34,050** | 40.8 % | Foundation |
| `projects` | 30 | **13,310** | 16.0 % | Foundation |
| `tasks` | 28 | 5,623 | 6.7 % | Foundation |
| `field` | 36 | 5,201 | 6.2 % | Operations |
| `time` | 24 | 4,760 | 5.7 % | Operations |
| `ai` | 17 | 4,362 | 5.2 % | Add-on |
| `partners` | 11 | 2,514 | 3.0 % | Commercial |
| `quality` | 8 | 2,193 | 2.6 % | Operations |
| `reporting` | 14 | 2,110 | 2.5 % | Commercial |
| `team` | 11 | 1,956 | 2.3 % | Operations |
| `knowledge` | 11 | 1,457 | 1.7 % | Foundation |
| `quotations` | 4 | 1,251 | 1.5 % | Commercial |
| `purchasing` | 7 | 934 | 1.1 % | Commercial |
| `planning` | 7 | 825 | 1.0 % | Operations |
| `ar` | 4 | 812 | 1.0 % | Add-on |
| `budget` | 4 | 750 | 0.9 % | Commercial |
| `documents` | 4 | 670 | 0.8 % | Operations |
| `integrations` | 7 | 616 | 0.7 % | Add-on |
| `client-portal` | 2 | 23 | 0.0 % | Commercial (stub) |

**Concentration:** `tools` + `projects` = **57 %** of all module code.

### 2.4 Outlier files (>25 KB)

| File | Size | Note |
|---|---:|---|
| `modules/tools/catalog.ts` | 239 KB | Calculator metadata + pure compute functions — **the key asset** |
| `modules/knowledge/data/publicRegulationFullText.generated.ts` | 1.32 MB | Generated BR18/DS/AB18 text — must not ship in the binary (or, on reflection, in the web bundle) |
| `modules/projects/components/wizard/house3d/house-scene.js` | 128 KB | Three.js scene, plain JS |
| `modules/tools/catalog.test.ts` | 108 KB | Calculator regression suite — **high-value, portable, and the parity gate** |
| `services/database.types.ts` | 113 KB | Generated Supabase types — portable verbatim |
| `modules/projects/data/wizardCatalog.ts` | 99 KB | Project-wizard task catalogue |
| `modules/projects/components/wizard/HouseModel3D.tsx` | 60 KB | R3F house configurator — see §6.5 |
| `core/registry/moduleShowcase.ts` | 61 KB | Marketplace copy |
| `pages/AdminDashboardPage.tsx` | 50 KB | Admin — out of mobile scope |
| `modules/field/components/TaskWorkspaceContent.tsx` | 51 KB | Core field screen |
| `modules/field/components/TaskDocumentationTab.tsx` | 51 KB | Photo documentation — core mobile flow |
| `modules/projects/components/ProjectDetailsTabContent.tsx` | 55 KB | |
| `modules/quotations/components/QuotationsTabContent.tsx` | 48 KB | |
| `modules/tasks/components/TaskFormModal.tsx` | 46 KB | |
| `modules/quality/components/PunchListTabContent.tsx` | 44 KB | |
| `pages/SettingsPage.tsx` | 43 KB | Needs decomposition for mobile |
| `public/textures/house/**` | ~14 MB jpg | Mobile `.webp` variants exist (~0.6 MB) |

---

## 3. Technology stack

### 3.1 Frontend (existing)

| Concern | Technology | Version | Usage in the enhancement |
|---|---|---|---|
| Framework | React | 18.3.1 | **Must upgrade to 19.x** — see §3.3 |
| Language | TypeScript | ~5.8.2 | Shared |
| Bundler | Vite | ^6.2.0 | Web only; Metro on mobile |
| Routing | `react-router-dom` **HashRouter** | ^6.30.4 | Replaced on mobile (§6.2) |
| Styling | Tailwind CSS v4, CSS-first `@theme` | ^4.2.1 | **Consumable directly by NativeWind v5** |
| State | Zustand 5 + Immer 11 + Context | | Shared where DOM-free |
| Validation | Zod | ^3.24.4 | Shared — also the sync-payload validator |
| Animation | Framer Motion | ^11.18.2 | Web only; Reanimated on mobile |
| Icons | `lucide-react` + `components/icons.tsx` (36 KB SVG) | | Shared via `react-native-svg` |
| Virtualisation | `@tanstack/react-virtual` | ^3.13 | **Does not port** — FlashList/FlatList on mobile |
| 3D | `three` 0.160 + `@react-three/fiber` 8.15.16 + `drei` 9.122 | | **Blocked on RN** (§6.5) |
| AR | `@react-three/xr` **5.7.1 (WebXR)** | | Dead on iOS; also 2 majors behind (current 6.x, incompatible API) |
| PDF | `jspdf` ^4.2.1 + `html2canvas-pro` ^1.5.11 | | jsPDF shared; html2canvas moves server-side |
| Spreadsheet | SheetJS `xlsx` 0.20.3 — **CDN tarball, not npm** | | ⚠ will need attention in the pnpm-workspace conversion |
| Sanitising | `dompurify` ^3.4.2 | | Web only |
| Consent | `vanilla-cookieconsent` ^3.1.0 | | Replaced by a native privacy screen (§6.12) |
| Observability | `@sentry/react` ^9.18 + `web-vitals` ^5.1 | | `@sentry/react-native` on mobile |
| AI SDK | `@google/genai` ^2.6.0 | | Server-side |
| Backend SDK | `@supabase/supabase-js` 2.39.3 | | ⚠ Jan-2024 release; upgrade before the RN storage-adapter work |

### 3.2 Backend & platform (existing, largely unchanged)

| Concern | Technology |
|---|---|
| Database | Supabase Postgres 17 — project `pkzburssqetnlcbvabdq`, `eu-west-1` |
| Auth | Supabase Auth (password + TOTP MFA/aal2 + Cloudflare Turnstile) |
| Storage | Supabase Storage, org-isolated buckets with quota accounting |
| Realtime | `postgres_changes` (entitlements, chat unread, project resources) |
| API | Node 20/23 + Express 4.22, Helmet, `express-rate-limit`, 22 route modules |
| Edge Functions | `ai-gateway` (Anthropic/Google/OpenAI/Cerebras/OpenRouter), `stripe-webhook` |
| Payments | Stripe Checkout + webhook; per-module and per-seat pricing |
| Email | Nodemailer; global + per-org SMTP, AES-256-GCM encrypted |
| Push | `web-push` VAPID → browser Push API |
| Hosting | simply.com shared hosting (CloudLinux), `bygsmart.com` + `app.bygsmart.com` |
| CI/Quality | ESLint 9 (+ `eslint-plugin-boundaries`, `jsx-a11y`), Vitest 3 + jsdom, Playwright 1.52, gitleaks, hadolint, OWASP ZAP |

### 3.3 New Technology Additions

Versions are pinned. "Latest stable" is not a version, and an 11–13-month programme crosses at least one breaking SDK boundary.

| Technology | Version | Purpose | Rationale | Integration |
|---|---|---|---|---|
| Expo SDK | **56** (55 if 56 slips) | Mobile platform | New Architecture is mandatory from 55; 56 raises min iOS to 16.4 | `apps/mobile` |
| React Native | 0.83+ (per SDK) | — | — | — |
| **React** | **19.2** | — | Shipped by SDK 55+. **`apps/web` must be upgraded to match** — a shared package of context providers cannot serve a React 18 and a React 19 consumer | Phase 1 prerequisite, 10–20 d |
| Expo Router | latest for SDK | Navigation + deep links | File-based, native Universal/App Link support | Replaces HashRouter |
| NativeWind | **v5** | Styling | Consumes the existing Tailwind v4 `@theme` block directly | `packages/tokens` stays the source |
| `expo-sqlite` | per SDK | Local store *(if bespoke)* | Expo-maintained, current with every SDK, typed tagged-template API | §7.2 decision D-11 |
| PowerSync **or** ElectricSQL | current | Sync platform *(if bought)* | Both are listed Supabase partner integrations | §7.2 decision D-11 |
| `expo-secure-store` | per SDK | Token storage | ⚠ **2048-byte limit** — needs a chunking adapter (§6.10) |
| `expo-file-system` | per SDK | Media queue | ⚠ background upload survives suspension, **not termination** (§7.4) |
| `react-native-svg` | current | Icons + calculator visualisations | The 36 KB icon set and the calculator viz layer both need it |
| `@shopify/flash-list` | current | Long lists | Replaces `@tanstack/react-virtual` |
| `react-native-skia` | current | Signature capture | Replaces Canvas 2D |
| `@sentry/react-native` | current | Observability | Native crash reporting + symbolication |
| Maestro | current | E2E | Simpler than Detox for this surface |
| `react-native-purchases` (RevenueCat) | current | IAP *(only if D-01 reopens)* | `expo-in-app-purchases` is unmaintained | Not in R1 |
| `react-native-webgpu` | current | 3D *(if the configurator ships)* | R3F/`expo-gl` is not viable under the New Architecture | §6.5 |

---

## 4. Architecture assessment (existing system)

### 4.1 The module registry ("BYG 3.0") — the fork's greatest asset

`core/registry/types.ts` defines a `ModuleManifest`. Each of the 19 modules exports one, declaring contributions into named **slots**: `nav · routes · projectTabs · homeWidgets · settingsSections · searchSources · quickActions`.

`core/registry/registry.ts` resolves the active set from entitlements, iteratively dropping any module whose `requires` closure is not fully entitled (so `ar → tools` degrades correctly). `core/registry/hooks.ts` exposes `useSlot('nav')` etc. The shell renders whatever entitled modules contributed; **nothing module-specific is hard-coded in the kernel**. Boundaries are enforced mechanically by `eslint-plugin-boundaries`.

**Why it matters:** the registry, the manifest *declarations*, entitlement resolution and the requires-closure are pure TypeScript with zero DOM dependency. They move to React Native unchanged. Only the slot **renderers** are web-specific — ~350 lines.

**Two constraints must be written into the contract:**
- Manifest `load()` must use **literal static import expressions** (they already do). Metro's static analysis cannot resolve fully dynamic import paths the way Rollup can.
- **Never nest `React.lazy` inside `React.lazy`.** `modules/tasks/index.ts` exports *loaders*, not lazy components, because nesting them caused a production crash on 2026-07-11. The same rule applies on RN. *(v1.0 recorded this and then failed to carry it into the requirements — it is now AR-03.)*

### 4.2 Entitlements & multi-tenancy

`EntitlementsProvider` is server-authoritative (`GET /api/modules/entitlements`), **fail-open** by design, org-scoped, and live via `postgres_changes` on `org_module_entitlements` and `org_module_prefs`.

**Portable, with two caveats now specified in §7.5:** the Realtime subscription must react to app foreground/background (iOS suspends the socket), and **fail-open does not survive contact with a 14-day offline grace window** — see §7.5, which was a hole in v1.0.

### 4.3 Data access layer

`services/` (6,540 lines) plus each module's `services/` wrap Supabase queries and `/api` calls, almost entirely free of DOM references.

> **Correction to v1.0.** v1.0 called this "~90 % portable verbatim" and counted
> 12–15k lines of "free reuse". That is true for an *online* client. A service that
> issues `supabase.from('tasks').select()` **cannot** be reused verbatim by a client
> whose source of truth is local SQLite. The correct statement: the *query shapes,
> types and business rules* are reusable; the *execution* must be re-pointed at a
> repository layer (§7.3). Budget the repository layer explicitly — v1.0 silently
> removed an unestimated subsystem from Phase 5.

### 4.4 Security posture

An unusually mature track: RLS-recursion fixes, profile over-exposure hardening, `SECURITY INVOKER` corrections, lookup-RPC lockdown, column guards on billing fields, encrypted provider and SMTP secrets, gitleaks, hadolint, ZAP, and two written audits.

RLS is the security boundary and it stays. A mobile client is another `anon`-key client — and on mobile the anon key ships in the binary and is trivially extractable, so **RLS must remain the only thing between a user and another tenant's data.** It currently is.

> **Correction to v1.0.** "No security rework required" was wrong for this client.
> Offline changes the model materially: cached entitlements, a 14-day grace window,
> a full local mirror of tenant data on a device that may be lost, and GDPR erasure
> that cannot reach a device. §7.5 specifies the offline authorisation model.

### 4.5 Documented architectural debt

Honest in-code comments record real incidents. Carry all of these forward as fork constraints:

- **Lazy-in-lazy incident (2026-07-11)** — §4.1.
- **Chunking fragility** — `vite.config.ts` records that forcing `knowledge`/`reporting` into a manual chunk dragged the 1.3 MB regulation catalogue into every page's static graph. Metro has blunter semantics; the problem returns in a different shape (§6.9).
- **Calculator formula divergence** — `catalog.ts` is intended as the single source, but `StairCalculator.tsx` documents a deliberate divergence (it is run-driven; `computeStairGeometry` is rise-driven). **Formulas live in two places for an unknown subset of the ~90 calculators.** Measuring this is the first task in the plan.

---

## 5. What already helps

| Property | Why it helps |
|---|---|
| **Mobile-first UI already** | `BottomNavBar`, `AppScreen`, `FAB`, `BottomSheet`, `pb-nav`, `viewport-fit=cover`, safe-area insets, 44px targets. The **information architecture is already a phone IA** — this removes most of the UX design cost. |
| **Design tokens centralised** | All theme values in one `@theme` block; the Tailwind JS config is deliberately empty. And now: **NativeWind v5 consumes that block directly.** |
| **Module registry** | §4.1 — transfers verbatim. |
| **Business rules in services** | §4.3 — reusable as rules, re-pointed for execution. |
| **`database.types.ts`** | 113 KB generated, portable verbatim. |
| **`catalog.ts` schema** | `CalculatorInputDef[]` + `computable` + `computeCalculator(id, inputs)` — a schema-driven calculator engine already exists in partial form. |
| **`catalog.test.ts`** | 108 KB of formula regression tests — the web↔mobile parity gate. |
| **Danish-only, single locale** | No i18n port cost. (Also no i18n *capability* — §9.) |
| **PWA install + web push shipped** | Notification and app-like patterns already validated with users. |
| **Mobile texture variants exist** | 14 MB → ~0.6 MB, already generated. |
| **Strong RLS** | §4.4 — the boundary needs no rework for a second client. |
| **Supabase has sanctioned offline routes** | PowerSync and ElectricSQL are partner integrations; WatermelonDB and Legend-State are documented in Supabase's engineering blog. **v1.0 missed this entirely.** |

---

## 6. What blocks or costs

### 6.1 Portability classification

Rebased on **123,100 frontend lines** (v1.0 used 134,064, which included the server).

| Class | Definition | Lines | Share |
|---|---|---:|---:|
| **A — Portable verbatim** | No DOM/CSS dependency: types, registry, entitlement logic, pure helpers, calculator formulas, tests | ~28,000 | **23 %** |
| **B — Portable behind adapters** | Business logic entangled with light UI; keeps its shape behind storage/fetch/navigation adapters | ~26,000 | **21 %** |
| **C — Rebuild, same behaviour** | Known, specified behaviour; rendering rewritten in RN primitives | ~48,000 | 39 % |
| **D — Different technology** | AR, 3D, PDF-by-snapshot, file pickers, canvas signature, service worker | ~11,000 | 9 % |
| **E — Out of mobile scope** | Admin dashboard, design-system gallery, marketing/legal pages, marketplace art | ~10,100 | 8 % |

**Single figure for all future citations: ~23 % directly reusable, ~44 % including adapter-mediated reuse, ±8 %.** Classification by directory role and file sampling.

### 6.2 Routing — HashRouter must go

`App.tsx` uses `HashRouter` (`/#/home`), a concession to static hosting. On mobile it is actively harmful: no Universal Links, no App Links, no deep links from push, no share targets.

**Required:** Expo Router; a `bygsmart://` scheme plus Universal Links / App Links on `app.bygsmart.com`; and **a complete route map** — v1.0 said "map every existing hash route" without producing the table, which four separate systems depend on (deep links, push targets, and four invite email flows).

**Affected:** `App.tsx`, `contexts/AuthProvider.tsx`, `ResetPasswordPage.tsx`, `modules/integrations` OAuth callback, `server/routes/inviteRoutes.js`, `taskInviteRoutes.js`, `emailTemplates.js`, and the Supabase Auth redirect allow-list.

⚠ **Deferred deep links** (installing from an invite link) have **no implementation named anywhere** and Firebase Dynamic Links is shut down. Either adopt an attribution SDK (Branch/AppsFlyer) or accept a manual code-entry fallback. This was a hard R1 requirement in v1.0 with no technology and no cost behind it.

### 6.3 Styling — **corrected**

~~Tailwind v4's CSS-first tokens are not consumable by NativeWind.~~

**NativeWind v5 targets Tailwind v4 and consumes `@theme` directly**, including `@custom-variant dark` which this project already uses. The choice between NativeWind and a token+StyleSheet approach is now an ordinary ergonomics/performance trade-off, not a forced migration.

**Still recommended, but no longer mandatory:** make `src/index.css`'s `@theme` block **generated from `packages/tokens`** rather than hand-edited, so one source feeds both apps. Small, reversible, and it removes a class of drift.

**D-03 is downgraded** from blocking decision to a Phase 2 team preference. **Risk R7 drops to Low/Low.**

### 6.4 Calculators — the largest mechanical cost

125 files, ~90 calculators, 16 categories. Each page holds Danish help content as JSX, input state, a `calculate()` closure, heavy layout, **SVG visualisations**, touch/mouse drag interactions, and PDF report assembly.

`catalog.ts` already provides `CalculatorMeta` with `inputs: CalculatorInputDef[]`, `standards`, `help`, a `computable` flag and pure compute functions — but its own header says only "the most purchase-relevant" formulas are extracted, and `StairCalculator` documents a deliberate divergence.

| | Hand-port each page | **Schema-driven engine** |
|---|---|---|
| Approach | Rewrite ~90 `.tsx` in RN | Complete `catalog.ts` for all 90; build one RN renderer for `CalculatorInputDef` + result + **a declarative visualisation layer**; hand-build the genuinely bespoke ones |
| Effort | 160–250 dev-days | **120–160 dev-days** |
| Maintenance | Two divergent implementations of every formula, forever | One formula source; the web can adopt the same renderer later |

**Corrected breakdown:** engine completion 60–80 d · renderer 25 d · **SVG visualisation layer + bespoke calculators 35–55 d**. v1.0 estimated "8–12 bespoke" while simultaneously stating that SVG viz and drag interaction appear on *every* page — an order-of-magnitude inconsistency, and it contained **no line item at all for the visualisation layer**. Assume **25–40 bespoke** until the divergence measurement says otherwise.

**Saving: 50–60 %**, not 60–70 %.

**Mandatory precursor (unchanged, still first):** measure which of the ~90 calculators delegate to `catalog.ts` and which hold divergent maths. 2–3 days; sizes a quarter of the codebase.

**New, non-negotiable requirement (§8):** converting a web page to call the catalog **must produce a bit-identical result**, or the change is a deliberate correction that is separately reviewed, golden-fixtured and communicated to users. These are compliance calculators.

### 6.5 AR & 3D — **substantially corrected**

**WebXR.** `@react-three/xr@5.7.1` is WebXR. Safari does not expose WebXR on iPhone or iPad, so `RoomMapper.tsx` (28 KB) is Android-Chrome-only today. *(visionOS Safari does support it, which is irrelevant to this product's device base.)* Separately, the repo pins a 2023-era version; current is **6.x with an incompatible API**, so "port the existing AR code" was never on the table.

**AR replacement — corrected.** ARKit **RoomPlan requires LiDAR**: Pro iPhones from the 12 Pro onward and iPad Pro 2020+. Standard, Plus, mini, e-series and SE models have no sensor. Pro models are roughly a third of the iPhone base and a *smaller* share of construction field devices, which skew cheap.

> RoomPlan is a **premium path, not the AR strategy.** Plan a non-LiDAR fallback —
> ARKit plane detection with manual dimensioning, and ARCore Depth which works
> without a ToF sensor — or accept that scanning ships to a minority. **30–45
> dev-days for the LiDAR path, plus 15–20 for a fallback.** R3, unchanged.

**Minimum OS — corrected.** The floor is set by **Expo, not RoomPlan**: SDK 55 requires iOS 15.1, SDK 56 raises it to **16.4**. Target **iOS 16.4 / Android API 26**.

**3D configurator — blocked as scoped.** `@react-three/fiber` does not render under the New Architecture, and **Expo SDK 55 removed the Legacy Architecture** (`newArchEnabled` is gone). The recommended platform and the v1.0 3D path are mutually exclusive. Options:

| Option | Effort | Note |
|---|---:|---|
| `react-native-webgpu` + Three.js WebGPU renderer | 30–50 d | Newest, most work, best result |
| WebView hosting the existing R3F scene unchanged | ~8 d | Pragmatic; the scene is already web code |
| Drop the configurator from mobile | 0 | **Recommended** — it is a configuration task, not a field task, and the PRD already excludes it |

### 6.6 Reporting & export

- `jspdf` runs in RN with polyfills. The **vector** PDF path is portable.
- `html2canvas-pro` **cannot** work in RN — it rasterises DOM. Every snapshot-based report needs a different strategy.
- `xlsx` (SheetJS) works with a Buffer polyfill; delivery moves to `expo-sharing`. ⚠ It is installed from a **CDN tarball, not the npm registry** — expect attention during the pnpm-workspace conversion.

**Recommendation stands: move snapshot-based generation server-side.** `server/handoverReport.js` proves the pattern and the server already depends on jsPDF.

> **Corrected cost.** v1.0's 15–20 d assumed the existing vector path extends
> trivially. It does not: replacing *snapshots* server-side needs a **headless
> browser**, which CloudLinux shared hosting generally cannot run. **25–35 dev-days
> plus an infrastructure decision** (a small render worker elsewhere, or rebuilding
> those three templates as vector jsPDF).

### 6.7 Offline — the defining subsystem *(now specified in §7)*

`public/sw.js` v4 states it plainly: API requests are never cached, navigations are network-first and not written back, only static assets are runtime-cached. **There is no offline data capability whatsoever.**

Every field flow assumes connectivity: check-in/out, photo documentation, task chat, quality control, time registration, punch lists.

**This is the largest net-new subsystem and the strongest reason the native app beats the PWA.** v1.0 estimated 60–80 dev-days for a bespoke build and never asked whether to build it. §7.2 now specifies the architecture and the build-vs-buy decision.

### 6.8 Push notifications

`server/routes/pushRoutes.js` + `web-push` implement VAPID browser push. Native needs **APNs** and **FCM**.

**Required:** a provider abstraction (`web` | `expo`), a `platform` + `device_token` column on the subscriptions table, unchanged `notificationCatalog.js` and preference logic, deep-link payloads, notification categories, badge counts — and for the 8-hour timer reminder and auto-checkout, **background execution**, which on iOS means a locally scheduled notification plus a server-side safety net, never a JS timer. **12–18 dev-days**, plus the schema change's rollback plan (§8).

⚠ Expo Push is a **single point of failure for 100 % of notifications** with no fallback named. Acceptable, but record it.

### 6.9 Bundling & startup — **corrected**

Metro splits far less aggressively than Rollup. The 1.32 MB regulation text and the 239 KB `catalog.ts` must not land in the initial bundle. *(The regulation text is a latent **web** problem too — it should move out of the web bundle regardless of the fork.)*

> **Corrected levers.** ~~Adopt Hermes, enable RAM bundles / inline requires.~~
> Hermes is the **default** — "adopt Hermes" is a no-op. **RAM bundles are
> incompatible with Hermes** (its bytecode is mmap'd; the two mechanisms conflict,
> per React Native's own docs). The real levers are: **inline requires**, lazy route
> registration, Metro `serializer` configuration, and keeping heavy catalogues out
> of the graph.

**Constraint that must be reconciled:** calculators must work **fully offline** (no network to compute) *and* `catalog.ts` must stay out of the initial bundle. Both hold only if the catalogue is **lazily required from the binary, never fetched at runtime**. State it that way or the two requirements contradict.

### 6.10 Auth, session and native storage

Inject a storage adapter, set `detectSessionInUrl: false`, drive OAuth and recovery through the deep-link handler.

> ⚠ **`expo-secure-store` has a hard ~2048-byte limit per value**, and a Supabase
> session with a populated `user_metadata` JWT plus refresh token routinely exceeds
> it — a documented, recurring Supabase-on-Expo failure. Use a **chunking
> SecureStore adapter**, or AsyncStorage with only the refresh token in
> SecureStore. A naive single-key adapter works in development and fails in the
> field.

- **MFA** works but needs native TOTP entry plus a biometric resume gate.
- **Cloudflare Turnstile** is a web widget. Native needs the Turnstile mobile SDK, or App Attest / Play Integrity. ⚠ **`supabase/config.toml [auth.captcha]` is global** — changing it for native can disable CAPTCHA on live **web** signup. This risk was dropped between v1.0's register and the roadmap's; it is reinstated as **R10**.

### 6.11 Billing — **substantially corrected**

BygSmart sells 19 modules plus seats plus storage add-ons via Stripe Checkout, with client/server pricing parity tests.

**Current rules, August 2026:**

| Route | Apple | Google |
|---|---|---|
| In-app purchase | 15–30 % | 15–30 % |
| **External purchase link** | **US: permitted, no entitlement, 0 % commission** (post-May-2025 injunction, pending appeal). **EU/DMA: ~17–20 % all-in** — 5 % Core Technology Commission + 2 % initial acquisition fee + Store Services 5 % (Tier 1) or 13 % (Tier 2) | **Link-outs permitted US/UK/EU from 30 June 2026 at 20 %; 0 % in the US** under the standing injunction |

| Option | Assessment |
|---|---|
| **1. Purchase on web, consume on mobile** ✅ **still recommended** | The app never sells. Marketplace screens are informational. Entitlements resolve server-side exactly as today. Zero commission, minimal work. **But not zero review risk — see below.** |
| 2. Full IAP for self-serve tiers | 15–30 % on mobile-originated revenue, a second entitlement source of truth to reconcile against Stripe, 25–40 dev-days. Implement with **`react-native-purchases` (RevenueCat)** or **`expo-iap`** — *not* `expo-in-app-purchases`, which is unmaintained. |
| 3. External purchase link | No longer the poor option v1.0 described — 0 % in the US. Still ~17–20 % in Denmark and carries ongoing compliance work. Worth revisiting only if D-01 reopens. |

> ⚠ **Correction: Option 1 is not zero-risk.** Guideline **3.1.3(b)** permits
> accessing content acquired elsewhere *"provided those items are also available as
> in-app purchases within the app"* — a condition BygSmart's modules would not meet.
> Login-only B2B SaaS apps have been rejected under 3.1.1 on exactly this basis,
> with no self-executing enterprise carve-out.
>
> **Mitigation:** marketplace and entitlement screens must not name, price or
> describe purchasable modules — present **capability state only**. Budget **2–4
> weeks and one appeal cycle** at first submission. **Risk R3 rises to
> High/Critical.**

**Rationale for Option 1 is unchanged and still good:** the buying motion is B2B — the org owner buys, the field worker consumes, and the field worker is the mobile persona.

### 6.12 Other platform-specific work

| Item | Current | Native requirement |
|---|---|---|
| File picking | `FilePicker.tsx`, `input[type=file]` | `expo-document-picker` + `expo-image-picker` + camera |
| Signature | `SignatureCanvas.tsx`, Canvas 2D | `react-native-skia` or SVG-path gesture capture |
| Rich text | `RichTextEditor.tsx` (stub) | Native editor or markdown input |
| Long lists | `@tanstack/react-virtual` | **Does not port** — FlashList/FlatList |
| Consent | `vanilla-cookieconsent` | ⚠ **Corrected:** a native **privacy/consent screen** covering Sentry telemetry under GDPR/ePrivacy — the obligation does not disappear on native. **ATT is *not* required** (no cross-company ad tracking) and should not be shipped by default. |
| Sentry | `@sentry/react` | `@sentry/react-native` + dSYM/source-map upload in CI |
| Web Vitals | `web-vitals` | RN performance monitoring |
| Testing | Vitest + jsdom, Playwright | Jest + RNTL, **Maestro** E2E, EAS Build + TestFlight/Internal Testing |
| Env config | `VITE_*` | `app.config.ts` + EAS secrets; anon key is public in a binary — RLS is the boundary |
| Cloud integrations | Google/Dropbox/OneDrive/Box OAuth | `expo-auth-session`; redirect URIs re-registered per platform |

---

## 7. Target architecture *(new in v2.0)*

The BMAD Architect pass failed v1.0 on this: it named thirteen entities and specified none of them. What follows is the minimum specification needed to estimate and build Phase 4. It is not a substitute for the sync design document (§11 action 2) — it is its skeleton.

### 7.1 Monorepo & source tree

```
bygsmart/
├── apps/
│   ├── web/                     ← existing Vite PWA (upgraded to React 19)
│   └── mobile/
│       ├── app/                 ← Expo Router routes, file-based
│       │   ├── (auth)/          ← sign-in, MFA, reset
│       │   ├── (tabs)/          ← registry-driven tab bar
│       │   ├── project/[id]/    ← registry-driven project tabs
│       │   ├── task/[id]/       ← the field workspace
│       │   └── sync/            ← Sync Centre
│       ├── src/
│       │   ├── db/              ← schema, migrations, repositories
│       │   ├── sync/            ← puller, outbox, media queue, conflict engine
│       │   ├── ui/              ← native primitives (mirrors components/ui)
│       │   ├── adapters/        ← platform adapter implementations
│       │   └── modules/         ← per-module screens, mirroring modules/*
│       └── app.config.ts
├── packages/
│   ├── core/                    ← types, database.types, registry, entitlements,
│   │                              org, business rules, query shapes   (Class A)
│   ├── calc-engine/             ← catalog formulas + input schemas + viz descriptors + tests
│   ├── tokens/                  ← generated design tokens (single source)
│   └── api-client/              ← typed Supabase + /api client behind adapters
└── server/                      ← unchanged Express API (+ push, + reports, + sync)
```

**Naming:** files `PascalCase.tsx` for components, `camelCase.ts` for everything else — matching the existing repo. Repositories are `<entity>Repository.ts`. Migrations are `NNNN_description.ts`, applied in order, never edited after release.

### 7.2 Local store — the build-vs-buy decision *(new: D-11)*

v1.0 specified six hand-rolled components and never asked the question. Supabase lists **PowerSync** and **ElectricSQL** as partner integrations, and documents **WatermelonDB** and **Legend-State** routes in its own engineering blog.

| Route | Effort | Trade-off |
|---|---:|---|
| **Bespoke on `expo-sqlite`** | **100–160 d** | Total control; every edge case is yours; `expo-sqlite` is Expo-maintained and current with every SDK |
| **PowerSync / ElectricSQL** | **35–55 d** + licence | Sync, conflict handling and consistency are the vendor's problem; non-invasive to the Postgres schema; introduces a platform dependency and a self-host question |
| **WatermelonDB** | 60–90 d | Brings its own reactive model *and its own sync protocol* — would supersede half of Phase 4. ⚠ Last stable 0.28.0 (Apr 2025); needs a community Expo plugin, React 19 peer overrides, Podfile de-duplication; New Architecture support officially untested |
| **Legend-State** | 50–80 d | Offline persistence, retry queue, realtime and timestamp/soft-delete conflict handling out of the box; lighter than the platforms |

**Recommendation:** evaluate PowerSync and ElectricSQL against a bespoke build in Phase 0, with a two-day spike each. This decision is worth 50–100 dev-days and it determines §7.3 and §7.4 entirely. **It is now decision D-11 and it gates Phase 4.**

### 7.3 Local data model *(the specification v1.0 lacked)*

Mirror only what the field personas touch. Every mirrored table carries the same sync metadata:

```sql
-- applied to every synced table
_local_id        TEXT PRIMARY KEY,   -- client UUIDv7, generated at creation
id               TEXT,               -- server uuid, NULL until first sync
_dirty           INTEGER NOT NULL DEFAULT 0,   -- has unsynced local changes
_deleted         INTEGER NOT NULL DEFAULT 0,   -- local tombstone
_server_version  TEXT,               -- server updated_at at last successful pull
_synced_at       INTEGER,            -- epoch ms
_conflict        TEXT                -- NULL | 'pending' | serialized rival row
```

**Type mapping.** Postgres `uuid` → `TEXT`; `timestamptz` → `INTEGER` epoch-ms UTC (never a string — comparison and cursor arithmetic depend on it); `jsonb` → `TEXT` with a Zod parse at the repository boundary; `numeric` → `TEXT` (never `REAL` — money and quantities); `boolean` → `INTEGER`.

**Mirrored entities (R1):** `orgs`, `profiles`, `org_module_entitlements`, `projects`, `project_resources`, `tasks`, `task_access`, `quick_tasks`, `task_check_ins`, `task_documentation`, `task_chat_messages`, `task_chat_reads`, `punch_list_items`, `task_quality_control`, `time_registrations`, `documents` (metadata only), `media_queue` (local-only).

**Indexes.** Every table gets `(_dirty)`, `(_server_version)` and its natural query index — at minimum `tasks(project_id, status)`, `task_documentation(task_id, created_at)`, `time_registrations(user_id, date)`, `task_chat_messages(task_id, created_at)`.

**Encryption.** SQLCipher, with the key in `expo-secure-store` (subject to §6.10's size limit — the key is small, this is fine) and re-derived on biometric unlock. Decide and record: SQLCipher **or** platform file-protection — "or" is not a decision.

**Corruption recovery.** A "zero data loss" bar requires a stated recovery path: on `SQLITE_CORRUPT`, quarantine the database file, export the outbox and media queue if readable, re-hydrate from the server, and surface what could not be recovered. Never silently re-create.

**Initial hydration.** First sign-in pulls the user's scope in paged batches with visible progress, over Wi-Fi by default. Specify the page size and the maximum acceptable first-sync duration; it is the first impression the app makes.

### 7.4 Sync protocol *(the contract v1.0 lacked)*

**Pull — delta, cursor-based, RLS-scoped.**

```
GET /api/sync/:entity?since=<cursor>&limit=500
Authorization: Bearer <jwt>

200 {
  "entity":  "tasks",
  "rows":    [ { ...row, updated_at, deleted_at } ],
  "cursor":  "1785712345678:9f3c…",   -- (updated_at_epoch_ms, id) — monotonic
  "hasMore": true,
  "serverTime": 1785712400000
}
```

- The cursor is `(updated_at, id)`, not `updated_at` alone — ties are common and a timestamp-only cursor silently drops rows.
- **Tombstones are mandatory and were entirely absent from v1.0.** Without `deleted_at` in the payload, deleted tasks and revoked project access persist on devices forever — a correctness bug *and* an RLS leak. Rows soft-delete server-side with a retention window at least as long as the offline grace (§7.5).
- The server applies RLS. The client never asks for what it cannot see; there is no client-side filtering to trust.

**Push — outbox, idempotent, ordered.**

```
POST /api/sync/mutations
Idempotency-Key: <client uuid, unique per mutation>

{ "mutations": [
    { "id":"<uuid>", "entity":"tasks", "op":"update",
      "localId":"<uuid>", "serverId":"<uuid|null>",
      "baseVersion":"<server updated_at at read time>",
      "payload":{…}, "createdAt":1785712000000, "dependsOn":["<uuid>"] }
]}

200 { "results":[ { "id":"<uuid>", "status":"applied|conflict|rejected",
                    "serverId":"…", "serverRow":{…}, "reason":"…" } ] }
```

- **Idempotency keys are stored server-side** with a TTL at least as long as the offline grace window, and deduplicated. Replay must be safe.
- `dependsOn` makes ordering explicit: a photo attached to a task created offline replays after that task.
- `baseVersion` enables optimistic concurrency — the server can detect that the client's read is stale.

**Retry and failure policy** — v1.0 said "exponential backoff" and stopped.

| Server response | Action |
|---|---|
| `5xx`, network error, timeout | Retry: 2s, 8s, 30s, 2m, 10m, 1h, capped at 1h. Unlimited attempts while the item stays valid. |
| `401` | Refresh token, retry once. On failure park the whole outbox and prompt for sign-in — **do not discard.** |
| `403` (RLS/entitlement) | **Park as `needs-attention`.** Never discard: the user's access may have changed after they did legitimate work. |
| `409` (conflict) | Apply the per-entity conflict policy (below). |
| `422` (validation) | Park as `rejected`, show the reason in the Sync Centre with the original payload viewable. |
| Same item fails 20 times | Mark **poison**, stop retrying, raise it in the Sync Centre, include it in the diagnostic bundle. |

**Conflict policy, per entity** — v1.0 named three strategies and never mapped them.

| Entity | Policy |
|---|---|
| `task_check_ins`, `time_registrations`, `task_documentation`, `task_chat_messages` | **Append-only.** No conflict is possible. Duplicate suppression by idempotency key. |
| `tasks` (status, assignee, dates) | **Last-writer-wins with a server guard.** The server rejects transitions illegal from the current state; the client surfaces the rejection rather than retrying. |
| `punch_list_items`, `task_quality_control` | **Explicit user resolution.** Store the rival row in `_conflict`, show both versions side by side in the Sync Centre, require a choice. Never merge silently. |
| `projects` (light edit) | LWW with server guard. |
| Media | Append-only; content-addressed by hash to suppress duplicates. |

**Media queue.**
- Capture writes to `expo-file-system` **before** anything else, with a thumbnail generated immediately.
- **Downscale before upload** — a specification v1.0 omitted entirely. 40 photos/day at 12 MP against an org storage quota is a cost problem and a bandwidth problem. Target long-edge 2048px, JPEG q80, EXIF stripped except orientation, with the original retained locally until the server confirms.
- ⚠ **`expo-file-system` background upload survives *suspension*, not *termination*.** Resumption after force-quit requires an iOS `URLSession` background configuration and Android `WorkManager`, plus a reconcile-on-launch sweep over the durable outbox. **+8–12 dev-days**, not in v1.0's estimate.
- Quota rejection never loses the media: retain locally, tell the user, point them at the web (§7.5).

### 7.5 Offline authorisation model *(a hole in v1.0)*

v1.0 combined three requirements that do not compose:

- **S-14:** entitlements cached, **fail-open** offline — justified as parity with the web.
- **A-06:** **14-day** offline grace window.
- **L-06:** a server-side **kill switch per module**; **AR-06:** force-upgrade.

On the web, fail-open covers an API outage of seconds. Stretched across 14 days it means an org whose entitlement is revoked — non-payment, seat removal, employee termination — **retains full local capability for two weeks and replays mutations authored under a revoked entitlement**, unreachable by both the kill switch and force-upgrade. That is a false equivalence across six orders of magnitude.

**Specified model:**

| Control | Rule |
|---|---|
| Entitlement cache TTL | **72 hours**, independent of the session grace window. Past TTL the client degrades to a read-only, sync-only mode for affected modules — not a lockout, but no new work. |
| Session grace | 14 days of read + queue. Past 14 days, read-only until an online authentication succeeds. |
| Replay under revoked entitlement | The **server** decides. A mutation authored before revocation and replayed after is accepted if `createdAt` precedes the revocation timestamp, rejected with a clear reason otherwise. The client never adjudicates this. |
| Kill switch | Takes effect on the next successful sync. Accept that it cannot reach a device that never connects; state the exposure rather than implying a guarantee. |
| Device loss | Local data is encrypted at rest; biometric lock is **mandatory, not a toggle**, when the device holds unsynced work. Remote wipe is out of scope for R1 — say so. |
| GDPR erasure | An erasure request must propagate to devices on next sync via tombstones (§7.4), and the retention window must be documented. It cannot reach a permanently offline device — record this as a known limitation with the DPO. |

**Also required and absent from v1.0:** a **DPIA**. Check-in with geolocation, GPS-stamped photos and crew-hour visibility constitute employee monitoring, which in Denmark carries works-council and employment-law obligations beyond GDPR.

### 7.6 Platform adapters

The interfaces that make `packages/core` platform-agnostic. v1.0 named them and typed none.

```ts
export interface StorageAdapter {          // token + small-value storage
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  // implementations MUST chunk values > 2 KiB (expo-secure-store limit)
}

export interface FetchAdapter {
  (path: string, init?: RequestInit): Promise<Response>;  // resolves apiBaseUrl, attaches JWT
}

export interface NavigateAdapter {
  push(route: string, params?: Record<string, string>): void;
  replace(route: string, params?: Record<string, string>): void;
  back(): void;
}

export interface FileAdapter {
  writeTemp(bytes: Uint8Array, ext: string): Promise<string>;   // returns a uri
  share(uri: string, mime: string): Promise<void>;
  pick(opts: { mime?: string[]; multiple?: boolean }): Promise<string[]>;
}

export interface ClipboardAdapter { copy(text: string): Promise<void>; }
```

`packages/core` accepts these at construction. `apps/web` supplies DOM implementations; `apps/mobile` supplies Expo ones. **No `packages/core` file may import from `react-native`, `expo-*`, or touch `window`/`document`** — enforced by an ESLint rule, the monorepo equivalent of the `eslint-plugin-boundaries` discipline that makes the existing codebase portable at all.

### 7.7 Observability — what makes the KPIs measurable

v1.0 set launch gates on "outbox unresolved failure < 0.1 %" and "≥ 20 % of mutations created offline" with **no telemetry pipeline capable of reporting either**. Required:

- A client heartbeat on each successful sync reporting: pending outbox count, oldest pending age, poison count, media queue depth, last successful pull cursor age, and whether the last mutation batch was authored offline.
- Server-side aggregation with alert thresholds: p95 oldest-pending-age > 1 h, poison rate > 0.05 %, sync error rate > 2 %.
- The Sync Centre's diagnostic export (device state, outbox contents redacted of payload bodies, last 200 sync breadcrumbs) attachable to a support ticket.
- Sentry release health tagged with the same `__APP_VERSION__` convention as the web app.

---

## 8. Brownfield integration & regression strategy *(new in v2.0)*

**This section exists because the BMAD PO pass failed the plan on it, and it was right.** The plan changes the live web app and live backend in eight ways. v1.0 specified rollback for none of them, and named its only containment mechanism as *"the web app stays green in production"* — on a codebase measured at **5.0 % line coverage**, with the extraction explicitly shipping *"behind no flag"*.

### 8.1 The eight mutations

| # | Change | Blast radius | Containment | Verification | Rollback |
|---|---|---|---|---|---|
| 1 | pnpm/Turborepo monorepo conversion | Web build + simply.com deploy | Staging deploy of the converted app **before** merge | Full Playwright critical-path suite green on staging; deploy dry-run against CloudLinux | Revert the merge; the previous deploy artefact is retained |
| 2 | Extract `services/`, registry, types → `packages/core` | 12–15k lines of live code | **Strangler re-export shims:** the old paths keep exporting from the new package, so any extraction reverts by a one-line import change | Characterisation tests written **before** the move (§8.2); Playwright suite | One-line import revert per file |
| 3 | **Rewire calculators to `catalog.ts`** | Live building-code results users sign reports against | One calculator per PR; **golden-fixture bit-identity** (§8.3) | `catalog.test.ts` + new golden fixtures per calculator | Per-calculator revert; feature-flag the catalog call for the first five |
| 4 | Push subscriptions gain `platform`, `device_token` | Live push delivery | Additive columns, nullable, defaults set; no backfill required | Web push send/receive smoke test post-migration | Drop-column migration prepared and tested; web path never reads the new columns |
| 5 | Deep-link URLs in email templates + **Supabase Auth redirect allow-list** | Live password reset and all four invite flows | Add mobile URLs **alongside** web URLs; never replace | End-to-end reset + invite test on staging **and** production post-deploy | Allow-list entries removed; templates reverted |
| 6 | Idempotency keys on existing mutation endpoints | Every write path the web app uses | Header **optional**; absent = current behaviour exactly | Contract test asserting identical behaviour with and without the header | Feature-flag the dedupe table lookup |
| 7 | `@theme` becomes generated from `packages/tokens` | Every visual token in the product | ⚠ **Requires visual-regression tooling that does not currently exist** — build it first (§8.2) | Pixel diff of the top 20 screens, light and dark | Revert to the hand-written `@theme` block |
| 8 | Server-side reports replace `html2canvas` for both clients | Live report, handover and quotation output | New endpoint alongside the old path; web switches last, behind a flag | Byte-comparison of 20 real historical reports old vs new | Flag off; web reverts to client-side generation |
| (9) | D-07 App Attest → `[auth.captcha]` (**global**) | Live **web** signup | Do not touch until the native path is proven on staging | Web signup smoke test with CAPTCHA enabled | Config revert |

### 8.2 Prerequisites that must land before Phase 1

Neither exists today, and Phase 1 is unsafe without them.

1. **A critical-path Playwright suite for `apps/web`.** Playwright is already a dependency and configured; the suite is not written. Minimum: sign-in with MFA, create project, create task, check in, upload documentation, generate a handover report, and five representative calculators end-to-end. **Make it a G1 exit criterion.** Without it, "the web app stays green" is a hope, not a gate.
2. **Visual-regression tooling.** The plan requires the token extraction to be "pixel-identical" and provides no way to know. Playwright's screenshot comparison over the top 20 screens in light and dark is sufficient and is a two-day build.

*These two items are the cheapest risk reduction in the entire programme.*

### 8.3 The calculator rule

> **For every calculator converted to call `catalog.ts`, the web result must be
> bit-identical to the pre-change result — proven by a golden fixture captured
> before the change — or the change is a deliberate correction that is separately
> reviewed by a qualified engineer, documented, and communicated to affected users.**

v1.0's parity requirement constrained *mobile == web*. It never constrained *new web == old web*. These are U-værdi, kabeldimensionering, faldsikring and brandkrav calculations that tradespeople act on and put in signed documents; `StairCalculator` already proves at least one divergence exists. Silently changing a compliance result is the most serious thing in this plan.

### 8.4 User impact & communication

The plan changes what live web users see: calculator results (possibly), report output, notification delivery path, and password-reset link behaviour. **A communication plan and a support-material update are required for the web side** and appear nowhere in v1.0. At minimum: a changelog entry per user-visible change, and advance notice for anything touching calculator output.

---

## 9. Gaps the fork should deliberately close

| Gap | Observation | Recommendation |
|---|---|---|
| **No offline** | §6.7 | The native app's core differentiator. Decide D-11 first. |
| **No i18n** | Every string is inline Danish. | The fork is the cheapest moment to add `i18next`. If Norway/Sweden/Germany are ever on the roadmap, do it now. ⚠ v1.0 recommended this and **no task anywhere implements it** — if D-02 lands "yes", it is a Phase 1 task in `packages/core`. |
| **Test coverage 5 % of lines** | Thresholds enforced on two files. | ≥70 % on `packages/*`, **plus** the web critical-path suite (§8.2). The second matters more. |
| **Formula divergence** | §4.5 | Measure, consolidate, and apply §8.3. |
| **No competitive analysis** | Dalux, Ajour, Minuba, Fieldwire, Autodesk Build and Procore all sell offline-capable field apps to this exact Danish buyer. | The commercial strategy in §6.11 rests on an unexamined assumption about the buying motion. A one-week scan is warranted before committing 48–58 person-months. |
| **Unevidenced problem statement** | The PWA has been in production with real users and Sentry telemetry throughout. | Six to eight field ride-alongs plus a module-usage-by-role analytics pull. The evidence is *available*; it was not used. |
| **Admin surface is web-only** | 50 KB of dense tabular administration. | Keep it that way. |
| **Client portal is a stub** | 23 lines. | Do not carry it into the fork. ⚠ But do not conclude from a line count that the bygherre is not a valuable mobile persona — that is a hypothesis to test, not a fact to infer. |

---

## 10. Fork strategy — decision record

### Option A — Capacitor / WKWebView wrapper

- **Effort:** 5–9 weeks to first submission. **Reuse:** ~100 % frontend.
- **Fails on:** Guideline 4.2 risk for a repackaged website; still no offline data; still no WebXR on iOS; WebView scroll/keyboard/gesture quality visibly below native on the long forms this app is full of.
- **Verdict:** viable only as a **pilot-only TestFlight/Internal-Testing build**, never a public listing.

### Option B — Expo monorepo with a shared core ✅ **RECOMMENDED (unchanged)**

- **Effort:** **11–13 months to R1**, ≈48–58 person-months; ~19–21 months to full parity across R1–R3.
- **Reuse:** ~23 % of frontend lines directly, ~44 % including adapters; ~95 % of the backend.
- **Wins:** true native UX; real offline; ARKit/ARCore instead of a WebXR path that has never worked on iPhone; push, biometrics, background upload; one team, one type system; the registry and entitlement model carry over — and the **web app benefits** from the extracted core, generated tokens, server-side reports, and (finally) a regression suite.
- **Costs:** monorepo tooling; two UI implementations long-term; Metro discipline; a React 19 upgrade of the web app that v1.0 did not budget.
- **Risk control:** the shared core is extracted *in place*, with the web app as its first consumer — validated continuously by the running product before any mobile code depends on it. **Now with rollback and verification per change (§8), which v1.0 lacked.**

### Option C — Fully native (SwiftUI + Jetpack Compose)

- 14–20 months, two teams, backend-only reuse. Justified only if scanning becomes the product's centre of gravity — and even then RoomPlan can ship as an Expo native module. **Rejected.**

### Decision

> **Adopt Option B.** Fork into an Expo monorepo with a shared core, targeting a
> field-first MVP, with offline as a first-class subsystem — **build-vs-buy decided
> first (D-11)** — and billing kept off-device for v1.

---

## 11. Sequencing principle

**Extract the shared core inside the existing repository first, with the web app as its only consumer, before any mobile code exists.** Each extraction ships to production and is validated by real users.

v2.0 adds the condition v1.0 omitted: **that validation requires a regression suite that does not yet exist.** Build it first (§8.2). "The web app stays green" on 5 % coverage is not a gate.

If a store presence is needed sooner than R1, the honest tactical answer remains a **pilot-only Capacitor build** — never a public listing, to avoid setting a 4.2 rejection precedent on the account.

---

## 12. Risk register

| # | Risk | P | I | Mitigation | Early-warning trigger |
|---|---|:-:|:-:|---|---|
| R1 | Calculator port overruns | H | H | Divergence measurement in week 1; schema engine; `catalog.test.ts` as gate; R1 ships 20 or fewer | >40 calculators diverging |
| R2 | Offline data loss | H | **C** | Idempotency keys everywhere; append-only where possible; chaos suite from day one; G4 is a hard stop; field pilot | Any chaos run losing one record |
| **R3** | **App Store rejection over module purchases** | **H** ⬆ | **C** | Option 1 **plus** capability-only marketplace screens with no names, prices or descriptions; budget an appeal cycle | Any reviewer question about the marketplace screen |
| **R3b** | **Live compliance-calculator results change silently** | **M** | **C** | §8.3 golden-fixture bit-identity rule; one calculator per PR | Any converted calculator whose golden fixture differs |
| R4 | Web and mobile diverge after the fork | M | H | Core extracted in place; strangler shims; parity tests; one owner for `packages/core` | A business rule implemented twice in one PR |
| **R4b** | **Phase 1 breaks production with no way to tell** | **H** | **H** | §8.2 web critical-path suite + visual regression as G1 exit criteria | Phase 1 starting before §8.2 lands |
| R5 | Bundle size / cold start on mid-range Android | M | H | Regulation text out of the bundle; **inline requires (not RAM bundles)**; CI budget gate | Cold start p90 >2.5 s on a Samsung A54 |
| R6 | AR consumes the schedule | M | M | AR is R3; LiDAR is a premium path with a stated fallback | Any AR work in an R1/R2 sprint |
| ~~R7~~ | ~~Tailwind v4 → native styling mismatch~~ | **L** ⬇ | **L** ⬇ | **Resolved** — NativeWind v5 consumes Tailwind v4 `@theme` directly | — |
| R8 | Supabase Realtime instability on mobile | M | M | Foreground/background-aware lifecycle; the **sync engine is authoritative, Realtime is an accelerator** | Missed entitlement flips in Phase 3 |
| R9 | Low coverage lets regressions into the core | H | M | ≥70 % gate on `packages/*` | The gate waived "just this once" |
| **R10** | **Turnstile `[auth.captcha]` is global — a native change can disable CAPTCHA on live web signup** | L | M | Decide native attestation before touching `supabase/config.toml`; test on staging | Any PR touching `[auth.captcha]` |
| R11 | Key-person dependency on the sync engine | M | H | Design doc reviewed by two engineers before code; pair on the outbox and media queue | Only one person can explain the outbox |
| R12 | Pilot crews drop out | M | M | Recruit 5, need 3; a named PO contact per crew | Fewer than 4 confirmed by week 40 |
| R13 | Store review latency | M | L | Submit 2–4 weeks before target; pre-validate via an external TestFlight build | — |
| **R14** | **Expo SDK breaking change mid-programme** | **H** | **M** | Pin SDK 56; schedule one upgrade window; never track "latest stable" | An SDK major landing inside a phase |
| **R15** | **Effort model is wrong by ~2.5×** | **M** | **H** | Reconcile dev-days and person-months into one unit before committing budget (§13 action 1) | Two documents quoting different totals |

---

## 13. Open decisions

| ID | Decision | Recommended default | Status |
|---|---|---|---|
| **D-01** | Billing on mobile | **No in-app selling** (§6.11) — but on 2026 numbers, and not risk-free | **Blocker** |
| D-02 | Introduce an i18n layer now | **Yes** — add the layer, ship `da-DK` only. ⚠ needs a Phase 1 task, which no document currently contains | Open |
| ~~D-03~~ | ~~NativeWind vs tokens+StyleSheet~~ | **Downgraded** — NativeWind v5 handles Tailwind v4. A team preference, not a blocker | **Resolved** |
| **D-12** | **Universality scope** | **The product is ONE universal Expo app — iOS, Android and web via React Native Web — shipping to web first. Back-office (platform admin, org/billing, SMTP, promo codes, the 3D project wizard, marketing site) stays DOM in a separate `apps/admin`.** Every `packages/ui` primitive is responsive from the first line: single-pane phone, two-pane tablet/desktop. A `.web.tsx` sibling is the named escape hatch for screens that genuinely want the DOM. | **New · Decided** |
| D-04 | Which calculators ship in R1 | Product owner selects — **or cut `tools` from R1 entirely** (§13 action 9) | Open |
| D-05 | Tablet support in R1 or R2 | **R2** | Open |
| **D-06** | Minimum OS versions | **iOS 16.4 / Android API 26** — set by Expo SDK 56, **not** by RoomPlan | **Corrected** |
| D-07 | Native signup anti-abuse | **App Attest / Play Integrity**. ⚠ touches global `[auth.captcha]` — see R10 | Open |
| D-08 | Offline session grace | **14 days for the session; 72 h for the entitlement cache** (§7.5) — the two are different clocks | **Corrected** |
| D-09 | Team shape and budget | See Part 3 §2 — **after** the effort model is reconciled | Open |
| **D-10** | Does the web app adopt the shared core immediately | **Yes** — the single control that prevents divergence | **Blocker** |
| **D-11** | **Offline: build bespoke, or adopt PowerSync / ElectricSQL / Legend-State** | **Evaluate in Phase 0 with a two-day spike each.** Worth 50–100 dev-days and it determines all of §7 | **New · Blocker for Phase 4** |

---

## 14. What to do first

Superseding v1.0's list.

1. **Reconcile the effort model.** One estimating unit, one stated overhead multiplier, re-derive every phase and gate date. Everything else is sized off this.
2. **Write the sync design document** (§7 is its skeleton) and make it a **hard G0 exit criterion**. v1.0 called it "the highest-leverage document in the project" and scheduled it nowhere.
3. **Decide D-11** — build vs buy for offline. Two-day spikes on PowerSync and ElectricSQL.
4. **Build the web critical-path Playwright suite and visual-regression harness** (§8.2). Cheapest risk reduction in the programme; Phase 1 is unsafe without it.
5. **Adopt the calculator bit-identity rule** (§8.3) before a single calculator is rewired.
6. **Run the calculator divergence measurement.** 2–3 days; sizes a quarter of the codebase.
7. **Open the Apple and Google developer accounts** — Apple organisation enrolment needs a **D-U-N-S number**, 2–4 weeks. v1.0 called this the longest lead item without mentioning the actual long-lead part.
8. **Record the repo remote, branch and commit SHA** at the top of this document and re-measure against it.
9. **Consider cutting `knowledge` and `tools` from R1 now**, rather than at Gate G5 where the roadmap already pre-authorises cutting them. They are the lowest-priority R1 modules for the primary persona and they carry the FTS5 pipeline, the schema-driven renderer and D-04 off the critical path with them.
10. **Book the D-01 / D-10 decision meeting**, and shortlist five pilot crews.

---

## 15. Companion documents

| Document | Content | Status |
|---|---|---|
| `01_AUDIT_MOBILE_FORK.md` | This document | **v2.0 — current** |
| `02_PRD_BYGSMART_MOBILE.md` | Product requirements | ⚠ **v1.0 — carries superseded numbers; needs a matching revision** |
| `03_ROADMAP_MOBILE.md` | Delivery plan | ⚠ **v1.0 — carries superseded numbers; needs a matching revision** |
| `04_BMAD_VALIDATION_REPORT.md` | The review that produced v2.0 | Current |

---

*Revised using BMAD-METHOD: `architect-checklist`, `pm-checklist`, `po-master-checklist`, `brownfield-architecture-tmpl`, `brownfield-prd-tmpl` — plus an adversarial fact-check against August 2026 sources.*
