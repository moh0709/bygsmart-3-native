# BygSmart 2.1 — Full Audit & Top-Tier Upgrade Plan
**Date:** 2026-06-09 · **Scope:** UI/UX, Partner (Underleverandør) flow, Security, AI Onboarding, Briefing/Evaluation + PDF, AI Orchestration

---

## 1. UI/UX Audit — Current State

**Inventory:** 33 pages + ~80 calculator routes (113 routes in `App.tsx`), 60+ components.

### Cross-cutting issues (these hold the whole app back)
| # | Issue | Evidence |
|---|-------|----------|
| 1 | **No component primitives** — Button, Card, Input, Modal, Badge styles are duplicated inline across pages | 6 different modal implementations; ad-hoc Tailwind classes everywhere |
| 2 | **No spacing/typography scale** — padding ranges p-2→p-12 ad hoc; headings inconsistent per page | `tailwind.config.js` lacks token scales |
| 3 | **Zero skeleton loading states** — pages pop in abruptly; spinners only | All data-driven pages |
| 4 | **Weak accessibility** — only ~34 ARIA attributes app-wide; missing focus traps in modals, inconsistent focus rings, small touch targets | All modals, BottomNavBar |
| 5 | **No empty-state design** — blank lists with no guidance/CTA | TasksPage, ProjectsPage, LogPage |
| 6 | **Animation inconsistency** — mixed durations/easings, no motion system | Various |
| 7 | **Monolithic pages** — `QuickProjectModal.tsx` (803 LOC), `TasksPage.tsx` (748), `HomePage.tsx` (678) mix data + UI, hard to polish | `pages/` |
| 8 | **Form UX** — no inline validation patterns, inconsistent error display, no unsaved-changes guard | TaskFormModal, PurchaseFormModal, onboarding steps |

### Worst pages (highest-impact fixes)
1. `pages/QuickProjectModal.tsx` 2. `pages/HomePage.tsx` 3. `pages/TasksPage.tsx` 4. `pages/ProjectDetailPage.tsx` 5. `pages/SettingsPage.tsx`

### UI Upgrade plan (top-tier target)
1. **Design tokens** in `tailwind.config.js` + `src/index.css`: color semantic scale (surface/elevated/border/brand/success/warn/danger), 4-pt spacing, type scale (display→caption), radius + shadow scale, motion tokens (durations 150/250/400ms, standard easings).
2. **`components/ui/` primitive library**: Button (variants/sizes/loading), Card, Input/Select/Textarea (label+error+hint), Modal (single accessible implementation: focus trap, ESC, scroll lock, mobile sheet variant), Badge, Tabs, Skeleton, EmptyState, Toast.
3. **Migrate all pages** to primitives — kills 6 modal implementations and inline-style duplication in one move.
4. **States everywhere**: skeleton → content, designed empty states with CTA, error states with retry.
5. **A11y pass**: focus management, aria-labels, 44px touch targets, contrast check on dark mode, `eslint-plugin-jsx-a11y` set to error.
6. **Motion polish**: page transitions, modal/sheet spring, list stagger — via tokens only.
7. **Refactor the 5 worst pages** into composed sections using the new primitives.

---

## 2. Partner (Underleverandør) Flow — Audit

### Current state
- Two overlapping team systems: new team management (`TeamManagementPage`, `TeamInvitePage`, migration `20260608000001_team_invite_flow.sql`) + ad-hoc project invitations.
- **Project members stored as denormalized JSONB array on `projects`**; offers stored in `task.offers` JSONB → no granular access control, no negotiation history.
- **Task filtering for EXTERNAL users is client-side only** — a partner with the anon key can query the full project row. Budget hiding is also client-side.
- No counter-offers, no settlement record, no human-to-human chat (Chatbot is AI-only).

### Target design
**New tables (with RLS as the enforcement layer, not the client):**
- `project_partners` (project_id, partner_user_id, status: invited|negotiating|accepted|declined, agreed_price, settled_at)
- `partner_task_access` (partner_id, task_id) — explicit allowlist of visible tasks
- `negotiations` (invitation-scoped thread: messages, offers with amount + status offered|countered|accepted|declined, full history)
- Postgres **view or RLS-scoped RPC** `partner_project_view` exposing only: project name, description, deadline — never budget/internal notes/other members' tasks.

**RLS policies:** partners can `SELECT` projects only via membership in `project_partners`; tasks only via `partner_task_access`; negotiation messages only on own threads. Manager retains full access via existing role policies.

**Flow:** Manager invites (picks tasks + optional opening price) → partner sees scoped view + negotiation chat → offers/counter-offers in thread → accept = `agreed_price` settled, task access activated, audit-stamped. Supabase Realtime on `negotiations` for live chat.

---

## 3. Security Audit

