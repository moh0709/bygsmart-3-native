# Videnscenter Demo AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich Videnscenter with production-safe Danish building regulation catalog content, add the supplied floor plan as a default demo punch-list layout, and verify AI briefing/chat failures.

**Architecture:** Keep the existing `/search` Videnscenter UI and `regulations` data model. Add a static catalog fallback that is merged with Supabase records, seed demo punch-list layouts/items during demo project creation, and verify Gemini through the production proxy without exposing secrets.

**Tech Stack:** React, TypeScript, Vite, Supabase, Express API, Playwright.

---

### Task 1: Regulation Catalog

**Files:**
- Create: `data/regulationCatalog.ts`
- Modify: `services/api.ts`
- Test: `data/regulationCatalog.test.ts`

- [ ] Add a typed static catalog with all BR18 chapters and curated source-linked entries for SBi/BUILD, DS, AB18, and Arbejdsmiljø.
- [ ] Merge the catalog with Supabase results in `searchRegulations` and `getRegulationById`.
- [ ] Add tests that every Videnscenter tab has entries and BR18 includes chapters 1-35.

### Task 2: Demo Punch List Floor Plan

**Files:**
- Create/copy: `public/demo/plantegning.png`
- Modify: `data/demoSeed.data.ts`
- Modify: `utils/demoSeeder.ts`

- [ ] Copy the supplied `plantegning.png` into the public demo assets.
- [ ] Extend demo seed data with a default punch-list layout and pins.
- [ ] Seed layout and punch-list items after creating a demo project.

### Task 3: AI Verification

**Files:**
- Inspect: `services/gemini.ts`
- Inspect: `server/index.js`

- [ ] Verify current Gemini model validity against Google documentation.
- [ ] Test `/api/gemini` through production.
- [ ] Use server logs to distinguish model errors from key/project permission errors.

### Task 4: Build And Deploy

**Files:**
- Build output: `dist/`
- Deployment target: `/home/omnifkht/public_html/byggeapp`
- Project sync target: `/opt/bygsmart`

- [ ] Run typecheck, unit tests, e2e smoke, and production build.
- [ ] Deploy static build to Namecheap with backup.
- [ ] Sync changed source/assets to `/opt/bygsmart`.
- [ ] Verify production demo login and Videnscenter content.
