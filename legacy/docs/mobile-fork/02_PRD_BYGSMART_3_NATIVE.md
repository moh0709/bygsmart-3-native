# BygSmart 3.0 Native — Product Requirements
## Part 2 (v2.0) · Replaces `02_PRD_BYGSMART_MOBILE.md`

**Product:** BygSmart 3.0 Native
**Version:** 2.0 · **Date:** 3 August 2026 · **Owner:** Moh
**Status:** ready for implementation, pending D-11 (resolved by the P0 spike)
**Governing plan:** `03_BUILD_PLAN.md` v4.1

### Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-08-03 | Initial PRD — phone-only fork of BygSmart 2.1 |
| **2.0** | **2026-08-03** | **Re-cut for BygSmart 3.0 Native.** One universal app (iOS + Android + PWA) replaces the phone-only fork. No users, so all brownfield compatibility requirements are void. Adds: tri-target platform matrix, three-runtime offline model, the web-commerce architecture (D-13), **an epic and story structure** (the largest gap in v1.0), acceptance criteria, a risk section, a glossary, and honest problem-evidence gaps. Requirement count reduced from 131 to 74 by grouping and by cutting scope. |

---

## 1. Vision and goals

> **BygSmart 3.0 Native is the tool a Danish tradesperson keeps in their pocket on site — it works in a basement with no signal, it captures proof of work in seconds, and it turns a day's work into a compliant report before they leave the site.**

BygSmart 2.1 was a capable office product that failed its primary user: someone standing in a new-build with no coverage, wearing gloves, holding a phone. 3.0 is one universal application — native on iOS and Android, an installable PWA in the browser — built around that person, with the office and back-office served by the same codebase where it fits and by a separate DOM app where it doesn't.

### 1.1 Goals

| # | Goal | Measured by |
|---|---|---|
| G-1 | A crew can complete a full working day with no connectivity and lose nothing | ≥ 20 % of all field mutations created offline; **zero** unrecoverable outbox items |
| G-2 | Documentation happens on site, not at the kitchen table | Median time from task completion to handover submitted |
| G-3 | One codebase serves three platforms | 100 % of product screens shared; `.web.tsx` variants < 10 % of components |
| G-4 | The product is sellable without a store account | PWA launch is commercially complete (§7) |
| G-5 | Every business rule and formula exists in exactly one place | Zero rules implemented twice; formula parity enforced by fixtures |
| G-6 | The codebase can be aggressively refactored at any point | Any subsystem deletable in ≤ 1 week with tests as the only proof needed |

### 1.2 Product principles

| # | Principle | Consequence |
|---|---|---|
| **P1** | **Offline is the substrate, not a feature** | Every field flow completes with the radio off. Where a runtime cannot guarantee that (browser), the app says so |
| **P2** | **Two taps to proof** | Camera against a task is ≤ 2 taps from cold start |
| **P3** | **The app never lies about state** | Pending, syncing, synced and failed are always visible. The app refuses work it cannot durably hold rather than pretending |
| **P4** | **Same rules, one place** | Formulas, entitlements and permissions come from shared packages and the server. The client never invents authorisation |
| **P5** | **The field, not the office** | If a flow is better on a laptop it lives in the back-office app. Deliberate scope refusal is a feature |
| **P6** | **Gloves, sun, noise, one hand** | ≥ 48 dp targets, outdoor high-contrast mode, one-thumb reach, minimal typing, camera-first |
| **P7** | **One UI, three shapes** | Responsive by design: single-pane phone, two-pane tablet and desktop. Never a phone layout stretched to a monitor |
| **P8** | **Tests are how we move fast** | A subsystem without tests is a subsystem we cannot delete — and being unable to delete things is what makes a rebuild slow |

---

## 2. Problem, and what we do not yet know

### 2.1 The problem

Field documentation in Danish construction is done twice: once badly on site (photos in a camera roll, hours on paper), then again in the evening on a laptop. Connectivity on sites is unreliable — basements, crawl spaces, new-builds without power. Every field tool that assumes a network shifts work into the tradesperson's own time.

### 2.2 The evidence gap — stated honestly

> **This problem statement is asserted, not measured.** No user research, site visits, interviews or analytics underpin it, and BygSmart 2.1's personas in v1.0 were specified to a precision the evidence could not support.

Two things must be gathered before the launch scope is final, and neither blocks starting:

