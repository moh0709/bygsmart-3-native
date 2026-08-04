# BygSmart 3.0 Native — Plan Hardening Review
## Part 5 · Adversarial evaluation of the build plan against a tri-target reality

**Date:** 3 August 2026
**Reviewing:** `03_BUILD_PLAN.md` v3.0
**Lens:** does this plan survive contact with a **native app + PWA** that must ship one codebase to iOS, Android and the browser?
**Verdict:** the strategy holds. **One critical gap, four high-severity gaps, and a naming/identity workstream that does not exist.** All fixable now; two of them are much more expensive to fix later.

---

## 0. Summary of findings

| # | Finding | Severity | Fix cost now | Fix cost at P5 |
|---|---|---|---|---|
| **S1** | **The offline engine must run on three storage runtimes, and the browser is the hardest of them.** The plan designs for native SQLite and never mentions wasm/OPFS, browser storage eviction, multi-tab concurrency, or private-browsing failure | **CRITICAL** | 1 spike week | Months |
| **S2** | "Fully prepared and optimised for native" has **no enforcement mechanism** | HIGH | A gate rule | Weeks of surprise at P7 |
| **S3** | **The PWA is the commercial escape valve for the App Store problem and the plan does not use it** | HIGH | A decision | Permanent 15–30 % revenue tax |
| **S4** | 90 incremental migrations are being carried forward when they could be **one clean baseline** | HIGH | 3–5 days | Never — you lose the window |
| **S5** | Gantt, Calendar and Org-chart are the **React Native Web canaries** and are scheduled last | HIGH | 3 days in P1 | A late architectural surprise |
| S6 | No web performance budget | MEDIUM | Hours | Rework |
| S7 | Push abstraction is specced two-way; it needs three | MEDIUM | Hours | Days |
| S8 | Auth/session storage and the offline grace window differ per runtime and are unspecified | MEDIUM | Hours | A security hole |
| S9 | No branch/release strategy for a product that deploys continuously to web and in store cycles to native | MEDIUM | Hours | Version chaos |
| S10 | i18n keeps floating between documents with no owning phase | MEDIUM | 2 days in P1 | 3–5× |
| S11 | The estimate has no named blow-up scenarios or contingencies | MEDIUM | Hours | Credibility |
| S12 | `apps/admin` is ~10 % of the work and has no phase | MEDIUM | Hours | Scope surprise |
| S13 | Identity migration — repo, bundle IDs, Supabase project, domains — is undefined | MEDIUM | 1 day | Painful renames |
| S14 | "Web first, native later" is the wrong framing and creates the S2 risk | LOW | Hours | — |

---

## 1. S1 — CRITICAL: offline on the web is a different engine

**This is the gap that would have hurt.**

The plan's §7 target architecture specifies SQLite, an outbox, a media queue and a chaos gate — all designed against **native** SQLite on iOS and Android. But you have decided the browser is a first-class target that carries the product for months. In a browser there is no native SQLite. There is **wasm SQLite over OPFS**, and it brings a materially different set of failure modes:

| Native (iOS/Android) | Browser |
|---|---|
| SQLite file in the app container | wasm SQLite over the Origin Private File System |
| Storage is yours until the user deletes the app | **The browser can evict your entire database** under storage pressure |
| Always available | **Safari private browsing has no OPFS at all**; Chrome incognito caps the database at ~100 MB and errors unpredictably at the limit |
| One process, one writer | **Multiple tabs, one database** — needs cross-tab coordination via Web Locks / MessageChannel; several VFS implementations allow only one connection at a time |
| Background upload via `URLSession` / `WorkManager` | **Background Sync is Chromium-only.** Close the tab mid-upload and nothing resumes until the user returns |
| Encrypted at rest via SQLCipher | OPFS is origin-scoped but **not encrypted**; a shared machine is a different threat model |

And the tooling is less mature than the plan assumes: **PowerSync's React Native Web support is explicitly in beta** (RN SDK 1.12.1+ / Web SDK 1.8.0+), requires copying worker assets and configuring Metro for platform-specific resolution, and its own documentation warns that *"many `react-native` and `web` packages are implemented with only their specific platform in mind"*, requiring per-platform alternatives.

