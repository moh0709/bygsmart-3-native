// ─────────────────────────────────────────────────────────────────────────────
// ALL_MANIFESTS — the single static import list of module manifests.
//
// This is the ONLY file allowed to import modules/*/manifest.ts (enforced by
// the ESLint boundary rules) — the registry assembles everything else from
// here. No dynamic federation: shipping a new module's code is a normal
// deploy; activating an already-shipped module is a runtime entitlement flip.
//
// Modules register here as they are extracted:
//   Phase 4 → modules/tools (Calculators)
//   Phase 5 → nav/projectTabs contributions for the remaining domains
//   Phase 7 → everything else, wave by wave
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleManifest } from './types';
import { manifest as projectsManifest } from '../../modules/projects/manifest';
import { manifest as tasksManifest } from '../../modules/tasks/manifest';
import { manifest as toolsManifest } from '../../modules/tools/manifest';
import { manifest as timeManifest } from '../../modules/time/manifest';
import { manifest as planningManifest } from '../../modules/planning/manifest';
import { manifest as qualityManifest } from '../../modules/quality/manifest';
import { manifest as budgetManifest } from '../../modules/budget/manifest';
import { manifest as purchasingManifest } from '../../modules/purchasing/manifest';
import { manifest as quotationsManifest } from '../../modules/quotations/manifest';
import { manifest as partnersManifest } from '../../modules/partners/manifest';
import { manifest as documentsManifest } from '../../modules/documents/manifest';
import { manifest as teamManifest } from '../../modules/team/manifest';
import { manifest as knowledgeManifest } from '../../modules/knowledge/manifest';
import { manifest as reportingManifest } from '../../modules/reporting/manifest';
import { manifest as fieldManifest } from '../../modules/field/manifest';
import { manifest as clientPortalManifest } from '../../modules/client-portal/manifest';
import { manifest as aiManifest } from '../../modules/ai/manifest';
import { manifest as arManifest } from '../../modules/ar/manifest';
import { manifest as integrationsManifest } from '../../modules/integrations/manifest';

export const ALL_MANIFESTS: ModuleManifest[] = [
  projectsManifest, // Phase 5 — nav + overblik/detaljer tabs (domain code moves in Phase 7)
  tasksManifest, // Phase 5 — nav + opgaver tab
  toolsManifest, // Phase 4 — Calculators & Tools, the first extracted module
  timeManifest, // Phase 5 — tid-plan tab
  planningManifest, // Phase 5 — pamindelser + opfølgning tabs
  qualityManifest, // Phase 5 — punch-list tab
  budgetManifest, // Phase 5 — budget tab
  purchasingManifest, // Phase 5 — indkob tab
  quotationsManifest, // Phase 5 — tilbud tab
  partnersManifest, // Phase 5 — partnere tab
  documentsManifest, // Phase 5 — dokumenter tab
  teamManifest, // Phase 5 — rail nav
  knowledgeManifest, // Phase 7 W1 — regulation/guide routes + searchSources
  reportingManifest, // Phase 7 W1 — PDF/Excel export behind modules/reporting (no shell contributions yet)
  fieldManifest, // Phase 7 W3 — task-workspace route /task/:taskId (requires tasks)
  clientPortalManifest, // Phase 7 W5 — registered id only (no code/surfaces yet)
  aiManifest, // Phase 7 W6 — chatbot/briefing/intelligence code behind index (no shell contributions)
  arManifest, // Phase 7 W6 — Scan nav (center action) + RoomMapper
  integrationsManifest, // Phase 7 W6 — cloud/OAuth code behind index
];
