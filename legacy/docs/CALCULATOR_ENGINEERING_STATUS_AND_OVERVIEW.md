# Calculator Engineering — Status & Capability Overview

**Living document.** Companion to `CALCULATOR_ENGINEERING_AUDIT_AND_UPGRADE_PLAN_2026-07-08.md` (the audit + full roadmap). This file tracks *what has been implemented* and holds the **engineering-capability overview** intended to be lifted into the app's in-app help section.

Last updated: 2026-07-08 · Verification: `tsc --noEmit` clean · **304 unit tests pass** · `eslint` clean · `vite build` succeeds.

---

## 1. Engineering-capability overview (app-help-ready)

> This table is the source for the app's help section. Each row = a calculator's *advanced/engineering* capability, the governing Danish/Eurocode standard, and the pass/fail check the user is shown. Keep it in sync when a new engineering mode ships.

### Statiske Beregninger (structural)

| Beregner | Ingeniør-tjek (avanceret) | Standard | Udnyttelse / pass-fail |
|---|---|---|---|
| Søjlebelastning | Knæk (buckling) **+ trykbrud (crushing)** → design-bæreevne N_b,Rd | DS/EN 1995-1-1 (EC5) · DS/EN 1993-1-1 (EC3) | Nd / N_b,Rd ≤ 1,0 |
| Bjælkeberegner | Bøjnings- **og forskydnings-bæreevne** Mrd/Vrd | EC5 / EC3 | max(Med/Mrd, Ved/Vrd) ≤ 1,0 |
| Nedbøjning | L/300–360–400 **+ EC5 krybning (kdef)** slutnedbøjning | EC5 §2.2.3 / EC3 §7.2 | w / (L/n) ≤ 1,0 |
| Fundamentstørrelse | EC7 kontakttryk m. **egenvægt + excentricitet** (effektiv bredde B′) | DS/EN 1997-1 (EC7) | σ / q ≤ 1,0 |
| Bærende væg | EC6 vertikal bæreevne N_Rd = Φ·t·f_d (**slankhed + excentricitet**, Annex G) | DS/EN 1996-1-1 (EC6) | N_Ed / N_Rd ≤ 1,0 |
| Dækbelastning | EC0 designlast (6.10) **+ EC2 nødvendig armering As** | EC0 · DS/EN 1992-1-1 (EC2) | As,krævet + min. As §9.2.1 |
| Tag-/snelast | Formfaktor μ1 **+ snelæ/ophobning (drift)** mod parapet | DS/EN 1991-1-3 §6 | s_drift vs. jævn last |
| Vindlast | Basistryk ½ρv² **+ terræneksponering ce(z)** | DS/EN 1991-1-4 | vindtryk vs. beklædningsgrænse |
| **Støttemur-stabilitet** *(ny)* | Rankine aktivt jordtryk → væltning / glidning / jordtryk | DS/EN 1997-1 (EC7) | FS_vælt ≥ 2 · FS_glid ≥ 1,5 |

### Lofter & Tag

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Spær-estimat | **EC5 bæreevnetjek**: spær som bjælke under (1,35·egenlast + 1,5·snelast) → Mrd/Vrd | DS/EN 1995-1-1 (EC5) | Med/Mrd ≤ 1,0 |

### Vægge & Skillevægge

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Skeletvæg | **EC5 bæreevnetjek**: stolpe som trykpåvirket søjle (last pr. stolpe = w·c/c) | DS/EN 1995-1-1 (EC5) | Nd/N_b,Rd ≤ 1,0 |

### Døre & Vinduer

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| U-værdi | **Fuldt vindue Uw** = (Ag·Ug + Af·Uf + lg·ψg)/Aw, inkl. glaskant-linjetab | DS/EN ISO 10077-1 | Uw ≤ BR18-krav |
| **Vinduets lydisolering (Rw)** *(ny)* | Rude-Rw og Rw+Ctr (trafikstøj) vs. facadekrav | DS/EN ISO 717-1 · BR18 §368 | Rw+Ctr ≥ facadekrav |

