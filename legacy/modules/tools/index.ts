// ─────────────────────────────────────────────────────────────────────────────
// modules/tools — public surface (the ONLY entry point for code outside the
// module; enforced by the ESLint boundary rules).
//
// The calculator catalog API is re-exported verbatim so existing consumers
// (ToolAccessPanel, AI intelligence, …) migrate by changing one import path.
// ─────────────────────────────────────────────────────────────────────────────

export {
  listCalculators,
  getCalculator,
  computeCalculator,
  computableCalculatorIds,
  computeBudget,
} from './catalog';
export type {
  CalculatorMeta,
  CalculatorInputDef,
  CalculatorStandard,
  CalculatorHelp,
  BudgetLineItem,
} from './catalog';
export { ROUTE_DEFS } from './loaders';
export type { ToolRouteDef } from './loaders';
// UI atoms/pickers consumed by legacy shell code — re-exported until their
// consumers convert to slot contributions in later phases.
export { default as AnimatedNumber } from './components/AnimatedNumber';
export { default as CalculatorPickerModal } from './components/CalculatorPickerModal';
export type { CalculatorPickerResult } from './components/CalculatorPickerModal';
