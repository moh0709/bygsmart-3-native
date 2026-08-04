// ─────────────────────────────────────────────────────────────────────────────
// modules/knowledge — public surface (the ONLY entry point for code outside
// the module; enforced by the ESLint boundary rules).
//
// The module has no external consumers today: its pages arrive via route
// contributions and its regulation search via the searchSources slot. Keep
// heavy internals out of this file — services/regulations statically pulls
// the ~1.3 MB regulation catalog, so re-exporting it here would drag that
// into every importer's chunk.
// ─────────────────────────────────────────────────────────────────────────────

export {};
