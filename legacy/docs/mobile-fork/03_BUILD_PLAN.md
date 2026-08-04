# BygSmart 3.0 Native — End-to-End Build Plan
## Part 3 (v4.1) · The governing plan

**Product:** **BygSmart 3.0 Native**
**Repository:** `bygsmart-3-native` — a **new repository**, not a fork
**Date:** 3 August 2026
**Supersedes:** `03_ROADMAP_MOBILE.md` v1.0 and `03_BUILD_PLAN.md` v3.0/v4.0
**Incorporates:** all findings from `05_PLAN_HARDENING_REVIEW.md`

> **v4.1 changes — a self-audit of the phasing.** v4.0 contained a sequencing
> contradiction: P5 was scheduled to start in week 13 while gate G3 — declared a
> hard stop — did not clear until week 18. v4.1 fixes it properly rather than by
> moving a date:
> - **P3 splits into P3a (read path) and P3b (write path).** Two gates: **G3a**
>   unblocks screens; **G3b** — the chaos gate — is what the field flows must
>   clear before they are *done*.
> - **Screens are built against the repository contract**, so UI work proceeds in
>   parallel with the write path instead of waiting on it.
> - **M1, a walking skeleton, lands at week ~15** — one thin vertical slice
>   proving the whole architecture before any breadth is built.
> - **E5 (calculators) is explicitly off the critical path.**
> - **Explicit FTE allocation per phase**, which v4.0 omitted.
> - **Honest timeline: ~7.5–8 months to PWA launch**, not 7.

---

## 0. What this is

**BygSmart 3.0 Native is a new product built on a proven backend, not a port of 2.1.**

One universal application — **Expo + React Native**, rendering natively on iOS and Android and to the browser through **React Native Web as an installable PWA**. One codebase, one UI, one set of business rules, three distribution targets.

BygSmart 2.1 is not a system to preserve. Nobody uses it. It is a **reference implementation and a parts bin** — a very good one, containing ~90 calculator formulas, a proven module architecture, 90+ migrations of hard-won schema and RLS work, generated types, and a great deal of correct Danish domain copy. It gets harvested and then deleted.

### 0.1 Three targets, one product — and a deliberate asymmetry

| | iOS | Android | Web (PWA) |
|---|---|---|---|
| Distribution | App Store | Play Store | `app.bygsmart.com`, installable |
| Offline | **Guaranteed** — native SQLite, encrypted, `URLSession`/`WorkManager` background upload | **Guaranteed** | **Best-effort, graded** — wasm SQLite over OPFS; the browser may evict it (§4) |
| Commerce | **Capability display only.** No module names, no prices, no purchase path | Same | **Full marketplace, Stripe, 0 % commission, no review** (§3) |
| Update cadence | Store review cycles, from a release tag | Store review cycles | Continuous, from trunk |
| Back-office | — | — | Separate DOM app, `admin.bygsmart.com` |

That asymmetry is not a compromise. Selling on the web sidesteps store commission and review entirely, and offline is genuinely stronger on native — which is precisely the argument for a field crew to install the app.

### 0.2 Framing that matters

**This is tri-target from day one.** It is *not* "web first, native later". Web is simply the first target you can deploy, because store accounts take 2–4 weeks and the build takes seven months. Every gate from G1 onward requires a green build running on **physical hardware** on all three targets. A plan that ships web for six months and discovers iOS at the end is the single most predictable way this fails.

---

## 1. What having no users deletes

| Deleted | Why |
|---|---|
| The 8-mutation rollback matrix (audit §8) | Nothing to roll back to |
| Strangler re-export shims | Build the target directly |
| "Extract core in place, web app as first consumer" | Risk mitigation for a live product |
| Route-by-route cutover | Nothing to cut over |
| The bit-identical calculator rule | **Replaced by something better: where a formula is wrong, fix it.** Correctness is proven by golden fixtures, not by matching the past |
| Visual regression against today's pixels | You are redesigning |
| React 19 upgrade of the 2.1 web app | Not keeping it |
| Field pilot as a launch gate | No crews. Real-site offline validation is still mandatory before you *sell* |
| Staged rollout, user communication | No users |
| "Backend changes must be additive" | **The biggest unlock — §2** |
| Carrying 90 incremental migrations | **One clean baseline instead — §2** |

---

## 2. What it unlocks

**The backend is redesigned, not extended.**

