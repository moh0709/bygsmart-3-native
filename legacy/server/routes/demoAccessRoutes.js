// ─────────────────────────────────────────────────────────────────────────────
// Demo account access routes.
//
// Mounted from server/index.js via:
//   app.use(createDemoAccessRouter({ supabaseAdmin, getAuthenticatedUser,
//                                    sensitiveLimiter }))
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import {
  buildDemoUsername,
  createDemoLoginEmail,
  createDemoSuffix,
  createTemporaryPassword,
  deriveInitials,
  validateContactEmail,
  validateDemoCompanyName,
  validateDemoName,
  isSupabaseCredentialError,
} from '../demoAccess.js';

// The seeded placeholder from /api/demo-session — a profile still carrying it
// has not been through the welcome step.
const PLACEHOLDER_DEMO_NAME = 'Demo Bruger';

const isDemoProfileComplete = (profile) =>
  Boolean(
    profile?.name &&
      profile.name.trim() &&
      profile.name.trim() !== PLACEHOLDER_DEMO_NAME &&
      profile.company_name &&
      profile.company_name.trim()
  );

export const createDemoAccessRouter = ({ supabaseAdmin, getAuthenticatedUser, sensitiveLimiter }) => {
  const router = Router();

  router.post('/api/demo-session', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Demo access is not configured.' });
      return;
    }

    try {
      const contactEmail = validateContactEmail(req.body?.email);

      // Check A: block real (non-demo) account holders from demo access
      const { data: realAccount } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', contactEmail)
        .eq('is_demo', false)
        .maybeSingle();

      if (realAccount) {
        return res.status(409).json({
          error: 'Det ser ud til, at du allerede har en aktiv konto med denne e-mail. Log ind med din e-mail og adgangskode i stedet.',
        });
      }

      // Check B: reuse existing demo session rather than creating a new one
      const { data: existingDemo } = await supabaseAdmin
        .from('profiles')
        .select('id, name, company_name')
        .eq('demo_contact_email', contactEmail)
        .eq('is_demo', true)
        .maybeSingle();

      if (existingDemo) {
        const newPassword = createTemporaryPassword();
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(
          existingDemo.id,
          { password: newPassword }
        );
        if (pwErr) throw pwErr;

        const { data: authUser, error: auErr } = await supabaseAdmin.auth.admin.getUserById(existingDemo.id);
        if (auErr || !authUser?.user?.email) throw new Error('Demo-bruger ikke fundet.');

        return res.status(200).json({
          email: authUser.user.email,
          password: newPassword,
          // A returning visitor who already told us who they are skips the
          // welcome step and lands straight on the dashboard.
          needsProfile: !isDemoProfileComplete(existingDemo),
        });
      }

      const suffix = createDemoSuffix();
      const demoLoginDomain = process.env.DEMO_LOGIN_EMAIL_DOMAIN || 'demo.bygsmart.dk';
      const loginEmail = createDemoLoginEmail(demoLoginDomain, suffix);
      const password = createTemporaryPassword();
      const username = buildDemoUsername(suffix);

      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          name: 'Demo Bruger',
          initials: 'DB',
          demo_contact_email: contactEmail,
        },
        app_metadata: {
          is_demo: true,
        },
      });

      if (createError || !createdUser?.user) {
        throw new Error(createError?.message || 'Unable to create demo user.');
      }

      const userId = createdUser.user.id;

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_demo: true,
          demo_contact_email: contactEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      const { error: leadError } = await supabaseAdmin.from('demo_access_requests').insert({
        contact_email: contactEmail,
        demo_user_id: userId,
        demo_login_email: loginEmail,
        user_agent: req.headers['user-agent'] || null,
        ip_address:
          typeof req.ip === 'string' && req.ip.length <= 64
            ? req.ip
            : null,
      });

      if (profileError || leadError) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
        throw new Error(profileError?.message || leadError?.message || 'Unable to save demo request.');
      }

      // A brand-new demo always routes through the welcome step so we capture
      // who is looking at the product.
      res.status(201).json({ email: loginEmail, password, needsProfile: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Demo access failed.';
      console.error('[api/demo-session] error:', message);
      const status = isSupabaseCredentialError(error) ? 503 : 400;
      const clientMessage =
        status === 503 ? 'Demo access is not configured.' : message;
      res.status(status).json({ error: clientMessage });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Welcome step: the signed-in demo visitor tells us their name and company.
  // Writes go through the service role because the lead table is service-role
  // only and the personal organisation is renamed at the same time, so the
  // admin dashboard shows the real company instead of "Demo Brugers organisation".
  // ───────────────────────────────────────────────────────────────────────────
  router.post('/api/demo-profile', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      res.status(503).json({ error: 'Demo access is not configured.' });
      return;
    }

    try {
      const caller = await getAuthenticatedUser(req);
      if (!caller) return res.status(401).json({ error: 'Ikke logget ind.' });

      const { data: profile, error: profileLoadErr } = await supabaseAdmin
        .from('profiles')
        .select('id, is_demo')
        .eq('id', caller.id)
        .maybeSingle();
      if (profileLoadErr) throw profileLoadErr;

      // Only demo profiles use this endpoint — a real account edits its details
      // in Settings, where the normal validation and audit rules apply.
      if (!profile?.is_demo) {
        return res.status(403).json({ error: 'Kun demokonti kan bruge dette trin.' });
      }

      const name = validateDemoName(req.body?.name);
      const companyName = validateDemoCompanyName(req.body?.companyName);
      const initials = deriveInitials(name);

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          name,
          initials,
          company_name: companyName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caller.id);
      if (updateErr) throw updateErr;

      // Keep auth metadata in sync so anything reading user_metadata.name
      // (e.g. the signup trigger's org naming) sees the real name too.
      await supabaseAdmin.auth.admin
        .updateUserById(caller.id, { user_metadata: { name, initials, company_name: companyName } })
        .catch(() => undefined);

      // Mirror onto the lead row so sales keeps the context.
      const { error: leadErr } = await supabaseAdmin
        .from('demo_access_requests')
        .update({ contact_name: name, company_name: companyName })
        .eq('demo_user_id', caller.id);
      if (leadErr) console.error('[api/demo-profile] lead update failed:', leadErr.message);

      // Rename the personal organisation the signup trigger created. Scoped to
      // orgs this demo user owns, so a shared org can never be renamed here.
      const { data: ownedMembership } = await supabaseAdmin
        .from('organization_members')
        .select('org_id')
        .eq('user_id', caller.id)
        .eq('role', 'owner')
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (ownedMembership?.org_id) {
        const { error: orgErr } = await supabaseAdmin
          .from('organizations')
          .update({ name: companyName, updated_at: new Date().toISOString() })
          .eq('id', ownedMembership.org_id)
          .eq('created_by', caller.id);
        if (orgErr) console.error('[api/demo-profile] org rename failed:', orgErr.message);
      }

      res.json({ saved: true, name, initials, companyName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke gemme oplysningerne.';
      console.error('[api/demo-profile] error:', message);
      const status = isSupabaseCredentialError(error) ? 503 : 400;
      res.status(status).json({
        error: status === 503 ? 'Demo access is not configured.' : message,
      });
    }
  });

  router.post('/api/claim-demo-account', sensitiveLimiter, async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ claimed: false });

    try {
      const { email, password, username, name, initials } = req.body ?? {};
      if (!email || !password || !username) return res.status(400).json({ claimed: false });

      const { data: demoProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('demo_contact_email', email)
        .eq('is_demo', true)
        .maybeSingle();

      if (!demoProfile) {
        return res.json({ claimed: false });
      }

      // Proof of ownership: the caller must currently be signed in AS the demo
      // user being claimed. Otherwise anyone who knows (or guesses) a demo
      // contact email could take over the account — and because the claim sets
      // email_confirm, they would also bypass email verification entirely.
      const caller = await getAuthenticatedUser(req);
      if (!caller || caller.id !== demoProfile.id) {
        return res.json({ claimed: false });
      }

      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(demoProfile.id, {
        email,
        password,
        email_confirm: true,
      });
      if (authErr) throw authErr;

      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          email,
          username,
          name: name ?? '',
          initials: initials ?? '',
          is_demo: false,
          demo_contact_email: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', demoProfile.id);
      if (profileErr) throw profileErr;

      res.json({ claimed: true });
    } catch (err) {
      console.error('[api/claim-demo-account]', err);
      res.status(500).json({ claimed: false, error: 'Kontokonvertering fejlede.' });
    }
  });

  return router;
};
