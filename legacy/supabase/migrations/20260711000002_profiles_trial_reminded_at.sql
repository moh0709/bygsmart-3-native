-- Trial-ending reminder dedupe marker.
-- Set by the daily trial-reminder job (server/jobs/trialReminders.js) when it
-- emails an app-level (admin-granted) trial that is about to expire, so each
-- trial is reminded at most once. Stripe-backed trials are handled separately by
-- the customer.subscription.trial_will_end webhook and do not use this column.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_reminded_at timestamptz;