| # | Research task | When | Why |
|---|---|---|---|
| RS-1 | **6–8 field ride-alongs** with real crews — observe a full day, record every connectivity gap, every double-entry, every photo taken | During P0–P2 | The persona→module priorities in §3.4 are currently judgement, and they drive the entire scope split |
| RS-2 | **Competitive scan** — Dalux, Ajour, Minuba, Fieldwire, Autodesk Build, Procore. All sell offline-capable field apps to this exact Danish buyer | During P0 | The commerce model (§7) rests on an unexamined assumption about who buys and why they would switch |

**Until RS-1 lands, treat §3 personas as hypotheses.**

---

## 3. Users

### 3.1 Primary — "Jonas", tradesperson / sjakbajs *(hypothesis)*
Electrician or carpenter, mid-range Android or iPhone, gloves on, phone in a trouser pocket, often with no coverage. Uses the app in short bursts, many times a day.
**Jobs:** see today's tasks · check in and out · photograph work as proof · log a defect · register hours · confirm completion · look up a §-rule when challenged · run a quick calculation.
**Success:** the day's documentation is complete before leaving site.

### 3.2 Secondary — "Mette", project manager / byggeleder *(hypothesis)*
Moves between sites and office; phone and laptop equally. Needs situational awareness and unblocking authority away from a desk.
**Jobs:** overview and blockers · approve completions · triage punch lists · answer chat · assign work · see crew hours · pull a report on the way to a meeting.

### 3.3 Tertiary — "Søren", org owner / self-employed *(hypothesis)*
Runs a 1–15-person firm, buys the modules, lives in the back-office for economy and administration, wants the phone for status and approvals.

**Not a user of the product app:** the platform administrator (back-office only) and the bygherre/client. *Note: v1.0 excluded the client because the client-portal code was a 23-line stub. That was reasoning from implementation to user need. The client who wants progress photos on a phone is a plausible untapped segment — a hypothesis to test after launch, not a conclusion.*

### 3.4 Persona → module priority *(judgement until RS-1)*

| Module | Jonas | Mette | Søren | Launch |
|---|:--:|:--:|:--:|:--:|
| `field` — check-in, documentation, chat, handover | ●●● | ●●○ | ●○○ | **Yes** |
| `tasks` | ●●● | ●●● | ●●○ | **Yes** |
| `projects` | ●●○ | ●●● | ●●● | **Yes** (read + light edit) |
| `time` | ●●● | ●●● | ●●○ | **Yes** |
| `quality` — KS, punch list | ●●● | ●●● | ●○○ | **Yes** |
| `documents` | ●●○ | ●●○ | ●○○ | **Yes** (view + upload) |
| `knowledge` — BR18/DS/AB18 | ●●○ | ●●○ | ●○○ | **Yes** (search + offline favourites) |
| `tools` — calculators | ●●○ | ●○○ | ●●○ | **Yes if ready** — explicitly off the critical path |
| `team`, `planning`, `reporting`, `ai` | ●○○–●●○ | ●●○–●●● | ●●○ | v1.1 |
| `partners`, `budget`, `quotations`, `purchasing`, `integrations` | ○○○–●○○ | ●○○–●●○ | ●●○–●●● | v1.2 |
| `ar` | ●●○ | ●○○ | ●○○ | v1.2 — LiDAR-only, premium path |
| `client-portal` | ○○○ | ○○○ | ●○○ | Out of scope |

---

## 4. Platform matrix

**Three targets, one codebase, one deliberate asymmetry.**

| | iOS | Android | Web (installable PWA) |
|---|---|---|---|
| Distribution | App Store | Play Store | `app.bygsmart.com` |
| Minimum | iOS 16.4 | API 26 (Android 8) | Chrome 108+ · Safari 16.4+ · Firefox 111+ |
| **Offline** | **Guaranteed** — native SQLite, encrypted, background upload | **Guaranteed** | **Graded, best-effort** — §6 |
| **Commerce** | Capability display only | Capability display only | **Full marketplace** — §7 |
| Push | APNs | FCM | Web Push (VAPID) |
| Updates | Store review, from a release tag | Store review, from a release tag | Continuous, from trunk |
| Biometric lock | Face ID / Touch ID | Fingerprint | Not available — shorter grace instead |

**Back-office** (`admin.bygsmart.com`) is a separate DOM application: platform administration, org and billing management, SMTP, promo codes, tool-access configuration, and the 3D project wizard. It is not part of the universal app.

---

## 5. Scope

### 5.1 Launch (PWA, ~month 7; native ~month 8)
`auth` · `projects` (read + light edit) · `tasks` · `field` · `time` · `quality` · `documents` (view + upload) · `knowledge` (search + offline favourites) · offline sync · push · deep links · **the PWA marketplace** · back-office.
`tools` ships **if ready** — it is deliberately off the critical path.

