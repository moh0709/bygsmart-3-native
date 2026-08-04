import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import WebSocket from 'ws';
import {
  assertRequiredEnv,
  getServerEnvOptions,
  hasUsableSupabaseServiceConfig,
  parseAllowedOrigins,
} from './env.js';
import {
  buildSeatBillingDetails,
  chooseBillableSubscription,
  getTargetSeatQuantity,
} from './billingSync.js';
import { createAiRouter } from './aiRoutes.js';
import { createToolAccessRouter } from './toolAccessRoutes.js';
import { createModuleEntitlementRouter } from './routes/moduleEntitlementRoutes.js';
import { createSmtpRouter } from './smtpRoutes.js';
import { createHealthRouter } from './routes/healthRoutes.js';
import { createInviteRouter } from './routes/inviteRoutes.js';
import { createTeamSeatRouter } from './routes/teamSeatRoutes.js';
import { createDemoAccessRouter } from './routes/demoAccessRoutes.js';
import { createGeminiProxyRouter } from './routes/geminiProxyRoutes.js';
import { createBillingRouter } from './routes/billingRoutes.js';
import { createPromoCodeRouter } from './routes/promoCodeRoutes.js';
import { createStripeWebhookRouter } from './routes/stripeWebhookRoutes.js';
import { createPushRouter } from './routes/pushRoutes.js';
import { createAccountRouter } from './routes/accountRoutes.js';
import { createOfferRouter } from './routes/offerRoutes.js';
import { createProjectMemberRouter } from './routes/projectMemberRoutes.js';
import { createTaskInviteRouter } from './routes/taskInviteRoutes.js';
import { createOrgRouter } from './routes/orgRoutes.js';
import { createAdminOverviewRouter } from './routes/adminOverviewRoutes.js';
import { createAdminUserRouter } from './routes/adminUserRoutes.js';
import { createAdminInsightsRouter } from './routes/adminInsightsRoutes.js';
import { createAdminOrgRouter } from './routes/adminOrgRoutes.js';
import { createAiHandoverLogRouter } from './routes/aiHandoverLogRoutes.js';
import { createContactRouter } from './routes/contactRoutes.js';
import { createNotificationDeliveryRouter } from './routes/notificationDeliveryRoutes.js';

dotenv.config(getServerEnvOptions());
assertRequiredEnv();

// Safety net: a single unhandled async error in a route (e.g. a Stripe API
// rejection in a handler without try/catch) must never crash the whole server
// and 502 every other request. Log and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason instanceof Error ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err instanceof Error ? err.stack : err);
});

// Single source of truth for the app version is root package.json (same file
// vite.config.ts reads for the frontend's __APP_VERSION__) — but the backend
// deploys as its own standalone directory (deploy/deploy-simply.sh) with no
// root package.json alongside it, so it can't read the file directly.
// start.sh reads the VERSION file deploy-simply.sh writes and injects
// APP_VERSION as an env var when starting the process instead;
// npm_package_version covers local `npm run api` from the repo root.
const appVersion = process.env.APP_VERSION || process.env.npm_package_version || 'unknown';

const app = express();
const port = Number(process.env.PORT || 3002);
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN || '');

app.set('trust proxy', 1);
app.use(
  helmet({
    // The HTML/asset CSP that governs the SPA is enforced at the nginx layer
    // (deploy/nginx-docker.conf), where the document and its scripts/styles are
    // served. The API only ever returns JSON, so it gets a maximally locked-down
    // policy here — nothing it returns can bootstrap script/style/frame
    // execution even if a response were ever rendered as a document.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },
    // The app embeds cross-origin resources (Supabase, Stripe, Sentry); COEP
    // would break them, so keep it disabled — preserves prior behaviour.
    crossOriginEmbedderPolicy: false,
    // The API is never meant to be framed.
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // HSTS is owned by the TLS edge (deploy/nginx-vps-proxy.conf); Helmet also
    // advertises it here so a directly-exposed API still gets HSTS.
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  })
);

