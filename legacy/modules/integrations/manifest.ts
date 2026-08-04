import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';

/**
 * Integrationer & Data -- extracted in Phase 7 Wave 6. Cloud-drive browsing +
 * OAuth connect flows. No shell contributions yet: the connect UI lives in
 * SettingsPage until the settingsSections slot lands (W7).
 */
export const manifest: ModuleManifest = {
  id: 'integrations',
  name: MODULE_INFO['integrations'].name,
  description: MODULE_INFO['integrations'].description,
  requires: [],
  entitlement: 'module.integrations',
  settingsSections: [
    { id: 'integrations-settings', order: 10, load: () => import('./components/IntegrationsSettingsSection').then((m) => ({ default: m.IntegrationsSettingsSection })) },
  ],
};
