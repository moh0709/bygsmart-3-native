# Calculator Correctness Audit & Engineering-Level Upgrade Plan

**Date:** 2026-07-08
**Scope:** All 83 calculator page files across all 16 tool categories (`pages/calculators/**`), the shared formula registry (`services/calculatorCatalog.ts`, 3490 lines, ~70 pure `compute*` functions), and the Danish-standards metadata (`STANDARDS_CATALOG`).
**Method:** 15 parallel domain audits (one per category), each reading every calculator file in its category, tracing the formula back to `services/calculatorCatalog.ts` where shared, and checking the math against real Danish/Eurocode construction practice. Read-only research — no code was changed to produce this plan.

---

## 0. How to read this document

1. §1 Executive summary — what's solid, what isn't, in one page.
2. §2 Cross-cutting architectural patterns — six recurring failure shapes that explain *why* the bugs in §3 keep happening. Fix these patterns once and a whole class of future bugs stops.
3. §3 Consolidated, prioritized bug list — every confirmed correctness issue, file:line, ranked by how badly it can mislead a user.
4. §4 Per-category audit tables — the full detail behind §3, category by category.
5. §5 New calculator proposals — ~30 candidates, grouped and prioritized.
6. §6 Phased roadmap — P0 (fix bugs) → P1 (architecture hygiene) → P2 (engineering-level advanced mode, per domain) → P3 (new calculators) → P4 (verification & sign-off).
7. §7 Verification & sign-off strategy, §8 Definition of done.

---

## 1. Executive summary

The platform's shared-formula architecture (`services/calculatorCatalog.ts` + `STANDARDS_CATALOG` + `CalculatorModeToggle` + `docs/add-a-formula.md`'s "merge gate") is a **good design** — pure, unit-tested functions, one place to fix a formula, structured Danish-standard citations, an explicit Basic/Advanced split. Where calculators actually follow this pattern (e.g. `FoundationBlocksCalculator`, `PavingCalculator`, `CeilingPanelCalculator`), they are correct, well-documented, and easy to trust.

The problem is **adoption, not design**: roughly a third of the 83 calculators don't follow their own architecture. Pages reimplement formulas locally instead of importing the canonical function (creating silent drift), authored help/standards content sits unused in the registry, and "Advanced" mode is in several places a cosmetic label rather than added rigor. On top of that, the audits surfaced **~34 concrete correctness bugs**, four of which can actively produce a wrong "compliant/safe" verdict on screen (structural column check, stair headroom, ramp landings, drain-slope compliance).

None of this requires a rewrite. Most of it is: import the existing shared function instead of a local copy, wire the help content that's already written, and merge a secondary check into the main verdict. The bigger lift — reaching genuine Eurocode/DS "engineering level" in Advanced mode — is real work, concentrated almost entirely in **Statiske Beregninger** (structural), where every calculator computes the *load* side correctly but none compute a *resistance/capacity* side, so nothing ever produces a true Ed/Rd utilization check.

**Numbers:** 83 files audited across 16 categories · ~34 confirmed bugs (4 safety-relevant) · ~15 instances of duplicated/forked formulas · ~10 instances of authored-but-unrendered help/standards content · ~30 candidate new calculators identified.

---

## 2. Cross-cutting architectural patterns

These six patterns each appeared in 3+ independent category audits — they are systemic, not one-off mistakes.

### Pattern A — Formula fork
A page reimplements a formula locally instead of importing the canonical `compute*` function from `services/calculatorCatalog.ts`. The two copies then silently diverge, and since `CalculatorPickerModal`, `services/onboardingIntelligence.ts`, and PDF reports call `computeCalculator(id, inputs)` against the *catalog* version, the number a user sees on the live page can differ from the number quoted elsewhere in the app.

Confirmed instances: `BattenSpacingCalculator` (own eaves/ridge algorithm vs. catalog's `computeBattenSpacing`), `CableSizingCalculator` (ρ=0.0172 vs. catalog's ρ=0.0175 in `computeVoltageDrop`), `VolumeCalculator`, `ReinforcementCalculator`, `FormworkCalculator`, `StairCalculator` (imports `computeStairGeometry` but never calls it), `PaintEstimatorPro` (reimplements `computeWallAreaWithDeductions`), `ExcavationCalculator`, `ExcavationSlopeCalculator`, `FenceCalculator`, `TerrainSlopeCalculator`, `BrickCourseCalculator` (not registered in the catalog at all).

**Fix:** for every fork, delete the local copy and import the catalog function. Add a test asserting page-level and catalog-level outputs match for a shared set of sample inputs (this single test class would have caught most of these).

### Pattern B — Ghost metadata
Rich `help`/`standards`/`safetyCritical` content is authored in the `COMPUTABLE` array but the page never calls `catalogHelpToContent()` / never passes `helpContent` to `CalculatorPage`, so it's dead data the user never sees — including, in one case, a `safetyCritical: true` disclaimer.

Confirmed instances: `MixRatioCalculator`, `ConcreteCalculator`, `CeilingInsulationCalculator`, `ReinforcementCalculator` (no help drawer despite `safetyCritical: true`), `ExcavationCalculator`/`ExcavationSlopeCalculator` (the latter is flagged `safetyCritical: true` with an AT-vejledning citation that never reaches the user).

**Fix:** add a lint/test that every `COMPUTABLE` entry with `help` defined has a corresponding page that imports `catalogHelpToContent`.

### Pattern C — Cosmetic "Advanced" mode
The Basic/Advanced toggle exists and reveals extra inputs, but the calculation doesn't gain real rigor — it's decoration.

Confirmed instances: `RafterCalculator` (`safetyCritical`+`modes:'both'` declared, but pure geometry, no load check), `GutterCalculator` (downpipe-placement toggle is "informativt" only, despite materially affecting real capacity), `DuctSizingCalculator` (Advanced = duct-type label only, no pressure-loss model), `VentilationFlowCalculator` (per-room presets feed the compliance meter but never the headline result). Several safety/compliance-relevant calculators have **no** Advanced mode at all despite being prime candidates: `WaterFlowCalculator`, `UnderfloorHeatingCalculator`, `LightingCalculator`, `BrickCourseCalculator`.