// In development, only allow loopback and private-network origins (localhost,
// 127.0.0.1, 10.x, 172.16-31.x, 192.168.x) instead of a blanket allow-all, so a
// misconfigured NODE_ENV can never silently disable CORS protection.
const isPrivateDevOrigin = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      // No origin header (same-origin requests, curl, Postman) — always allow.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (!isProduction && isPrivateDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed'));
    },
    credentials: true,
  })
);

app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// Route-specific JSON limits instead of the global 10mb (F-08). /api/ai/chat is
// text-only, so it gets a tight limit that bounds cost and prompt-injection blast
// radius. /api/gemini carries multimodal image payloads (base64 inlineData), so it
// keeps a large limit; its `contents` are additionally bounded in-handler
// (GEMINI_MAX_CONTENTS_BYTES) which trips first with a friendly error. Registered
// before the global parser so express.json() skips re-parsing them.
app.use('/api/ai/chat', express.json({ limit: '256kb' }));
app.use('/api/gemini', express.json({ limit: '11mb' }));

app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 300 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 20 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiClient = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  hasUsableSupabaseServiceConfig()
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        realtime: { transport: WebSocket },
      })
    : null;

// ── Stripe: dual test + live clients ─────────────────────────────────────────
// Per-user Stripe mode (see profiles.user_type): user_type 'test' | 'admin' use
// TEST keys; 'normal' | 'partner' use LIVE keys. Both key sets live side-by-side
// with _TEST / _LIVE env suffixes, with a legacy fallback so a mid-migration .env
// still using the unsuffixed STRIPE_SECRET_KEY (currently the test key) keeps
// working until the suffixed vars are provisioned.
const resolveStripeSecret = (mode) => {
  const suffixed = process.env[mode === 'live' ? 'STRIPE_SECRET_KEY_LIVE' : 'STRIPE_SECRET_KEY_TEST'];
  if (suffixed) return suffixed;
  const legacy = process.env.STRIPE_SECRET_KEY;
  if (legacy && legacy.startsWith(mode === 'live' ? 'sk_live_' : 'sk_test_')) return legacy;
  return null;
};
const stripeTestKey = resolveStripeSecret('test');
const stripeLiveKey = resolveStripeSecret('live');
const stripeClients = {
  test: stripeTestKey ? new Stripe(stripeTestKey) : null,
  live: stripeLiveKey ? new Stripe(stripeLiveKey) : null,
};
const stripeModeForUserType = (userType) =>
  userType === 'test' || userType === 'admin' ? 'test' : 'live';
const getStripe = (mode) => stripeClients[mode] ?? null;
const getStripeForUserType = (userType) => getStripe(stripeModeForUserType(userType));
// Default client for non-user-scoped / legacy call sites (prefer live, else test).
const stripe = stripeClients.live ?? stripeClients.test;
// The Node webhook route is superseded by the Supabase edge function; keep a
// secret resolvable for it (unused in practice).
const stripeWebhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET || null;

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@bygsmart.dk',
    vapidPublicKey,
    vapidPrivateKey
  );
}

const PLAN_LIMITS = {
  FREE: 5,
  PRO: 50,
  PREMIUM: 1000,
  ENTERPRISE: 10000,
};

// Returns the Stripe price ID for (mode, tier, billing). mode = 'test' | 'live'.
// Reads STRIPE_PRICE_<TIER>_<PERIOD>_<MODE>; falls back to the legacy unsuffixed
// var (which is the current TEST price) for mode='test' only.
const getPriceId = (mode, tier, billing = 'monthly') => {
  const suffix = mode === 'live' ? 'LIVE' : 'TEST';
  const period = billing === 'yearly' ? 'YEARLY' : 'MONTHLY';
  const suffixed = process.env[`STRIPE_PRICE_${tier}_${period}_${suffix}`];
  if (suffixed) return suffixed;
  if (mode === 'test') return process.env[`STRIPE_PRICE_${tier}_${period}`] || null;
  return null;
};

const PLAN_PRIORITY = ['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE'];

const normalizeTier = (tier) => {
  if (!tier) return 'FREE';
  const upper = tier.toUpperCase();
  return PLAN_PRIORITY.includes(upper) ? upper : 'FREE';
};

