// The minimal SQL surface SqlRepository needs. Async so ONE implementation covers
// every SQLite runtime: native op-sqlite/expo-sqlite (async), wasm-SQLite over OPFS
// on web (async), and sql.js in node tests (sync, wrapped). A runtime only has to
// provide these two calls; SqlRepository holds all the query logic.
export interface SqlDriver {
  /** Execute a statement (DDL or write), ignoring any result. */
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Run a query and return rows as plain objects. */
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
