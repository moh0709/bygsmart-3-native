# Test harness — the 8 layers

Tests here are not insurance against users (there are none). They are **what lets us delete
and rewrite whole subsystems in a week without slowing down.** The harness exists *before*
the feature code (risk R9/R10 mitigation) so nothing is ever added without a home for its tests.

| # | Layer | Where | P0 state | Green gate |
|---|---|---|---|---|
| 1 | Formula golden fixtures | `packages/calc-engine` | **REAL** | per-PR |
| 2 | Pure business rules | `packages/core` | **REAL** | per-PR |
| 3 | RLS policy (SQL) | `test-harness/layer3-rls/` | red-pending | nightly |
| 4 | Repository / sync contract ×3 runtimes | `test-harness/layer4-repo-contract/` | red-pending | per-PR (once real) |
| 5 | Property-based sync (`fast-check`) | `test-harness/layer5-property-sync/` | red-pending | nightly |
| 6 | Chaos — native arm | `test-harness/layer6-chaos-native/` | red-pending | nightly |
| 6b | Chaos — web arm | `test-harness/layer6b-chaos-web/` | red-pending | nightly |
| 7 | Universal component (both renderers) | `packages/ui` | **REAL** | per-PR |
| 8 | E2E journeys (Maestro + Playwright) | `test-harness/layer8-e2e/` | red-pending | nightly |

## Two lanes

- **Green gate** — `pnpm test` (turbo → package `test` scripts). Runs the REAL layers (1, 2, 7).
  Must be green on every PR. This is what blocks merge.
- **Red-pending** — `pnpm test:pending` (vitest on `*.pending.test.ts`). Runs the not-yet-built
  layers as **intentionally failing** placeholders. CI reports them as a non-blocking job so
  they stay visible and cannot be quietly dropped.

## Rules (Build Plan §5.2)

- **No skipped tests, ever.** A skip is a lie about what you can safely delete. The placeholders
  FAIL — they do not `.skip`.
- **Line coverage lies** — mutation testing (Stryker) on `calc-engine` and the sync layer, ≥75%.
- **Fixtures are captured, never hand-written.**
- **Every `packages/ui` test runs on both renderers** or it is not a `packages/ui` test.
- The chaos suites (6, 6b) run **nightly**, both arms.

## Not yet wired — and deliberately not hidden

The **per-PR green build on three physical targets** (real iPhone, mid-range Android, web) is a
non-negotiable guardrail but needs device/EAS infrastructure that does not exist yet. It is
represented in CI as a `three-target-build` job marked pending, so its absence is loud, not silent.