const maxTier = (first, second) => {
  const firstIndex = PLAN_PRIORITY.indexOf(normalizeTier(first));
  const secondIndex = PLAN_PRIORITY.indexOf(normalizeTier(second));
  return PLAN_PRIORITY[Math.max(firstIndex, secondIndex)] || 'FREE';
};

// Admin-granted trials (Phase 5) overlay a temporary tier on top of the real,
// Stripe-verified subscription_tier — never replacing it. Takes a profile row
// that selected subscription_tier, trial_tier, trial_ends_at. This is the
// ONLY place server-side that should decide "what tier does this user's
// request get gated at" — every enforcement point (AI quota, tool access,
// SMTP tier gate) reads through this instead of subscription_tier directly.
const getEffectiveTier = (profile) => {
  const base = normalizeTier(profile?.subscription_tier);
  const trialActive = !!profile?.trial_tier && !!profile?.trial_ends_at && new Date(profile.trial_ends_at).getTime() > Date.now();
  return trialActive ? maxTier(base, profile.trial_tier) : base;
};

// Maps a price ID back to its tier. Checks BOTH test and live price sets (plus
// the legacy unsuffixed vars) so a webhook event from either mode resolves.
const resolveTierFromPriceId = (priceId) => {
  if (!priceId) return 'FREE';
  const idsFor = (tier) =>
    [
      process.env[`STRIPE_PRICE_${tier}_MONTHLY_TEST`],
      process.env[`STRIPE_PRICE_${tier}_YEARLY_TEST`],
      process.env[`STRIPE_PRICE_${tier}_MONTHLY_LIVE`],
      process.env[`STRIPE_PRICE_${tier}_YEARLY_LIVE`],
      process.env[`STRIPE_PRICE_${tier}_MONTHLY`],
      process.env[`STRIPE_PRICE_${tier}_YEARLY`],
    ].filter(Boolean);
  if (idsFor('PRO').includes(priceId) || ['price_pro_monthly', 'price_pro_yearly'].includes(priceId)) {
    return 'PRO';
  }
  if (idsFor('PREMIUM').includes(priceId) || ['price_premium_monthly', 'price_premium_yearly'].includes(priceId)) {
    return 'PREMIUM';
  }
  return 'FREE';
};

const removeUserFromTeamsAndDeleteOwnedProjects = async (userId) => {
  if (!supabaseAdmin || !userId) return;

  const { data: projects, error: projectsError } = await supabaseAdmin
    .from('projects')
    .select('id, owner_id, team');

  if (projectsError) {
    throw new Error(`Unable to load projects for account deletion: ${projectsError.message}`);
  }

  const ownedProjectIds = [];

  for (const project of projects || []) {
    if (project.owner_id === userId) {
      ownedProjectIds.push(project.id);
      continue;
    }

    const currentTeam = Array.isArray(project.team) ? project.team : [];
    const filteredTeam = currentTeam.filter((member) => String(member?.id || '') !== userId);

    if (filteredTeam.length !== currentTeam.length) {
      const { error: updateTeamError } = await supabaseAdmin
        .from('projects')
        .update({ team: filteredTeam, updated_at: new Date().toISOString() })
        .eq('id', project.id);

      if (updateTeamError) {
        throw new Error(
          `Unable to update team membership for project ${project.id}: ${updateTeamError.message}`
        );
      }
    }
  }

  if (ownedProjectIds.length > 0) {
    const { error: deleteProjectsError } = await supabaseAdmin
      .from('projects')
      .delete()
      .in('id', ownedProjectIds);

    if (deleteProjectsError) {
      throw new Error(`Unable to delete owned projects: ${deleteProjectsError.message}`);
    }
  }
};

