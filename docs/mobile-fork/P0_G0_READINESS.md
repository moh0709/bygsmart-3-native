# P0 → G0 Gate Readiness

**Date:** 2026-08-04 · **Phase:** P0 (decide, spike, scaffold) · **Repo:** `github.com/moh0709/bygsmart-3-native`
**Purpose:** map every G0 exit criterion to evidence, and separate what is DONE from what only the owner (Moh) can clear.

> **Honest headline:** all P0 *engineering* artifacts are complete and, where verifiable without hardware, verified. **G0 cannot be declared cleared** — three criteria depend on physical devices, developer accounts, and a paid Supabase project, none of which are in the engineering workspace.

## G0 exit criteria

| # | Criterion | Status | Evidence / blocker |
|---|---|---|---|
| 1 | **D-11 signed on tri-target evidence** | 🔴 **Blocked** | Spike plan authored (`P0.1_D11_tritarget_spike_plan.md`): protocol, 2×3 matrix, rubric, decision outcomes. Needs the 2 physical devices + a provisioned Supabase project carrying the baseline. Recommendation on record: BUY. **Owner.** |
| 2 | **Calculator divergence table complete** | 🟢 **Done** | `P0.2_calculator_divergence.md` — measured **34/89 divergent** (11 partial + 23 own-maths); threshold (>40) **not crossed**. |
| 3 | **Baseline schema reviewed + deployed** | 🟡 **Partial** | Draft authored + invariants verified (`supabase/baseline/`, 54 tables, tombstones + unified `updated_at` + `parent_is_gone()`). **Review** = the 12 sign-off decisions in the baseline README (owner). **Deploy** blocked on the provisioned project (owner). |
| 4 | **`pnpm test` green on empty universal app, 3 physical targets** | 🟡 **Partial** | **Web:** verified — `pnpm test` green (9/9) + `expo export --platform web` compiles. **Physical iOS/Android:** blocked — no devices. |
| 5 | **Apple + Google dev applications submitted** | 🔴 **Blocked** | Apple needs D-U-N-S (2–4 wk latency). Reserve `com.bygsmart.app`. **Owner — longest lead item in the programme.** |
| 6 | **New repo created, 2.1 tagged, vendored into legacy/** | 🟢 **Done** | Repo live, 7 commits pushed. 2.1 tagged **`v2.1.0-final`** (pushed to its remote). Full 2.1 tree (901 files) vendored into `legacy/`. |

## What P0 produced (all in the repo)

- **Evidence set** (`docs/mobile-fork/`): D-11 spike plan · divergence table · sync design document · decision sign-off · RS-2 competitive scan · this readiness record.
- **Monorepo** (verified builds/lints/typechecks): pnpm + Turborepo + `eslint-plugin-boundaries` (AR-05 + legacy ban on day one) · universal **Expo SDK 56** app (web bundle compiles) · **Vite** back-office · 8 `@bygsmart/*` workspaces.
- **8-layer test harness** (verified): real layers 1/2/7 green, red-pending 3/4/5/6/6b/8, CI with a loud pending `three-target-build` job.
- **Baseline schema draft** (`supabase/baseline/`): unrun, awaiting the project.

## Changes to the plan's assumptions (surface these at the gate)

- **Divergence 34/89, not escalated** → P4 descope (ship ~20, tail in v1.1) holds comfortably; margin moderate.
- **D-13 rationale corrected (RS-2):** no competitor sells via app-store IAP, so 0% commission is a **margin win for our P&L, not a buyer-perceived differentiator.** Mechanism stands; reframe the *why*. Switching is driven by GC/BIM mandate, offline reliability, da-DK/KS compliance.
- **Biggest competitive threat = Dalux** (structural: top-down GC distribution), not a feature gap.
- **Schema:** 40 syncable cascade edges collapse to 23 soft-delete cascades; `task_check_ins` gets `updated_at` (was silently invisible to the sync cursor); 12 decisions need owner sign-off.
- **Sync design flags 8 audit-§7-silent calls** for review (hydration budget, repository-contract shape, SQLCipher, Web Locks routing, …).

## Owner action list (the real critical path — none are engineering)

1. **Apply for Apple (D-U-N-S) + Google Play dev accounts.** Longest lead item — start first.
2. **Buy 1 iPhone + 1 Samsung A54** (or equiv.).
3. **Provision the new Supabase project** + pick org → then Claude deploys & validates the baseline and the D-11 spike can run.
4. **Sign off the 12 schema decisions** (baseline README).
5. **Own RS-1 field ride-alongs** (still unassigned — plan gap X-9; it re-derives the launch scope).