### 5.2 v1.1 — "Lead & Report"
`planning` (calendar, Gantt) · `reporting` (server-generated) · `team` · `ai` assistant with voice · the full calculator catalogue · photo annotation · notification actions and quiet hours.

### 5.3 v1.2 — "Commercial & Capture"
`partners` · `budget` (read) · `quotations` · `purchasing` · `integrations` · **AR scanning on ARKit RoomPlan / ARCore** · drawing markup.

### 5.4 Permanently out of scope for the universal app
Platform administration · org/billing management · SMTP configuration · promo codes · the 3D project wizard · the marketing site · client portal · **any purchase path in the native binaries**.

---

## 6. Offline behaviour — the contract

Notation: **[O]** works fully offline · **[Q]** mutation is queued · **[N]** requires network.

### 6.1 Per-runtime capability

| Runtime | Tier | Behaviour |
|---|---|---|
| iOS / Android | **Guaranteed** | Full offline read and write. Encrypted at rest. Background upload survives suspension; reconciles on launch after termination |
| Web — OPFS + persistence granted | **Full** | Identical to native, except no background upload after tab close |
| Web — OPFS, no persistence | **Session-durable** | Works; warns the browser may reclaim data; prompts to install the PWA |
| Web — no OPFS (Safari private) | **Online-only** | App runs, clearly labelled, and **refuses to queue mutations it cannot durably hold** (P3) |

### 6.2 Per-capability matrix

| Capability | Offline read | Offline write | Notes |
|---|:--:|:--:|---|
| My Day / task list | ✅ | — | Last synced scope |
| Task detail · create · edit | ✅ | ✅ | Client UUID; queued |
| Check in / out | ✅ | ✅ | Append-only |
| Photo documentation | ✅ | ✅ | Media queue; downscaled at capture |
| Task chat | ✅ | ✅ | Queued, ordered |
| Punch list · quality checklist | ✅ | ✅ | Conflict-aware, explicit resolution |
| Time registration | ✅ | ✅ | Append-only |
| Handover + signature | ✅ | ✅ | Queued |
| Project list / detail / light edit | ✅ | ✅ | |
| Documents marked offline | ✅ | ✅ upload queued | Unmarked need network |
| Knowledge favourites + FTS index | ✅ | — | |
| Calculators | ✅ | ✅ save queued | **Never network-dependent to compute** |
| Global search | ✅ local scope | — | Clearly labelled as local |
| Invitations · reports · AI · marketplace | ❌ | ❌ | Network required |

---

## 7. Commerce model *(D-13)*

> **Selling lives on the web surface. Native binaries are capability-only.**

Store payment rules bind native binaries; they do not bind a PWA.

- **PWA and back-office** carry the full module marketplace, seats and storage add-ons via Stripe Checkout — **0 % commission, no review cycle, instant pricing changes.**
- **Native binaries** display capability state only. A locked module shows *"Aktiveres af din organisations ejer på bygsmart.com"* with **no module name, no price, no description and no link that could read as a purchase path** — satisfying App Store Guidelines 3.1.1 and 3.1.3(b) by containing nothing to object to.
- Entitlements resolve server-side and propagate to every client within seconds of a purchase.

**Consequence:** the PWA launch is a commercially complete product. Store rejection risk affects distribution timing, not revenue.

---

## 8. Functional requirements

Grouped by epic. Acceptance criteria are stated per epic in §11; these are the requirements those criteria test.

### 8.1 Authentication & session (A)
| ID | Requirement | Runtime notes |
|---|---|---|
| A-01 | Email + password sign-in via Supabase Auth | |
| A-02 | Session persisted in secure storage; `detectSessionInUrl: false`; silent refresh on foreground. **A chunking adapter is required** — `expo-secure-store` caps values at ~2048 bytes and Supabase sessions exceed it | Native: SecureStore. Web: IndexedDB |
| A-03 | TOTP MFA (aal2) blocks the whole app until satisfied | |
| A-04 | **Biometric app lock, mandatory when unsynced work exists**, 15-minute default timeout | Native only |
| A-05 | Password reset and verification links open the app via Universal Link / App Link | |
| A-06 | **Offline grace: 14 days native, 72 hours web.** Past it, read-only until an online authentication succeeds | Web storage is neither secure nor durable |
| A-07 | Organisation switcher; changing org re-resolves entitlements and swaps local data scope | |
| A-08 | Sign-out purges local database, media cache and outbox after warning about unsynced items | |
| A-09 | Signup anti-abuse via App Attest / Play Integrity (native) and Turnstile (web) | ⚠ `[auth.captcha]` is global — see R-08 |
| A-10 | Invite acceptance (team, task, partner, project) via deep link | Deferred deep links: manual code fallback at launch |