**Fix:** treated case-by-case in §6 Phase 2 — this is the core of "reach engineering level."

### Pattern D — Secondary check computed but not decisive
A calculator computes a real secondary pass/fail check, but doesn't merge it into the headline verdict the user actually reads (the "green banner").

Confirmed instances: `StairCalculator` (headroom/frihøjde computed, excluded from `isCompliant`), `RampCalculator` (landing/repos interval never computed, so long ramps at exactly 1:20 show "Tilgængelig: Ja"), `DrainSlopeCalculator` (per-material `minSlope` shown in the UI but the pass/fail badge uses a different, hardcoded 2.0% threshold), `ColumnLoadCalculator` (the *only* check shown — Euler buckling — can read "Sikker" while a plain crushing/yield check would fail; there is no resistance check to disagree with it).

**Fix:** highest priority in §3 — these are the bugs most likely to make a user trust a wrong answer.

### Pattern E — Internal standard-value inconsistency
The app cites conflicting numbers for the *same* rule in different files.

Confirmed instances: DS 432 minimum drainage fall — `STANDARDS_CATALOG.drainage` says "1:40 (25‰)" = 2.5%, `computeDrainDrop` checks `>= 2.0`, and `DrainSlopeCalculator.tsx` itself states "1:40 (20‰ = 2%)" (1:40 is actually 2.5%, not 2% — a math error independent of which threshold is correct). BR18 §258 is cited for three unrelated rules across three files (energy frame U-value target, minimum flat-roof fall, and — via `STANDARDS_CATALOG.energy` — an annual-energy-frame clause attached to an instantaneous-only heat-loss tool). Timber elastic modulus is 11 GPa in some files, "12e9" in a code comment elsewhere. `TerrainSlopeCalculator`'s own default (20‰) contradicts the 25‰ it cites.

**Fix:** a small script/test that greps every `code`/`clause` pair across `calculatorCatalog.ts` + all page files and flags duplicates with different associated numeric thresholds.

