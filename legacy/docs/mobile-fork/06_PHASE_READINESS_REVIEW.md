# BygSmart 3.0 Native — Phase Readiness Review
## Part 6 · Is each phase actually executable as written?

**Date:** 3 August 2026
**Reviewing:** `03_BUILD_PLAN.md` v4.1, phase by phase
**Method:** for each phase — bottom-up effort against allocated staffing, dependency check, missing-work check, failure-mode check
**Headline:** **six of eight phases are executable as written. Two are materially under-resourced, one contains a 2–2.6× estimating error, and the plan has no buffer anywhere.** Corrected end date: **~week 35 (8–8.5 months) to PWA launch**, native 5–7 weeks after that.

---

## 0. Scorecard

| Phase | Weeks | Staffing | Verdict | Headline issue |
|---|---|---:|:--:|---|
| **P0** Decide, spike & scaffold | 1–3 | 4.0 | 🟠 **Tight** | Too much in 3 weeks; the 8-layer harness cannot all be real yet |
| **P1** Universal foundation | 4–9 | 4.0 | 🟠 **Tight** | The ≥90 % coverage gate on harvested code is a hidden 2-week job |
| **P2** Offline-native backend | 5–8 | 1.0 | 🔴 **Under-resourced** | 8 substantial items for one person; one of them is a 25–35-day job that shouldn't be here |
| **P3a** Local store, read path | 9–12 | 2.0 | 🟢 **Sound** | Two policies undefined (local migration, hydration budget) |
| **P3b** Outbox, media, chaos | 13–20 | 2.5 | 🟢 **Sound** | No stated contingency if G3b fails |
| **P4** Calc engine + renderer | 9–16 | 1.5 | 🔴 **2–2.6× under-estimated** | 60 person-days allocated against a 120–160-day scope |
| **P5** Screens + back-office | 13–28 | 4.0 | 🟠 **Tight** | Zero buffer, QA unstaffed for 16 weeks |
| **P6** Harden & PWA launch | 29–32 | 5.0 | 🟠 **Tight** | DPIA and security review have calendar lead times and are scheduled as engineering work |
| **P7** Native packaging | +3 | 1.5 | 🟠 **Optimistic** | Excludes store review latency; realistically +5–7 weeks |

---

## 1. Will the PWA be better on phones and tablets than BygSmart 2.1?

Answering this first because it shapes how hard the web budget must be defended.

**Yes on phones — decisively, but for one reason above all others.**

| | 2.1 (Vite + Tailwind DOM) | 3.0 (React Native Web) |
|---|---|---|
| **Offline** | **None.** `sw.js` never caches `/api`. Open it in a basement and you get a shell with nothing in it | **Graded offline** — full local database, outbox, media queue, subject to browser storage tiers |
| **Tablet** | **No tablet layout at all** — `max-w-3xl` centred, a phone layout on a bigger screen | **Real two-pane layouts** above the tablet breakpoint, designed from the first primitive |
| **Desktop** | Phone-shaped IA stretched | Rail + sidebar, master/detail |
| **Camera / files** | Browser APIs | Same browser APIs — no change |
| **Install** | Already installable | Same, plus install prompted at the moment it matters (storage persistence) |
| **Bundle / first load** | Lighter — hand-written DOM with Tailwind | **Heavier.** RNW emits a div-per-`View` with inline styles |
| **Long-list scroll** | `@tanstack/react-virtual` — very good on web | FlashList on web is decent, not better |
| **Semantic HTML / a11y** | Real elements | Divs with ARIA — correct semantics take deliberate effort |

**The honest framing: phones and tablets get better because of *offline* and *responsive design*, not because of React Native Web.** RNW is a cost you pay on the web side to get one codebase; the wins come from what you build with it. On a like-for-like online screen, 2.1's DOM output is lighter and its long lists scroll better.

**Three consequences:**

1. **The web performance budget is not a nice-to-have.** ≤ 1.5 MB gzipped first route, LCP < 2.5 s, Lighthouse PWA ≥ 90 — enforced in CI from P1, not measured in P6. If it drifts, the phone web experience gets *worse* than 2.1's while you are still calling it an upgrade.
2. **Accessibility needs explicit attention on web.** Every primitive needs correct roles and labels because RNW will not give you semantic HTML for free. This is why test layer 7 runs every component on both renderers.
3. **Keeping the back-office DOM-native was the right call** — dense admin tables are precisely where RNW would have cost you and delivered nothing.