### El

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Kabelberegner | Spændingsfald m. **ledertemperatur (70 °C) + 1/3-faset**; kabel-**derating** (omgivelse × gruppering) | DS/HD 60364-5-52 | ΔU ≤ 4 % · In ≤ Iz |
| Sikringsberegner | In ≥ IB×1,25 **+ derating In ≤ Iz** (temperatur/gruppering) | DS/HD 60364-5-52 | In ≤ Iz (deratet) |
| **Fejlsløjfeimpedans (Zs)** *(ny)* | Automatisk afbrydelse: fejlstrøm + maks. Zs | DS/HD 60364-4-41 §411 | Zs ≤ U0/Ia |
| **Ladestander (elbil)** *(ny)* | Designstrøm → gruppeafbryder, kabel, HPFI-type (B / A+6mA) | DS/HD 60364-7-722 | In ≥ IB, korrekt RCD |

### Beton & Armering

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Armeringsstål | **EC2 armerings-DESIGN**: Med → nødvendig As, jern-eftervisning | DS/EN 1992-1-1 (EC2) | As,leveret ≥ As,krævet, K ≤ 0,167 |

### VVS

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Rørdimension | **Trykfald → pumpehoved** (Darcy–Weisbach + fittings) | DS 439 | hastighed ≤ 2,0 m/s |
| Kedelstørrelse | **Varmepumpe COP/drift**: SCOP → årligt elforbrug, driftsbesparelse & CO₂ | — (DS 469 for varmeanlæg) | besparelse vs. nuværende varmekilde |
| Vandflow | **Samtidig belastning (DS 439)**: belastningsenheder → design-flow qd | DS 439 / EN 806-3 | qd til rørdimensionering |

### HVAC / Ventilation

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Kanaldimension | **Trykfald → ventilator-statiktryk** (friktion + fittings) | DS 447 | hastighed ≤ 6 m/s |
| Udsugning | **Varmegenvinding (VGV)**: genvundet varme (η·flow·ρcp·ΔT) + SFP + årlig besparelse | BR18 (SFP ≤ 1800 J/m³) | SFP ≤ 1800 J/m³ |

### Energi & Klima

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Dugpunkt | **Glaser-metode: indvendig (interstitiel) kondens** gennem konstruktionen | DS/EN ISO 13788 | p_aktuel < p_mætning i alle grænseflader |
| Varmetab | **Årligt energibehov (energiramme)**: transmission + ventilation − tilskud → kWh/m²/år | DS 418 / Be18-lignende | vs. indikativ energiramme-reference |

### Gulve & Overflader

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Gulvafretning | **Tørretid før belægning** (bindemiddel + forhold) | Producent / SBi (RH-måling påkrævet) | måling < dæklags RH-grænse |

### Udenomsarealer

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Flisebelægning | **Bærelag efter trafikklasse** (stabilgrus + afretningssand + udgravningsdybde) | — (vejregler/branchevejl.) | tykkere base ved tungere last |
| **Faskine (nedsivning)** *(ny)* | Magasinvolumen fra opland + designregn − nedsivning | DS 432 + kommunal tilladelse | magasin/udgravning m³ |

### Pris & Budget

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| Projektbudget | **Betalingsplan / byggefaser** (trækplan pr. fase, akkumuleret) | AB-Forbruger / entrepriseaftale | faser summer til 100 % |

### Trapper & Adgang

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| **Vindeltrappe** *(ny)* | Effektiv trinbredde på gangkurven (400 mm fra kerne) + stigning | BR18 §64–§67 · SBi | grund ≥ 20 cm · stigning 15–21 cm |

### Udgravning & Jord

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| **Udgravning — sikkerhed** *(ny)* | Dybde+jordtype → lodret/skråning/afstivning | AT-vejledning D.2.17 | > 1,7 m kræver foranstaltning |

### Areal & Rumfang

| Beregner | Ingeniør-tjek | Standard | Pass-fail |
|---|---|---|---|
| **Skråtag / skunk** *(ny)* | Tællende gulvareal ved skråt loft (≥ 1,5 m) + fuld højde (≥ 2,3 m) | BR18 Bilag 1 · §431 | areal m. fuld højde til opholdsrum |

---

## 2. Implementation status

### ✅ Done & verified