- **One consolidated baseline schema**, offline-native from line one. You are currently carrying 90+ migrations of which a visible number exist only to fix earlier ones — `fix_profiles_team_member_rls_recursion`, `fix_tasks_rls_recursion`, `fix_handover_view_security_invoker`, `fix_budget_summary_ambiguous_column`, `fix_disabled_tabs_allowlist`, `fix_time_registration_date_cast`, `fix_protect_trial_columns_company_id`. That history is worthless as executable migrations and invaluable as a specification. **3–5 days to consolidate. This is the last moment it is free.**
- **Soft deletes and tombstones everywhere**, with a stated retention window. Hard deletes are structurally hostile to sync — a deleted row is invisible to a device that was offline when it happened, so it lives on that device forever. Your two most recent migrations are `allow_ledger_cascade_delete` and `allow_org_owner_cascade_delete`; that collision becomes a design decision instead of a constraint.
- **Trigger-maintained, indexed `updated_at`** on every syncable table — the sync cursor depends on it.
- **Idempotency as a first-class contract.**
- **RLS re-derived** from the offline access model rather than patched.
- **The database can be reset.** No data migration, ever.
- **A new Supabase project.** `pkzburssqetnlcbvabdq` is archived read-only as the reference.

**Build-vs-buy resolves toward buying** — PowerSync or ElectricSQL, both Supabase partner integrations. But see §4: the decision must be made against **all three runtimes**, not just native, and PowerSync's React Native Web support is currently **beta**.

---

## 3. Commerce architecture *(D-13)*

> **Selling lives on the web. Native binaries are capability-only.**

Store payment rules bind the native binaries. They do not bind a PWA. So:

- **PWA and `apps/admin`** carry the full module marketplace, seats, storage add-ons, Stripe Checkout — 0 % commission, no review cycle, instant pricing changes.
- **Native binaries** show capability state only. A locked module renders as *"Aktiveres af din organisations ejer på bygsmart.com"* with no name, no price, no description and no link that could read as a purchase path — satisfying Guidelines 3.1.1 and 3.1.3(b) by containing nothing to object to.
- **Consequence:** the web launch at G6 is a **commercially complete product**. You can take money from month seven without a store account, a review, or an appeal. Audit risk R3 stops threatening revenue and becomes a distribution-timing risk only.

---

## 4. Offline across three runtimes — the hardest part of this plan

The browser is not a smaller version of a phone. It is a different storage substrate with failure modes that do not exist on native.

| Native (iOS/Android) | Browser |
|---|---|
| SQLite in the app container | wasm SQLite over the Origin Private File System |
| Storage is yours until the app is deleted | **The browser can evict the entire database** under pressure |
| Always available | **Safari private browsing has no OPFS.** Chrome incognito caps at ~100 MB with unpredictable errors at the limit |
| One process, one writer | **Multiple tabs, one database** — needs Web Locks / MessageChannel coordination; several VFS implementations permit only one connection |
| `URLSession` / `WorkManager` background upload | **Background Sync is Chromium-only.** Close the tab mid-upload and nothing resumes |
| SQLCipher at rest | OPFS is origin-scoped but **not encrypted** |

### 4.1 Graded web offline

Detect at startup, degrade explicitly, never pretend:

| Tier | Condition | Behaviour |
|---|---|---|
| **Full** | OPFS available, `navigator.storage.persist()` granted | Identical to native |
| **Session-durable** | OPFS available, persistence not granted | Works; warns that the browser may reclaim data; prompts to install the PWA (installed PWAs are far less likely to be evicted) |
| **Online-only** | No OPFS (Safari private browsing) | App runs, clearly labelled, and **refuses to queue mutations it cannot durably hold** |

That refusal is correct behaviour. Queueing into memory that vanishes on tab close would violate principle P3 — *the app never lies about state* — and it is exactly the class of silent data loss the chaos gate exists to prevent.

### 4.2 Required design decisions

- **Single-writer election across tabs** via the Web Locks API; other tabs read through the leader. Retrofitting multi-tab safety into a working single-tab implementation is a rewrite — design it in.
- **Request persistent storage** at first meaningful use; surface the result in the Sync Centre.
- **The offline grace window differs per runtime**: native holds 14 days in secure storage with a mandatory biometric lock when unsynced work exists; **web holds 72 hours**, matching the entitlement cache TTL, because browser storage is neither secure nor durable.
- **The PRD states the limitation honestly:** offline durability on web is best-effort and browser-dependent; native is the guarantee.

---

## 5. Testing — the mechanism that makes big jumps safe

Tests here are not insurance against users. They are **what lets you delete and rewrite whole subsystems in a week without slowing down.** That produces a different suite from a conventional one: the test that earns its keep is the one that lets you throw code away.

### 5.1 The eight layers

