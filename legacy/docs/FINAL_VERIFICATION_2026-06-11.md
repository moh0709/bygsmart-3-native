# BygSmart 2.1 Upgrade — Final Verification & Deployment Checklist (2026-06-11)

## Verification results (all green)

| Check | Result |
|---|---|
| `tsc --noEmit` (full repo, 254 project files incl. all 83 calculators) | **0 errors** |
| ESLint (`eslint . --max-warnings 0`) | **0 errors / 0 warnings** (27 unused `eslint-disable` directives auto-fixed) |
| Unit tests (vitest, client) | **35/35 passed** (10 files) |
| Server tests (vitest, server/) | **17/17 passed** (env, demoAccess, billingSync) |
| `node --check` server/index.js, aiProviders.js, aiRoutes.js | **OK** |
| Production build (`vite build`) | **OK, 6.2s** (only pre-existing chunk-size warning for knowledge-domain bundle) |

Note: 21 files had stale/NUL-corrupted sandbox copies (a sync artifact, not real damage); each was verified against the authoritative Windows-side content and repaired before any verification or commit. All committed blobs were re-checked for completeness.

## Commits created

```
a68284b chore: remove unused eslint-disable directives (eslint --fix)
2148694 Integration wiring: partner-project route, AI admin tab, Partnere tab + IntelligenceIndexCard
255a01b Phase 6: project intelligence index + AI feedback + jsPDF intelligence report
32f3127 Phase 5: calculator catalog (83 entries, 14 pure formulas) + picker + onboarding validation
c2214ac Phase 4: AI orchestration — 21 providers, encrypted keys, /api/ai/chat fallback chain, admin panel
db9a879 Phase 3: partner flow — RLS-scoped invites, task allowlist, negotiation chat, price settlement
4615473 Phase 2: UI migration to design-system primitives
9390f6b WIP: team invite flow + Stripe seat billing sync (your pre-existing work, committed to protect it)
```

Your remaining ~208 locally modified files (other pre-existing WIP) were intentionally left uncommitted.

## What shipped per objective

1. **UI upgrade** — design tokens + dark-mode fix (Phase 1, committed earlier), primitives (Button/Card/Field/Modal/Badge/Tabs/Skeleton/EmptyState), GenericModal rebuilt on new Modal (all ~17 call sites upgraded), Toast a11y, HomePage/ProjectsPage/wizard/QuickProject/Settings/nav migrated.
2. **Partner flow** — invite → in-invitation chat + price negotiation (øre-precision) → settlement on accept. Partners see ONLY name/description/deadline (SECURITY DEFINER view) + allowlisted tasks. RLS on all 3 new tables; atomic RPCs; realtime chat. Route: `#/partner-project/<id>`.
3. **Security** — CORS hardening, /api/gemini auth + model whitelist, demo-account claim takeover fix (Phase 1, committed earlier).
4. **Intelligent onboarding + calculators** — 83-calculator catalog, 14 formulas extracted as pure functions, "Beregn" picker in task & purchase forms with Danish provenance lines, debounced AI quantity check, plan validation (deterministic + one AI pass) on wizard review step with add-suggestion buttons.
5. **Intelligence index + PDF** — 5-dimension weighted A–F grade, Danish drivers, AI feedback with fallback, pure-vector branded PDF report from IntelligenceIndexCard on project detail.
6. **AI orchestration** — 21-provider registry, AES-256-GCM key storage, priority fallback chain at `/api/ai/chat`, admin panel "AI-orkestrering" tab, usage log. Bedrock/watsonx are 501 stubs.

## Manual steps YOU must do before this works in production

1. **Apply migrations to Supabase** (SQL editor or `supabase db push`), in date order — note the first three are from your own team-invite/billing work:
   - `20260608000001_team_invite_flow.sql`
   - `20260609000001_stripe_backed_team_tier.sql`
   - `20260609000002_fix_handle_new_user_search_path.sql`
   - `20260610000001_partner_collaboration.sql`
   - `20260610000002_ai_orchestration.sql`
   - `20260611000001_fix_profiles_team_member_rls_recursion.sql`
2. **Add `AI_KEYS_SECRET`** to the server `.env` (generate: `openssl rand -base64 32`), restart the API server. Without it, key saving and `/api/ai/chat` return 503.
3. **Configure providers**: log in as admin → Admin Dashboard → "AI-orkestrering" → add API keys, enable providers, set priority, test connections.
4. Optional: regenerate `services/database.types.ts` after migrations (removes the `supabase as any` casts in services/partners.ts).
5. **Behavior changes**: `/api/gemini` now requires login (anonymous chatbot gets Danish 401); demo-account claim only succeeds while signed in as that demo user.