### What to change

1. **Move the sync spike from P3 to P0, and make it tri-target.** Do not evaluate PowerSync and ElectricSQL on native alone. The question is not "does this sync?" — it is "does this sync on iOS, Android *and* React Native Web, today, in beta, with our schema?" If the answer is no, you need that in week 2, not month 4.
2. **Make web offline a *graded* capability, not a binary one.** Define three tiers explicitly and detect at startup:
   - **Full** — OPFS available and persistent storage granted. Same behaviour as native.
   - **Session-durable** — OPFS available, persistence not granted. Works, warns that the browser may reclaim data, prompts to install the PWA (installed PWAs are far less likely to be evicted).
   - **Online-only** — no OPFS (Safari private browsing). The app runs, clearly labelled, and refuses to queue mutations it cannot durably hold. **Refusing is correct.** Silently queueing into memory that vanishes on tab close is the worst possible behaviour and violates principle P3, "the app never lies about state".
3. **Request persistent storage** via `navigator.storage.persist()` at first meaningful use, and surface the result in the Sync Centre.
4. **Elect a single writer across tabs** using the Web Locks API; other tabs read through the leader. Design this in — retrofitting multi-tab safety into a working single-tab implementation is a rewrite.
5. **Add a web arm to the chaos suite (test layer 6).** New scenarios that do not exist on native: storage eviction mid-outbox · quota exceeded · tab closed mid-upload · two tabs mutating the same record · OPFS unavailable at startup · private-browsing session.
6. **State the honest limitation in the PRD:** offline durability on the web is best-effort and browser-dependent; native is the guarantee. That is a true and defensible product statement, and it is also a reason for field crews to install the native app once it exists.

---

## 2. S2 — HIGH: "prepared for native" needs teeth

The plan says the app will be used as a PWA at first but will be *"fully prepared and optimized"* for native. As written that is an intention, not a mechanism. The failure mode is well known: a team ships web for six months, everything works, and at P7 discovers that three screens crash on iOS, the keyboard covers the form on Android, and the bundle is 40 MB.

**Change: every phase gate from P1 onward requires a green build on all three targets, exercised on physical hardware — one real iPhone and one mid-range Android (the Samsung A54 already named as the reference device), not simulators.** Simulators do not surface memory pressure, thermal throttling, real keyboards, or storage limits.

This also fixes the framing problem in S14: it is not "web first, native later". It is **tri-target from day one**, with web being the first target you can *deploy*.

---

## 3. S3 — HIGH: the PWA solves your App Store problem

Audit §6.11 and risk R3 treat store payment rules as an unavoidable tax with an appeal risk attached. But **store rules bind the native binaries only.** A PWA is not distributed through a store, takes no commission, and needs no review.

That means the correct architecture is not "the app sells nothing" — it is:

> **Selling lives on the web.** The PWA and `apps/admin` carry the full module
> marketplace with Stripe Checkout, at 0 % commission and with no review cycle.
> The **native binaries** show capability state only — no module names, no prices,
> no descriptions, no purchase path — satisfying Guideline 3.1.1 and 3.1.3(b) by
> containing nothing to object to.

This is materially better than v3.0's position, and it is not a workaround — it is using the distribution channel that fits the transaction. It also means:

- **The web launch is a commercially complete product.** You can sell from month 7 without waiting for a store account, a review, or an appeal.
- **Risk R3 stops threatening revenue.** A store rejection would delay native distribution, not your ability to take money.
- Instant updates on the sales surface. No review latency on pricing or packaging changes.

Record this as **D-13: commerce lives on the web surface; native binaries are capability-only.**

---

## 4. S4 — HIGH: squash 90 migrations into one baseline

You are carrying `20260218000000_drop_old_tables.sql` through to `20260803000003_allow_org_owner_cascade_delete.sql` — 90+ migrations, of which a visible number exist only to fix earlier ones (`fix_profiles_team_member_rls_recursion`, `fix_tasks_rls_recursion`, `fix_handover_view_security_invoker`, `fix_budget_summary_ambiguous_column`, `fix_disabled_tabs_allowlist`, `fix_time_registration_date_cast`, `fix_protect_trial_columns_company_id`).

