// @bygsmart/core — types, module registry, and pure business rules.
// Harvested from legacy/ (not extracted in place). Test layer 2 targets this package.
// In 3.0 this becomes the SINGLE source both the app and the server import — collapsing
// 2.1's deliberate client/server duplication (and its parity tests).
export * from './types';
export * from './registry/types';
export * from './registry/registry';
export * from './registry/moduleInfo';
export * from './access/projectTabAccess';
export * from './access/roles';
export * from './entitlements/moduleCatalog';
export * from './entitlements/enabledModules';
export * from './entitlements/subscriptionPlans';
export * from './status/handover';
export * from './status/lifecycle';
export * from './status/partner';
export * from './status/taskStatus';
export * from './org/org';
