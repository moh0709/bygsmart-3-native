# Calculator UX Template — Byggeapp 2.1

> **Platform baseline (Phase 3 complete — 2026-06-14):** All ~80 calculators now follow this pattern.
> The §7 checklist below is the mandatory standard for every calculator.

Phase 3 completes the full rollout. Use this as the checklist for every calculator (new or existing).

---

## Component inventory

| Component | Location | Purpose |
|---|---|---|
| `CalculatorPage` | `components/calculators/CalculatorPage.tsx` | Sticky header, back button, share, help-drawer wiring, sticky mobile result bar |
| `CalculatorModeToggle` | `components/calculators/CalculatorModeToggle.tsx` | Basic/Advanced mode toggle (persists in localStorage) |
| `HelpDrawer` | `components/calculators/HelpDrawer.tsx` | Right-side / bottom-sheet help panel (triggered by ? button) |
| `CalculatorHero` | `components/calculators/CalculatorHero.tsx` | Illustrated banner + info/compliance block |
| `InputField` | `components/calculators/InputField.tsx` | Decimal input with label, unit, and info tooltip |
| `SegmentedControl` | `components/calculators/SegmentedControl.tsx` | Animated tab/type selector |
| `ResultDisplay` | `components/calculators/ResultDisplay.tsx` | Result card with "Gem til Projekt" actions |
| `AnimatedNumber` | `components/calculators/AnimatedNumber.tsx` | 500 ms animated counter |
| `ResultGauge` | `components/calculators/ResultGauge.tsx` | Arc gauge and bar for visual scale |
| `ComplianceAlert` | `components/calculators/ComplianceAlert.tsx` | Pass/fail compliance card |
| `SafetyDisclaimer` | `components/calculators/SafetyDisclaimer.tsx` | Red engineer-verify banner for safety-critical tools |
| `RegulationSwitch` | `components/calculators/RegulationSwitch.tsx` | Toggle to activate compliance mode |
| `InfoTooltip` | `components/calculators/InfoTooltip.tsx` | Tap-to-open info popover |
| `CalculatorActions` | `components/calculators/CalculatorActions.tsx` | PDF export (landscape) + save to project |
| `AddToProjectModal` | `components/calculators/AddToProjectModal.tsx` | Save as purchase or task |
| `BreakdownDonut` | `components/calculators/viz/BreakdownDonut.tsx` | SVG donut chart for cost/material breakdown |
| `BreakdownBar` | `components/calculators/viz/BreakdownBar.tsx` | Horizontal stacked bar chart |
| `ComplianceMeter` | `components/calculators/viz/ComplianceMeter.tsx` | Pass/fail gauge against a threshold |
| `DimensionedShape` | `components/calculators/viz/DimensionedShape.tsx` | Annotated 2D/iso diagram |
| `ScaleComparator` | `components/calculators/viz/ScaleComparator.tsx` | Side-by-side size comparison |

---

## Page layout

```
<CalculatorPage title="…" stickyResultLabel="…" stickyResult={<AnimatedNumber …/>} shareValue="…">

  {/* 1. Type/mode selector (optional) */}
  <SegmentedControl … />

  {/* 2. Illustrated hero + compliance reference */}
  <CalculatorHero
    illustration={<svg …/>}
    hint="Plain-language guidance"
    complianceRef="BR18 §xxx, DS/EN …"
    accentFrom="#hex" accentTo="#hex"
  />

  {/* 3. Two-column (stacks on mobile) */}
  <div className="grid md:grid-cols-2 gap-4">

    {/* Left: inputs */}
    <div className="bg-white …">
      <InputField … />
      …optional quality/preset selectors…
    </div>

    {/* Right: results */}
    <div className="space-y-4">
      <ResultDisplay …/>
      …AnimatedNumber cards, compliance alerts…
      …project/quotation hint…
    </div>
  </div>

</CalculatorPage>
```

### Key rules

- **Sticky result bar** — always pass `stickyResult` + `stickyResultLabel` to `CalculatorPage` so the
  primary result is visible while scrolling inputs on mobile.
- **shareValue** — pass a plain-text string (e.g. `"3.2 m³ beton"`) to enable the native share/copy
  button in the header.
- **Mobile-first** — all interactive elements min 44 px height. Grid collapses to single column on `<md`.
- **No formula changes** — engineering calculations stay intact; only layout, illustration and guidance text change.
- **No heavy libraries** — use inline SVG + CSS transitions only.

---

## CalculatorHero props