### 8.2 Sync & offline (S)
| ID | Requirement |
|---|---|
| S-01 | A local store mirrors the field entity set, with sync metadata on every row |
| S-02 | **Scoped sync** — only rows the user can already see under RLS. The server is the authority |
| S-03 | Delta pull on a `(updated_at, id)` cursor, including **tombstones**, on foreground, network regain, pull-to-refresh and schedule |
| S-04 | **Durable outbox** — client UUID as idempotency key, exponential backoff, survives force-quit, reboot and tab close |
| S-05 | **Ordered, dependency-aware replay** — a photo on a task created offline replays after that task |
| S-06 | **Media queue** — capture to disk first, thumbnail immediately, **downscale before upload** (2048 px long edge, q80, EXIF stripped except orientation), background upload with resume, originals retained until confirmed |
| S-07 | **Per-entity conflict policy**: append-only (check-ins, time, chat, documentation) · last-writer-wins with server guard (tasks, projects) · **explicit user resolution** (punch list, quality sign-off) |
| S-08 | **Sync Centre** — pending count, per-item state and failure reason, manual retry, explicit discard with confirmation, diagnostic export, **storage-tier display** |
| S-09 | Per-screen freshness and pending indicators |
| S-10 | Quota rejection never loses media — retained locally, user informed, path to resolution |
| S-11 | Wi-Fi-only media upload toggle with a manual override |
| S-12 | Local cache cap with LRU eviction of **synced** media only; visible usage; clear-cache action |
| S-13 | **Web: graded capability detection at startup** (§6.1), persistent-storage request, honest tier reporting |
| S-14 | **Web: single-writer election across tabs** via Web Locks; other tabs read through the leader |
| S-15 | Entitlements cached with a **72-hour TTL** independent of the session grace. Past TTL, affected modules degrade to read-only |

### 8.3 Shell & navigation (H)
| ID | Requirement |
|---|---|
| H-01 | Navigation assembled from the module registry's `nav` slot, **responsive**: bottom tabs on phone, rail on tablet, rail + sidebar on desktop |
| H-02 | Role-aware home from the `homeWidgets` slot — worker context vs management context |
| H-03 | Raised centre **Capture** action: camera → attach to task or project |
| H-04 | Global search across projects, tasks, documents and knowledge via `searchSources`; offline covers cached content |
| H-05 | Deep links: `bygsmart://` + Universal Links / App Links, covering task, project, invite, reset-password, chat and notification targets |
| H-06 | Locked-module deep links land on a capability page (§7), never a dead end |

### 8.4 Projects (P) · Tasks (T)
| ID | Requirement |
|---|---|
| P-01 | Project list with search and filter, offline |
| P-02 | Project detail with tabs from the `projectTabs` slot, role- and visibility-filtered, **two-pane above tablet** |
| P-03 | Overview: status, progress, key dates, address with one-tap navigation, weather, crew on site |
| P-04 | Edit core project fields |
| P-05 | Project members with roles and visibility |
| T-01 | Global task list ("My Day") — today / overdue / upcoming |
| T-02 | Project task list: list, group and kanban views; kanban above a width threshold |
| T-03 | Create task (project and quick task), offline with a client UUID |
| T-04 | Edit: title, description, assignee, dates, priority, status, tags |
| T-05 | Status transitions honouring the existing state machine, with the same guards as 2.1 |
| T-06 | Accept or decline a task invitation, including from a push notification |
| T-07 | Task access roles enforced from `packages/core` |

### 8.5 Field (F) · Quality (Q) · Time (M)
| ID | Requirement |
|---|---|
| F-01 | Check in / out on a task with optional geolocation, offline, append-only |
| F-02 | Active check-in visible from anywhere with one-tap check-out |
| F-03 | Photo documentation: camera capture, multi-shot, gallery import, per-photo caption and category, before/after pairing |
| F-04 | Photo metadata stamped **at capture**: timestamp, task, project, author, GPS with permission |
| F-05 | Task chat with unread badges, realtime online, queued offline, per-message delivery state |
| F-06 | Attach photo or document to a chat message |
| F-07 | Handover chain (Færdigmeld → Godkend / Afvis) with **on-device signature capture** |
| F-08 | Team tab on a task: access, presence, invite |
| Q-01 | Punch list: create, edit, assign, severity, resolve, with photo evidence and location tags |
| Q-02 | Quality checklist per task: complete items, attach evidence, sign off |
| Q-03 | Conflict-resolution UI for concurrently edited punch-list and quality items |
| M-01 | **Floating timer** — start/stop against a task, persistent across restart and reboot, visible from any screen |
| M-02 | **8-hour reminder and auto-checkout as a locally scheduled notification plus a server-side safety net** — never a JS timer |
| M-03 | Manual and retroactive time entry |
| M-04 | Weekly own-hours overview; manager crew overview |

