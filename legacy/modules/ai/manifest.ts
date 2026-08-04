import type { ModuleManifest } from '../../core/registry/types';
import { MODULE_INFO } from '../../core/registry/moduleInfo';

/**
 * AI-assistent -- extracted in Phase 7 Wave 6. The chatbot mounts via App's
 * chrome (ChatbotController from this module's index); briefings and
 * intelligence render embedded in other modules' pages. No shell
 * contributions yet.
 */
export const manifest: ModuleManifest = {
  id: 'ai',
  name: MODULE_INFO['ai'].name,
  description: MODULE_INFO['ai'].description,
  requires: [],
  entitlement: 'module.ai',
  homeWidgets: [
    { id: 'ai-daily-briefing', context: 'management', section: 'main', order: 30, load: () => import('./components/home/DailyBriefingWidget').then((m) => ({ default: m.DailyBriefingWidget })) },
  ],
};