| # | Layer | Scope | Target | What it lets you destroy |
|---|---|---|---|---|
| **1** | **Formula golden fixtures** | Every `computable` calculator: typical, boundary, invalid and unit-edge inputs, captured as JSON | **100 %** | **`legacy/modules/tools/pages/**` — 34,050 lines, deleted in one commit** |
| **2** | **Pure business rules** | `packages/core`: entitlement resolution, requires-closure, task access, project-tab access, visibility, status transitions | ≥ 90 % lines, 100 % of decision branches | The entire legacy `services/` and `core/` tree |
| **3** | **RLS policy tests (SQL)** | Every table × every role, positive **and** negative. Extends the existing `supabase/tests/rls_profiles_overexposure_test.sql` precedent | Every syncable table | Schema restructuring, the cascade-delete fix, policy rewrites |
| **4** | **Repository / sync contract tests** | The local-DB repository layer against a fake server, **run against all three storage runtimes** | ≥ 90 % | **Swapping the sync engine in a week** — the contract is engine-agnostic *by design* |
| **5** | **Property-based sync tests** | `fast-check`: any sequence of offline mutations under any interleaving of syncs converges | 10,000 cases per run | The outbox, cursor logic, conflict engine |
| **6** | **Chaos suite — native arm** | Kill mid-upload · reboot with full outbox · disk full · airplane flapping · clock skew · session expiry offline · two-device conflict | 100 randomised runs, **zero loss** | Nothing — this is a gate |
| **6b** | **Chaos suite — web arm** | **Storage eviction mid-outbox · quota exceeded · tab closed mid-upload · two tabs mutating one record · OPFS unavailable at startup · private-browsing session** | 100 randomised runs | Nothing — this is a gate |
| **7** | **Universal component tests** | RNTL, each file executed **twice** — native renderer and React Native Web | ≥ 80 % of `packages/ui` | Redesigning primitives; catching RNW divergence the day it appears |
| **8** | **End-to-end journeys** | The same 12 journeys run by **Maestro on device** and **Playwright against the web build of the same app** | 12 journeys | Rewriting whole screens |

### 5.2 Rules

- **Line coverage lies.** Run **mutation testing** (Stryker) on `packages/calc-engine` and the sync layer. Target ≥ 75 % mutation score on both.
- **Fixtures are captured, never hand-written.** Generate them by running the 2.1 implementation across an input grid, then have a human review the cases where 2.1 is *wrong* — that review is where formulas get fixed.
- **Every `packages/ui` test runs on both renderers or it is not a `packages/ui` test.** A component that passes natively and breaks on web is how universality quietly fails. This is also the Liskov check on `.web.tsx` variants: same props, same behaviour, different rendering.
- **No screen may import a sync-engine type directly.** That constraint is why "swap engines in a week" is credible; protect it with a lint rule.
- **The chaos suites run nightly**, both arms, not per-PR.
- **No skipped tests, ever.** A skipped test in a codebase with no users is a lie about what you can safely delete — and being unable to delete things is what turns a fast rebuild into a slow one.

### 5.3 Gates

| Cadence | Must be green |
|---|---|
| Per PR | Layers 1, 2, 4, 7 · coverage thresholds · no new skips · **builds on all three targets** |
| Nightly | Layers 3, 5, 6, 6b, 8 · mutation score maintained |
| Per phase | The phase gate in §7, **including physical-device verification** |

---

## 6. Target shape

```
bygsmart-3-native/                 ← NEW repository
├── apps/
│   ├── app/                       ← BygSmart 3.0 Native. iOS + Android + Web (PWA).
│   │   ├── app/                   ← Expo Router, file-based, responsive layouts
│   │   ├── src/db/                ← schema, migrations, repositories (3 runtimes)
│   │   ├── src/sync/              ← engine adapter, outbox, media queue, conflicts
│   │   └── src/screens/           ← per-module screens, universal
│   └── admin/                     ← DOM-only Vite app: platform admin, org/billing,
│                                     SMTP, promo codes, 3D project wizard
├── packages/
│   ├── core/                      ← types, registry, entitlements, org, business rules
│   ├── calc-engine/               ← formulas + input schemas + viz descriptors + fixtures
│   ├── ui/                        ← universal responsive primitives (RN + RNW)
│   ├── tokens/                    ← design tokens, single source
│   └── api-client/                ← typed Supabase + /api client
├── server/                        ← Express API, redesigned for sync
├── supabase/                      ← ONE consolidated baseline schema, offline-native
└── legacy/                        ← BygSmart 2.1, vendored as one snapshot commit.
                                      Read-only. Harvested, then DELETED at G5.
```

**Identity:**

