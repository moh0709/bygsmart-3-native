# BMAD Validation Report — BygSmart Mobile Fork planning set
## Part 4 of 4 · What the checklists found, and what changed

**Date:** 3 August 2026
**Method:** BMAD-METHOD, global install (`~/.claude/bmad`), commit `08074f3`
**Artefacts validated:** `01_AUDIT_MOBILE_FORK.md` · `02_PRD_BYGSMART_MOBILE.md` · `03_ROADMAP_MOBILE.md`
**Project type:** Brownfield, full-stack + UI

Four independent passes were run: the BMAD **Architect** against `architect-checklist` and `brownfield-architecture-tmpl`, the BMAD **PM** against `pm-checklist` and `brownfield-prd-tmpl`, the BMAD **PO** against `po-master-checklist` (brownfield branches), and an adversarial technical fact-check tasked with *refuting* the plan against current August 2026 sources.

---

## 1. Verdicts

| Pass | Score | Verdict |
|---|---|---|
| Architect — solution validation | ~37 % | **NOT READY** — an excellent decision record, but not an architecture: no data model, no API contract, no interfaces, no diagrams |
| PM — PRD validation | 55 % | **NOT READY** — unevidenced problem statement, R1 not minimal (87 requirements), no epic/story/AC layer, no Compatibility Requirements |
| PO — cross-document integrity | Conditional | **CONDITIONAL** — 17 contradictions, ~3× effort mismatch, and **no rollback for any of the 8 changes to the live system** |
| Adversarial fact-check | 16 findings | **6 claims wrong, 5 outdated, 3 overstated, 2 incomplete** |

The consistent shape of the finding across all four: **the strategy is sound and the scoping discipline is above average; the engineering specification and the estimates are not yet real.** Nothing in the review overturns the decision to fork to Expo with a shared core. Several things overturn the numbers, the dates, and three technical premises.

---

## 2. Things that were factually WRONG (verified, corrected in v2.0)

| # | Claim in v1.0 | Reality (Aug 2026) | Consequence |
|---|---|---|---|
| **F1** | "NativeWind tracks Tailwind's JS-config model; v4's CSS-first tokens are not directly consumable" | **NativeWind v5 targets Tailwind v4 directly.** `@theme`, `@custom-variant`, `@utility`, `@source` all supported; `tailwind.config.js` optional. *Verified at nativewind.dev/v5.* | The whole B1/B2 styling fork was built on a false premise. **D-03 is no longer a blocking decision** and risk R7 drops to Low. |
| **F2** | "`@react-three/fiber` has a native renderer over `expo-gl` … 15–25 dev-days to port" | **R3F does not render under the New Architecture**, and **Expo SDK 55 removed the Legacy Architecture entirely** (`newArchEnabled` no longer exists). *Verified at expo.dev/changelog/sdk-55.* The recommended platform and the recommended 3D path are mutually exclusive. | The 3D configurator port as scoped is impossible. Needs `react-native-webgpu`, a WebView, or dropping from mobile. 30–50 dev-days, or 8 for the WebView. |
| **F3** | "iOS 16.0 (ARKit RoomPlan floor; ~98 % of active devices)" | RoomPlan requires **LiDAR** — Pro iPhones only, roughly a third of the base and *less* among field crews. An OS floor buys nothing. Separately Expo SDK 55's minimum is **iOS 15.1, rising to 16.4 in SDK 56**. | Min-OS reasoning was a category error. AR is a premium-hardware path, not the AR strategy. |
| **F4** | External purchase links: "regionally fragmented, still commissioned. Not worth it" | **US: permitted, no entitlement, 0 % Apple commission** since the May 2025 injunction. **EU/DMA: ~17–20 % all-in** (5 % CTC + 2 % acquisition + Store Services), vs 15–30 % IAP. **Google Play: link-outs in US/UK/EU from 30 June 2026 at 20 %, 0 % in the US.** | The billing section was ~12 months out of date. The *conclusion* (sell nothing in-app) survives — but it must be reached on current numbers. |
| **F5** | Option 1 (sell nothing) = "**zero review risk**" | Guideline **3.1.3(b)** conditions multiplatform access on the same items being available as IAP. Login-only B2B apps have been rejected under 3.1.1 on exactly this basis. | R3 goes from Medium to **High** likelihood. Budget an appeal cycle. |
| **F6** | "Adopt Hermes, enable **RAM bundles** / inline requires" | React Native's own docs: RAM bundles are **incompatible with Hermes**. Hermes is already the default — "adopt Hermes" is a no-op. | Two of three bundling levers were wrong. |
| **F7** | ATT prompt replaces the cookie banner | ATT is for **cross-company advertising tracking** only — not applicable here. Meanwhile GDPR/ePrivacy consent for Sentry telemetry **does not disappear** on native. | Both halves inverted. |
| **F8** | `expo-in-app-purchases` | Unmaintained; Expo now lists only **`react-native-purchases` (RevenueCat)** and **`expo-iap`**. | Stale library recommendation. |
| **F9** | §5.1 "Portability classification of the **frontend**", rows summing to 134,000 lines | 134,064 is the **whole repo including the 10,964-line Express server**. Frontend is ~123,100. | Every percentage in the table was normalised against the wrong denominator. |
| **F10** | "45–55 % of the frontend is platform-agnostic" (§0) vs "40 %" (§5.1) vs "~40–50 %" (§7) | Three numbers for one measurement. | Corrected to a single figure with a stated band. |
| **F11** | "field-first MVP in ~4 months" (§7) | The roadmap's own bottom-up build-up says **8.5–10**, and its gate table says **48 weeks ≈ 11 months** — with G4 stated as a hard stop that makes the claimed Phase 4/5 overlap impossible. | The headline number an executive would remember was 2.5× optimistic. |
| **F12** | "cuts this cost by an estimated 60–70 %" | The audit's own figures (160–250 → 80–95) are a **50–62 %** cut. Outside the stated band at both ends. | The number justifying the single most consequential engineering decision was wrong. |

