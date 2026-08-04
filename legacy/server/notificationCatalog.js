// ─────────────────────────────────────────────────────────────────────────────
// Server mirror of services/notificationCatalog.ts.
//
// Maps an in-app notification `type` (the value written into public.notifications)
// onto the preference key used by notification_preferences + Settings →
// "E-mail notifikationer". The delivery webhook (notificationDelivery.js) uses
// this to decide whether to also send email/push, honouring the user's prefs.
//
// Keys MUST stay in sync with services/notificationCatalog.ts (NOTIFICATION_EVENTS).
// ─────────────────────────────────────────────────────────────────────────────

// notification.type  →  preference event_key
export const TYPE_TO_EVENT_KEY = {
  // Projects & tasks
  task_invite: 'task_assigned',
  task_chat_mention: 'task_mention',
  task_submitted: 'task_handover',
  task_accepted: 'task_handover',
  task_rejected: 'task_handover',
  project_member_added: 'project_member_added',
  offer_received: 'job_offer_received',
  offer_decided: 'job_offer_decided',
  time_registration_submitted: 'time_registration_submitted',
  time_registration_decided: 'time_registration_decided',
  // Team & subscription
  team_invite: 'team_seat_added',
  team_invite_accepted: 'team_invite_accepted',
  team_seat_removed: 'team_seat_removed',
  // Connections & partners
  connection_request: 'connection_request',
  connection_accepted: 'connection_accepted',
  partner_invite: 'partner_invited',
  partner_invite_accepted: 'partner_decided',
  partner_invite_declined: 'partner_decided',
};

// Events whose PUSH is already delivered at insert time by notifyUserAndPush()
// in server/index.js. The delivery webhook must NOT push these a second time
// (it still handles their email). Everything else pushes via the webhook only.
export const PUSHED_AT_INSERT_TYPES = new Set(['task_chat_mention', 'timer_safety', 'admin']);

// Danish heading / subject-line label per preference key.
export const EVENT_LABEL = {
  task_assigned: 'Opgave tildelt dig',
  task_mention: 'Du er nævnt i en opgavechat',
  task_handover: 'Opgavestatus opdateret',
  project_member_added: 'Tilføjet til et projekt',
  job_offer_received: 'Nyt tilbud modtaget',
  job_offer_decided: 'Dit tilbud er besvaret',
  time_registration_submitted: 'Tidsregistrering indsendt',
  time_registration_decided: 'Din tidsregistrering er besvaret',
  team_seat_added: 'Du er tilføjet til et team',
  team_invite_accepted: 'Teaminvitation accepteret',
  team_seat_removed: 'Fjernet fra et team',
  connection_request: 'Ny forbindelsesanmodning',
  connection_accepted: 'Forbindelse accepteret',
  partner_invited: 'Inviteret som partner',
  partner_decided: 'Partneraftale besvaret',
  welcome: 'Velkommen til BygSmart',
  trial_ending: 'Din prøveperiode udløber snart',
  account_deleted: 'Din konto er slettet',
};

export const eventKeyForType = (type) => TYPE_TO_EVENT_KEY[type] || null;