With no users and a new Supabase project, that history has no value as *executable* history. It has enormous value as a *specification*.

**Change:** create a fresh Supabase project for 3.0 and **generate one consolidated baseline schema, redesigned offline-native from line one** — soft deletes and tombstones, trigger-maintained indexed `updated_at`, idempotency tables, the cascade-delete design resolved, and the RLS policies re-derived rather than patched. Keep `pkzburssqetnlcbvabdq` archived read-only as the reference.

The existing `supabase/schema.sql` (74 KB) plus the migration history is your input; a clean, reviewable, single-file baseline is your output. **3–5 days**, and it is the last moment this is free.

---

## 5. S5 — HIGH: prototype the RNW canaries in P1, not P5

Three existing screens are the ones most likely to fight React Native Web, and all three are scheduled late:

| Screen | Size | Why it is a canary |
|---|---|---|
| `components/planning/GanttView.tsx` | 22 KB | Wide horizontally-scrolling timeline with synchronised rows — the classic RNW pain point |
| `components/planning/CalendarView.tsx` | 18 KB | Dense grid, month view, drag interactions |
| `modules/team/components/OrgChartView.tsx` | 16 KB | Nested tree layout with connectors |

If React Native Web cannot render an acceptable Gantt, `.web.tsx` is a cheap answer **in month 2** and an architectural crisis **in month 8**.

**Change: build a throwaway Gantt prototype in `packages/ui` during P1 and run it on all three targets.** Three days. It either de-risks the whole universality decision or tells you to plan `.web.tsx` variants for the planning module from the start.

---

## 6. Medium-severity findings

### S6 — Web performance budget
The plan sets native budgets and none for the browser, where React Native Web output is heavier than hand-written DOM. Add: **first-route JS ≤ 1.5 MB gzipped · LCP < 2.5 s on simulated 4G · TTI < 3.5 s · Lighthouse PWA score ≥ 90**, enforced in CI alongside the native startup budget.

### S7 — Push needs three providers
The abstraction is specced `web | expo`. It needs **`web` (VAPID — already built and working in 2.1) · `expo/APNs` · `expo/FCM`**, with per-platform subscription rows. The web half is the part you already own; do not rebuild it.

### S8 — Auth and the offline grace window differ per runtime
`expo-secure-store` on native (with the 2048-byte chunking problem already noted); on web, `localStorage`/IndexedDB, which the user or the browser can clear at any time. **The 14-day offline grace has a different threat model on each.** Specify: native holds the grace in secure storage with a mandatory biometric lock when unsynced work exists; web holds a shorter grace (recommend 72 hours, matching the entitlement TTL) because the storage is neither secure nor durable.

### S9 — Branch and release strategy
Web deploys continuously from trunk. Native ships in store cycles from tags. Without a rule those two drift. **Rule: trunk-based development, short-lived branches, web auto-deploys from trunk, native cuts from a release tag, and the two must never be more than one minor version apart.** Where they must differ, it is a platform capability flag, never a code fork.

### S10 — i18n needs an owning phase
It has now floated across three documents with a recommendation and no task. **Add `i18next` in P1, ship `da-DK` only.** With a fresh codebase this is roughly two days; retrofitting is 3–5×. Either do it in P1 or explicitly decide never to — the current state, recommending it while scheduling nothing, is the worst of both.

### S11 — Name the blow-up scenarios
±30 % is not a plan. The four things that would actually break the estimate, each with a trigger and a contingency:

| Scenario | Trigger | Contingency |
|---|---|---|
| Web offline is harder than expected (S1) | P0 tri-target spike fails or PowerSync RNW beta is unusable | Ship web as online-only for launch; native gets full offline. Costs the PWA's field value, saves the schedule |
| Calculator divergence > 40 | P0.2 measurement | Cut `tools` from the launch scope entirely — it is not on the critical path |
| RNW fails a key screen (S5) | P1 Gantt canary | `.web.tsx` variants for the planning module; budget +10 days |
| Screens phase parallelises badly | Two modules blocked on one owner at week 16 | The registry makes modules independent — re-assign, do not add people to a blocked module |