| Item | Value |
|---|---|
| Repository | **New repo `bygsmart-3-native`** — clean history. 2.1 vendored into `legacy/` as one snapshot commit so it is greppable; the 2.1 repo stays archived for history archaeology |
| Bundle IDs | `com.bygsmart.app` — reserve on both stores at account creation |
| Supabase | **New project.** `pkzburssqetnlcbvabdq` archived read-only |
| Domains | `app.bygsmart.com` → the PWA · `admin.bygsmart.com` → back-office · `bygsmart.com` → static marketing |
| Deep links | `bygsmart://` + Universal Links / App Links on `app.bygsmart.com` |

**Escape hatch, named on day one:** any component may have a `.web.tsx` sibling the bundler picks automatically. Dense tables and drag-heavy editors are the expected users. Without this convention teams either ship poor web output or abandon universality at the first hard case.

**`legacy/` has a deletion date.** Delete at G5. A parts bin nobody throws away becomes a source of accidental imports.

---

## 7. Phases

Costed for **4–5 developers**, a designer, a QA/release engineer and a part-time PO. Estimates carry **±30 %**, with named blow-up scenarios in §9.

```
wk   1   4    8   12   16   20   24   28   32   36
     │   │    │    │    │    │    │    │    │    │
P0   ███                                              Decide, spike & scaffold  (3)
P1      ████████████                                  Universal foundation      (6)
P2        ████████                                    Backend, offline-native   (4, ∥ from wk5)
P3a             ████████                              Local store · READ path   (4)
P3b                 ████████████████                  Outbox · media · CHAOS    (8)
P4              ████████████████                      Calc engine + renderer    (8, ∥, OFF critical path)
P5-A                ████████████████████              Shell · auth · projects · tasks   (10, from G3a)
P5-B                        ████████████████████████  Field · time · quality    (12, done at G3b)
P5-C                                    ████████████  Documents · knowledge     (6)
P5-D                    ████████████████              Back-office + PWA commerce (8, ∥)
P6                                              ████████  Harden & PWA launch   (4)
P7                              (when accounts clear)     Native packaging      (3)

     ▲ G0 wk3   ▲ G1 wk9   ▲ G2 wk8   ▲ G3a wk12   ▲ M1 wk15   ▲ G3b wk20
                                       ▲ G4 wk16       ▲ G5 wk28   ▲ G6 wk32
```

> **⚠ Superseded by the phase-readiness review.** The schedule above was audited
> phase by phase in `06_PHASE_READINESS_REVIEW.md` and did not fully survive.
> **Use the corrected schedule below.** Three phases changed materially: P0 gains
> a week, P2 was under-resourced and loses server-side reports to v1.1, and P4's
> scope was 2–2.6× its allocation and is descoped to the renderer + visualisation
> layer + 20 calculators.

```
P0  wk 1–4    (+1 wk)          Decide, spike, scaffold, procure devices, design flows   → G0
P1  wk 5–10                    Universal foundation (coverage work budgeted)            → G1
P2  wk 6–9    (2.0 FTE)        Backend — server-side reports removed to v1.1            → G2
P3a wk 10–13                   Local store, READ path                                   → G3a
P3b wk 14–21                   Outbox, media, CHAOS          ⭑ M1 walking skeleton wk 16 → G3b
P4  wk 10–17  (descoped)       Renderer + viz layer + 20 calculators                    → G4
P5  wk 14–31  (+2 wk buffer)   Screens, four streams, QA 0.5 throughout                 → G5
    ├ DPIA + security review start wk 21 (calendar lead time, not engineering)
    └ throwaway TestFlight build wk 21 (smoke-test the submission pipeline early)
P6  wk 32–35                   Harden & PWA launch                                      → G6
P7  wk 36–38 + 2–4 wks review  Native packaging & submission                            → G7
```

**PWA launch ≈ week 35 (8–8.5 months). Native launch ≈ week 41–43 (~10 months)** — G6 + 5–7 weeks, because P7's three weeks of engineering exclude store review latency.
**≈ 33–39 person-months.**

### 7.0 Staffing by phase

| Phase | Weeks | Headcount | Who |
|---|---|---:|---|
| P0 | 1–4 | 4.0 | Lead + senior RN (tri-target spike, 4–5 d per candidate) + dev (divergence + schema) + PO 0.5 + designer 0.5 **designing key flows** |
| P1 | 5–10 | 4.0 | Lead (owns the Gantt canary) + 2 devs + designer 0.5 + QA 0.5 |
| P2 | 6–9 | **2.0** ⬆ | 2 full-stack devs. Was 1.0 against eight substantial deliverables — under-resourced |
| P3a | 10–13 | 2.0 | Senior RN (owner) + 1 dev |
| P3b | 14–21 | 2.5 | Senior RN (owner) + 1 dev + QA 0.5 on the chaos harness |
| P4 | 10–17 | 1.5 | 1 dev + 0.5 domain review on formula corrections. **Descoped to fit** |
| P5-A/B/C | 14–31 | 3.0 + **QA 0.5** ⬆ | **One owner per module** — the registry keeps them independent |
| P5-D | 16–23 | 1.0 | 1 dev on `apps/admin` + PWA commerce |
| P6 | 32–35 | 5.0 | Everyone + QA 1.0 |
| P7 | 36–38 | 1.5 | 1 dev + release engineering |