// mode = the Stripe mode of the customer being deleted (from the owner's
// user_type). A test-user customer lives only in test mode, a live user's only
// in live mode — deleting with the wrong client would silently no-op.
const cancelStripeForAccountDeletion = async (stripeCustomerId, mode = 'live') => {
  if (!stripeCustomerId) return;

  const client = getStripe(mode);
  if (!client) {
    throw new Error(`Stripe ${mode} mode is not configured on server, cannot cancel active subscriptions.`);
  }

  let hasMore = true;
  let startingAfter = undefined;

  while (hasMore) {
    const subscriptions = await client.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const subscription of subscriptions.data) {
      if (!['canceled', 'incomplete_expired'].includes(subscription.status)) {
        await client.subscriptions.cancel(subscription.id);
      }
    }

    hasMore = subscriptions.has_more;
    startingAfter = subscriptions.data.length
      ? subscriptions.data[subscriptions.data.length - 1].id
      : undefined;
  }

  await client.customers.del(stripeCustomerId);
};

// ─────────────────────────────────────────────────────────────────────────────
// syncStripeSeatsForLeader(leaderId)
// Reads the true seat count from the DB (all non-declined seats) and sets the
// Stripe subscription item quantity to that number + 1 (the leader's own seat).
// Absolute sync — immune to drift from missed delta calls.
// Non-throwing: logs errors but does not bubble.
// ─────────────────────────────────────────────────────────────────────────────
const syncStripeSeatsForLeader = async (leaderId) => {
  if (!supabaseAdmin) {
    return { ok: false, reason: 'Supabase admin is not configured.' };
  }

  const { data: leader } = await supabaseAdmin
    .from('profiles')
    .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_tier, user_type')
    .eq('id', leaderId)
    .maybeSingle();

  if (!leader?.stripe_customer_id) {
    console.warn('[syncStripeSeatsForLeader] leader has no stripe_customer_id, skipping');
    return { ok: false, reason: 'Leader has no Stripe customer.' };
  }

  const mode = stripeModeForUserType(leader.user_type);
  const client = getStripe(mode);
  if (!client) {
    console.warn('[syncStripeSeatsForLeader] Stripe mode not configured for leader, skipping');
    return { ok: false, reason: 'Stripe mode not configured.' };
  }

  const { data: teamRow } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .eq('leader_id', leaderId)
    .maybeSingle();

  let seats = [];
  if (teamRow) {
    const { data: seatRows, error: seatsError } = await supabaseAdmin
      .from('team_seats')
      .select('id, email, status, profile_id, subscription_tier, created_at')
      .eq('team_id', teamRow.id)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: true });

    if (seatsError) {
      console.error('[syncStripeSeatsForLeader] load seats error:', seatsError.message);
      return { ok: false, reason: 'Unable to load team seats.' };
    }

    seats = seatRows ?? [];
  }

  const billingDetails = buildSeatBillingDetails({
    leaderEmail: leader.email,
    teamName: teamRow?.name ?? '',
    seats,
  });
  const targetQty = getTargetSeatQuantity(seats);

  let subscription;
  try {
    const subscriptions = await client.subscriptions.list({
      customer: leader.stripe_customer_id,
      status: 'all',
      limit: 20,
      expand: ['data.items.data.price'],
    });
    subscription = chooseBillableSubscription(subscriptions.data, leader.stripe_subscription_id);
  } catch (err) {
    console.error('[syncStripeSeatsForLeader] list subscriptions error:', err?.message);
    return { ok: false, reason: 'Unable to load Stripe subscription.' };
  }

  if (!subscription) {
    console.warn('[syncStripeSeatsForLeader] no active subscription found for customer');
    return { ok: false, reason: 'No active Stripe subscription found.' };
  }

  if (leader.stripe_subscription_id !== subscription.id) {
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_subscription_id: subscription.id, updated_at: new Date().toISOString() })
      .eq('id', leaderId);
  }

  const tierPriceIds = [
    getPriceId(mode, leader.subscription_tier, 'monthly'),
    getPriceId(mode, leader.subscription_tier, 'yearly'),
  ].filter(Boolean);

  const item =
    subscription.items.data.find((i) => tierPriceIds.includes(i.price?.id)) ||
    subscription.items.data[0];

  if (!item) {
    console.warn('[syncStripeSeatsForLeader] no matching subscription item found');
    return { ok: false, reason: 'No matching Stripe subscription item found.' };
  }

  const currentQty = item.quantity ?? 1;

  try {
    await client.subscriptionItems.update(item.id, {
      quantity: targetQty,
      metadata: billingDetails.metadata,
    });

    await client.subscriptions.update(subscription.id, {
      description: billingDetails.description,
      metadata: billingDetails.metadata,
    });

    await client.customers.update(leader.stripe_customer_id, {
      invoice_settings: {
        custom_fields: billingDetails.invoiceCustomFields,
      },
    });

    console.log(
      `[syncStripeSeatsForLeader] item ${item.id} quantity ${currentQty} -> ${targetQty} (${seats.length} team seats + leader)`
    );

    return {
      ok: true,
      subscriptionId: subscription.id,
      subscriptionItemId: item.id,
      quantity: targetQty,
      previousQuantity: currentQty,
      teamSeatCount: seats.length,
    };
  } catch (err) {
    console.error('[syncStripeSeatsForLeader] update subscription error:', err?.message);
    return { ok: false, reason: 'Unable to update Stripe subscription quantity.' };
  }
};

const getBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
};

// ─── Input validation helpers ────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

// A client-supplied notification link must be a safe, same-origin SPA route
// ("/task/123", "/project-detail/abc?tab=x", "#/team-invite"). Absolute URLs,
// protocol-relative ("//evil.com"), javascript: URIs, and CR/LF/HTML-bearing
// values are rejected so a notification link can never be turned into an
// off-site phishing redirect or XSS sink.
const isSafeInternalLink = (v) =>
  typeof v === 'string' &&
  v.length > 0 &&
  v.length <= 512 &&
  (v.startsWith('/') || v.startsWith('#/')) &&
  !v.startsWith('//') &&
  !/[\r\n\t<>"']/.test(v) &&
  !/javascript:/i.test(v);

// Accepts only absolute https:// URLs of a sane length. Used to validate
// user-supplied links (e.g. contract URLs) before they are stored and later
// rendered as clickable links in the client.
const isHttpsUrl = (v) => {
  if (typeof v !== 'string' || v.length === 0 || v.length > 2048) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

const getAuthenticatedUser = async (req) => {
  if (!supabaseAdmin) return null;
  const token = getBearerToken(req.headers.authorization);
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;
  return user;
};

const enforceAiQuota = async (userId) => {
  if (!supabaseAdmin || !userId) return { ok: true };

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, ai_requests_today, ai_last_reset_date, subscription_tier, trial_tier, trial_ends_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    return { ok: false, status: 403, error: 'Unable to validate AI quota.' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastReset = profile.ai_last_reset_date;
  const currentCount = lastReset === today ? profile.ai_requests_today : 0;
  const tier = getEffectiveTier(profile);
  const limit = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;

  if (currentCount >= limit) {
    return {
      ok: false,
      status: 429,
      error: `Kvote overskredet for ${tier}-planen. Prøv igen i morgen eller opgrader.`,
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      ai_requests_today: currentCount + 1,
      ai_last_reset_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    return { ok: false, status: 500, error: 'Unable to update AI quota usage.' };
  }

  return { ok: true };
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoints — all reads go via service role; never expose service role
// key to the browser. Access is gated by profiles.app_role = 'admin'. These
// helpers are defined here (ahead of route mounting) because they're shared by
// several of the routers mounted below (admin overview/users/companies/insights
// and the push-notification router).
// ─────────────────────────────────────────────────────────────────────────────

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const getAdminProfile = async (userId) => {
  if (!supabaseAdmin || !userId) return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, app_role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
};

// Guard used by every admin action endpoint. On success returns the
// authenticated admin's auth user; otherwise it has already written the
// appropriate error response and returns null, so callers just `return`.
const ensureAdmin = async (req, res) => {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Serverkonfiguration mangler.' });
    return null;
  }
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Ikke autoriseret.' });
    return null;
  }
  const profile = await getAdminProfile(user.id);
  if (!profile || profile.app_role !== 'admin') {
    res.status(403).json({ error: 'Adgang nægtet. Kun administratorer.' });
    return null;
  }
  return user;
};

// Writes an in-app notification row and, when push is configured, sends a
// web-push to every registered device for the recipient. Best-effort push.
const notifyUserAndPush = async (userId, {
  title,
  text,
  link,
  type = 'admin',
  metadata = {},
}) => {
  const { error: notificationError } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    text,
    timestamp: new Date().toISOString(),
    is_read: false,
    link: link || null,
    type,
    metadata,
  });
  if (notificationError) throw notificationError;

  if (!vapidPublicKey || !vapidPrivateKey) return;
  try {
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);
    const payload = JSON.stringify({
      title: title || 'BygSmart',
      body: text,
      url: link || '/#/home',
    });
    await Promise.allSettled(
      (data || []).map((row) => webpush.sendNotification(row.subscription, payload))
    );
  } catch (pushErr) {
    console.warn('[notifyUserAndPush] push failed (non-fatal):', pushErr?.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin insights helpers — period filtering, shared by the admin overview and
// admin insights routers (revenue, teams, delegation, reports) mounted below.
// ─────────────────────────────────────────────────────────────────────────────

// Parses ?from=&to=&compare=yoy|prev into a window plus the equal-length
// (or same-window-last-year) comparison window. Defaults to month-to-date.
const parseAdminPeriod = (req) => {
  const now = new Date();
  let to = req.query.to ? new Date(req.query.to) : now;
  let from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  if (Number.isNaN(to.getTime())) to = now;
  if (Number.isNaN(from.getTime())) from = new Date(now.getFullYear(), now.getMonth(), 1);
  if (from > to) { const tmp = from; from = to; to = tmp; }

  const spanMs = Math.max(to.getTime() - from.getTime(), 24 * 60 * 60 * 1000);
  const compare = req.query.compare === 'yoy' ? 'yoy' : 'prev';

  let prevFrom;
  let prevTo;
  if (compare === 'yoy') {
    prevFrom = new Date(from);
    prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    prevTo = new Date(to);
    prevTo.setFullYear(prevTo.getFullYear() - 1);
  } else {
    prevTo = new Date(from.getTime() - 1);
    prevFrom = new Date(prevTo.getTime() - spanMs);
  }
  return { from, to, prevFrom, prevTo };
};

const pctChange = (current, previous) => {
  if (!previous) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const periodDelta = (current, previous) => ({ current, previous, changePct: pctChange(current, previous) });

// Counts rows of `table` whose `column` timestamp falls in [from, to]. Returns
// 0 (rather than throwing) when the table/column doesn't exist yet — several
// callers reference columns from migrations that haven't been applied yet.
const countInRange = async (table, column, from, to, extra) => {
  try {
    let query = supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .gte(column, from.toISOString())
      .lte(column, to.toISOString());
    if (extra) query = extra(query);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.warn(`[admin insights] countInRange(${table}.${column}) failed (non-fatal):`, err?.message);
    return 0;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Route mounting — order preserved exactly as before the split:
// health → invite → team-seat → demo → contact → gemini-proxy → billing → stripe-webhook
// → push → delete-account → offers → project/terminate-member → admin/overview
// → admin/users → admin/companies → admin/insights → reports/ai-handover
// → AI orchestration → tool access → SMTP config → listen.
// ─────────────────────────────────────────────────────────────────────────────

app.use(createHealthRouter({ appVersion }));

app.use(createInviteRouter({ supabaseAdmin, getAuthenticatedUser, sensitiveLimiter }));

app.use(
  createTeamSeatRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    syncStripeSeatsForLeader,
    sensitiveLimiter,
  })
);

app.use(createDemoAccessRouter({ supabaseAdmin, getAuthenticatedUser, sensitiveLimiter }));

app.use(createContactRouter({ supabaseAdmin, sensitiveLimiter }));

app.use(
  createGeminiProxyRouter({
    geminiClient,
    getAuthenticatedUser,
    enforceAiQuota,
    isProduction,
  })
);

app.use(
  createBillingRouter({
    getStripe,
    stripeModeForUserType,
    supabaseAdmin,
    getAuthenticatedUser,
    normalizeTier,
    getPriceId,
    sensitiveLimiter,
  })
);

// Discount codes (Stripe coupons/promo codes) + free-trial codes (app-managed).
app.use(
  createPromoCodeRouter({
    getStripe,
    supabaseAdmin,
    getAuthenticatedUser,
    ensureAdmin,
    sensitiveLimiter,
  })
);

app.use(
  createStripeWebhookRouter({
    stripe,
    stripeWebhookSecret,
    supabaseAdmin,
    isProduction,
    resolveTierFromPriceId,
    maxTier,
  })
);

app.use(
  createPushRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    webpush,
    vapidPublicKey,
    vapidPrivateKey,
    notifyUserAndPush,
    sensitiveLimiter,
  })
);

app.use(
  createAccountRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    stripeModeForUserType,
    cancelStripeForAccountDeletion,
    removeUserFromTeamsAndDeleteOwnedProjects,
    isProduction,
    sensitiveLimiter,
  })
);

