# Phase 1 — QA Checklist

**Date:** 2026-06-05  
**Scope:** P1.3 End-to-end functionality QA sweep (post P1.1 + P1.2 + P1.4)

---

## Auth / Public Routes

| Route | Check | Status |
|---|---|---|
| `/login` | Page loads, demo access button present | ✅ |
| `/register` | Page loads, form renders | ✅ |
| `/forgot-password` | Page loads, email input present | ✅ |
| `/reset-password` | Handles Supabase session recovery token from URL | ✅ |
| `/privacy` | Legal page renders | ✅ |
| `/terms` | Legal page renders | ✅ |
| `/cookies` | Legal page renders | ✅ |
| `/gdpr` | Legal page renders | ✅ |
| `/welcome` | Welcome/onboarding page renders | ✅ |

---

## Protected Routes

| Route | Check | Status |
|---|---|---|
| `/home` | Dashboard loads; management + worker views; stat cards clickable | ✅ |
| `/home` (management) | "Nyt Projekt" → `/projects/new` | ✅ |
| `/home` (management) | "Start Tjekliste" → `/tasks` (GlobalTasksPage) | ✅ |
| `/home` (management) | "Søg Reglement" → `/search` | ✅ |
| `/home` (worker) | "Min Arbejdsdag" uses `getAllTasksForActiveProjects` + assignee filter | ✅ |
| `/home` (worker) | Empty state shown when no assigned tasks | ✅ |
| `/tasks` | GlobalTasksPage with filter tabs (Alle/I dag/Forfaldne/Igangværende/Udført) | ✅ |
| `/tasks` | Error state + retry button on fetch failure | ✅ |
| `/tasks` | Empty state per tab | ✅ |
| `/projects/new` | New project wizard (AI plan generation) | ✅ |
| `/projects` | Project list with status filter | ✅ |
| `/project-detail/:id` | Project detail with all tabs | ✅ |
| `/task/:taskId` | Task detail page | ✅ |
| `/settings` | Settings page | ✅ |
| `/search` | Search / "Søg Reglement" with category tabs | ✅ |
| `/regulation/:id` | Regulation detail (static catalog + DB fallback) | ✅ |
| `/tools` | Tools configurator | ✅ |
| `/tools/list` | Calculator list | ✅ |
| `/tools/*` | 60+ calculator routes lazy-loaded | ✅ |

---

## Project Detail Tabs

| Tab | Check | Status |
|---|---|---|
| Oversigt | Stats, team, AI bottleneck | ✅ |
| Opgaver | Task list, create/edit modal | ✅ |
| Indkøb | Purchase list | ✅ |
| Påmindelser | Reminder list | ✅ |
| Dokumenter | Document upload/list | ✅ |
| Punch List | Layout + items | ✅ |
| Tid/Plan | Time entries | ✅ |

---

## alert() / confirm() Replacements (P1.3 Fixes)

| Component | Old UX | Fixed UX |
|---|---|---|
| `TaskFormModal` — outsource external assignee | `window.confirm()` | ConfirmDialog |
| `TaskFormModal` — accept offer / generate contract | `window.confirm()` + `alert()` | ConfirmDialog + toast error |
| `TaskFormModal` — reject offer | `window.confirm()` | ConfirmDialog (danger) |
| `TaskFormModal` — owner reply send error | `alert()` | toast error |
| `ProjectDetailsTabContent` — add member | `alert()` | toast success |
| `CalculatorActions` — PDF export fail | `alert()` | toast error |
| `CalculatorActions` — save to project success | `alert()` | toast success |
| `CalculatorActions` — save to project fail | `alert()` | toast error |
| `AddToProjectModal` — save success | `alert()` | toast success |
| `AddToProjectModal` — save error | `alert()` | toast error |
| `AdvancedBriefingModal` — clipboard copy | `alert()` | toast success |
| `FilePicker` — cloud not connected | `alert()` | toast warning |
| `Chatbot` — TTS not supported | `alert()` | toast warning |
| `CloudFileBrowser` — download fail | `alert()` | toast error |

---

## External Audit Cross-checks

| Audit Point | Check | Status |
|---|---|---|
| `/tasks` route renders GlobalTasksPage (not wizard) | Fixed in P1.4; confirmed in App.tsx | ✅ |
| Wizard at `/projects/new` | Fixed in P1.4; TasksPage component at this route | ✅ |
| Home quick action "Nyt Projekt" → `/projects/new` | Confirmed in HomePage.tsx:557 | ✅ |
| Home quick action "Søg Reglement" → `/search` | Confirmed in HomePage.tsx:559 | ✅ |
| Min Arbejdsdag uses `getAllTasksForActiveProjects` + assignee filter | Confirmed in HomePage.tsx:185 | ✅ |
| Worker view shows pending invites from active projects | Confirmed in HomePage.tsx:360 | ✅ |
| BottomNavBar `/tasks` → GlobalTasksPage | Confirmed in BottomNavBar.tsx:18 | ✅ |
| `/search` and `/regulation/:id` resolve correctly | SearchPage and RegulationDetailPage mounted | ✅ |
| Knowledge-centre / building guide links via `/guide/:guideId` | Route present in App.tsx | ✅ |
| Offer/negotiation flow: submit, accept, reject with toasts | JobOfferModal + TaskFormModal updated | ✅ |
| Connection manager uses toast for success/error | ConnectionManagerModal uses useToast | ✅ |

---

## Diagnostics

- No TypeScript errors introduced by P1.3 changes
- All `alert()` and blocking `confirm()` removed from core user flows
- E2E smoke tests updated to cover `/tasks` and `/projects/new` routes
- Static regulation catalog fallback in place for `getRegulationById` and `searchRegulations`