**Tablets are the largest single UX win in the programme**, and they cost almost nothing extra *provided* the breakpoints are in the primitives from day one. Retrofitting them is a rewrite. This is the strongest argument for not letting P1 slip.

---

## 2. P0 — Decide, spike & scaffold · 🟠 Tight

**What's right.** Front-loading the tri-target sync spike is the single best decision in the plan — it converts the programme's biggest unknown into evidence in week 2 rather than month 4. The divergence measurement and the developer-account applications are correctly placed.

**What doesn't fit in three weeks.** Bottom-up, P0 contains: two sync spikes on three runtimes each · schema consolidation (3–5 d) · divergence measurement (2–3 d) · monorepo + Expo scaffold on three targets · an eight-layer test harness · repo creation and 2.1 vendoring · identity decisions. The spikes alone are the problem: I costed them at "two days each", but evaluating a **beta** RNW integration against a real schema on three runtimes is realistically **4–5 days each**.

**The harness is the other over-reach.** Layers 3 (RLS SQL), 5 (property-based sync), 6 and 6b (chaos) cannot be meaningfully written before the things they test exist.

**Fixes:**
- **Extend P0 to 4 weeks.** This is the cheapest week in the entire plan and it de-risks the most expensive decision.
- **Split the harness:** layers 1, 2 and 7 are *real* in P0; layers 3, 4, 5, 6, 6b are **failing placeholders** that CI runs and reports as red-pending. A failing placeholder cannot be forgotten; an absent layer can.
- **Add: buy the physical devices in week 1** — one current iPhone, one Samsung A54 or equivalent. You need them by day 5 and procurement is latency.
- **Add: design.** The designer is allocated 0.5 FTE with no P0 deliverable. Key flows (capture, check-in, sync states, conflict resolution) should be designed during P0 so P1 builds against something.

---

## 3. P1 — Universal foundation · 🟠 Tight

**What's right.** The Gantt canary, the responsive-from-day-one mandate, the i18n layer landing while it's cheap, and carrying `eslint-plugin-boundaries` in from the start.

**The sleeper item: G1 requires `packages/core` at ≥ 90 % coverage.** That is roughly 6,500 lines of harvested service and registry code, and **2.1's tests do not exist for most of it** — the repo measures 5.0 % line coverage overall. So this is not "port the tests", it is "write the tests". Realistically **8–10 person-days** that the phase does not currently account for.

**Also missing:**
- **The deep-link route map** is scheduled in P5-A but the navigation shell is built in P1. The map is a P1 artefact.
- **Error, empty, loading and offline states as first-class primitives.** If these are not primitives, every screen invents its own and P3's sync states become 40 inconsistent implementations.
- **Who builds the Gantt canary?** It needs someone fluent in both RNW and the domain. Assign it to the lead explicitly, or it will be quietly dropped.

**Fixes:** budget the coverage work explicitly (or lower G1 to ≥ 80 % and raise it at G5) · move the route map into P1 · add state primitives to the 25 · name the canary's owner.

---

## 4. P2 — Offline-native backend · 🔴 Under-resourced

**This is the weakest phase in the plan.** One developer, four weeks, and eight substantial deliverables: schema consolidation · sync pull endpoint · mutation endpoint with idempotency · a three-provider push abstraction · **server-side report generation** · the per-runtime session model · entitlement TTL and revocation adjudication · the full RLS test suite.

Two of those are phases in their own right. The audit costed **server-side reports at 25–35 dev-days**, and the RLS suite covering every table × every role, positive and negative, is **5–10 days**. That alone exceeds the phase's entire capacity.

**Fixes — both, not either:**

1. **Move server-side report generation out of P2 entirely.** Reporting ships in v1.1. Nothing at launch needs it. This removes 25–35 days from the critical region of the plan for free — it is the single largest easy saving available.
2. **Staff P2 at 1.5–2.0 FTE.** It is the foundation P3a and P3b build directly on top of; a shaky sync contract propagates into both.

With reports removed and 2.0 FTE, four weeks becomes plausible.

---

## 5. P3a — Local store & read path · 🟢 Sound

**What's right.** Splitting the read path out was the correct fix to v4.0's contradiction, and the repository contract satisfied by three runtimes is the abstraction the whole architecture hangs on.

**Two policies are undefined and both are cheap to decide now:**