**Peak ≈ 6.0 FTE around weeks 16–21** (P3b + P4 + P5-A + P5-D). That is the load-bearing assumption; if the team is smaller the schedule stretches roughly linearly **except P3b**, which does not compress — adding people to correctness work early makes it slower.

**Non-negotiables under delivery pressure.** These are the gates a team quietly relaxes first, and each one is load-bearing:
- Green builds on **all three physical targets** per PR — this is what prevents a nasty surprise in P7.
- **No skipped tests**, ever.
- The **web performance budget** enforced in CI from P1, not measured in P6. If it drifts, the phone web experience becomes *worse* than 2.1's while still being called an upgrade.

### P0 — Decide, spike & scaffold · 3 weeks

| # | Deliverable |
|---|---|
| 0.1 | **Tri-target sync spike — the highest-information work in the programme.** PowerSync *and* ElectricSQL, on iOS, Android **and React Native Web**, against the real schema. PowerSync's RNW support is beta; find out now, not in month four. Output: **D-11 signed** |
| 0.2 | **Calculator divergence measurement.** Which of the ~90 delegate to `catalog.ts` and which hold their own maths. 2–3 days; sizes a quarter of the programme |
| 0.3 | **Schema baseline consolidation** — 90 migrations → one clean, reviewable, offline-native baseline; new Supabase project provisioned |
| 0.4 | Monorepo scaffolded; the universal app runs on web, a physical iPhone and a physical Android by day 5 |
| 0.5 | **The test harness itself** — all eight layers wired with one trivial test each, so nothing is ever added without a home for its tests |
| 0.6 | **Apply for Apple and Google developer accounts.** Apple organisation enrolment needs a **D-U-N-S number**: 2–4 weeks of pure latency. Reserve bundle IDs |
| 0.7 | Identity decisions executed (§6): repo created, 2.1 vendored into `legacy/`, domains planned |
| 0.8 | Remaining decisions signed: **D-12** (universality scope), **D-13** (commerce on web), D-02 (i18n now), D-04 (calculator launch set) |

**G0:** sync engine chosen on tri-target evidence · divergence table complete · baseline schema reviewed · `pnpm test` green on an empty app running on **three physical targets** · account applications submitted.

### P1 — Universal foundation · 6 weeks

| # | Deliverable |
|---|---|
| 1.1 | `packages/tokens` — the single source; nothing else defines a colour or spacing step |
| 1.2 | `packages/ui` — ~25 responsive primitives, **each with breakpoint behaviour designed in**: single-pane phone, two-pane tablet and desktop |
| 1.3 | Registry-driven navigation shell: bottom tabs on phone, rail on tablet, rail + sidebar on desktop |
| 1.4 | `packages/core` — harvested from `legacy/`, not gradually extracted. **`eslint-plugin-boundaries` discipline carried into the monorepo on day one** |
| 1.5 | **i18n layer (`i18next`), shipping `da-DK` only.** Two days now, 3–5× later |
| 1.6 | Icon package via `react-native-svg`; outdoor high-contrast mode; Dynamic Type; a11y roles on every primitive |
| 1.7 | **The Gantt canary** — a throwaway prototype of `GanttView` in `packages/ui` on all three targets. Three days. It either de-risks universality or tells you to plan `.web.tsx` for the planning module now |
| 1.8 | **Graded web-offline capability detection** (§4.1) — OPFS probe, persistence request, tier reporting |
| 1.9 | Test layers 2 and 7 live and enforced |

**G1:** primitive gallery renders correctly on **physical iOS, physical Android and web** at phone/tablet/desktop widths · a11y audit passed · `packages/core` ≥ 90 % · **Gantt canary verdict recorded**.

### P2 — Backend, offline-native · 4 weeks *(parallel from week 5)*