---

## 3. Things that were MISSING and now block execution

**From the Architect pass** — measured against `brownfield-architecture-tmpl.yaml`, these REQUIRED sections were absent entirely: `data-models`, `component-architecture`, `api-design`, `source-tree-integration`, `coding-standards`, the New Technology Additions table, `testing-strategy → Regression Testing`, `security-integration → Security Testing`, and the Change Log.

The sharpest instance: **S-01 lists 13 entity names and not one column, type, key, index or relation.** The entire R1 thesis is offline. Phase 4 cannot be estimated, let alone built, from a list of nouns. And the plan concedes it — Roadmap §15.6 calls the sync design document *"the highest-leverage document in the project"* while scheduling it nowhere and gating it on nothing.

**From the PO pass** — the finding I consider the most serious in the whole review:

> The plan mutates the live web app and live backend in **eight** ways — monorepo conversion on shared hosting, extracting 12–15k lines of services, **changing the formula source of live building-code calculators**, a schema change on the live push-subscriptions table, rewriting the Supabase Auth redirect allow-list that carries production password resets and invitations, adding idempotency keys to existing mutation endpoints, inverting the design-token source for every visual token in the product, and replacing report generation for both clients.
>
> **Not one of the eight has a rollback procedure, a named verification, or a containment mechanism.** The sole stated safety net is "the web app stays green in production" — applied to a codebase this audit itself measures at **5.0 % line coverage with thresholds enforced on two files**, and explicitly *"behind no flag"* by design.

Item 3 of the eight is the one that should stop the room: these are Danish building-code calculators — U-værdi, kabeldimensionering, faldsikring, brandkrav — whose outputs tradespeople act on and put in signed reports. The plan changes their formula source with no requirement that the new result equals the old one.