```tsx
<CalculatorHero
  illustration={<svg …/>}          // inline SVG, max-h-[150px]
  hint="…"                          // plain-language guidance sentence
  complianceRef="BR18 §258, …"      // shown as bold badge
  accentFrom="#0ea5e9"              // gradient start (discipline colour)
  accentTo="#0369a1"                // gradient end
  className="mb-4"
/>
```

Choose accent colours matching the category colour in `CalculationToolsPage.tsx`:

| Discipline | accentFrom | accentTo |
|---|---|---|
| Beton & Armering | `#3b82f6` | `#1e40af` |
| Lofter & Tag | `#0ea5e9` | `#0369a1` |
| El | `#eab308` | `#a16207` |
| HVAC / Ventilation | `#10b981` | `#047857` |
| Energi & Klima | `#f97316` | `#c2410c` |
| Statiske Beregninger | `#64748b` | `#334155` |
| VVS | `#06b6d4` | `#0e7490` |

---

## Compliance pattern

```tsx
// Toggle switch in inputs card header
<RegulationSwitch isActive={isActive} onToggle={setIsActive} />

// Alert rendered below results, only when toggle is on
<ComplianceAlert
  isActive={isActive}
  passed={result >= threshold}
  message="Opfylder / overskyder …"
  ruleRef="DS/EN 60364-5-52"
/>
```

---

## Project / quotation hint (standard copy)

Add this block inside the results column on every upgraded calculator:

```tsx
<div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-100 dark:border-blue-900 flex items-start gap-2.5">
  {/* shopping-cart icon */}
  <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
  <p className="text-xs text-blue-800 dark:text-blue-300 leading-snug">
    Gem resultatet som indkøb og brug det direkte i dit tilbud via <strong>Gem til Projekt</strong>.
  </p>
</div>
```

---

## §7 Done-checklist — mandatory for every calculator

Every calculator must satisfy all items before it is considered complete:

- [x] Formula(s) centralized in `services/calculatorCatalog.ts` as pure, tested functions
- [x] `CalculatorPage` wrapper with `stickyResult` + `stickyResultLabel` + `shareValue`
- [x] `helpContent` prop populated (formål, variabler, formel, antagelser, standarder)
- [x] `modeToggle` prop wired via `CalculatorModeToggle` (or omitted for Basic-only tools)
- [x] Infographic from the viz library (`BreakdownDonut`, `BreakdownBar`, `DimensionedShape`, …)
- [x] Standards and disclaimer displayed (`SafetyDisclaimer` for safety-critical tools)
- [x] `CalculatorActions` present (PDF landscape + save to project)
- [x] `useToolAccess` compatibility via `CalculatorModeToggle.advancedLocked`
- [x] Dark mode + mobile (≥44px touch targets) + no horizontal overflow

---

## Phase rollout status

| Phase | Categories | Status |
|---|---|---|
| Phase 1 | 1–9 (material / quantity / compliance) | ✅ Complete |
| Phase 2 | 10–15 (engineering & technical) | ✅ Complete |
| Phase 3 | 16 (Pris & Budget) + full-sweep QA | ✅ Complete (2026-06-14) |

---

## Already upgraded calculators

| Calculator | Discipline | Key additions |
|---|---|---|
| `BetonArmering/ConcreteCalculator.tsx` | Beton | Quality class, rebar overlay, slab-thickness warning, BR18/EC2 |
| `LofterTag/RoofPitchCalculator.tsx` | Tag | House cross-section SVG, pitch classification, rafter-length, BR18 §258 |
| `El/CableSizingCalculator.tsx` | El | Cable comparison SVG, animated recommendation, DS/HD 60364 |
| `HVACVentilation/AirChangeCalculator.tsx` | HVAC | Room presets, airflow diagram, BR18 §§473–474 |
| `VVS/PipeSizingCalculator.tsx` | VVS | Mode toggle, ComplianceMeter (DS 439 velocity), SafetyDisclaimer |
| `PrisBudget/BudgetCalculator.tsx` | Pris & Budget | Mode toggle, BreakdownDonut + BreakdownBar, help drawer, moms 25% |
| `PrisBudget/MaterialCostCalculator.tsx` | Pris & Budget | Mode toggle, BreakdownBar, help drawer, spild + moms |
| `PrisBudget/LaborCostCalculator.tsx` | Pris & Budget | Mode toggle, BreakdownDonut, help drawer, labor burden + moms |
| `PrisBudget/FinancingCalculator.tsx` | Pris & Budget | Mode toggle, BreakdownDonut + amortization chart, ÅOP, help drawer |

---

*All ~80 calculators now follow this platform pattern. For new tools, start from this template.*