| # | Deliverable |
|---|---|
| 2.1 | Baseline schema deployed: tombstones with retention, trigger-maintained indexed `updated_at`, idempotency tables, cascade-delete resolved |
| 2.2 | `GET /api/sync/:entity` — cursor `(updated_at, id)`, RLS-applied, tombstones included, paged |
| 2.3 | `POST /api/sync/mutations` — idempotency keys with TTL, `dependsOn` ordering, `baseVersion` optimistic concurrency, per-entity conflict adjudication |
| 2.4 | **Push abstraction, three providers**: `web` (VAPID — already built in 2.1, reuse it), `expo/APNs`, `expo/FCM`, with per-platform subscription rows |
| ~~2.5~~ | ~~Server-side report generation~~ — **moved to v1.1.** Costed at 25–35 dev-days, needed by nothing at launch, and it was consuming most of this phase's capacity. Largest easy saving in the plan |
| 2.6 | **Per-runtime session model** (§4.2): native 14-day grace in secure storage with mandatory biometric lock when unsynced work exists; web 72 hours |
| 2.7 | Offline authorisation: 72 h entitlement-cache TTL; the **server** adjudicates replay under revoked entitlements |
| 2.8 | Test layer 3 — the RLS suite |

**G2:** RLS suite green · sync endpoints exercised by contract tests · the schema supports a delete that a two-week-offline device can learn about.

### P3a — Local store & read path · 4 weeks *(weeks 9–12)*

Split out from the monolithic P3 so that screen work is not blocked for eight weeks behind a correctness gate.

| # | Deliverable |
|---|---|
| 3a.1 | Local schema + migrations + encryption; corruption quarantine-and-rehydrate |
| 3a.2 | **Three storage runtimes behind one repository contract**: native SQLite ×2, wasm SQLite over OPFS on web |
| 3a.3 | **Multi-tab single-writer election** via Web Locks; other tabs read through the leader |
| 3a.4 | Delta puller: cursor handling, paging, tombstone application, initial hydration with visible progress |
| 3a.5 | Test layer 4 — the repository contract, **run against all three runtimes** |

**G3a — unblocks screens.** The same repository contract is satisfied on all three runtimes · hydration completes with progress and within its stated maximum · a delete performed while a client was offline is learned on reconnect · two tabs stay consistent. **P5-A starts here.**

### P3b — Outbox, media & conflicts · 8 weeks *(weeks 13–20)*

| # | Deliverable |
|---|---|
| 3b.1 | **Thin write path first** — one entity, one mutation type, no conflicts. This is what M1 (below) proves |
| 3b.2 | Outbox: durable, ordered, dependency-aware, idempotent, surviving force-quit, reboot and tab close |
| 3b.3 | Retry mechanics: backoff schedule, per-status policy, poison handling, session refresh on replay |
| 3b.4 | Media queue: capture-to-disk first, immediate thumbnail, **downscale before upload** (2048 px long edge, q80, EXIF stripped except orientation), background upload via `URLSession`/`WorkManager` with **reconcile-on-launch** — Expo's background upload survives suspension, not termination |
| 3b.5 | Conflict engine: append-only · LWW-with-server-guard · explicit user resolution |
| 3b.6 | Sync Centre: pending state, failure reasons, manual retry, explicit discard, diagnostic export, **storage-tier display** |
| 3b.7 | Client sync telemetry heartbeat — without it the launch metrics are unmeasurable |
| 3b.8 | Test layers 5, 6 **and 6b** |

**⭑ M1 — the walking skeleton · week ~15.** One thin vertical slice, built before any breadth: **sign in → see one task → capture a photo with the radio off → reconnect → the photo is on the server**, on all three targets. It proves the entire architecture end to end at the earliest possible moment, and it is the first thing you can demo. If M1 is late, the schedule is wrong and you find out in month four rather than month seven.

**G3b — the hard stop.** Both chaos arms: **100 consecutive randomised runs, zero data loss**, on native *and* web. A reference offline day (8 h, 40 photos, 12 check-ins, 30 mutations, no signal) drains to an empty outbox within 5 minutes of reconnection. **No offline-write flow is considered done until this passes** — P5-B screens may be *built* against the repository contract before it, but not shipped.

### P4 — Calculator engine + universal renderer · 8 weeks *(parallel, weeks 9–16 — **off the critical path**)*

> **Nothing depends on this phase.** If it slips, or if the divergence measurement
> comes back worse than expected, `tools` simply does not ship at launch and
> follows in v1.1. Treat it as the schedule's shock absorber — it is the one large
> body of work that can be dropped without touching anything else.