### Pattern F — Whole safety domain missing from `STANDARDS_CATALOG`
Excavation/trench safety (Arbejdstilsynet's AT-vejledning on trench shoring) has **no domain entry** in `STANDARDS_CATALOG` at all, unlike statics/electrical/water/drainage/heating/energy/moisture/ventilation/geometry/quantities/concrete/timber. It's hand-typed inconsistently per page instead.

**Fix:** add an `excavation` (or `geotechnical`) domain to `STANDARDS_CATALOG`, per §6 Phase 1.

---

## 3. Consolidated bug list (prioritized)

**Tier 1 — can produce an actively wrong "safe/compliant" verdict:**

1. `pages/calculators/StatiskeBeregninger/ColumnLoadCalculator.tsx` — verdict is based solely on Euler elastic buckling (`computeColumnLoad`, `calculatorCatalog.ts:700-712`); there is no compressive-stress/crushing check, so a short, stocky column (small L → Pcrit→∞) always shows a large, "safe" ratio even if plain N/A exceeds the material's actual strength.
2. `services/calculatorCatalog.ts:1097-1098,1115` (`computeLoanAmortization`) — ÅOP is finalized as `rApr·12·100` (nominal annualization) instead of the legally-required effective annual rate `((1+rApr)^12−1)·100`; it also defaults to the raw nominal rate whenever no admin fee is set (i.e. always in Basic mode), understating the true ÅOP purely by ignoring monthly compounding.
3. Danish DS 432 drainage-slope inconsistency, three-way: `STANDARDS_CATALOG.drainage` (`calculatorCatalog.ts:164`) says 2.5% (1:40); `computeDrainDrop` (`calculatorCatalog.ts:892`) checks `>= 2.0`; `pages/calculators/VVS/DrainSlopeCalculator.tsx:13-14,32,40,116,154` states "1:40 (20‰=2%)" — a math error, since 1:40 = 25‰ = 2.5%. The same page also shows a per-material `minSlope` (PVC/PE 2.0%, cast-iron 1.5%) in the UI that the pass/fail badge ignores, so the meter and the badge can visibly disagree.
4. `pages/calculators/HVACVentilation/VentilationFlowCalculator.tsx:69-82` — the room-type preset's absolute minimum L/s (e.g. 20 L/s for a kitchen) only feeds the compliance meter, never `results.lps`, so an under-sized value can be saved/exported to a project report while only the on-screen colour warns otherwise. Compounded by `computeVentilationFlow` (`calculatorCatalog.ts:903`) itself: it *sums* `0.3×area + 7×persons` rather than taking the greater of the two, inconsistent with `ExhaustFanCalculator`'s own (correct) `Math.max()` pattern.
5. `pages/calculators/Trapper/StairCalculator.tsx:73-105,258` — headroom (`headroomOk`) is computed but never merged into `results.isCompliant`; the compliance banner can read "Trappen overholder reglerne" while frihøjde actually fails BR18 §65.
6. `pages/calculators/Trapper/RampCalculator.tsx` — `accessible` only checks slope ratio; landing/repos interval is never computed, so a very long ramp at exactly 1:20 (e.g. 60 m for a 3 m rise) reports "Tilgængelig: Ja" though it would fail in practice without landings.
7. `pages/calculators/Trapper/StairStringerCalculator.tsx:52` — throat formula computes `b − r·cosα − g·sinα`, which algebraically reduces to `b − 2rg/d`, not the correct `b − rg/d` (since `cosα=g/d`, `sinα=r/d`, both terms equal `rg/d`). With defaults (r=18, g=25, b=28 cm) this reports a stringer as inadequate (clamped to 0) when the correct throat is ~13.4 cm — a normal, adequate width. Conservative direction (false negative), but a real formula bug; the help text's own formula (line 24) doesn't match the code either.

**Tier 2 — wrong number, not (yet) tied to a pass/fail verdict:**

8. `pages/calculators/HVACVentilation/AirChangeCalculator.tsx:246` — Advanced-mode CO₂ ppm estimate overstates steady-state rise by ~3.6× (unit-mixing error; should be `20000/(V·ACH)`, not `20/(V·ACH)·1000·3.6`).
9. `pages/calculators/HVACVentilation/DuctSizingCalculator.tsx:249-252` — "equivalent rectangular duct area" is computed in mm² but labeled cm² (100× too large).
10. `services/calculatorCatalog.ts:559` (`computeBackfill`) — `excess = excavatedVol(in-situ) − looseNeeded(loose)` mixes in-situ and loose-measure volumes without applying swell, understating leftover soil needing haul-away by roughly the swell %.
11. `services/calculatorCatalog.ts:462` (`computeBrickBlock`) — `mortarVolume = wallArea × 0.0175` ignores the `brickLmm`/`brickHmm`/`jointMm` parameters entirely; changing brick size or joint thickness in the UI has zero effect on the mortar quantity.
12. `pages/calculators/VaeggeSkillevaegge/PaintEstimatorPro.tsx:263` — window/door opening-deduction sizes (1.5 m² / 2.0 m²) are hardcoded, not shown or editable — silently under-deducts rooms with large glazing/patio doors.
13. `services/calculatorCatalog.ts:396-401` (`computeWoodFloor`) — the first/last-row split can produce rows below its own 50 mm minimum for certain narrow-plank/remainder combinations (e.g. plankWidth=70 mm, remainder=0 → 35 mm rows).
14. `pages/calculators/GulveOverflader/ScreedCalculator.tsx:41` — displayed report formula text says 72 bags/m³; the actual computation (and the catalog's own documented formula) uses 80 bags/m³. The number shown to the user is correct; the self-documented method text is wrong.
15. `pages/calculators/DoereVinduer/WindowAreaCalculator.tsx:109-113` vs `calculatorCatalog.ts:2453` — the daylight-ratio input is labeled "Hulmål" (rough opening) while the catalog's own assumption text says "glasareal (ekskl. karm)"; using rough-opening dimensions overstates BR18 §373 daylight compliance by roughly 15–25%.
16. `pages/calculators/Udenomsarealer/TerrainSlopeCalculator.tsx:9,43` — default value and tooltip recommend 20‰ (2.0%), directly contradicting the 25‰ (2.5%) DS 432 minimum the same tool's catalog entry cites — the shipped default itself would produce a non-compliant design. The tool also doesn't distinguish "slope away from foundation for drainage" (wants ≥2.5%) from "accessible path/ramp slope" (wants ≤5%, ideally ≤2%) — opposite design intents under one generic label.
17. `pages/calculators/Udenomsarealer/FenceCalculator.tsx` / `computeFence` (`calculatorCatalog.ts:662`) — "Stolpebredde" (post width) is collected and displayed but has zero effect on posts/panels/remainder in either the page or the shared function.
18. `pages/calculators/BetonArmering/ConcreteCalculator.tsx:25,68,239` — self-contradictory slab-thickness guidance: hint text recommends 150 mm minimum, but the warning banner only triggers below 100 mm and tells the user 100 mm is fine.
19. `services/calculatorCatalog.ts:2374` — formwork pressure standard cites "DS/EN 1992-1-1 EC2 §6.1" (concrete section resistance) — wrong clause; the relevant standard for fresh-concrete formwork pressure is EN 12812 / DIN 18218.
20. `pages/calculators/ArealRumfang/VolumeCalculator.tsx:32,52,85` vs `calculatorCatalog.ts:1986,1996` — cites BR18 "§179" for the room-height rule the catalog's own `rumfangsberegner` entry cites as "§431" — contradicting clause numbers for the same rule (and the page bypasses the catalog entry entirely).
21. `pages/calculators/LofterTag/RoofPitchCalculator.tsx:23` — cites "BR18 §258" for the 1:50 minimum flat-roof-fall rule; the app's own `STANDARDS_CATALOG.energy` (`calculatorCatalog.ts:170`) defines §258 as the *energy-frame* clause, not drainage/fall — likely a mis-cited paragraph.
22. `services/calculatorCatalog.ts:592-601` (`computeCircle`) — returns a positive area but negative circumference/diameter for a negative-radius input (no guard/clamp).
23. `pages/calculators/ArealRumfang/RoomAreaCalculator.tsx:145`, `Geometri/CircleCalculator.tsx:37`, `Geometri/PythagorasCalculator.tsx:36` — cast `meta?.help` directly to `HelpContent` instead of calling `catalogHelpToContent()`; the two shapes use different field names (`purpose` vs `formaal`, etc.), so the help drawer likely renders blank for these three tools.
24. `pages/calculators/LofterTag/BattenSpacingCalculator.tsx:27-62` vs `calculatorCatalog.ts:2230-2237` (`lofter-tag-laegter` → `computeBattenSpacing`) — page implements an entirely different eaves/ridge-offset algorithm with a different input schema than the routed catalog entry; anything calling `computeCalculator('lofter-tag-laegter', …)` gets a different, less accurate answer than the live page shows.
25. `pages/calculators/El/CableSizingCalculator.tsx:17` vs `calculatorCatalog.ts:865` — diverging resistivity constants (ρ=0.0172 vs 0.0175) between the page's inline voltage-drop calc and the (unused-by-any-page) `computeVoltageDrop`; neither corrects for real conductor operating temperature (should be ~0.0225 Ω·mm²/m at 70 °C per DS/HD 60364-5-52), understating worst-case drop by ~25–30%.
26. `pages/calculators/HVACVentilation/AirChangeCalculator.tsx:71` vs `:181` — cites BR18 §425–§445 in the help drawer and §§473–474 in the hero hint for the same rule.
27. `pages/calculators/EnergiKlima/HeatLossCalculator.tsx:437-439` — the "Temperaturprofil (Glaser-kurve)" chart plots temperature only; a real Glaser curve requires the vapour-pressure profile vs. saturation-pressure profile — the label overclaims what's actually being checked for interstitial condensation.
28. `pages/calculators/EnergiKlima/Co2Calculator.tsx:403` — a percentage display divides by zero (→ NaN%) when all weight/GWP factors sum to zero. Cosmetic, no crash.
29. `pages/calculators/UdgravningJord/ExcavationCalculator.tsx:24-26` — calls `computeExcavation` (which returns a soil-typed swell % from `SOIL_SWELL`) then discards the result in favor of a generic free-text override; no soil-type selector exists in the UI at all despite the catalog declaring one as an `advanced`-mode input.
30. `pages/calculators/UdgravningJord/ExcavationSlopeCalculator.tsx` — bypasses `calculatorCatalog.ts` entirely; the catalog's `safetyCritical: true` flag and AT-vejledning D.2.17 citation for this exact tool never reach the rendered page.
31. `services/calculatorCatalog.ts:528` (`SOIL_SWELL`) — `rock: 30%` is at the low end for blasted rock (commonly 30–60%+ depending on fragmentation); presented as one fixed figure with no range/caveat.
32. `pages/calculators/StatiskeBeregninger/RoofSnowLoadCalculator.tsx` (diagram, ~line 170/386) — the 3D visualization displays the raw characteristic ground value `sk` labeled as the roof's snow load, while the results panel correctly shows the shape/exposure/thermal-adjusted `sd = μ1·Ce·Ct·sk`. Cosmetic, but can misinform a user reading the diagram alone.
33. `services/calculatorCatalog.ts` doc-comment for `computeColumnLoad` ("Timber ≈ 12e9" Pa) vs. `ColumnLoadCalculator.tsx`/`DeflectionCalculator.tsx` (both use 11 GPa, the more defensible EC5 C24 value) — stale doc comment, not a logic bug.
34. `pages/calculators/LofterTag/RoofingMaterialCalculator.tsx:30-63` — the calculation `useEffect` has no `else` branch; clearing an input leaves the previous (now stale) result on screen instead of resetting.

**Dead code:**
- `pages/calculators/RoomAreaCalculator.tsx` (top-level) is confirmed unused — nothing imports it; the live, routed calculator is `pages/calculators/ArealRumfang/RoomAreaCalculator.tsx`. Recommend deletion.
- `BrickCourseCalculator.tsx` has no `COMPUTABLE` registry entry, no help drawer, no standards — unlike every sibling in its category.

---

## 4. Per-category audit detail

Full agent findings, lightly cleaned up. "Gap" = distance to genuine engineering-level rigor for that domain; "Correctness" already accounts for the bugs listed in §3 (not repeated in full here — see file:line above).

### 4.1 Statiske Beregninger (structural) — highest priority

| Calculator | What it computes today | Gap to Eurocode-compliant engineering level |
|---|---|---|
| BeamLoadCalculator | Mmax/Vmax, simply-supported, point or UDL — correct | No cross-section resistance (Mrd/Vrd), no γM |
| WindLoadCalculator | ½ρv²Cp + advanced terrain exposure ce(z) — correct simplified form | No full qp(z) peak pressure, no cpe zone tables, no cscd |
| BearingWallCalculator | Self-weight + applied load (kN/m) — correct arithmetic | No resistance side at all — needs EC6 NRd=Φ·t·fk/γM |
| ColumnLoadCalculator | Euler Pcrit, pinned-pinned only | **No crushing/yield check** (Tier-1 bug, §3.1); needs EC3/EC5 buckling curves + K-factor options |
| DeflectionCalculator | δ=5qL⁴/384EI vs L/300, L/400 — correct formula | Missing L/360; no EC5 creep (kdef) for timber |
| FoundationCalculator | A=N/q simple division | Needs EC7 qult=c'Nc+q'Nq+0.5γB'Nγ, eccentricity, partial factors |
| SlabLoadCalculator | Ed=γG·Gk+γQ·Qk computed, never used further | Needs flexural/punching-shear design (EC2 §6.4.3) |
| RoofSnowLoadCalculator | μ1 shape coefficient matches EC1-1-3 Table 5.2 exactly — correct | Only uniform load; no drift/accumulation case (Annex B) |

**New calculators proposed:** timber joist/rafter span-table lookup (EC5), steel beam/section selector (EC3), masonry/timber wall buckling check (EC6/EC5), retaining-wall stability (EC7), EC0 load-combination generator (ψ0/ψ1/ψ2 across simultaneous actions).

### 4.2 Beton & Armering (concrete & reinforcement)

| Calculator | Correctness | Gap |
|---|---|---|
| ConcreteCalculator | Correct volumes; self-contradictory thickness guidance (§3.18) | No EC2 mode |
| MixRatioCalculator | Correct via `computeMixRatio`; disclaimer authored but not rendered (§3, Pattern B) | Nominal ratios only, no DS/EN 206 mix design |
| ReinforcementCalculator | Correct d²/162 formula but forked from catalog (Pattern A); no wastage input; no help drawer despite `safetyCritical:true` | **Biggest gap in the app**: pure quantity takeoff at user-chosen spacing — cannot derive required As from a design moment, no ρmin/ρmax, no cover/exposure-class check |
| FoundationBlocksCalculator | Best-practice example — correct, fully wired to catalog + standards + disclaimer | Quantity-only; no frost-depth/bearing check |
| FormworkCalculator | Correct area formula but forked (Pattern A); drops wastage; wrong EC2 clause cited (§3.19) | No pressure/prop-spacing check |

**New calculators proposed:** EC2 required-reinforcement (As) design calculator (the single highest-value structural addition), concrete curing/maturity-method strength estimator, EC7 retaining-wall/bearing-capacity check.

### 4.3 El (electrical)

| Calculator | Correctness | Gap |
|---|---|---|
| CableSizingCalculator | Forked resistivity constant (§3.25) | No temperature-corrected ρ, no ambient/grouping derating tables, no 3-phase mode |
| FuseSizingCalculator | In≥IB×1.25, Iz≥In logic correct; own ampacity table independent of Cable calc's | No Icc/breaking-capacity check (honestly disclosed as out of scope) |
| CircuitLoadCalculator | Arithmetic correct | "Samtidighedsfaktor" is a bare numeric input with no Danish demand-factor presets |
| LightingCalculator | Matches `computeLightingLayout` exactly | No Advanced mode at all; room utilization factor (UF) omitted, implicitly assumes UF=1 |
| SolarPanelCalculator | Grid-packing arithmetic correct | Zero edge/margin setback (disclosed); flat 900 kWh/kWp yield, no tilt/orientation |
| SolarRoiCalculator | Payback loop sound | No panel degradation (~0.5%/yr), overstates 30-yr lifetime savings |

**New calculators proposed:** earth-fault loop impedance (Zs) vs. disconnection time per DS/HD 60364-4-41 (most safety-critical gap in this category), short-circuit/breaker discrimination (Icc/Icu), EV-charger circuit dimensioning.

### 4.4 VVS (plumbing/heating)

| Calculator | Correctness | Gap |
|---|---|---|
| BoilerSizingCalculator | Advanced mode correctly implements DS 418 transmission+infiltration, but duplicated inline instead of calling `computeHeatLoss` | No DHW load, no solar/internal gains offset |
| RadiatorSizingCalculator | ΔT/50 exponent (EN 442) correct | Advanced mode only rigorous on the output side — demand side is still a flat W/m³ rule of thumb |
| DrainSlopeCalculator | Formula correct | **Tier-1 bug** (§3.3): DS 432 threshold inconsistency + ignored per-material minSlope |
| PipeSizingCalculator | Continuity + Darcy-Weisbach correct, DS 439 2.0 m/s enforced | No DS 439 simultaneous-demand (fixture-unit) method for multi-fixture mains |
| WaterFlowCalculator | Math correct | Cites DS/EN 806-3 velocity range but never checks it — no Advanced mode |
| UnderfloorHeatingCalculator | Correct, loop-split logic actually works | No Advanced mode; no pump-head/flow-balancing check |

**New calculators proposed:** pipe pressure-loss/pump-head (system curve) calculator, DS 439 fixture-unit multi-fixture supply sizing, heat-pump COP/sizing calculator (high relevance to the current DK retrofit/subsidy market).

### 4.5 HVAC / Ventilation

| Calculator | Correctness | Gap |
|---|---|---|
| VentilationFlowCalculator | **Tier-1 bug** (§3.4): sum-not-max formula + preset ignored in headline result | Advanced mode's room presets are cosmetic |
| ExhaustFanCalculator | Correctly uses `Math.max()` pattern — the category's best example | Duct-run static-pressure derating not modeled |
| DuctSizingCalculator | Diameter arithmetic correct; unit-label bug (§3.9) | No pressure-loss/fitting-loss model anywhere; any velocity accepted, only a colour warns |
| AirChangeCalculator | Core V×ACH correct; CO₂ ppm bug (§3.8); BR18 clause self-contradiction (§3.26) | No transient/decay model |

**New calculators proposed:** duct pressure-loss/fan static-pressure calculator, balanced ventilation w/ heat-recovery efficiency & energy savings, kitchen extraction hood (emhætte) sizing.

### 4.6 Energi & Klima

| Calculator | Correctness | Gap |
|---|---|---|
| DewPointCalculator | Magnus-Tetens formula exactly correct; Advanced fRsi logic correctly reproduces ISO 13788 Method A | Surface condensation only — no interstitial (Glaser method) check |
| HeatLossCalculator | U×A×ΔT correct; thermal-bridge add-on correctly implemented | Instantaneous transmission only — no ventilation loss, no annual energy-frame balance; "Glaser-kurve" chart mislabels a temperature-only plot (§3.27) |
| Co2Calculator | Embodied-carbon math (E=m×f_GWP) correct, good lifecycle-stage taxonomy | Not normalized by floor area/50-yr reference period, so not comparable to the actual statutory kg CO₂e/m²/year metric |

**New calculators proposed:** full Glaser-method interstitial condensation calculator (the largest gap shared across two tools), annual heat-loss/energy-frame estimator (transmission+ventilation+gains), BR18 climate-footprint normalizer for Co2Calculator.

### 4.7 Døre & Vinduer

| Calculator | Correctness | Gap |
|---|---|---|
| EscapeWindowCalculator | Thresholds match standard DBI/SBi redningsåbning practice | Doesn't derate for sash type (top-hung/tilt-turn have smaller effective clear opening) |
| UValueCalculator | Correct simplified EN ISO 10077-1 (Uw from Ug/Uf), honestly discloses missing ψg | Missing ψg·lg edge-of-glass term entirely; single hardcoded 1.2 W/m²K limit shown without caveat |
| WindowAreaCalculator | Ratio math correct | **Bug** (§3.15): hulmål-vs-glasareal mismatch overstates daylight compliance |
| DoorSizeCalculator | Module table matches real Danish DVH sizes | Static 5-entry list, no M20 variant, no accessibility (§61) check |

**New calculators proposed:** full 3-term EN ISO 10077-1 whole-window Uw, window acoustic (Rw) estimator, glazing condensation-risk (fRsi) check.

### 4.8 Lofter & Tag

| Calculator | Correctness | Gap |
|---|---|---|
| RafterCalculator | Geometry (rafter length, ridge height, count) all correct | `safetyCritical`+`modes:'both'` declared but pure geometry — no load/cross-section check despite `computeSnowLoad`/`computeWindLoad`/`computeBeamLoad` already existing unused in the catalog |
| GutterCalculator | Q=A×I hydraulics correct | No climate-change rainfall-intensity factor; downpipe-placement toggle is cosmetic (§3, Pattern C) |
| BattenSpacingCalculator | Page's own algorithm is sound in isolation | **Formula fork** vs. its own catalog route (§3.24) |
| CeilingInsulationCalculator | Matches `computeInsulationBatts` | No wastage input; BR18 §258/DS 418 content authored but unrendered (Pattern B) |
| RoofPitchCalculator | Trig fully correct | Mis-cited BR18 clause (§3.21) |

**New calculators proposed:** EC5 rafter/purlin bearing-capacity check (wiring the catalog's already-existing but unused load functions), downpipe sizing paired to gutter flow, hip/valley roof area with cutting-waste multiplier.

### 4.9 Vægge & Skillevægge

| Calculator | Correctness | Gap |
|---|---|---|
| StudWallCalculator | Correct quantity takeoff | Pure QTO, **no EC5 load-bearing check** — page title doesn't warn users away from load-bearing use, a common DIY mistake |
| BrickBlockCalculator | Brick-count math correct, realistic DK module dims | **Bug** (§3.11): mortar volume ignores brick/joint inputs entirely |
| WallInsulationCalculator | Batt-count math correct | BR18 §258 U-value target cited but never verified against actual thickness/λ |
| PaintEstimatorPro | Aggregation logic correct | **Bug** (§3.12): hardcoded, non-editable opening deductions |
| BrickCourseCalculator | Module math correct (dk_normal preset = 200mm/3 skifter, accurate) | Not registered in the catalog at all — no help/standards (dead-code-adjacent) |

**New calculators proposed:** load-bearing stud/timber wall EC5 check (reusing existing but unwired `computeColumnLoad`/`computeBeamLoad`), masonry wall EC6 slenderness/buckling check, partition U-value/acoustic (Rw) rating estimator.

### 4.10 Gulve & Overflader

| Calculator | Correctness | Gap |
|---|---|---|
| ScreedCalculator | Correct number shown; **doc-text bug** (§3.14) in the report's formula string | No moisture-readiness/drying-time (RH%) check before covering — biggest real-world floor-covering failure mode, entirely absent |
| WoodFloorCalculator | Layout algorithm mostly sound | **Bug** (§3.13): can produce sub-50mm sliver rows for narrow planks |
| FloorInsulationCalculator | Board-count math correct | BR18 §258 U-value cited but never computed from thickness+λ |
| TileQuantityCalculator, CarpetLaminateCalculator | Correct, honestly hedge "no legal standard" | No movement-joint/trinlyd guidance |

**New calculators proposed:** floor-screed drying-time/moisture-readiness estimator, self-leveling compound quantity calculator, moisture-barrier (damp-proof membrane) roll sizing.

### 4.11 Trapper (stairs/ramps)

| Calculator | Correctness | Gap |
|---|---|---|
| StairCalculator | Blondel formula correct | **Tier-1 bug** (§3.5): headroom not merged into verdict; forks `computeStairGeometry` (imported, never called) |
| RampCalculator | `computeRampLength` verified correct | **Tier-1 bug** (§3.6): landing/repos interval never computed |
| StairStringerCalculator | Hypotenuse/angle correct | **Tier-1 bug** (§3.7): throat formula double-subtracts a term |

**New calculators proposed:** standalone headroom/clearance checker, ramp landing-interval calculator (BR18 §81), spiral staircase (vindeltrappe) calculator.

### 4.12 Udgravning & Jord

| Calculator | Correctness | Gap |
|---|---|---|
| ExcavationCalculator | Correct arithmetic | Discards the catalog's soil-typed swell%, no soil selector in the UI (Pattern A/C) |
| ExcavationSlopeCalculator | Trapezoid math correct | Bypasses the catalog entirely — `safetyCritical:true` + AT-vejledning citation never reach the page (Pattern B) |
| BackfillCalculator | Best-integrated of the three | **Bug** (§3.10): fast/loose unit mismatch in `computeBackfill` |

**New calculators proposed:** trench-shoring/support requirement checker (Arbejdstilsynet depth thresholds — closes a real worker-safety compliance gap present in zero current tools), cut-and-fill earthwork balance calculator, dewatering pump sizing.

### 4.13 Udenomsarealer

| Calculator | Correctness | Gap |
|---|---|---|
| PavingCalculator | Correctly wired to catalog + DS 432/BR18 — best example in this category | No traffic-class selector (same sub-base depth for a garden path and a driveway) |
| FenceCalculator | Posts/panels math consistent | **Bug** (§3.17): post-width input has no effect anywhere; no wind-load/frost-depth guidance |
| TerrainSlopeCalculator | Conversion arithmetic correct | **Bug** (§3.16): self-contradictory default vs. cited standard; conflates drainage-slope and accessible-path-slope intents |

**New calculators proposed:** traffic-class sub-base thickness sizing, faskine/soakaway sizing per DS 432, retaining garden wall (støttemur) basic stability check.

### 4.14 Pris & Budget

| Calculator | Correctness | Gap |
|---|---|---|
| FinancingCalculator | **Tier-1 bug** (§3.2): ÅOP miscalculated | No loan-type comparison (realkredit vs. banklån), no rentefradrag view |
| BudgetCalculator | Correct, but contingency-on-(subtotal+overhead) compounding is a modeling choice worth flagging to users | No staged/phased cash flow |
| LaborCostCalculator, MaterialCostCalculator | No issues found | No per-trade rate tiers, no bulk-discount/price-index adjustment |

**New calculators proposed:** staged-payment/cash-flow planner across build phases, contractor break-even/margin calculator, energy-renovation subsidy ROI (Bygningspuljen/BoligJob-ordning).

### 4.15 Areal & Rumfang / Geometri

| Calculator | Correctness | Gap |
|---|---|---|
| RoomAreaCalculator (live, `ArealRumfang/`) | Correct L-shape math | **Bug** (§3.23): help-content cast bug; `modes:'both'` declared but Advanced mode is a no-op (no height/slope input) |
| VolumeCalculator | Correct L×W×H | **Bug** (§3.20): contradicting BR18 clause vs. catalog |
| WallAreaCalculator | Correct, honestly non-regulatory | Aggregate-wall model only, can't place openings per individual wall |
| CircleCalculator, PythagorasCalculator | Correct math | **Bug** (§3.22, §3.23): negative-radius guard missing; help-content cast bug; Pythagoras never compares computed `c` to an actual site measurement |
| MaterialVolumeCalculator | Correct but a strictly weaker duplicate of `computeConcreteVolume`'s slab case | Candidate for deletion/merge |

**Dead code confirmed:** `pages/calculators/RoomAreaCalculator.tsx` (top-level, unrouted) — see §3.

**New calculators proposed:** BR18 Bilag A precise etageareal calculator with the 1.5m/2.3m skunk-height rule actually enforced (currently only *cited*, never computable anywhere in the app), stair-void/opening floor-area deduction, hip/valley roof area with cutting waste.

---

## 5. New calculator proposals (grouped, prioritized)

**P1 — closes a safety/compliance gap that exists in zero current tools:**
- Earth-fault loop impedance (Zs) vs. disconnection time — DS/HD 60364-4-41 (El)
- Trench shoring/support requirement checker — Arbejdstilsynet AT-vejledning (Udgravning & Jord)
- EC2 required-reinforcement (As) design calculator — from Msd to bar selection (Beton & Armering)
- Headroom/clearance (frihøjde) standalone checker + ramp landing-interval calculator (Trapper)
- BR18 Bilag A precise etageareal calculator (enforces the skunk-height rule the app already cites but never computes) (Areal & Rumfang)

**P2 — closes the biggest engineering/analysis gap per domain:**
- Timber joist/rafter span-table lookup (EC5) and steel beam/section selector (EC3) — closes the load-vs-resistance gap running through all of Statiske Beregninger
- Masonry/timber load-bearing wall buckling & slenderness check (EC6/EC5) — ties BearingWallCalculator + StudWallCalculator together
- Full Glaser-method interstitial condensation calculator (DS/EN ISO 13788)
- Annual heat-loss/energy-frame estimator (transmission + ventilation + gains, Be18-aligned)
- Pipe pressure-loss/pump-head and DS 439 fixture-unit multi-fixture supply sizing (VVS)
- Duct pressure-loss/fan static-pressure calculator (HVAC)
- Short-circuit/breaker discrimination check (El)

**P3 — high market relevance / rounds out the catalog:**
- Heat-pump COP/sizing calculator (DK retrofit market)
- EV-charger circuit dimensioning (El)
- Full EN ISO 10077-1 whole-window Uw calculator; window acoustic (Rw) estimator (Døre & Vinduer)
- Retaining wall/foundation bearing-capacity (EC7) (Statiske Beregninger / Udgravning)
- Traffic-class paving sub-base sizing; faskine/soakaway sizing (Udenomsarealer)
- Floor-screed drying-time/moisture-readiness estimator (Gulve & Overflader)
- BR18 climate-footprint normalizer for Co2Calculator (Energi & Klima)

**P4 — nice-to-have, lower urgency:**
- Concrete curing/maturity-method strength estimator
- Spiral staircase calculator
- Contractor break-even/margin calculator; staged cash-flow planner; energy-renovation subsidy ROI
- Kitchen extraction hood sizing; balanced-ventilation heat-recovery savings calculator
- Cut-and-fill earthwork balance; dewatering pump sizing
- Glazing condensation-risk (fRsi) checker; retaining garden wall check

---

## 6. Phased roadmap

### Phase 0 — Bug fixes (do first, regardless of everything else)
Fix all 34 items in §3, in the listed priority order. Every fix is mechanical and independently testable: correct a constant, merge a secondary check into a verdict, fix a mislabeled unit, or swap a local formula for the catalog import. No new UI, no new standards research needed — the correct values are already known (either from the catalog's own conflicting entry, or from the standard the tool already cites).
- **Effort:** small per item; ~34 small PRs or a few batched-by-category PRs.
- **Risk:** low — these are corrections toward each tool's own stated intent, not behavior changes users would object to.
- **Verification:** extend `services/calculatorCatalog.test.ts` with one regression test per fixed bug (known-good input → corrected output), run `npx vitest run services/calculatorCatalog.test.ts && npx tsc --noEmit`.

### Phase 1 — Architecture hygiene (prevents the next 34 bugs)
1. Eliminate every Pattern-A formula fork: delete the local copy, import the catalog function (`BattenSpacingCalculator`, `CableSizingCalculator`, `VolumeCalculator`, `ReinforcementCalculator`, `FormworkCalculator`, `StairCalculator`, `PaintEstimatorPro`, `ExcavationCalculator`, `ExcavationSlopeCalculator`, `FenceCalculator`, `TerrainSlopeCalculator`).
2. Wire every Pattern-B "ghost metadata" page to `catalogHelpToContent()` (`MixRatioCalculator`, `ConcreteCalculator`, `CeilingInsulationCalculator`, `ReinforcementCalculator`, `ExcavationCalculator`, `ExcavationSlopeCalculator`), and register `BrickCourseCalculator` in `COMPUTABLE`.
3. Delete the dead top-level `pages/calculators/RoomAreaCalculator.tsx`.
4. Add an `excavation`/`geotechnical` domain to `STANDARDS_CATALOG` (closes Pattern F) with the AT-vejledning trench-safety citation, and apply it consistently across the three Udgravning & Jord tools.
5. Add two new test classes to `calculatorCatalog.test.ts` / a small script:
   - **Fork-detection test:** for each page that has a catalog counterpart, assert page-computed and catalog-computed results match for a shared input set.
   - **Citation-consistency check:** grep all `{code, clause}` pairs across `calculatorCatalog.ts` and page files; flag any clause number that resolves to more than one plain-language rule (would have caught the §258 and DS 432 conflicts in §3 immediately).
- **Effort:** medium — touches ~15 files but each change is small and mechanical.
- **Risk:** low-medium (behavior changes slightly wherever a fork disagreed with the catalog — pick the catalog's value as canonical, since it's the one tested and reused elsewhere).
- **Verification:** full test suite + `tsc --noEmit` + manual click-through of the ~15 touched calculators in both Basic and Advanced mode.

### Phase 2 — Engineering-level Advanced mode, per domain (the core of the user's ask)
Tackle in this order — highest safety stakes and richest existing gap first:

1. **Statiske Beregninger:** add a resistance/capacity side to every calculator that currently only computes load. Concretely: `BeamLoadCalculator`/`ColumnLoadCalculator` gain a material+cross-section input (timber C24/C30, steel S235/S355, or concrete class) and output a utilization ratio Ed/Rd per EC2/EC3/EC5 with γM; `ColumnLoadCalculator` gets an explicit K-factor (end-condition) selector and a plain crushing/yield check alongside Euler buckling (fixes the Tier-1 bug at the same time); `DeflectionCalculator` adds L/360 and EC5 creep factor kdef for timber; `FoundationCalculator` moves from A=N/q to EC7's qult with eccentricity; `SlabLoadCalculator` adds a flexural/punching-shear check; `RoofSnowLoadCalculator` adds the EC1-1-3 Annex B drifted-load case. This is the single biggest lift in the plan — budget it as its own workstream.
2. **Beton & Armering:** give `ReinforcementCalculator` an EC2 design mode (input Msd → required As, ρmin/ρmax, then let the user pick bar size/spacing to match) — reuses the same resistance-check machinery built in step 1.
3. **El:** add temperature-corrected resistivity + ambient/grouping derating tables (DS/HD 60364-5-52 Tables B.52.14/17) shared between `CableSizingCalculator` and `FuseSizingCalculator`; add a 3-phase mode; add Zs/disconnection-time as an Advanced-mode extension where feasible.
4. **VVS / HVAC:** replace BoilerSizing/RadiatorSizing's demand-side rule-of-thumb with a call into the shared `computeHeatLoss`; fix the sum-vs-max ventilation formula and merge the preset minimum into the headline result (Phase 0 already fixes the worst of this, Phase 2 makes Advanced mode add pressure-loss modeling on top).
5. **Energi & Klima:** add the Glaser-method (DS/EN ISO 13788) interstitial condensation calculation as `DewPointCalculator`'s true Advanced mode; extend `HeatLossCalculator` toward an annual energy-frame estimate.
6. **Areal & Rumfang / Geometri:** implement the BR18 Bilag A skunk-height rule as a real input/output (currently cited everywhere, computed nowhere), fixing `RoomAreaCalculator`'s no-op Advanced mode along the way.
7. **Vægge & Skillevægge / Lofter & Tag:** wire the *already-existing* but unused `computeColumnLoad`/`computeBeamLoad`/`computeSnowLoad`/`computeWindLoad` functions into `StudWallCalculator` and `RafterCalculator` so their declared `safetyCritical`/`modes:'both'` metadata is finally backed by real load-bearing checks.
8. **Trapper / Udenomsarealer / Døre & Vinduer / Gulve & Overflader:** lower priority — these are regulatory-precision or quantity-modeling improvements rather than Eurocode design work; fold into general backlog after 1–7.
- **Effort:** large, multi-week; do as a sequence of small, reviewable PRs per calculator, not one big change.
- **Risk:** medium — new engineering formulas need careful validation (see §7) before being presented as authoritative.
- **Verification:** hand-calculated golden-value tests per new formula (see §7), plus the existing `npx vitest run` / `tsc --noEmit` / `eslint` gate from `docs/add-a-formula.md`.

### Phase 3 — New calculators
Build from the P1 list in §5 down, following the existing `docs/add-a-formula.md` recipe (pure function in the catalog → `COMPUTABLE` entry with standards/help → tests → page). Since several of the highest-value new tools (EC2 As design, EC5 span tables, EC3 section selector) directly reuse the resistance-check machinery from Phase 2, sequence them immediately after their corresponding Phase-2 domain lands.

### Phase 4 — Verification & sign-off
See §7 below — this phase runs continuously alongside 0–3, not after them.

---

## 7. Verification & sign-off strategy

- **Automated:** every new/changed formula gets a known-good (hand-calculable) test, a boundary test (zero/negative), and — per `docs/add-a-formula.md` — a wastage/mode-parity test where applicable. Run `npx vitest run services/calculatorCatalog.test.ts`, `npx tsc --noEmit`, `npx eslint` before every merge, exactly as the existing merge gate requires.
- **Fork/consistency tests (new, from Phase 1):** page-vs-catalog output equality test, and the clause-citation consistency check — both are cheap to run and catch the exact bug class that dominated this audit.
- **Manual:** click through Basic and Advanced mode for every touched calculator; confirm the PDF/report export text matches the on-screen formula (catches doc-text bugs like the Screed one in §3.14).
- **External domain sign-off — recommended before marketing anything as "engineering level":** the Phase 2 structural/electrical/VVS formulas should get a one-time review pass by a Danish autoriseret konstruktør, elektriker, and VVS-installatør respectively, *even though* the app's `SafetyDisclaimer` already states these tools don't replace certified engineering — BR18 legally requires certified sign-off for permit-triggering structural/electrical/plumbing work regardless of tool output, and an SME pass materially reduces the risk of a subtle formula error reaching a real building. This is a one-time cost per domain, not a per-calculation gate.
- **Position clearly, not just legally:** keep (and where new engineering-level modes ship, strengthen) the existing `SafetyDisclaimer` framing — "pre-dimensioning / decision support," not a certified calculation. This is already the app's own stated posture; Phase 2 doesn't change that posture, it just makes the pre-dimensioning more accurate.

---

## 8. Definition of done

- Phase 0: all 34 §3 bugs fixed, each with a regression test; `vitest`/`tsc`/`eslint` green.
- Phase 1: zero remaining Pattern-A forks in the 11 identified files; zero remaining Pattern-B ghost-metadata pages; dead code removed; `excavation` standards domain added; fork-detection and citation-consistency tests passing in CI.
- Phase 2: each domain's Advanced mode produces a genuine utilization ratio or standard-compliant check (not just more inputs), validated against at least 3 hand-calculated worked examples per new formula, reviewed by the relevant external SME once.
- Phase 3: P1-tier new calculators (§5) shipped and passing the same merge gate as any existing tool.
- Phase 4: ongoing — every future formula PR includes the fork/consistency tests from Phase 1 as part of its own merge gate going forward.
