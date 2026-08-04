# BygSmart 3.0 Native

One **universal Expo application** — iOS + Android + an installable PWA (React Native Web) from a single codebase — built on a proven backend redesigned offline-native. A ground-up rebuild of BygSmart 2.1, **not** a port. See `docs/mobile-fork/` for the governing plan, PRD, and P0 evidence.

> **Status: Phase P0** (decide, spike, scaffold). This repo is the scaffold; feature code starts in P1.

## Workspace layout

```
apps/
  app/        Universal Expo app — iOS + Android + Web (PWA)
  admin/      Back-office — separate DOM Vite app (admin.bygsmart.com). Deliberately no RNW.
packages/
  core/       Types, module registry, entitlements, org, pure business rules
  calc-engine/ Formulas as pure functions + schemas + viz descriptors + golden fixtures
  ui/         Universal responsive primitives (RN + RNW)
  tokens/     Design tokens — the single source
  api-client/ Typed Supabase + /api client
server/       Express API, redesigned for sync
supabase/     ONE consolidated baseline schema, offline-native (baseline/)
legacy/       BygSmart 2.1, vendored as one snapshot commit. Read-only. Deleted at G5.
```

## Non-negotiable guardrails (enforced from day one)

- **Module discipline** via `eslint-plugin-boundaries` (`.eslintrc.cjs`). Dependency directions are lint-enforced now, before any feature code exists.
- **No screen imports a sync-engine type** (AR-05). `screens` may not depend on `sync`; they use the repository contract in `db`. This is why "swap the sync engine in a week" is credible.
- **`legacy/` is never imported** by shipping code — it is a parts bin, harvested then deleted at G5.
- **RLS is the sole authorisation boundary.** The anon key ships in the binary; the client never invents authorisation.
- **Metro:** manifest `load()` uses **literal static imports**; `React.lazy` is **never** nested inside `React.lazy` (production incident 2026-07-11).
- **Every PR:** green build on **three physical targets** (real iPhone, mid-range Android, web) · **no skipped tests, ever** · web perf budget in CI from P1 (first-route JS ≤ 1.5 MB gzip, LCP < 2.5 s, Lighthouse PWA ≥ 90).

## The 8-layer test harness

Layers 1, 2, 7 are **real** in P0. Layers 3, 4, 5, 6, 6b are **failing placeholders** CI reports as red-pending — a failing placeholder cannot be forgotten, an absent one can. (Harness wiring is the next P0 step, deliverable 0.5.)

1 Formula golden fixtures · 2 Pure business rules · 3 RLS policy (SQL) · 4 Repository/sync contract ×3 runtimes · 5 Property-based sync · 6 Chaos (native) · 6b Chaos (web) · 7 Universal component (both renderers) · 8 E2E journeys (Maestro + Playwright).

## Getting started (once dependencies are installed)

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

> The Expo app in `apps/app` and the Vite app in `apps/admin` still need their framework
> dependencies added by an init step (Expo SDK 56 / Vite). Until then the workspace spine,
> shared packages, and lint/boundaries rules are in place and reviewable.

## Identity

| Item | Value |
|---|---|
| Bundle ID | `com.bygsmart.app` (iOS + Android) |
| Domains | `app.bygsmart.com` (PWA) · `admin.bygsmart.com` (back-office) · `bygsmart.com` (marketing) |
| Deep links | `bygsmart://` + Universal Links / App Links |
| Supabase | New project (2.1's `pkzburssqetnlcbvabdq` archived read-only) |
