// The ONE file that statically imports module manifests — the eslint-plugin-boundaries /
// Metro guardrail (literal static imports only; manifest load() fns use literal import('./...'),
// React.lazy is never nested inside React.lazy). New modules are added here, never in the shell.
import type { ModuleManifest } from '@bygsmart/core';
import { projectsManifest } from '../modules/projects.manifest';
import { tasksManifest } from '../modules/tasks.manifest';

export const ALL_MANIFESTS: ModuleManifest[] = [projectsManifest, tasksManifest];
