// ─────────────────────────────────────────────────────────────────────────────
// Client service for org_module_prefs — owner-level module deactivation.
//
// A row (hidden = true) means the org owner has turned a module OFF from the
// /moduler marketplace. This is a PRESENTATION preference only: it never
// touches org_module_entitlements (billing/purchase truth). The
// EntitlementsProvider subtracts the hidden set from `enabledModules` so a
// deactivated module vanishes from nav/routes/tabs/widgets, while
// getEntitlement() still reports the underlying billing state.
//
// FAIL-SAFE: if the migration (20260723000001) has NOT been applied, the table
// is missing. `listHiddenModules` swallows that and returns [] (app behaves
// exactly as today — every entitled module visible). `setModuleHidden` throws
// a typed ModulePrefsUnavailableError the UI can turn into a graceful toast.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabaseClient';

// The generated Database types don't yet know org_module_prefs (types are
// regenerated after the migration ships); cast to keep the query type-safe-ish
// without fighting the schema map — same pattern as modules/team/orgTeams.ts.
const db = supabase as any;

/** Thrown by writes when the org_module_prefs table doesn't exist yet. */
export class ModulePrefsUnavailableError extends Error {
  constructor(message = 'Funktionen kræver en databaseopdatering.') {
    super(message);
    this.name = 'ModulePrefsUnavailableError';
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * True when the error means "org_module_prefs does not exist" — either the
 * Postgres undefined_table code (42P01) or PostgREST's schema-cache miss
 * (PGRST205), with a message fallback for good measure.
 */
const isMissingTableError = (error: PostgrestLikeError | null | undefined): boolean => {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('org_module_prefs') &&
    (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))
  );
};

const toTypedError = (error: PostgrestLikeError): Error =>
  isMissingTableError(error)
    ? new ModulePrefsUnavailableError()
    : new Error(error.message || 'Kunne ikke gemme modul-indstillingen.');

/**
 * Module ids the org owner has deactivated. Fail-safe: never throws — returns
 * [] on a missing table or any transient error, so gating stays fail-open
 * (nothing extra hidden) exactly as before the migration.
 */
export const listHiddenModules = async (orgId: string): Promise<string[]> => {
  try {
    const { data, error } = await db
      .from('org_module_prefs')
      .select('module_id')
      .eq('org_id', orgId)
      .eq('hidden', true);
    if (error) {
      // Missing table = migration not applied yet: expected, stay quiet.
      if (!isMissingTableError(error)) {
        console.warn('listHiddenModules:', error.message ?? error);
      }
      return [];
    }
    return (data ?? []).map((r: { module_id: string }) => r.module_id);
  } catch {
    // Network / unexpected — fail safe (show everything).
    return [];
  }
};

/**
 * Deactivate (hidden = true → upsert) or reactivate (hidden = false → delete a
 * module for the org. Throws ModulePrefsUnavailableError when the table is
 * missing so the caller can toast a graceful "needs a DB update" message.
 */
export const setModuleHidden = async (
  orgId: string,
  moduleId: string,
  hidden: boolean
): Promise<void> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (hidden) {
    const { error } = await db.from('org_module_prefs').upsert(
      {
        org_id: orgId,
        module_id: moduleId,
        hidden: true,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,module_id' }
    );
    if (error) throw toTypedError(error);
  } else {
    const { error } = await db
      .from('org_module_prefs')
      .delete()
      .eq('org_id', orgId)
      .eq('module_id', moduleId);
    if (error) throw toTypedError(error);
  }
};
