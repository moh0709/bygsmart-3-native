# Add a Formula — Recipe

Follow these steps every time you centralize a new calculator formula into the registry.
This is the **merge gate** for the rollout: a category is "done" only when its formulas are centralized and tested.

---

## 1. Write the pure function in `services/calculatorCatalog.ts`

Add a new exported pure function above the `COMPUTABLE` array.

```ts
// Input type (export so calculator pages can import it)
export interface MyCalcInput {
  length: number;
  // … other numeric inputs
}

// Pure function — no side effects, no React, no i18n
export const computeMyCalc = (
  input: MyCalcInput
): { result: number; someSideValue: number } => {
  const { length } = input;
  if (length <= 0) return { result: 0, someSideValue: 0 };
  const result = length * 2; // your actual formula here
  return { result, someSideValue: result * 0.1 };
};
```

**Rules:**
- Return `0` / empty object for invalid inputs (zero, negative) — never `NaN`.
- No `Math.random()`, no `Date`, no external calls.
- Export the input type and the function — pages import them directly.

---

## 2. Add a `ComputableDef` entry to the `COMPUTABLE` array

```ts
{
  id: 'my-calc-id',                  // matches the route slug and page id
  name: 'My Calculator Name',        // shown in UI
  category: 'Category Name',        // one of the 16 categories
  route: '/tools/category/my-calc',
  resultUnit: 'm²',

  // ── New required fields ──────────────────────────────────────────────────
  modes: 'basic',                    // 'basic' | 'advanced' | 'both'
  safetyCritical: false,             // true → renders engineer-verify banner
  standards: [
    { code: 'BR18', note: 'Plain-language Danish note.' },
    // Add more from STANDARDS_CATALOG as needed
  ],
  help: {
    purpose: 'Danish: what this tool calculates and when to use it.',
    variables: [
      { symbol: 'L', label: 'Længde', unit: 'm', description: 'Beskrivelse.' },
    ],
    formula: 'Result = L × 2',
    assumptions: [
      'Antagelse 1 på dansk.',
    ],
    // workedExample: 'Optional Danish worked-through example.',
    standardsExplained: 'Plain Danish: which standard governs this and what it means.',
  },
  // ────────────────────────────────────────────────────────────────────────

  inputs: [
    { id: 'length', label: 'Længde', unit: 'm', defaultValue: '5' },
    // mode-specific inputs: add mode: 'advanced' to inputs only shown in advanced mode
  ],
  compute: (inputs) => {
    const r = computeMyCalc({ length: num(inputs, 'length') });
    return {
      value: round(r.result, 2),
      unit: 'm²',
      summary: `${round(r.result, 2)} m²`,
    };
  },
},
```

**Checklist:**
- [ ] `id` matches the URL slug (last segment of `route`).
- [ ] `modes` set: use `'both'` only when advanced inputs and formula are implemented.
- [ ] `safetyCritical: true` for: statics, electrical, pressurised systems.
- [ ] At least one `standards[]` entry.
- [ ] `help.variables` covers every input symbol.
- [ ] `help.formula` is the human-readable string (LaTeX not required).
- [ ] `help.assumptions` lists all simplifications (waste factors, defaults).

---

## 3. Write tests in `services/calculatorCatalog.test.ts`

Add a `describe` block for your pure function **and** a case in the `computeCalculator` describe block.

```ts
describe('computeMyCalc', () => {
  it('known-good: length=5 → result=10', () => {
    const r = computeMyCalc({ length: 5 });
    expect(r.result).toBe(10);
  });

  it('zero length → 0 result', () => {
    const r = computeMyCalc({ length: 0 });
    expect(r.result).toBe(0);
  });

  it('negative length → 0 result (guard)', () => {
    const r = computeMyCalc({ length: -3 });
    expect(r.result).toBe(0);
  });

  it('wastage: 10% > 0% result', () => {
    // If your formula has a wastage parameter
    const base = computeMyCalc({ length: 5, wastagePct: 0 });
    const waste = computeMyCalc({ length: 5, wastagePct: 10 });
    expect(waste.result).toBeGreaterThan(base.result);
  });
});
```

**Required test categories (all must pass):**

| Category | What to test |
|---|---|
| Known-good | Concrete numeric example you can verify by hand |
| Boundary | `length = 0`, `area = 0`, `quantity = 0` |
| Negative | Negative inputs should return `0` or the guarded value |
| Wastage | Higher `wastagePct` → higher result |
| Mode parity | If `modes: 'both'`, basic and advanced run independently and both pass |
| Standard ref | If safety-critical, assert the result meets the relevant limit |

---

## 4. Run the correctness gate

```bash
npx vitest run services/calculatorCatalog.test.ts
npx tsc --noEmit
npx eslint services/calculatorCatalog.ts services/calculatorCatalog.test.ts
```

All three must be green before merging. This is the **rollout merge gate**.

---

## 5. Update the calculator page (optional — do this in the category rollout ticket)

The page imports the pure function directly:

```ts
import { computeMyCalc, type MyCalcInput } from '@/services/calculatorCatalog';
```

Pass the metadata from `getCalculator('my-calc-id')` to `<HelpDrawer>` and `<CalculatorModeToggle>`.

---

## Standards reference

Import `STANDARDS_CATALOG` to reuse pre-typed standard objects:

```ts
import { STANDARDS_CATALOG } from '@/services/calculatorCatalog';

// In a ComputableDef:
standards: [
  ...STANDARDS_CATALOG.concrete,
  ...STANDARDS_CATALOG.statics,
],
```

Available domains: `statics`, `electrical`, `water`, `drainage`, `heating`, `energy`, `moisture`, `ventilation`, `geometry`, `quantities`, `concrete`, `timber`.

Add new entries to `STANDARDS_CATALOG` in `calculatorCatalog.ts` when introducing a new domain.