**Build-vs-buy was never asked.** The offline engine is specified as six hand-rolled components with no evaluation of **PowerSync** or **ElectricSQL** (both listed Supabase partner integrations), **Legend-State** or **WatermelonDB** (both documented in Supabase's own engineering blog). That is a Phase 0 decision worth 50–100 dev-days.

---

## 4. Estimates, restated

The PO pass found a systematic **~2.5–3× mismatch** between the audit's dev-day figures and the roadmap's person-month totals, in both directions and never reconciled. The fact-check independently found the dev-day figures themselves optimistic.

| Item | v1.0 | v2.0 | Why |
|---|---|---|---|
| Offline engine (bespoke) | 60–80 d | **100–160 d** | Durable ordered dependency-aware outbox + RLS-scoped delta pull + media queue + per-entity conflict policy + a chaos suite passing 100 randomised runs is 5–8 specialist person-months |
| Offline engine (on PowerSync/Electric) | — | **35–55 d** + vendor cost | New option; now a decision |
| Calculators, schema-driven | 80–95 d | **120–160 d** | The v1.0 estimate contained **no line for the SVG visualisation layer**, and "8–12 bespoke" contradicted its own statement that SVG viz and drag interaction appear on *every* page |
| 3D configurator | 15–25 d | **30–50 d** (WebGPU) / 8 d (WebView) | F2 |
| Server-side reports | 15–20 d | **25–35 d + infrastructure** | Replacing `html2canvas` *snapshots* needs a headless browser; CloudLinux shared hosting generally cannot run one |
| React 19 upgrade of `apps/web` | — | **10–20 d** | Expo SDK 55 ships React 19.2; a shared package of context providers cannot serve React 18 and 19 consumers |
| Background upload after force-quit | — | **+8–12 d** | `expo-file-system` background upload survives *suspension*, not *termination* |
| **R1 total** | 8.5–10 months, ≈48 PM | **11–13 months, ≈48–58 PM** | G4 is a hard stop, so Phases 4/5 cannot overlap; 48 PM over 8.5 months needs 5.6 FTE average against a stated 5.5 FTE *peak* |

---

## 5. The 17 cross-document contradictions

Found by the PO pass. Each is now resolved in v2.0 in favour of the document named.

| # | Subject | Resolved to |
|---|---|---|
| C-1 | Time to MVP: "~4 months" vs "8.5–10" vs a 48-week gate table | **11–13 months** |
| C-2/3/14 | Dev-days vs person-months, ~3× apart, in three places | One estimating unit, stated overhead multiplier |
| C-4 | Calculator engine 35–50 d vs roadmap's 25 d; renderer 20 d vs 5 d | Audit's figures, revised upward |
| C-5 | Reuse: 45–55 % / 40 % / 40–50 % | **~23 % directly, ~44 % including adapters**, of 123,100 frontend lines |
| C-6 | Risk ID R10 means two different things; the Turnstile/global-CAPTCHA risk vanished | Reinstated; roadmap risks renumbered |
| C-7 | ATT required vs not | Not required; GDPR consent screen still is |
| C-8 | i18n "do it now" vs no roadmap task at all | Phase 1 task if D-02 lands yes |
| C-9 | Token extraction scheduled in three different weeks | Immediately after monorepo conversion (wk 3–4) |
| C-10 | "No mobile code until Phase 3" vs Phase 2 building a native gallery on both platforms | Phase 2 *is* mobile code; Expo scaffold moves earlier |
| C-11 | Cold start 2.0 s vs 2.5 s, gate vs risk trigger disagree | 2.0 s median budget, 2.5 s p90 field metric, labelled |
| C-12 | Calculators "fully offline" vs heavy catalogues "excluded from the bundle" | Lazily required, never network-fetched |
| C-13 | Projects R1: "read" vs "read + light edit" | Read + light edit |
| C-15 | "8.5 months with overlap" vs a strictly sequential gate table | Gate table governs |
| C-16 | "120+ functional requirements" | 98 |
| C-17 | Schema-driven saving "60–70 %" | 50–60 % |

---

## 6. What survived unchallenged

Worth recording, because a review that only lists faults is not a review.

- **The fork decision itself.** Expo monorepo with a shared core, over Capacitor and over full-native. No pass disputed it.
- **Core-extraction-before-fork sequencing** (§8) — the fact-check called it out as correct.
- **The security assessment** (§3.4) for the *existing* system, and the conclusion that RLS remains the boundary.
- **The HashRouter / deep-link analysis** (§5.2).
- **The server-side PDF recommendation** (§5.6) — right conclusion, wrong cost.
- **The push-provider abstraction** (§5.8).
- **`expo-sqlite` as the default local store** — listed first without justification, which happens to be right.
- **The offline behaviour matrix** (PRD §5) — the PO pass called it "the strongest artefact across the three documents".
- **The scope refusals** (PRD §11) — "exemplary", and to be preserved intact.
- **The gate structure with explicit "if it fails" columns**, and the risk register's early-warning triggers — "above the norm for this artefact class".
- **The in-code archaeology** — lazy-in-lazy, `manualChunks`/regulation text, Metro static imports, iOS JS-timer suspension, Realtime socket death. Called "outstanding".

---

## 7. What has been changed, and what has not

**Done in this pass:** `01_AUDIT_MOBILE_FORK.md` is superseded by **v2.0**, which corrects every factual error in §2, restates every estimate in §4, resolves the audit's side of every contradiction in §5, and adds the missing architecture sections the Architect pass demanded — local data model, sync API contract, source-tree and adapter interfaces, error/retry mechanics, offline authorisation model, regression and rollback strategy, and a New Technology Additions table with pinned versions.

**Not done, and deliberately so:**

- **The PRD and Roadmap still carry their v1.0 numbers.** They now contradict the corrected audit. They need a matching revision — that is the obvious next piece of work, and it is mostly mechanical once the audit's numbers are settled.
- **The epic/story/AC layer** the PM pass demands should not be written until D-01, D-03 and D-10 are signed. Writing 60 stories against unresolved decisions wastes most of them. The one exception the PM pass names is right: **Epic 1 (Shared Core Extraction) should be storied immediately**, because it starts in week 1 and modifies the live production web app.
- **The problem statement is still unevidenced.** The existing PWA has been in production with real users and Sentry telemetry the whole time. The evidence is *available* and was not used. Six to eight field ride-alongs plus a web-analytics pull on module usage by role would let §2.4's persona→module matrix — the basis of the entire R1/R2/R3 split — be derived rather than asserted. That is a Phase 0 task, not a document edit.
- **No competitive analysis.** Dalux, Ajour, Minuba, Fieldwire, Autodesk Build and Procore all sell offline-capable field apps to this exact Danish buyer. The commercial strategy in §10 rests on an unexamined assumption about the buying motion.

---

## 8. Recommended immediate actions, revised

Replacing the v1.0 "first two weeks" list, in priority order:

1. **Reconcile the effort model.** One estimating unit, one overhead multiplier, re-derive every phase and gate date from it. Everything else is sized off this.
2. **Write the sync design document** — entities, columns, indexes, cursors, tombstones, per-entity conflict policy, idempotency scheme — and make it a **hard G0 exit criterion**. It is currently the highest-leverage document in the project and is scheduled nowhere.
3. **Decide build-vs-buy for the offline engine** (new decision D-11). PowerSync / ElectricSQL / Legend-State / WatermelonDB vs bespoke. Worth 50–100 dev-days.
4. **Write a rollback + verification + blast-radius statement for each of the eight live-system mutations**, and replace "behind no flag" with strangler re-export shims so any extraction reverts by a one-line import change.
5. **Add the requirement that converted calculators produce bit-identical results**, or that a change is a deliberate, separately reviewed, golden-fixtured, user-communicated correction.
6. **Fund web-side regression protection before Phase 1** — a critical-path Playwright suite plus visual regression, as a G1 exit criterion. Without it "the web app stays green" is not a safety net, it is a hope.
7. **Run the calculator divergence measurement** (unchanged from v1.0 — still 2–3 days, still sizes a quarter of the codebase).
8. **Open the Apple and Google developer accounts** — and note the Apple organisation enrolment needs a **D-U-N-S number**, 2–4 weeks, which v1.0 did not mention despite billing this as the longest lead item.
9. **Cut `knowledge` and `tools` from R1 now**, at Phase 0, rather than at Gate G5 where the roadmap already pre-authorises cutting them. They are the three lowest-priority R1 modules for the primary persona by the PRD's own matrix, and they carry the FTS5 corpus pipeline, the schema-driven renderer and the D-04 decision off the critical path with them.
10. **Record the repository remote, branch and commit SHA in the audit.** Every measurement in v1.0 is currently unverifiable by a second party — the evidence base is a Windows path and an uncommitted working tree.

---

*Method: BMAD-METHOD (Breakthrough Method of Agile AI-Driven Development), installed globally at `~/.claude/bmad`. Checklists: `architect-checklist.md`, `pm-checklist.md`, `po-master-checklist.md`. Templates: `brownfield-architecture-tmpl.yaml`, `brownfield-prd-tmpl.yaml`.*
