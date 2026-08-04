# BygSmart 3.0 Native — P0 Decision Sign-off Record

**Deliverable:** P0 0.8 — "Remaining decisions signed."
**Decision owner:** Moh. **Forum:** G0 gate review (end of P0).
**Date drafted:** 2026-08-04
**Source of truth:** `02_PRD_BYGSMART_3_NATIVE.md` §14, `03_BUILD_PLAN.md` §3/§6, kickoff `decisions` block.

> This record documents the decisions so G0 has a clean, auditable checkpoint. Four are already **Decided** in the PRD and are carried forward here with rationale + consequence + what would reopen them. **D-11 is OPEN and cannot be signed without physical tri-target spike evidence** (see the D-11 spike plan).

---

## D-12 — Universality scope · **DECIDED, ready to sign**
**Decision:** ONE universal Expo app (`apps/app`) is the product across iOS + Android + installable PWA. The back-office is a **separate DOM Vite app** (`apps/admin`). `.web.tsx` siblings are the sanctioned per-component escape hatch.
**Rationale:** one codebase / one UI / one set of business rules across three distribution targets (Goal G-3). DOM stays where RNW would cost and deliver nothing (dense admin tables, drag-heavy editors, the 3D wizard).
**Consequence:** every gate from G1 requires green builds on all three physical targets; `.web.tsx` variants must stay < 10% of components (Goal G-3) and must be Liskov-substitutable (AR-06, test layer 7).
**Reopens if:** the Gantt canary (P1) shows RNW fails a class of screens beyond the escape hatch's reach.
**Ready to sign at G0:** ✅

## D-13 — Commerce on the web surface · **DECIDED, ready to sign**
**Decision:** selling lives on the WEB. PWA + `apps/admin` carry the full Stripe marketplace (seats, storage add-ons) at **0% commission, no store review**. Native binaries are **capability-only**: a locked module shows *"Aktiveres af din organisations ejer på bygsmart.com"* with **no module name, no price, no description, no purchase path**.
**Rationale:** store payment rules bind native binaries, not a PWA. This makes the PWA launch (G6) a commercially complete product and reduces store-rejection risk (R-06) from a revenue threat to a distribution-timing risk only.
**Consequence:** entitlements resolve server-side and propagate within seconds. E9 AC②: a reviewer-perspective walkthrough must verify the native binaries contain nothing objectionable. This is a **guardrail** (kickoff do_not): no purchase path/name/price/description in native binaries, ever.
**Reopens if:** Apple/Google change guidelines such that capability-only display itself is challenged (low probability).
**Ready to sign at G0:** ✅

## D-02 — i18n layer now, da-DK only · **DECIDED, ready to sign**
**Decision:** add the i18next layer in P1 (E1), shipping `da-DK` only.
**Rationale:** "two days now, 3–5× later." Retrofitting i18n across built screens is expensive; the layer is cheap while the screen count is zero.
**Consequence:** E1 story "i18n scaffold"; all P1+ primitives/screens go through the layer from the first line even though only one locale ships.
**Ready to sign at G0:** ✅

## D-04 — Calculator launch set · **DECIDED, ready to sign** (now evidence-backed)
**Decision:** `tools` ships **if ready** and is explicitly OFF the critical path (P4/E5). Launch set descoped to the renderer + visualisation layer + **~20 highest-value field calculators**; the long tail is v1.1 at ~1 dev-day each.
**Rationale + new evidence:** the P0.2 divergence measurement (2026-08-04) counted **34 divergent of 89** (11 partial + 23 own-maths) — **below the >40 escalation threshold**. ~55 are near-mechanical harvests. So the engine is viable and the descope is comfortable; P4 remains the schedule's shock absorber.
**Consequence:** if P4 slips, `tools` simply doesn't ship at launch and follows in v1.1 — nothing else is touched. `legacy/modules/tools/pages/**` is deleted per-calculator as replaced, not in one commit.
**Ready to sign at G0:** ✅

---

## D-11 — Offline: buy (PowerSync / ElectricSQL) or build bespoke · **OPEN**
**Status:** cannot be signed at G0 without evidence. The kickoff and PRD both require the decision be made against **all three runtimes on physical hardware** — PowerSync's React Native Web support is BETA and that is exactly the unknown the spike must settle (risk R-02).
**Recommendation on record:** BUY (35–55 dev-days vs 100–160 to build). Not yet a decision.
**Blocked on:** (a) the two physical devices (iPhone + Samsung A54), (b) a provisioned new Supabase project carrying the consolidated baseline schema, (c) running the tri-target spike harnesses on both candidates. Items (a) and (b) are owner tasks (procurement / paid provisioning + credentials).
**What "signed" requires:** documented pass/fail evidence for PowerSync AND ElectricSQL on iOS + Android + RNW against the real schema, scored on the rubric in the D-11 spike plan, with a written recommendation and the escalation check (both unusable on RNW → web launches online-only, native carries full offline).
**Ready to sign at G0:** ❌ — this is the one G0 exit criterion that depends on hardware + provisioning outside the engineering workspace.