### 8.6 Documents (D) · Knowledge (K) · Tools (C)
| ID | Requirement |
|---|---|
| D-01 | Browse project documents with discipline and revision metadata |
| D-02 | Native PDF and image viewing; large drawings pinch-zoom and pan at full resolution |
| D-03 | **Mark for offline** — pre-fetched and retained until unmarked |
| D-04 | Upload from camera, gallery or the device file provider |
| D-05 | Share out via the native share sheet |
| K-01 | Search the regulation catalogue by keyword and §-reference, with category filters |
| K-02 | The 1.32 MB corpus is **not bundled** — fetched once into SQLite FTS5, then searched locally |
| K-03 | Favourite a regulation for guaranteed offline access |
| K-04 | Regulation detail with §-reference copy and share |
| C-01 | Calculators are rendered by **one schema-driven renderer**, not hand-written screens |
| C-02 | Every shipped calculator's result is **proven by golden fixtures**; where 2.1 was wrong, 3.0 is correct |
| C-03 | Compliance indicators, standards references, help drawer and safety disclaimers carried from `CalculatorMeta` |
| C-04 | Save a result to a project; share as text; export as a **server-generated** PDF |
| C-05 | **Calculators compute fully offline** — the catalogue is lazily required from the bundle, never network-fetched |

### 8.7 Notifications (N) · Settings (G)
| ID | Requirement |
|---|---|
| N-01 | Push via **three providers**: Web Push (VAPID), APNs and FCM, behind one server abstraction |
| N-02 | The existing notification catalogue and per-user preferences drive all three unchanged |
| N-03 | Every notification deep-links to its target |
| N-04 | Correct badge counts and an in-app notification centre |
| N-05 | Permission requested **in context**, after first value — never on first launch |
| G-01 | Profile view and edit |
| G-02 | Notification preferences |
| G-03 | **Sync & storage**: tier, cache size, Wi-Fi-only toggle, offline documents, clear cache, sync now, diagnostic export |
| G-04 | Appearance: light / dark / system, plus **outdoor high-contrast mode** |
| G-05 | Security: biometric lock and timeout, MFA management, active sessions |
| G-06 | About: version, build, privacy, terms, GDPR, support |
| G-07 | **Subscription and modules: purchasable on web, capability-only on native** (§7) |

---

## 9. Non-functional requirements

### 9.1 Performance budgets

| Metric | Native | Web |
|---|---|---|
| Cold start → interactive home | **< 2.0 s median, < 2.5 s p90** (iPhone 12 / Samsung A54) | — |
| Warm start | < 0.8 s | — |
| First-route JS | < 6 MB Hermes bytecode | **≤ 1.5 MB gzipped** |
| LCP / TTI on simulated 4G | — | **< 2.5 s / < 3.5 s** |
| Lighthouse PWA score | — | **≥ 90** |
| Camera ready from centre action | < 1.2 s | < 1.5 s |
| Photo capture → visible in task | < 0.5 s (local write) | < 0.5 s |
| List scroll, 500 items | 60 fps | 60 fps |
| Calculator input → result | < 100 ms | < 100 ms |
| Install size | < 60 MB iOS · < 45 MB AAB | — |
| Local DB after 90 days heavy use | < 200 MB excl. media | < 200 MB, subject to browser quota |
| Battery, 8 h shift, 40 photos, active timer | < 12 % of a 4,000 mAh battery | — |

### 9.2 Reliability
- **Zero data loss attributable to app, OS or sync behaviour on a device that remains functional.** Device loss, theft and browser eviction are accepted, disclosed risks — not defects. *(v1.0 stated an unqualified absolute the design cannot honour.)*
- Crash-free sessions ≥ 99.5 %; crash-free users ≥ 99.8 %.
- Sync converges: the outbox drains to empty or to an explicitly surfaced failure — never a silent stall.

### 9.3 Accessibility
WCAG 2.2 AA equivalents on all three runtimes: Dynamic Type / font scaling to 200 %, VoiceOver and TalkBack labels on every interactive element, ≥ 4.5:1 contrast, reduced-motion honoured, ≥ 48 dp targets. Audited at every phase gate.

