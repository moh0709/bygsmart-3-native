// ─────────────────────────────────────────────────────────────────────────────
// modules/purchasing — public surface (the ONLY entry point for code outside
// the module; enforced by the ESLint boundary rules).
// ─────────────────────────────────────────────────────────────────────────────

export * from './services/purchases';
export * from './services/suppliers';
export { PurchasingTabContent } from './components/PurchasingTabContent';
export { PurchaseFormModal } from './components/PurchaseFormModal';