- **Phase 0** — all ~34 correctness bugs fixed (all 7 Tier-1 wrong-verdict bugs), each with a regression test.
- **Phase 1** — formula forks eliminated, ghost help/standards metadata wired, `excavation` standards domain added.
- **Phase 2 (engineering modes)** — the 6 domains in §1 above: all 8 Statiske Beregninger calculators + El (Cable/Fuse) + Beton (Reinforcement) + VVS (PipeSizing) + HVAC (DuctSizing) + Energi (DewPoint).
- **Phase 3 (P1 new calculators)** — 3 new routed calculators: Fejlsløjfeimpedans (Zs), Udgravning-sikkerhed, Skråtag/skunk-areal.
- **Wave A (structural completeness)** — RafterCalculator EC5 sizing + StudWall EC5 load-bearing check.
- **Wave B (envelope & energy)** — whole-window Uw (EN ISO 10077-1) + annual energy-frame (Be18-aligned).
- **Wave C (building services)** — heat-pump COP/sizing/savings (BoilerSizing), balanced-ventilation heat-recovery/SFP (ExhaustFan), DS 439 fixture-unit demand (WaterFlow).
- **Wave D (quantities & finance)** — screed drying-time (ScreedCalculator), traffic-class sub-base (PavingCalculator), staged cash-flow / byggefaser (BudgetCalculator).
- **Cleanup** — deleted the dead unrouted top-level `pages/calculators/RoomAreaCalculator.tsx`.
- **Phase 3 P2–P4 new calculators** — 5 new routed calculators: EV-charger (DS/HD 60364-7-722), retaining-wall stability (EC7), faskine/soakaway (DS 432), spiral staircase (BR18/SBi), window acoustics Rw (EN ISO 717-1).

**Shared engineering functions added** (all in `services/calculatorCatalog.ts`, tested in `services/calculatorCatalog.test.ts`):
`computeColumnCapacity`, `computeBeamCapacity`, `computeDeflection` (extended), `computeFoundationBearing`, `computeMasonryWallCapacity`, `computeSlabDesignLoad`, `computeSlabFlexure`, `computeSnowDrift`, `computeVoltageDrop` (extended), `computeCableAmpacity`, `computeEarthFaultLoop`, `computeFlexuralReinforcement`, `computePipePressureLoss`, `computeDuctPressureLoss`, `computeGlaser`, `computeTrenchSafety`, `computeLoftArea`, `computeWindowUValue`, `computeAnnualEnergyFrame`, `computeHeatPumpSizing`, `computeHeatRecoveryVentilation`, `computeFixtureUnitDemand`, `computeScreedDryingTime`, `computePavingSubbase`, `computeStagedCashflow`, `computeEvCharger`, `computeRetainingWall`, `computeSoakaway`, `computeSpiralStair`, `computeWindowAcoustics` — plus material tables `COLUMN_MATERIALS`, `BEAM_MATERIALS`, `MASONRY_MATERIALS`, `COLUMN_END_CONDITIONS`. (**32 tested engineering functions total.**)

### ⏳ Remaining (long tail — see roadmap §5–6)

**The roadmap is essentially complete** — Phases 0–3 (P1 + P2–P4) and Waves A–D are all done and verified.

**Optional future polish (not blocking):**
- **Timber joist/rafter span tables (EC5) & steel section selector (EC3)** — a "smallest passing section for a given span+load" finder. The underlying check already exists and ships: `BeamLoadCalculator` lets a user verify a chosen section against a load via `computeBeamCapacity` (utilization Med/Mrd). A dedicated *auto-selector* page (iterate standard sections until one passes) would be a UX convenience on top of that — deferred as it duplicates the existing capability.
- Non-structural niceties from the audit's P3–P4 (e.g. glazing condensation fRsi, concrete maturity strike-time) remain candidates but are low priority.

New-calculator recipe (proven): page with inline `helpContent` + inline `reportData` standards → lazy import + `<Route>` in `App.tsx` → `LINK_ONLY` `{name, category, route, resultUnit}` in `calculatorCatalog.ts`. Reference the 5 P2–P4 pages just shipped (`EvChargerCalculator.tsx`, `RetainingWallCalculator.tsx`, `SoakawayCalculator.tsx`, `SpiralStairCalculator.tsx`, `WindowAcousticsCalculator.tsx`).

---

## 3. Notes for the in-app help section

- The §1 table is written in Danish (user-facing) and can be rendered directly.
- Every engineering mode already carries a `SafetyDisclaimer` and, via `InfoHint`, per-concept science explanations — the help section should reinforce, not replace, those.
- Legal framing to preserve: these tools are **pre-dimensioning / decision support**, not certified calculations. BR18 requires certified sign-off (autoriseret konstruktør/elinstallatør/VVS-installatør) for permit-triggering work regardless of tool output.