### 9.4 Security & privacy
- **RLS is the sole authorisation boundary.** The anon key is public in a binary and is treated as such. No client-side-only authorisation, ever.
- Local database encrypted at rest on native (SQLCipher, key in secure storage, re-derived on biometric unlock). **On web, OPFS is origin-scoped but not encrypted** — disclosed.
- GDPR: consent screen for telemetry (the obligation does not disappear on native). **No ATT prompt** — no cross-company tracking.
- **A DPIA is required before launch.** Check-in geolocation, GPS-stamped photos and crew-hour visibility constitute employee monitoring, which in Denmark carries works-council and employment-law obligations beyond GDPR.
- In-app account deletion (an Apple requirement) and local purge on sign-out.
- A security review before the first paying customer.

### 9.5 Observability
Sentry (native + web) with release health and symbolication. **A client sync heartbeat reporting pending count, oldest pending age, poison count, media depth, cursor age and offline-authored share** — without it the §12 metrics are unmeasurable. Server-side aggregation with alert thresholds.

---

## 10. Architecture requirements

| ID | Requirement |
|---|---|
| AR-01 | One universal Expo app in `apps/app`; back-office in `apps/admin`; shared `packages/{core,calc-engine,ui,tokens,api-client}` |
| AR-02 | **A rule implemented twice is a defect** — scoped to business rules, formulas and entitlements. Two *renderings* are permitted; two *rules* are not |
| AR-03 | The module manifest contract carries over, including requires-closure and fail-open entitlements. **Manifest `load()` uses literal static imports** (Metro), and **`React.lazy` is never nested inside `React.lazy`** (production incident, 2026-07-11) |
| AR-04 | Design tokens generated from `packages/tokens`; nothing else defines a colour or spacing step |
| AR-05 | **No screen may import a sync-engine type directly.** Enforced by lint. This is why swapping the sync engine is a one-week job |
| AR-06 | `.web.tsx` siblings are the sanctioned escape hatch, and must be **substitutable**: same props, same behaviour, different rendering |
| AR-07 | `eslint-plugin-boundaries` module discipline carried into the monorepo from day one |
| AR-08 | Force-upgrade against a server minimum-version endpoint (native only, from v1.1) |

---

## 11. Epics and stories

Ten epics, mapped to build-plan phases. Each carries a goal, acceptance criteria and indicative stories. **Stories are sized to be independently completable and verifiable.**

### E1 — Universal foundation *(P1)*
**Goal:** a running universal app with a responsive design system, on three targets.
**AC:** ① The primitive gallery renders correctly on a physical iPhone, a physical mid-range Android and in a browser, at phone/tablet/desktop widths. ② `packages/core` ≥ 90 % coverage with every decision branch tested. ③ An accessibility audit passes on all three. ④ **The Gantt canary verdict is recorded** — either RNW handles it or `.web.tsx` is planned for `planning`. ⑤ i18n layer live, `da-DK` only.
**Stories:** tokens package · 25 responsive primitives · registry-driven responsive shell · core harvest · icon package · outdoor mode · Dynamic Type · Gantt canary · i18n scaffold · capability detection (S-13).

### E2 — Offline-native backend *(P2)*
**Goal:** a backend a two-week-offline client can safely rejoin.
**AC:** ① One consolidated baseline schema, reviewable in a single file. ② Every syncable table has tombstones with a stated retention window and a trigger-maintained indexed `updated_at`. ③ The RLS suite covers every table × every role, positive and negative. ④ A delete performed while a client is offline is learnable by that client on reconnect. ⑤ Idempotent replay of the same mutation produces one row.
**Stories:** schema consolidation · tombstones + retention · `updated_at` triggers · sync pull endpoint · mutation endpoint with idempotency · three-provider push abstraction · per-runtime session model · entitlement TTL and revocation adjudication · server-side reports · RLS test suite.

### E3 — Local store & read path *(P3a)*
**Goal:** the app reads its world from local storage on all three runtimes.
**AC:** ① The same repository contract satisfied by native SQLite ×2 and wasm/OPFS on web. ② Initial hydration completes with visible progress and a stated maximum duration. ③ Corruption is quarantined and re-hydrated, never silently re-created. ④ Multi-tab: a single writer is elected; other tabs read consistently.
**Stories:** local schema + migrations · repository layer · encryption · delta puller · cursor handling · tombstone application · hydration UX · corruption recovery · Web Locks election · contract tests across three runtimes.