app.use(
  createOfferRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    isUuid,
    isSafeInternalLink,
    isHttpsUrl,
  })
);

app.use(
  createProjectMemberRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    isUuid,
    isProduction,
    sensitiveLimiter,
  })
);

app.use(
  createTaskInviteRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    isUuid,
    isProduction,
    sensitiveLimiter,
    notifyUserAndPush,
  })
);

// Organization invite notifications (BYG 3.0 Phase 2) — see
// server/routes/orgRoutes.js.
app.use(
  createOrgRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    isUuid,
    isProduction,
    sensitiveLimiter,
    notifyUserAndPush,
  })
);

// Notification delivery webhook — Supabase Database Webhook on notifications
// INSERT posts here; fans out email + push per the recipient's preferences.
app.use(
  createNotificationDeliveryRouter({
    supabaseAdmin,
    webpush,
    vapidPublicKey,
    vapidPrivateKey,
  })
);

app.use(
  createAdminOverviewRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    getAdminProfile,
    parseAdminPeriod,
    countInRange,
    periodDelta,
    isProduction,
    adminLimiter,
  })
);

app.use(
  createAdminUserRouter({
    supabaseAdmin,
    getStripeForUserType,
    stripeModeForUserType,
    ensureAdmin,
    notifyUserAndPush,
    cancelStripeForAccountDeletion,
    removeUserFromTeamsAndDeleteOwnedProjects,
    isProduction,
    adminLimiter,
  })
);


