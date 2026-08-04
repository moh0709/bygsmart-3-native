# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BygSmart deployable to a VPS with isolated demo accounts, safer API defaults, and PWA push support.

**Architecture:** Keep Supabase as auth/data backend and the existing Express API as the privileged server boundary. Demo auth user creation and push subscription storage happen only on the API using the Supabase service role. The browser signs into generated demo users and handles PWA install/push subscription through standard service worker APIs.

**Tech Stack:** React, Vite, TypeScript, Supabase, Express, Stripe, Web Push/VAPID, Docker, Nginx.

---

### Task 1: Dependency And Docker Hardening

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server/package.json`
- Create: `server/package-lock.json`
- Create: `.dockerignore`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `server/Dockerfile`

- [ ] Upgrade vulnerable production dependencies.
- [ ] Add API lockfile and use `npm ci --omit=dev`.
- [ ] Exclude `.env`, `node_modules`, build output, coverage, and local caches from Docker context.
- [ ] Pass all frontend Vite build-time variables through Compose build args.

### Task 2: Isolated Demo Access

**Files:**
- Create: `server/demoAccess.js`
- Modify: `server/index.js`
- Modify: `contexts/AuthProvider.tsx`
- Modify: `pages/LoginPage.tsx`
- Modify: `types.ts`
- Modify: `services/database.types.ts`
- Create: `supabase/migrations/20260510000000_demo_access_and_push.sql`
- Test: `server/demoAccess.test.js`

- [ ] Validate visitor e-mail before creating a demo session.
- [ ] Create fresh Supabase demo auth users with confirmed generated credentials.
- [ ] Store the visitor e-mail in `demo_access_requests` and profile metadata columns.
- [ ] Sign the browser into the generated demo account and seed fresh demo data.
- [ ] Block demo users from Stripe checkout and account deletion.

### Task 3: API Security

**Files:**
- Create: `server/env.js`
- Modify: `server/index.js`
- Test: `server/env.test.js`

- [ ] Validate production-required environment variables at startup.
- [ ] Fail closed for CORS in production.
- [ ] Add Helmet security headers.
- [ ] Add route-specific rate limiting.
- [ ] Stop returning internal error details to clients.

### Task 4: PWA And Push

**Files:**
- Create: `manifest.json`
- Modify: `index.html`
- Modify: `sw.js`
- Create: `services/pushNotifications.ts`
- Modify: `pages/SettingsPage.tsx`
- Modify: `server/index.js`
- Test: `services/pushNotifications.test.ts`

- [ ] Add installable PWA manifest and iOS metadata.
- [ ] Add push and notification click handlers to the service worker.
- [ ] Add authenticated push subscription endpoint.
- [ ] Add user-facing settings control to enable push notifications.

### Task 5: Verification

**Commands:**
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npm run test:e2e -- tests/e2e/smoke.spec.ts`
- `npm audit --omit=dev --audit-level=high`
- `npm audit --prefix server --omit=dev --audit-level=high`
