// Module display info — Danish name + one-liner per module. Harvested from
// legacy/core/registry/moduleInfo.ts. The fallback for modules without a manifest yet.

import type { ModuleId } from './types';

export interface ModuleInfo {
  name: string;
  description: string;
  /** Grouping that drives marketplace/admin section headers. */
  group: 'Foundation' | 'Operations' | 'Commercial' | 'Add-ons';
}

export const MODULE_INFO: Record<ModuleId, ModuleInfo> = {
  projects: { name: 'Projekter', description: 'Projekt-hub, overblik og status', group: 'Foundation' },
  tasks: { name: 'Opgaver', description: 'Opret, tildel og følg opgaver', group: 'Foundation' },
  tools: { name: 'Beregnere & Værktøjer', description: '~90 beregnere i 16 kategorier', group: 'Foundation' },
  knowledge: { name: 'Viden & Reglement', description: 'BR18/SBI/DS/AB18/AT-bibliotek og guides', group: 'Foundation' },
  field: { name: 'Udførelse & Kommunikation', description: 'Check-in, dokumentation, site-chat, presence', group: 'Operations' },
  quality: { name: 'KS & Aflevering', description: 'Kvalitetssikring, mangelliste, afleveringsrapport', group: 'Operations' },
  time: { name: 'Tidsregistrering', description: 'Timer, sjak og produktivitet — uden løn', group: 'Operations' },
  planning: { name: 'Plan & Kalender', description: 'Gantt, dagsplan og rute-tjek', group: 'Operations' },
  documents: { name: 'Dokumenter & Tegninger', description: 'Dokumentstyring, discipliner og revisioner', group: 'Operations' },
  team: { name: 'Team & Adgang', description: 'Sæder, invitationer og netværk', group: 'Operations' },
  budget: { name: 'Budget & Økonomistyring', description: 'Baseline, forecast og budget-burn', group: 'Commercial' },
  purchasing: { name: 'Indkøb & Leverandører', description: 'Indkøb, leverandører og levering', group: 'Commercial' },
  quotations: { name: 'Tilbud & Salg', description: 'Tilbud med linjer, moms og status', group: 'Commercial' },
  partners: { name: 'Partnere & Underentreprenører', description: 'Invitationer, forhandling og delegation', group: 'Commercial' },
  reporting: { name: 'Rapporter & Eksport', description: 'PDF-rapporter og Excel/CSV-eksport', group: 'Commercial' },
  'client-portal': { name: 'Kunde-portal', description: 'Read-only adgang for bygherre', group: 'Commercial' },
  ai: { name: 'AI-assistent', description: 'Chat, briefinger og intelligens (forbrug)', group: 'Add-ons' },
  ar: { name: 'AR & Opmåling', description: 'RoomMapper 3D-scanning og AR-måling', group: 'Add-ons' },
  integrations: { name: 'Integrationer & Data', description: 'Cloud-lager, ruter og regnskab', group: 'Add-ons' },
};