- **Local schema migration policy.** When the server schema changes and a client holds old local data — migrate, or wipe and re-hydrate? For a pre-launch product with no precious local state, **wipe-and-rehydrate is correct and far cheaper**. Say so explicitly, and revisit only after launch.
- **The hydration budget.** G3a requires hydration "within its stated maximum duration" and no maximum is stated. Pick one — recommend **≤ 60 seconds on 4G for a typical user's scope**, with visible progress — because it is the first impression the app makes.

**One dependency note:** if D-11 resolves to *buy*, PowerSync or ElectricSQL handle a meaningful share of P3a — including multi-tab coordination. If it resolves to *build*, P3a is closer to 6 weeks than 4. That is a further argument for buying, and the P0 spike settles it.

---

## 6. P3b — Outbox, media & chaos · 🟢 Sound

**What's right.** Thin-write-path-first, M1 as a forcing function, and the chaos gate held at full strength.

**One dependency to make explicit:** M1 (week ~15) needs auth and a task screen, which come from P5-A starting week 13. That works — P5-A's first two weeks are exactly auth and shell — but it is an unstated cross-stream dependency, and unstated dependencies are how milestones slip quietly. **Write it into both streams.**

**The missing piece: what happens if G3b fails at week 20?** No contingency is stated for the plan's hardest gate. State it:

> **G3b failure path.** P5-B screens continue to be *built* (they are written against the repository contract, not the engine). Sync hardening gets **+2 to +4 weeks**. If two consecutive attempts fail, the fallback is that **the PWA launches online-only and native carries full offline** — which costs the web's field value but protects the launch date. That decision is taken at week 24, not later.

**On the chaos harness:** 0.5 FTE across 8 weeks is 4 person-weeks to build a randomised harness that kills processes, fills disks, evicts OPFS, flaps networks and drives two devices into conflict, on two platforms plus web. That is right *if* the sync layer is bought and supplies some of the scaffolding. If it is built, add 1–2 weeks.

---

## 7. P4 — Calculator engine · 🔴 Estimating error, 2–2.6×

**The clearest error in the plan, and it is mine.**

Allocated: 1.5 FTE × 8 weeks = **12 person-weeks ≈ 60 person-days**.
Scoped: the audit's own figure for the schema-driven approach is **120–160 dev-days** — engine completion 60–80, renderer 25, visualisation layer and bespoke calculators 35–55.

That is precisely the dev-days-versus-person-months mismatch the BMAD validation caught in the previous plan, reappearing in a new place.

**The fix is to scope down, not to add people.** P4 is off the critical path specifically so it can absorb this:

> **P4 delivers the renderer, the visualisation descriptor layer, and the ~20
> highest-value field calculators.** Renderer 25 d + viz layer 20 d + 20 calculators
> at ~1 d each ≈ **65 person-days ≈ 13 person-weeks** — which fits 1.5 FTE × 8 weeks
> with a little slack.
>
> **The remaining ~70 calculators are v1.1 work**, delivered incrementally at roughly
> one developer-day each once the engine exists. `legacy/modules/tools/pages/**` is
> then deleted **per calculator as it is replaced**, not in one commit — the golden
> fixtures make that safe either way.

This also improves the story: the launch ships the calculators a field worker actually opens, and the long tail arrives steadily rather than as a wall.

---

## 8. P5 — Screens & back-office · 🟠 Tight

**What's right.** Four parallel streams, one owner per module, and building against the repository contract so UI does not queue behind the write path. The registry genuinely makes modules independent — that property is 2.1's best inheritance.

**Three problems:**

1. **Zero buffer across 16 weeks.** Every stream is packed end to end. In a 35-week programme, having no slack in the longest phase means the first surprise moves the launch date. **Add two weeks before G5.**
2. **QA is unstaffed for the entire phase.** The staffing table has QA at 0.5 in P3b and 1.0 in P6, with nothing during 16 weeks of screen building. That guarantees a quality cliff at week 29. **Add QA at 0.5 through P5**, owning test layer 8 and the per-PR three-target verification.
3. **Stream C is overloaded at the tail.** Documents, Knowledge, home widgets, global search *and* settings in six weeks with one owner. Settings alone in 2.1 is a 43 KB screen. Move settings into Stream A, which frees up after week 22.

**One thing to protect:** the per-PR requirement for green builds on all three physical targets. Under delivery pressure it is the first gate a team quietly relaxes, and it is the one that prevents a nasty surprise in P7.

---

## 9. P6 — Harden & PWA launch · 🟠 Tight

**The engineering work fits.** The non-engineering work does not, because it has calendar lead times that four weeks cannot absorb:

