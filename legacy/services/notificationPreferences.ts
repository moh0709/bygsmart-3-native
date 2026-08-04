// ─────────────────────────────────────────────────────────────────────────────
// Notification preferences service — reads/writes the per-user opt-in/opt-out
// rows backing Settings → "E-mail notifikationer".
//
// DEFAULT-ON: a user with no stored row for an event has BOTH channels enabled.
// loadNotificationPreferences() therefore seeds every catalog event to
// { email: true, push: true } and only overrides the ones the user has changed.
//
// NOTE: public.notification_preferences is introduced in migration
// 20260708000001. services/database.types.ts is regenerated at deploy time, which
// restores full typing; until then the table is reached through an untyped handle
// (eslint permits `any`; the cast is isolated to prefsTable()).
// ─────────────────────────────────────────────────────────────────────────────

import supabase from './supabaseClient';
import { NOTIFICATION_EVENTS } from './notificationCatalog';

export interface ChannelPref {
  email: boolean;
  push: boolean;
}

export type PreferenceMap = Record<string, ChannelPref>;

interface PreferenceRow {
  event_key: string;
  email_enabled: boolean;
  push_enabled: boolean;
}

const prefsTable = () => (supabase as any).from('notification_preferences');

/** Every optional event enabled on both channels — the baseline before overrides. */
export const defaultPreferences = (): PreferenceMap => {
  const map: PreferenceMap = {};
  for (const event of NOTIFICATION_EVENTS) {
    map[event.key] = { email: true, push: true };
  }
  return map;
};

/** Load the current user's preferences, merged over the default-ON baseline. */
export async function loadNotificationPreferences(): Promise<PreferenceMap> {
  const map = defaultPreferences();
  const { data, error } = await prefsTable().select('event_key, email_enabled, push_enabled');
  if (error) throw error;
  for (const row of (data ?? []) as PreferenceRow[]) {
    map[row.event_key] = { email: !!row.email_enabled, push: !!row.push_enabled };
  }
  return map;
}

/** Upsert a single event's channel preferences for the current user. */
export async function saveNotificationPreference(eventKey: string, pref: ChannelPref): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Du er ikke logget ind.');

  const { error } = await prefsTable().upsert(
    {
      user_id: user.id,
      event_key: eventKey,
      email_enabled: pref.email,
      push_enabled: pref.push,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,event_key' },
  );
  if (error) throw error;
}