### Corrected finding
The sub-audit flagged "live secrets committed to repo" — **verified false**. `.env`/`.env.local` contain live keys but are git-ignored and have never been committed (history contains only `.env.example`). No rotation forced; treat as good hygiene.

### Verified secure ✅
- RLS policies comprehensive, no `USING(true)`
- Stripe webhook signature verification correct (`server/index.js`)
- Gemini API key server-side only (`api/gemini.ts` proxy) — not exposed to browser
- Server-side admin authorization checks present; rate limiting adequate

### Findings to fix
| Sev | Finding | Fix |
|-----|---------|-----|
| **High** | Partner/EXTERNAL task + budget scoping is client-side only (see §2) | RLS tables/policies in §2 |
| **High** | Dev CORS allows all origins in server config | Explicit origin allowlist incl. dev |
| **Med** | Gemini proxy accepts arbitrary model names | Whitelist models server-side |
| **Med** | Demo-account claim flow can be claimed without verifying original credentials | Require auth proof / token check |
| **Med** | Vite `define` secret-injection pattern risks accidental leakage of non-VITE_ vars | Inject only explicit VITE_-prefixed vars |
| **Low** | OAuth/integration tokens cached in web storage (`integrationAuth`/contexts) | Move to httpOnly session or encrypt + short TTL |
| **Low** | `dangerouslySetInnerHTML` in `RegulationDetailPage.tsx` | Confirm DOMPurify with strict config at sanitization point |

---

## 4. AI Onboarding, Briefing/Evaluation, PDF — Audit

### Current state
- `services/gemini.ts`: 14 AI functions, server proxy, basic error handling. Onboarding wizard (`components/onboarding/`, `QuickProjectModal`) is an 8-step flow with light AI assistance.
- **Gaps vs "senior engineer/PM" onboarding:** no material quantity validation, no cross-check of amounts vs project dimensions, no task sequencing/dependency logic, no supplier/price intelligence, no document analysis, no plausibility scoring of user inputs. Calculators exist (`components/calculators/`, 80 routes) but are **not wired into onboarding/purchases**.
- **Briefing/evaluation:** `AdvancedBriefingModal` produces generic text; evaluation is a single score + risks. No multi-dimensional index, no compliance/financial/resource dimensions, no trend, no feedback loop.
- **PDF:** html2canvas-pro + jsPDF screenshot-based; 3 templates. Fragile with complex CSS, no proper page breaks, raster text, no structured layout.

### Upgrade plan
1. **Intelligent onboarding engine**: AI pass that reviews every step like a senior engineer/PM — validates quantities against dimensions + waste factors (reusing calculator formulas as deterministic tools the AI calls), flags missing tasks/materials, proposes sequencing with dependencies, estimates durations, and produces a confidence score per line item before commit. Purchase lines get unit/amount sanity checks.
2. **Project Intelligence Index**: multi-dimensional grade (0–100 + A–F): planning completeness, budget realism, schedule risk, compliance, resourcing — each with concrete feedback and prioritized actions; recomputed on change; trend stored.
3. **Advanced PDF**: replace screenshot pipeline with structured jsPDF (or @react-pdf/renderer) — vector text, real page breaks, branded cover, index-grade visualization, task/purchase tables, signatures section.
4. **AI Orchestration (admin)**: new menu in admin Settings dashboard:
   - Providers: Gemini, OpenAI, Anthropic, (optional: Mistral/Groq) — API key entry **or** OAuth where supported.
   - Keys stored server-side (Supabase table with RLS admin-only, encrypted via pgsodium/Vault) — never in client bundle.
   - `services/ai/` abstraction: provider registry, model mapping per feature, fallback chain, usage logging per provider/feature, server proxy extended from `api/gemini.ts` → `api/ai.ts`.

---

## 5. Phased Implementation Plan

| Phase | Content | Depends on |
|-------|---------|-----------|
| **1. Foundation** | Design tokens + `components/ui/` primitives + skeleton/empty/toast system; security quick wins (CORS, model whitelist, vite define, demo claim) | — |
| **2. UI migration** | Migrate all pages/modals to primitives; a11y pass; motion; refactor 5 worst pages | 1 |
| **3. Partner flow** | Schema + RLS (`project_partners`, `partner_task_access`, `negotiations`), scoped partner view, invitation UI, realtime negotiation chat, price settlement | 1 |
| **4. AI orchestration** | `services/ai/` provider abstraction, server proxy, admin AI menu with encrypted key management | 1 |
| **5. Intelligent onboarding** | Senior-engineer validation engine, calculator integration, quantity/material checks, purchase validation | 4 |
| **6. Index + PDF** | Project Intelligence Index, advanced briefing, structured PDF reports | 4 |

Each phase: implemented on git commits per logical change, `npm run lint` + tests green, verification pass before next phase.
