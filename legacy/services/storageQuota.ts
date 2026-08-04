import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Client-side storage-quota gate. Every upload flow calls assertStorageQuota()
// before writing to the bucket; at/over 100 % of the org's allowance the
// upload is refused with a purchase pointer (Udvid din BygSmart → Lagerplads).
//
// Usage comes from org_storage_usage (nightly pg_cron refresh — see
// 20260715000001), so enforcement lags up to a day, matching the banner.
// FAIL-OPEN: any error (offline, no org, missing rows) allows the upload —
// a quota must never block work because a lookup failed.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000;
let cache: { at: number; blocked: boolean; percent: number } | null = null;

export class StorageQuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StorageQuotaError';
    }
}

/** Test hook / post-purchase refresh: forget the cached verdict. */
export const invalidateStorageQuotaCache = (): void => {
    cache = null;
};

export const assertStorageQuota = async (): Promise<void> => {
    try {
        const now = Date.now();
        if (!cache || now - cache.at > CACHE_TTL_MS) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                cache = { at: now, blocked: false, percent: 0 };
            } else {
                const { data: profile } = await (supabase as any)
                    .from('profiles')
                    .select('active_org_id')
                    .eq('id', user.id)
                    .maybeSingle();
                const orgId = profile?.active_org_id ?? null;
                if (!orgId) {
                    cache = { at: now, blocked: false, percent: 0 };
                } else {
                    const [orgRes, usageRes] = await Promise.all([
                        (supabase as any).from('organizations').select('storage_allowance_gb').eq('id', orgId).maybeSingle(),
                        (supabase as any).from('org_storage_usage').select('bytes_total').eq('org_id', orgId).maybeSingle(),
                    ]);
                    const allowanceBytes = (orgRes.data?.storage_allowance_gb ?? 5) * 1024 * 1024 * 1024;
                    const usedBytes = Number(usageRes.data?.bytes_total) || 0;
                    const percent = allowanceBytes > 0 ? Math.round((usedBytes / allowanceBytes) * 100) : 0;
                    cache = { at: now, blocked: allowanceBytes > 0 && usedBytes >= allowanceBytes, percent };
                }
            }
        }
    } catch {
        cache = { at: Date.now(), blocked: false, percent: 0 };
    }
    if (cache?.blocked) {
        throw new StorageQuotaError(
            `Lagerpladsen er opbrugt (${cache.percent} %). Tilkøb ekstra plads under Udvid din BygSmart → Lagerplads, eller ryd op i filer.`
        );
    }
};