app.use(
  createAdminInsightsRouter({
    supabaseAdmin,
    stripe,
    ensureAdmin,
    parseAdminPeriod,
    periodDelta,
    countInRange,
    resolveTierFromPriceId,
    adminLimiter,
  })
);

app.use(
  createAdminOrgRouter({
    supabaseAdmin,
    ensureAdmin,
    parseAdminPeriod,
    periodDelta,
    countInRange,
    adminLimiter,
  })
);

app.use(createAiHandoverLogRouter({ supabaseAdmin, getAuthenticatedUser }));

// ─────────────────────────────────────────────────────────────────────────────
// AI orchestration (multi-provider proxy + admin config) — see server/aiRoutes.js.
// Mounted here (after getAdminProfile is defined) so the router can reuse the
// existing auth/quota/admin helpers. The legacy /api/gemini endpoint above
// keeps working unchanged for services/gemini.ts.
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  createAiRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    enforceAiQuota,
    getAdminProfile,
    isProduction,
  })
);

// Tool access routes (admin campaign/pro gating) — see server/toolAccessRoutes.js.
app.use(
  createToolAccessRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    getAdminProfile,
    isProduction,
    getEffectiveTier,
  })
);

// Module entitlement routes (BYG 3.0 module engine) — see
// server/routes/moduleEntitlementRoutes.js.
app.use(
  createModuleEntitlementRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    getAdminProfile,
    isProduction,
    getEffectiveTier,
    isUuid,
    getStripeForUserType,
  })
);

// SMTP configuration routes — see server/smtpRoutes.js.
app.use(
  createSmtpRouter({
    supabaseAdmin,
    getAuthenticatedUser,
    getAdminProfile,
    getEffectiveTier,
    isProduction,
  })
);

app.listen(port, () => {
  console.log(`[BygSmart] API server running on port ${port}`);
});
