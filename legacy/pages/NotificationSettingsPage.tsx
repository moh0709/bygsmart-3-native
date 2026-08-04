import React, { useEffect, useState } from 'react';
import { AppScreen, Card, Spinner, Alert, cn } from '../components/ui';
import { useToast } from '../contexts/ToastContext';
import {
  NOTIFICATION_CATEGORIES,
  eventsForCategory,
  type NotificationChannel,
} from '../services/notificationCatalog';
import {
  loadNotificationPreferences,
  saveNotificationPreference,
  type PreferenceMap,
} from '../services/notificationPreferences';

// Local accessible toggle — mirrors the Switch used on the main Settings page.
const Switch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  'aria-label': string;
}> = ({ checked, onChange, disabled, 'aria-label': ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked ? 'true' : 'false'}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onChange}
    className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150',
        checked ? 'bg-brand-primary' : 'bg-border-strong dark:bg-border-dark-strong',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        )}
      />
    </span>
  </button>
);

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: 'E-mail',
  push: 'Push',
};

const NotificationSettingsPage: React.FC = () => {
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<PreferenceMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // event_key currently being persisted → disables its toggles briefly.
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadNotificationPreferences();
        if (!cancelled) setPrefs(data);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Kunne ikke indlæse indstillinger.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (eventKey: string, channel: NotificationChannel) => {
    if (!prefs) return;
    const current = prefs[eventKey] ?? { email: true, push: true };
    const next = { ...current, [channel]: !current[channel] };
    // Optimistic update.
    setPrefs({ ...prefs, [eventKey]: next });
    setSavingKey(eventKey);
    try {
      await saveNotificationPreference(eventKey, next);
    } catch (err) {
      // Revert on failure.
      setPrefs((prev) => (prev ? { ...prev, [eventKey]: current } : prev));
      showToast(err instanceof Error ? err.message : 'Kunne ikke gemme. Prøv igen.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <AppScreen
      hasBottomNav={false}
      width="reading"
      header={{ title: 'E-mail notifikationer', back: '/settings' }}
    >
      <div className="flex flex-col gap-5 py-2">
        <p className="text-caption text-text-secondary dark:text-text-dark-secondary px-1">
          Vælg hvilke hændelser du vil have besked om. Sikkerheds- og betalings­relaterede
          e-mails (kvitteringer, abonnement og loginsikkerhed) sendes altid og kan ikke slås fra.
          Push kræver, at du har slået push-notifikationer til på enheden.
        </p>

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6 text-text-tertiary dark:text-text-dark-tertiary" />
          </div>
        )}

        {loadError && !loading && (
          <Alert variant="danger">{loadError}</Alert>
        )}

        {!loading && !loadError && prefs &&
          NOTIFICATION_CATEGORIES.map((category) => {
            const events = eventsForCategory(category.id);
            if (events.length === 0) return null;
            return (
              <section key={category.id} className="flex flex-col gap-3" aria-label={category.label}>
                <h3 className="text-label font-semibold ml-1 text-text-secondary dark:text-text-dark-secondary">
                  {category.label}
                </h3>
                <Card padding="none" className="overflow-hidden divide-y divide-border dark:divide-border-dark">
                  {events.map((event) => {
                    const pref = prefs[event.key] ?? { email: true, push: true };
                    return (
                      <div key={event.key} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 grow">
                          <span className="block text-label font-semibold text-text-primary dark:text-text-dark-primary">
                            {event.label}
                          </span>
                          <span className="block text-caption text-text-secondary dark:text-text-dark-secondary mt-0.5">
                            {event.description}
                          </span>
                        </div>
                        <div className="flex items-start gap-4 shrink-0">
                          {event.channels.map((channel) => (
                            <div key={channel} className="flex flex-col items-center gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-tertiary dark:text-text-dark-tertiary">
                                {CHANNEL_LABEL[channel]}
                              </span>
                              <Switch
                                checked={pref[channel]}
                                onChange={() => toggle(event.key, channel)}
                                disabled={savingKey === event.key}
                                aria-label={`${event.label} – ${CHANNEL_LABEL[channel]}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </section>
            );
          })}
      </div>
    </AppScreen>
  );
};

export default NotificationSettingsPage;