### E4 — Outbox, media & conflicts *(P3b)* — **the hard gate**
**Goal:** nothing a user does offline is ever lost.
**AC:** ① **Both chaos arms pass 100 consecutive randomised runs with zero data loss.** ② A reference offline day (8 h, 40 photos, 12 check-ins, 30 mutations, no signal) drains to an empty outbox within 5 minutes of reconnection. ③ Property-based tests show convergence under any mutation/sync interleaving. ④ Every failure state is visible and actionable in the Sync Centre. ⑤ In the web Online-only tier the app **refuses** to queue rather than pretending.
**Stories:** outbox schema + replay · idempotency · dependency ordering · backoff and poison handling · media capture-to-disk · downscale · background upload · reconcile-on-launch · conflict engine per entity · resolution UI · Sync Centre · diagnostic export · chaos native · chaos web.

### E5 — Calculator engine & renderer *(P4, off the critical path)*
**Goal:** one calculator definition, three platforms, zero UI code per calculator.
**AC:** ① 100 % of computable calculators have human-reviewed golden fixtures. ② Mutation score ≥ 75 % on `calc-engine`. ③ Adding a calculator requires a schema entry, a pure function and a test — no UI code. ④ **`legacy/modules/tools/pages/**` is deleted.**
**Stories:** catalog harvest · divergence remediation (per calculator) · schema completion · pure-function extraction · fixture generation and review · universal renderer · visualisation descriptor layer · bespoke calculators · legacy deletion.

### E6 — Field work *(P5)* — **the heart of the product**
**Goal:** a crew documents a day's work on site, offline, in seconds.
**AC:** ① Camera against a task is ≤ 2 taps from cold start. ② Every field flow in §6.2 completes with the radio off. ③ A handover with signature survives force-quit and reboot before sync. ④ Chat ordering is preserved across offline authorship.
**Stories:** check-in/out + persistent banner · photo capture + metadata · multi-shot · gallery import · categories and pairing · task chat + unread · attachments · handover chain · signature capture · team tab.

### E7 — Projects, tasks, time, quality *(P5)*
**Goal:** the work itself is manageable from any device.
**AC:** ① Every list and detail is usable offline with visible freshness. ② The task state machine matches `packages/core` exactly, with server guards on replay. ③ The timer survives restart and reboot; the 8-hour reminder fires without the app running. ④ Two-pane layouts engage above the tablet breakpoint.
**Stories:** project list/detail/tabs/edit · task list views · create/edit/status · invitations · floating timer · scheduled reminder + server safety net · manual time entry · crew overview · punch list · quality checklist · conflict UI.

### E8 — Documents, knowledge & search *(P5)*
**Goal:** the reference material a tradesperson needs is on the phone before they lose signal.
**AC:** ① A marked document is available offline and survives eviction on native. ② Regulation search returns locally in < 300 ms after first corpus fetch. ③ The corpus is never in the initial bundle.
**Stories:** document browse · viewer · mark-for-offline · upload · share · corpus fetch and FTS5 index · search · favourites · detail · global search integration.

### E9 — Commerce & back-office *(P5, parallel)*
**Goal:** the product is sellable at PWA launch.
**AC:** ① The PWA marketplace completes a Stripe purchase and the entitlement appears on a second device within seconds. ② **The native binaries contain no module name, price, description or purchase path** — verified by a reviewer-perspective walkthrough. ③ The back-office covers everything out of scope for the universal app.
**Stories:** PWA marketplace · Stripe Checkout integration · entitlement propagation · native capability-only screens · `apps/admin` shell · platform admin · org/billing · SMTP · promo codes · tool access · 3D project wizard.

### E10 — Launch readiness *(P6/P7)*
**Goal:** ship it, twice.
**AC:** ① Every budget in §9.1 met on real hardware and the real web build. ② Accessibility audit passed. ③ **Real-site offline validation completed** — the installed PWA taken into actual basements. ④ DPIA completed and signed. ⑤ Store submissions accepted.
**Stories:** performance pass · bundle optimisation · a11y remediation · consent screen · DPIA · security review · store assets · privacy declarations · account deletion · EAS pipeline · TestFlight/Internal Testing · submission.

### The walking skeleton — **M1, week ~13**
Spanning E1–E4 and E6, one thin vertical slice built before breadth: **sign in → see one task → capture a photo with the radio off → reconnect → the photo is on the server.** On all three targets. It proves the entire architecture end to end at the earliest possible moment, and it is the first thing you can demo.

---

## 12. Success metrics

Baselines do not exist — 2.1 has no users. These are targets measured from launch, with the first 30 days establishing the baseline.

