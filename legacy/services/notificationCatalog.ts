// ─────────────────────────────────────────────────────────────────────────────
// Notification catalog — the single source of truth for the OPTIONAL email/push
// notification events a user can toggle in Settings → "E-mail notifikationer".
//
// MANDATORY events (billing receipts, payment-failed, and the account-security
// notices handled by Supabase Auth) are deliberately absent — they are always
// sent and never shown as a toggle.
//
// `key` is the stable preference key stored in public.notification_preferences.
// The server maps each in-app notification `type` onto one of these keys when
// deciding whether to also send email/push (see server/notificationCatalog.js).
//
// DEFAULT-ON: absence of a stored preference row means both channels are enabled.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'push';

export type NotificationCategoryId = 'team' | 'connections' | 'projects' | 'account';

export interface NotificationEventDef {
  /** Stable preference key, persisted in notification_preferences.event_key. */
  key: string;
  /** Danish label shown in the settings row. */
  label: string;
  /** Danish one-line explanation. */
  description: string;
  category: NotificationCategoryId;
  /** Which channels are offered as toggles for this event. */
  channels: NotificationChannel[];
}

export interface NotificationCategoryDef {
  id: NotificationCategoryId;
  label: string;
}

export const NOTIFICATION_CATEGORIES: NotificationCategoryDef[] = [
  { id: 'team', label: 'Team & abonnement' },
  { id: 'connections', label: 'Forbindelser & partnere' },
  { id: 'projects', label: 'Projekter & opgaver' },
  { id: 'account', label: 'Konto' },
];

const BOTH: NotificationChannel[] = ['email', 'push'];
const EMAIL_ONLY: NotificationChannel[] = ['email'];

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  // ── Team & abonnement ──────────────────────────────────────────────────────
  {
    key: 'team_seat_added',
    label: 'Tilføjet til et team',
    description: 'Når en kontoejer giver dig en plads på sit abonnement.',
    category: 'team',
    channels: BOTH,
  },
  {
    key: 'team_invite_accepted',
    label: 'Teaminvitation accepteret',
    description: 'Når en person accepterer din invitation til teamet.',
    category: 'team',
    channels: BOTH,
  },
  {
    key: 'team_seat_removed',
    label: 'Fjernet fra et team',
    description: 'Når du fjernes fra et team eller abonnement.',
    category: 'team',
    channels: BOTH,
  },

  // ── Forbindelser & partnere ────────────────────────────────────────────────
  {
    key: 'connection_request',
    label: 'Ny forbindelsesanmodning',
    description: 'Når nogen sender dig en forbindelsesanmodning.',
    category: 'connections',
    channels: BOTH,
  },
  {
    key: 'connection_accepted',
    label: 'Forbindelse accepteret',
    description: 'Når en person accepterer din forbindelsesanmodning.',
    category: 'connections',
    channels: BOTH,
  },
  {
    key: 'partner_invited',
    label: 'Inviteret som partner',
    description: 'Når du inviteres som underentreprenør/partner på et projekt.',
    category: 'connections',
    channels: BOTH,
  },
  {
    key: 'partner_decided',
    label: 'Partneraftale besvaret',
    description: 'Når en partneraftale accepteres eller afvises.',
    category: 'connections',
    channels: BOTH,
  },

  // ── Projekter & opgaver ────────────────────────────────────────────────────
  {
    key: 'project_member_added',
    label: 'Tilføjet til et projekt',
    description: 'Når du tilføjes som deltager på et projekt.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'task_assigned',
    label: 'Opgave tildelt dig',
    description: 'Når en opgave tildeles eller deles med dig.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'task_mention',
    label: 'Nævnt i opgavechat',
    description: 'Når nogen nævner (@) dig i en opgavechat.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'task_handover',
    label: 'Opgavestatus ændret',
    description: 'Når en opgave indsendes, godkendes eller afvises.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'job_offer_received',
    label: 'Tilbud modtaget',
    description: 'Når en underentreprenør sender et tilbud på dit projekt.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'job_offer_decided',
    label: 'Tilbud besvaret',
    description: 'Når dit tilbud accepteres eller afvises.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'time_registration_submitted',
    label: 'Tidsregistrering indsendt',
    description: 'Når en medarbejder, du er ansvarlig for, indsender sin ugentlige tidsregistrering.',
    category: 'projects',
    channels: BOTH,
  },
  {
    key: 'time_registration_decided',
    label: 'Tidsregistrering besvaret',
    description: 'Når din tidsregistrering godkendes eller afvises.',
    category: 'projects',
    channels: BOTH,
  },

  // ── Konto ──────────────────────────────────────────────────────────────────
  {
    key: 'welcome',
    label: 'Velkomst-e-mail',
    description: 'En kort velkomst, når din konto er oprettet og bekræftet.',
    category: 'account',
    channels: EMAIL_ONLY,
  },
  {
    key: 'trial_ending',
    label: 'Prøveperiode udløber snart',
    description: 'En påmindelse et par dage før din gratis prøveperiode slutter.',
    category: 'account',
    channels: BOTH,
  },
  {
    key: 'account_deleted',
    label: 'Bekræftelse på kontosletning',
    description: 'En kvittering, når din konto er slettet.',
    category: 'account',
    channels: EMAIL_ONLY,
  },
];

/** All optional event keys — handy for the server's mandatory-vs-optional check. */
export const OPTIONAL_EVENT_KEYS: string[] = NOTIFICATION_EVENTS.map((e) => e.key);

export const eventsForCategory = (categoryId: NotificationCategoryId): NotificationEventDef[] =>
  NOTIFICATION_EVENTS.filter((e) => e.category === categoryId);