| # | Deliverable |
|---|---|
| 4.1 | `packages/calc-engine`: `catalog.ts` and its 108 KB suite harvested; all ~90 formulas consolidated as pure functions — **and the wrong ones fixed** |
| 4.2 | Input schemas, standards, help and result shapes completed for every calculator |
| 4.3 | **Golden fixtures generated across an input grid and human-reviewed** — layer 1, 100 % coverage |
| 4.4 | The universal renderer: one component producing form, result, compliance meter, help drawer, disclaimer, save-to-project, share and PDF |
| 4.5 | **The visualisation layer** — declarative descriptors (gauge, breakdown bar, donut, dimensioned shape, load diagram) on `react-native-svg`, rendering on all three targets |
| 4.6 | The 25–40 genuinely bespoke calculators, hand-built once, universally |
| 4.7 | **`legacy/modules/tools/pages/**` deleted — 34,050 lines in one commit** |

**G4:** every calculator's golden fixtures green · mutation score ≥ 75 % on `calc-engine` · the old pages are gone.

### P5 — Screens + back-office · weeks 13–28, four parallel streams

Built universal and responsive. The registry makes modules genuinely independent, so assign **one owner per module** — and when a stream blocks, re-assign rather than adding people to it.

**Screens are built against the repository contract from P3a**, so UI work runs in parallel with the write path rather than queuing behind it. G3b gates *shipping* the offline-write flows, not building them.

| Stream | Weeks | Content | Gate |
|---|---|---|---|
| **P5-A** | 13–22 | Auth, MFA, biometric lock, org switching, deep-link route map · Projects (list, detail, registry tabs, two-pane above tablet, light edit) · Tasks (My Day, project tasks, list/group/kanban above a width threshold, create, edit, status machine, invitations) | Needs **G3a** |
| **P5-B** | 17–28 | **Field** — check-in/out, photo documentation, task chat, handover chain, signature capture. *The heart of the product* · Time — floating timer surviving restart, notification-scheduled 8-hour reminder with a server safety net, manual entry, crew overview · Quality — punch list with evidence and location tags, checklist and sign-off, conflict-resolution UI | Built from wk 17; **done only after G3b** |
| **P5-C** | 23–28 | Documents (browse, viewer, mark-for-offline, upload, share) · Knowledge (corpus fetch → SQLite FTS5, search, favourites) · Home widgets · global search · settings | Needs **G3a** |
| **P5-D** | 15–22 | **`apps/admin`** — Vite + React + `packages/core`, DOM-native: platform admin, org and billing management, SMTP, promo codes, tool-access config, 3D project wizard · **the PWA marketplace and Stripe integration (§3)** | Independent |
| all | throughout | Test layer 8 — 12 journeys, on device and on web · seed/demo data for development and sales demos | |

**G5 (week 28):** feature complete · all eight test layers green · **`legacy/` deleted**.

### P6 — Harden & PWA launch · 4 weeks *(weeks 29–32)*

Performance against budget on real mid-range devices **and** the web build · bundle and startup optimisation (inline requires, lazy routes, regulation corpus and catalogue out of the initial graph — **not** RAM bundles, which are incompatible with Hermes) · a11y audit · **real-site offline validation: take the installed PWA into actual basements** · GDPR consent screen and a **DPIA** for check-in geolocation under Danish employee-monitoring law · **a security review before the first paying customer** · observability dashboards and alert thresholds live · deploy.

**Budgets:**

| | Native | Web |
|---|---|---|
| Cold start → interactive | < 2.0 s median, < 2.5 s p90 | — |
| First-route JS | < 6 MB Hermes bytecode | **≤ 1.5 MB gzipped** |
| LCP / TTI | — | **< 2.5 s / < 3.5 s on simulated 4G** |
| Install size | < 60 MB iOS / < 45 MB AAB | — |
| Lighthouse PWA | — | **≥ 90** |

**G6 — PWA launch. A commercially complete product** (§3).

### P7 — Native packaging · 3 weeks *(whenever accounts clear)*

EAS Build pipeline · store listings in Danish and English · App Privacy and Data Safety declarations · in-app account deletion (an Apple requirement) · **capability-only screens verified** (§3) · TestFlight and Internal Testing · submission, with 2–4 weeks and one appeal cycle budgeted.

**G7 — store launch.**

---

## 8. Release strategy

- **Trunk-based development**, short-lived branches.
- **Web deploys continuously from trunk.** Native cuts from a **release tag**.
- **The two must never be more than one minor version apart.** Where behaviour must differ, it is a **platform capability flag**, never a code fork.
- Feature flags are kept minimal — with no users their value is low — with one exception: **the sync engine sits behind a flag**, because the ability to swap it is an architectural property worth being able to exercise in production.

---

## 9. Risks and named blow-up scenarios