### S12 — `apps/admin` has no phase
Roughly 10 % of the effort and currently unscheduled. It is a thin Vite + React app consuming `packages/core` and `packages/tokens`, DOM-native, no RNW. **Add it as a parallel stream in P5**, one developer, 4–5 weeks: platform admin, org and billing management, SMTP, promo codes, tool-access config, and the 3D project wizard.

### S13 — Identity migration
Undefined and it touches everything. Decide now:

| Item | Recommendation |
|---|---|
| Repository | **New repo `bygsmart-3-native`.** Not a fork — a clean history. Vendor the 2.1 tree into `legacy/` as one snapshot commit so it is greppable and in history, then delete it at G5. The 2.1 repo stays archived for history archaeology |
| Product name | **BygSmart 3.0 Native** |
| Bundle identifiers | `com.bygsmart.app` (iOS) / `com.bygsmart.app` (Android) — reserve both at account creation |
| Supabase project | **New project** (S4). Archive `pkzburssqetnlcbvabdq` read-only |
| Domains | `app.bygsmart.com` serves the new PWA; `admin.bygsmart.com` serves `apps/admin`; `bygsmart.com` stays the static marketing site |
| Deep links | Universal Links / App Links association files on `app.bygsmart.com`; scheme `bygsmart://` |

### S14 — Reframe "web first"
"Web first, native later" invites the S2 failure. The accurate framing is **tri-target from day one; web is simply the first target you can deploy.** Developer accounts take 2–4 weeks and the build takes seven months — accounts will never be the blocker if you apply in week 1.

---

## 7. Is the plan SOLID?

You used the word, so it is worth answering both ways.

**As "robust":** it will be, once S1 through S5 are folded in. S1 is the one that would have been discovered in month four and cost months.

**As the principles**, three of the five are already load-bearing architectural properties — worth naming so they are defended rather than accidental:

- **Dependency inversion** — the sync layer sits behind a contract that the tests target, not the implementation. This is why "swap PowerSync for something else in a week" is credible. Protect it: **no screen may import a sync-engine type directly.**
- **Open/closed** — the module registry is the existing system's best property. New capability arrives as a new manifest, not as an edit to the shell. Carry the `eslint-plugin-boundaries` discipline into the monorepo on day one; it is the reason any of this is portable.
- **Single responsibility** — `packages/calc-engine` computes and knows nothing about rendering; `packages/ui` renders and knows nothing about domain. This is what makes one calculator definition serve three platforms.
- **Interface segregation** — the platform adapters (§7.6 of the audit) are already small and separate. Keep them that way; a fat `PlatformAdapter` would undo it.
- **Liskov** — the one to watch: a `.web.tsx` variant must be substitutable for its native sibling. Same props, same behaviour, different rendering. Test layer 7 (every component run on both renderers) is the enforcement.

---

## 8. What to change in the plan, in order

1. **P0 gains a tri-target sync spike** (S1) — PowerSync and ElectricSQL on iOS, Android *and* React Native Web, against the real schema. This is now the highest-information two weeks in the programme.
2. **P0 gains the schema baseline consolidation** (S4) and the identity decisions (S13).
3. **P1 gains the Gantt canary** (S5), the i18n layer (S10), and the graded web-offline capability detection (S1).
4. **Every gate from G1 gains the three-target physical-device requirement** (S2).
5. **P2 gains the third push provider** (S7) and the per-runtime session model (S8).
6. **P3 gains the web arm of the chaos suite** (S1).
7. **P5 gains `apps/admin`** as a parallel stream (S12).
8. **D-13 recorded**: commerce on the web surface, native capability-only (S3).
9. **Budgets and release strategy** written down (S6, S9), blow-up scenarios named (S11).

Net effect on the timeline: **+2 to +3 weeks**, concentrated in P0 and P1 — and it removes the two scenarios most likely to cost months.
