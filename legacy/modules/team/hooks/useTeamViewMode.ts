import { useCallback, useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared "Liste ↔ Diagram" view-mode for the Team page and the Settings
// "Organisation" preview. Persisted to localStorage and synced across every
// component on the page via a same-tab custom event (plus the native `storage`
// event for other tabs), so the Settings preview mirrors the choice made on
// /team without a reload.
// ─────────────────────────────────────────────────────────────────────────────

export type TeamViewMode = 'list' | 'chart';

const STORAGE_KEY = 'bygsmart:teamViewMode';
const SYNC_EVENT = 'bygsmart:teamViewModeChange';

const readMode = (): TeamViewMode => {
    // Default to 'chart' (Diagram) when no explicit choice is stored. A user who
    // previously picked 'list' keeps it; every other case (no value yet, 'chart',
    // or an unreadable/invalid value) resolves to the 'chart' default.
    if (typeof window === 'undefined') return 'chart';
    try {
        return window.localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'chart';
    } catch {
        return 'chart';
    }
};

export const useTeamViewMode = (): [TeamViewMode, (mode: TeamViewMode) => void] => {
    const [mode, setModeState] = useState<TeamViewMode>(readMode);

    useEffect(() => {
        const sync = () => setModeState(readMode());
        window.addEventListener(SYNC_EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(SYNC_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    const setMode = useCallback((next: TeamViewMode) => {
        setModeState(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* storage unavailable (private mode) — state still updates in-memory */
        }
        // Notify other consumers mounted on the same page in the current tab.
        window.dispatchEvent(new CustomEvent(SYNC_EVENT));
    }, []);

    return [mode, setMode];
};