- **The DPIA** — check-in geolocation, GPS-stamped photos and crew-hour visibility are employee monitoring under Danish law, with works-council implications. This involves people outside the team.
- **The security review** before the first paying customer — external, and booked in advance.

**Fix: both start at week 20, running in parallel with P5.** They are not blocked by feature completeness, and treating them as P6 engineering tasks is how launches slip on paperwork.

**Also add to P6:** a rollback plan for the *web* deploy (trivial — previous artefact — but write it down), and confirmation that observability dashboards and alert thresholds are live *before* launch, not after.

---

## 10. P7 — Native packaging · 🟠 Optimistic

Three weeks covers the engineering: EAS pipeline, store assets, privacy declarations, account deletion, TestFlight and Internal Testing. It **excludes review latency**, which the plan itself budgets at 2–4 weeks with a plausible appeal cycle on the capability-only marketplace screens.

**State it honestly: native launch is G6 + 5–7 weeks**, not +3. And because the accounts clear around week 6 while P7 runs at week 33, there is no reason not to **submit a throwaway build to TestFlight in P5** — around week 20, as soon as there is anything installable. It smoke-tests the entire credential, signing and submission pipeline months before it matters, which is the cheapest possible way to discover that something in it is broken.

---

## 11. Cross-cutting gaps

| # | Gap | Fix |
|---|---|---|
| X-1 | **No buffer anywhere in a 32-week plan** | +1 wk P0, +2 wks P5. A plan with zero slack does not hold |
| X-2 | **QA absent during the 16 weeks of screen building** | QA 0.5 through P5 |
| X-3 | **Design has no phased deliverable** | Key flows designed in P0; the designer runs one sprint ahead of P5 throughout |
| X-4 | **Physical devices not procured** | Buy in week 1 — needed by day 5 |
| X-5 | **Server-side reports sit in the critical region and belong in v1.1** | Remove from P2. Largest easy saving in the plan |
| X-6 | **DPIA and security review treated as engineering tasks** | Start both at week 20 |
| X-7 | **The store submission pipeline is first exercised in P7** | Throwaway TestFlight build at ~week 20 |
| X-8 | **No dependency-upgrade window** in an 8-month programme | Pin Expo SDK 56; schedule one upgrade window at ~week 24 |
| X-9 | **RS-1 field research has no owner or date** | PO, weeks 4–12. It re-derives the scope split and it is currently judgement |

---

## 12. Corrected schedule

Applying the fixes above:

```
P0  wk 1–4    (+1 wk)          Decide, spike, scaffold, procure, design flows
P1  wk 5–10                    Universal foundation  (coverage work budgeted)
P2  wk 6–9    (2.0 FTE)        Backend — reports removed to v1.1
P3a wk 10–13                   Local store, read path              → G3a
P3b wk 14–21                   Outbox, media, chaos     M1 @ wk 16 → G3b
P4  wk 10–17  (descoped)       Renderer + viz + 20 calculators     → G4
P5  wk 14–31  (+2 wk buffer)   Screens, four streams, QA 0.5       → G5
    ├ DPIA + security review start wk 21
    └ throwaway TestFlight build wk 21
P6  wk 32–35                   Harden & PWA launch                 → G6
P7  wk 36–38  + 2–4 wks review Native packaging & submission       → G7
```

| Milestone | Was | Now |
|---|---|---|
| M1 walking skeleton | wk 15 | **wk 16** |
| G3b — the hard gate | wk 20 | **wk 21** |
| **G6 — PWA launch** | wk 32 (~7.5 mo) | **wk 35 (~8–8.5 mo)** |
| G7 — store launch | +3 wks | **+5–7 wks ≈ wk 41–43 (~10 mo)** |
| Effort | 30–36 PM | **33–39 PM** |

**Three weeks later and one week of buffer richer**, with the two under-resourced phases fixed and the worst estimate corrected by scoping rather than by hope. That is a plan I would defend in front of the BMAD checklists.

---

## 13. What I would still do differently if pushed

1. **Cut `knowledge` from launch.** It carries the corpus fetch, the FTS5 index and offline favourites, for a module the primary persona rates ●●○. Moving it to v1.1 frees Stream C almost entirely and buys back the two weeks of buffer.
2. **Consider deferring `documents` upload** to v1.1 as well, shipping view-only at launch. Capture-to-task via the Field module already covers the field worker's real need.
3. **Do not defer the walking skeleton for anything.** If week 16 arrives and M1 is not demonstrable on three targets, that is the signal to re-plan — not to push harder.