| Metric | Target at 3 months post-launch |
|---|---|
| **Mutations created while offline** — *proves the core thesis* | ≥ 20 % of all field mutations |
| Outbox items ending in unresolved failure | **< 0.1 %** |
| Weekly active field users per licensed seat | ≥ 60 % |
| Median sessions per active field user per working day | ≥ 6 |
| Documentation photos per completed task | Establish baseline, then +20 % quarter on quarter |
| Median time from task completion to handover submitted | Establish baseline, then −25 % |
| Crash-free sessions | ≥ 99.5 % |
| Cold start p90 (native) / LCP p90 (web) | < 2.5 s |
| Support tickets citing lost data **attributable to the app** | 0 |
| PWA install rate among field users | ≥ 50 % |

---

## 13. Risks

| # | Risk | P | I | Mitigation |
|---|---|:-:|:-:|---|
| R-01 | **Offline correctness across three runtimes** | H | **C** | E4 chaos gate, both arms, 100 runs, zero loss. Property-based testing. Buy the sync layer |
| R-02 | **PowerSync React Native Web support is beta and may be unusable** | M | H | **Resolved in P0 by a tri-target spike, not in P3.** Contingency: ElectricSQL, or web launches online-only |
| R-03 | Browser evicts a user's local database | M | M | Graded tiers, persistence request, PWA install prompt, honest UI, web chaos arm |
| R-04 | React Native Web fails a key screen | M | M | Gantt canary in E1; `.web.tsx` escape hatch; every component tested on both renderers |
| R-05 | Calculator consolidation overruns | H | L ⬇ | E5 is off the critical path and can be cut entirely from launch |
| R-06 | Store rejection over module purchases | M | **L** ⬇ | §7 removes the revenue exposure — a rejection delays distribution, not income |
| R-07 | Personas and scope are unevidenced | H | M | RS-1 ride-alongs during P0–P2; re-derive §3.4 before the launch scope is frozen |
| R-08 | `[auth.captcha]` is global — a native change can affect web signup | L | M | Decide native attestation before touching Supabase auth config; test on staging |
| R-09 | Employee-monitoring exposure under Danish law | M | H | DPIA before launch; works-council guidance; geolocation optional and disclosed |
| R-10 | Team ships fast and untested under "maximum power" | H | H | Test harness exists before feature code; no skipped tests; three-target builds per PR |

---

## 14. Decisions

| ID | Decision | Status |
|---|---|---|
| **D-01** | Billing on mobile | **Superseded by D-13** |
| D-02 | i18n layer now, `da-DK` only | **Decided — E1** |
| D-03 | Styling approach | **Resolved** — NativeWind v5 consumes Tailwind v4 `@theme` |
| D-04 | Calculator launch set | **Decided** — ships if ready; off the critical path |
| D-05 | Tablet support | **Decided** — responsive from E1, not a later phase |
| D-06 | Minimum OS | **Decided** — iOS 16.4 / Android API 26, set by Expo SDK 56 |
| D-07 | Native anti-abuse | **Decided** — App Attest / Play Integrity; Turnstile stays on web |
| D-08 | Offline grace | **Decided** — 14 days native, 72 h web, 72 h entitlement TTL |
| D-10 | Shared core adoption | **Superseded** — there is no second consumer to keep in step |
| **D-11** | **Offline: buy or build** | **Open — resolved by the P0 tri-target spike.** Recommendation: buy |
| **D-12** | **Universality scope** | **Decided** — one universal app; back-office DOM; `.web.tsx` escape hatch |
| **D-13** | **Commerce on the web surface** | **Decided** — §7 |

**Decision owner:** Moh. **Forum:** the P0 gate review at the end of week 3.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **RLS** | Row-Level Security — Postgres policies that decide which rows a user can see. The sole authorisation boundary |
| **aal2** | Supabase's "authenticator assurance level 2" — a session that has satisfied a second factor |
| **Outbox** | The durable, ordered queue of mutations made offline, awaiting replay |
| **Tombstone** | A soft-delete marker that lets an offline client learn a row was deleted |
| **LWW** | Last-writer-wins — a conflict policy where the most recent write survives |
| **OPFS** | Origin Private File System — the browser storage backing wasm SQLite |
| **RNW** | React Native Web — renders React Native components to the DOM |
| **FTS5** | SQLite's full-text search extension |
| **Hermes** | The JavaScript engine used by React Native |
| **VAPID** | The key protocol behind Web Push |
| **EAS** | Expo Application Services — build and submit pipeline |
| **dp / pt / px** | Density-independent pixel (Android) / point (iOS) / CSS pixel. Not interchangeable; targets are specified in dp |
| **Walking skeleton** | A thin end-to-end slice built before breadth, to prove the architecture |