| # | Risk | P | I | Mitigation |
|---|---|:-:|:-:|---|
| **R1** | **Offline correctness on three runtimes** | H | **C** | Undiminished by having no users. G3 is a hard stop with both chaos arms; property-based testing; buy rather than build; tri-target spike in P0 |
| **R2** | **PowerSync RNW beta is unusable** | M | H | **Discovered in P0, not P3.** Contingency: ElectricSQL, or web ships online-only at G6 with native carrying full offline |
| R3 | Universality fails on a hard screen | M | M | Gantt canary in P1; `.web.tsx` escape hatch named day one; layer 7 runs every component on both renderers |
| R4 | Store rejection over module purchases | M | L ⬇ | **§3 removes the revenue exposure.** A rejection now delays distribution, not income |
| R5 | Calculator consolidation overruns | H | M | Divergence measurement first; golden fixtures; the launch set can shrink to zero — `tools` is not on the critical path |
| R6 | Screens phase parallelises badly | M | H | One owner per module; the registry keeps them independent. Re-assign, never add people to a blocked module |
| R7 | Expo SDK breaking change mid-programme | H | M | Pin SDK 56; one scheduled upgrade window; never track "latest stable" |
| R8 | Developer accounts delayed | M | L | Applied for in week 1; **the PWA launch does not depend on them** |
| R9 | **Team ships fast and untested under "maximum power"** | H | H | The harness exists before the code (P0.5); no skipped tests; per-PR gates including three-target builds. This is the risk §5 exists to manage |
| R10 | Browser evicts a user's local database | M | M | Graded tiers (§4.1); `navigator.storage.persist()`; PWA install prompt; honest UI; web chaos arm 6b |

### Blow-up scenarios

| Scenario | Trigger | Contingency |
|---|---|---|
| Web offline harder than expected | P0 tri-target spike fails | Web launches online-only; native gets full offline. Costs the PWA's field value, saves the schedule |
| Calculator divergence > 40 | P0.2 measurement | Cut `tools` from launch scope entirely |
| RNW fails a key screen | P1 Gantt canary | `.web.tsx` variants for the planning module; +10 days |
| Screens blocked on one owner | Week 16 | Re-assign across modules; do not add people |

---

## 10. Is this SOLID?

Three of the five principles are load-bearing architectural properties here — named so they are defended rather than accidental:

- **Dependency inversion** — the sync layer sits behind a contract the tests target, not an implementation. This is *why* "swap engines in a week" is credible. **No screen may import a sync-engine type directly**; enforce with a lint rule.
- **Open/closed** — the module registry is 2.1's best property. New capability arrives as a new manifest, never as an edit to the shell. Carry `eslint-plugin-boundaries` into the monorepo on day one.
- **Single responsibility** — `calc-engine` computes and knows nothing about rendering; `ui` renders and knows nothing about domain. This is what makes one calculator definition serve three platforms.
- **Interface segregation** — the platform adapters stay small and separate; a fat `PlatformAdapter` would undo it.
- **Liskov** — the one to watch. A `.web.tsx` variant must be substitutable for its native sibling: same props, same behaviour, different rendering. Test layer 7 is the enforcement.

---

## 11. First three weeks

1. **Create `bygsmart-3-native`**, vendor 2.1 into `legacy/` as one snapshot commit, freeze the old repo.
2. **Apply for Apple and Google developer accounts** — D-U-N-S first. Pure latency; start day one.
3. **Run the tri-target sync spike** — PowerSync and ElectricSQL on iOS, Android and React Native Web, against the real schema. Sign D-11 on the evidence.
4. **Run the calculator divergence measurement.** 2–3 days.
5. **Consolidate 90 migrations into one offline-native baseline** and provision the new Supabase project.
6. **Scaffold the monorepo**; universal app running on web, a physical iPhone and a physical Android by day 5.
7. **Build the test harness — all eight layers, one trivial test each — before any feature code exists.**
8. **Write the sync design document** (audit §7 is its skeleton) and have two engineers review it.
9. **Sign D-12 and D-13.**

---

## 12. Document status

| Document | Status |
|---|---|
| `01_AUDIT_MOBILE_FORK.md` | v2.1 — inventory, stack, architecture assessment and target architecture (§7) valid. **§8 and §11 void** |
| `02_PRD_BYGSMART_3_NATIVE.md` | **v2.0 — current.** Re-cut for BygSmart 3.0 Native: tri-target platform matrix, three-runtime offline, web commerce, **and the epic/story structure this plan's phases execute** |
| `03_BUILD_PLAN.md` | **This document (v4.1). Governing plan.** |
| `04_BMAD_VALIDATION_REPORT.md` | Current — findings on estimates, contradictions and technical accuracy all stand |
| `05_PLAN_HARDENING_REVIEW.md` | Current — the tri-target evaluation this version incorporates |
| `06_PHASE_READINESS_REVIEW.md` | **Current — the phase-by-phase audit. Its corrected schedule and staffing govern.** |
