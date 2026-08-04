import { authenticatedServerFetch } from './http';

// Fire-and-forget: ask the server to send the one-time welcome email. Safe to
// call on every login/registration — the server is idempotent (profiles.welcomed_at)
// and only sends once. Never throws.
export const notifyWelcome = async (): Promise<void> => {
  try {
    await authenticatedServerFetch('/account/welcome', { method: 'POST' });
  } catch {
    /* non-fatal — welcome email is a nice-to-have */
  }
};
