/**
 * wizardCatalog.ts
 * Complete BYG SMART task catalog for the v3 wizard.
 * All UI strings in Danish. All IDs/keys in English.
 */

// ─── Type Definitions ────────────────────────────────────────────────────────

export type ProjectTypeId =
  | 'nybyg'
  | 'renovering'
  | 'vedligehold'
  | 'tilbygning'
  | 'lejlighed'
  | 'let_erhverv';

export type TradeId =
  | 'Tømrer'
  | 'El'
  | 'VVS'
  | 'Maler'
  | 'Murer'
  | 'Tagdækker'
  | 'Blikkenslager'
  | 'Gulvlægger'
  | 'Materiel'
  | 'Diverse';

export type ZoneView = 'exterior' | 'interior' | 'apartment' | 'model';

export interface Task {
  id: string;
  label: string;
  trade: TradeId;
  icon: string;
  complexity: 1 | 2 | 3;
  duration: string;
  durationDaysMin: number;
  durationDaysMax: number;
  isMaintenance?: boolean;
  dependsOn?: string[];
  coSelectedWith?: string[];
  phase: 1 | 2 | 3 | 4;
}

export interface ZoneConfig {
  id: string;
  label: string;
  sublabel: string;
  highlightColor: string;
  icon: string;
  view: ZoneView;
  floorId?: string;
  tasksKey: string;
}

export interface ZoneSelection {
  zoneId: string;
  floorId?: string;
  quantity: number;
  source: 'user' | 'ai';
}

export interface Bundle {
  id: string;
  label: string;
  zoneKey: string;
  icon: string;
  taskIds: string[];
}

export interface ProjectType {
  id: ProjectTypeId;
  label: string;
  description: string;
  icon: string;
  buildingIllustration: string;
  availableAreaTabs: string[];
  preselectedZones: string[];
  taskFilterFlag?: string;
}

export interface WizardState {
  entryMode: 'ai' | 'visual' | 'quick';
  currentStep: 0 | 1 | 2 | 3 | 4;
  projectType: ProjectTypeId | null;
  selectedZones: ZoneSelection[];
  selectedTasks: Record<string, string[]>;
  activeZoneTab: string | null;
  details: {
    name: string;
    address?: string;
    team: string[];
    startDate?: string;
    notes?: string;
  };
  ai: {
    pending: Record<string, boolean>;
  };
}

// ─── Project Types ────────────────────────────────────────────────────────────

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: 'nybyg',
    label: 'Nybyggeri',
    description: 'Opførelse af ny bolig fra grunden',
    icon: '🏗️',
    buildingIllustration: 'house_under_construction',
    availableAreaTabs: ['Råhus & Struktur', 'Tag', 'Facade', 'Indvendig', 'Udendørs'],
    preselectedZones: ['fundament_sokkel', 'tag_og_skorsten', 'facade_stueetage', 'kloak_forsyning'],
  },
  {
    id: 'renovering',
    label: 'Renovering',
    description: 'Modernisering af eksisterende bolig',
    icon: '🔨',
    buildingIllustration: 'house_full',
    availableAreaTabs: ['Udvendig', 'Indvendig'],
    preselectedZones: [],
  },
  {
    id: 'vedligehold',
    label: 'Vedligeholdelse',
    description: 'Løbende vedligehold og reparationer',
    icon: '🔧',
    buildingIllustration: 'house_full',
    availableAreaTabs: ['Udvendig', 'Indvendig'],
    preselectedZones: [],
    taskFilterFlag: 'maintenance_tasks_only',
  },
  {
    id: 'tilbygning',
    label: 'Tilbygning / Ombygning',
    description: 'Udvidelse eller omdannelse af bygning',
    icon: '➕',
    buildingIllustration: 'house_with_extension_highlighted',
    availableAreaTabs: ['Udvendig', 'Indvendig', 'Tilbygning'],
    preselectedZones: ['garage_carport', 'fundament_sokkel'],
  },
  {
    id: 'lejlighed',
    label: 'Lejlighed / Ejendom',
    description: 'Renovering af lejlighed eller etageejendom',
    icon: '🏢',
    buildingIllustration: 'apartment_block_cross_section',
    availableAreaTabs: ['Lejlighed', 'Fællesarealer', 'Ejendom Udvendig'],
    preselectedZones: [],
  },
  {
    id: 'let_erhverv',
    label: 'Let Erhverv',
    description: 'Kontor, butik, mindre erhvervsbygning',
    icon: '🏭',
    buildingIllustration: 'commercial_light',
    availableAreaTabs: ['Udvendig', 'Indvendig'],
    preselectedZones: [],
  },
];

// ─── Zone Configs ─────────────────────────────────────────────────────────────

export const EXTERIOR_ZONES: ZoneConfig[] = [
  {
    id: 'tag_og_skorsten',
    label: 'Tag & Skorsten',
    sublabel: 'Tagbelægning, tagrender, ovenlysvinduer',
    highlightColor: '#DC2626',
    icon: '🏠',
    view: 'exterior',
    tasksKey: 'tag_og_skorsten',
  },
  {
    id: 'loft_tagetage',
    label: 'Loft & Tagetage',
    sublabel: 'Isolering, loftrum, kviste, dampspærre',
    highlightColor: '#7C3AED',
    icon: '📐',
    view: 'exterior',
    tasksKey: 'loft_tagetage',
  },
  {
    id: 'solceller_energi',
    label: 'Solceller & Energi',
    sublabel: 'Solceller, solfangere, batteri, elbil-lader',
    highlightColor: '#F59E0B',
    icon: '☀️',
    view: 'exterior',
    tasksKey: 'solceller_energi',
  },
  {
    id: 'facade_overetage',
    label: 'Facade 1. Sal',
    sublabel: 'Beklædning, isolering, puds, maleri',
    highlightColor: '#2563EB',
    icon: '🧱',
    view: 'exterior',
    tasksKey: 'facade_generel',
  },
  {
    id: 'vinduer_overetage',
    label: 'Vinduer 1. Sal',
    sublabel: 'Vinduesskift, karme, fuger, solafskærmning',
    highlightColor: '#0EA5E9',
    icon: '🪟',
    view: 'exterior',
    tasksKey: 'vinduer_doere',
  },
  {
    id: 'altan_balkon',
    label: 'Altan & Balkon',
    sublabel: 'Altandæk, rækværk, afvanding, belysning',
    highlightColor: '#10B981',
    icon: '🏗️',
    view: 'exterior',
    tasksKey: 'altan_balkon',
  },
  {
    id: 'facade_stueetage',
    label: 'Facade Stueetage',
    sublabel: 'Facadebeklædning, isolering, sokkelpuds',
    highlightColor: '#2563EB',
    icon: '🧱',
    view: 'exterior',
    tasksKey: 'facade_generel',
  },
  {
    id: 'vinduer_doere_stueetage',
    label: 'Vinduer & Døre',
    sublabel: 'Vinduer, hoveddør, terrassedør, karme',
    highlightColor: '#0EA5E9',
    icon: '🚪',
    view: 'exterior',
    tasksKey: 'vinduer_doere',
  },
  {
    id: 'garage_carport',
    label: 'Garage & Carport',
    sublabel: 'Tag, gulv, port, el, port-automatik',
    highlightColor: '#6B7280',
    icon: '🚗',
    view: 'exterior',
    tasksKey: 'garage_carport',
  },
  {
    id: 'terrasse_udendoers',
    label: 'Terrasse & Udendørs',
    sublabel: 'Terrassedæk, fliser, trappe, rækværk, belysning',
    highlightColor: '#D97706',
    icon: '🪴',
    view: 'exterior',
    tasksKey: 'terrasse_udendoers',
  },
  {
    id: 'indkoersel_belaegning',
    label: 'Indkørsel & Belægning',
    sublabel: 'Asfalt, fliser, drænbelægning, kantsten',
    highlightColor: '#92400E',
    icon: '🛣️',
    view: 'exterior',
    tasksKey: 'indkoersel_belaegning',
  },
  {
    id: 'have_hegn',
    label: 'Have & Hegn',
    sublabel: 'Hegn, låge, jordarbejde, beplantning',
    highlightColor: '#16A34A',
    icon: '🌳',
    view: 'exterior',
    tasksKey: 'have_hegn',
  },
  {
    id: 'fundament_sokkel',
    label: 'Fundament & Sokkel',
    sublabel: 'Sokkelreparation, fugt, dræn, radon',
    highlightColor: '#78350F',
    icon: '🏛️',
    view: 'exterior',
    tasksKey: 'fundament_sokkel',
  },
  {
    id: 'kaelder_udvendig',
    label: 'Kælder (udvendig)',
    sublabel: 'Kældervindue, udvendig dræn, membran',
    highlightColor: '#4C1D95',
    icon: '⬇️',
    view: 'exterior',
    tasksKey: 'kaelder_udvendig',
  },
  {
    id: 'kloak_forsyning',
    label: 'Kloak & Forsyning',
    sublabel: 'Kloakrør, skelbrønd, vand, fjernvarme',
    highlightColor: '#1E40AF',
    icon: '🔌',
    view: 'exterior',
    tasksKey: 'kloak_forsyning',
  },
];

export const FLOOR_ROOMS: Record<string, ZoneConfig[]> = {
  stueetage: [
    { id: 'stue', label: 'Stue', sublabel: 'Stue & Opholdsrum', highlightColor: '#F59E0B', icon: '🛋️', view: 'interior', floorId: 'stueetage', tasksKey: 'stue_vaerelser' },
    { id: 'alrum_spisestu', label: 'Alrum / Spisestue', sublabel: 'Alrum og spiseområde', highlightColor: '#F59E0B', icon: '🍽️', view: 'interior', floorId: 'stueetage', tasksKey: 'stue_vaerelser' },
    { id: 'koekken', label: 'Køkken', sublabel: 'Køkken og køkkenalrum', highlightColor: '#10B981', icon: '🍳', view: 'interior', floorId: 'stueetage', tasksKey: 'koekken' },
    { id: 'badevaereelse_stue', label: 'Badeværelse', sublabel: 'Bad, toilet og brus', highlightColor: '#2563EB', icon: '🚿', view: 'interior', floorId: 'stueetage', tasksKey: 'badevaereelse' },
    { id: 'bryggers_vaskerum', label: 'Bryggers', sublabel: 'Bryggers og vaskerum', highlightColor: '#7C3AED', icon: '🧺', view: 'interior', floorId: 'stueetage', tasksKey: 'bryggers_vaskerum' },
    { id: 'entree_gang_stue', label: 'Entré & Gang', sublabel: 'Entré, gang og trappe', highlightColor: '#D97706', icon: '🚪', view: 'interior', floorId: 'stueetage', tasksKey: 'entree_gang' },
  ],
  overetage: [
    { id: 'sovevaereelse', label: 'Soveværelse', sublabel: 'Soveværelse og garderobe', highlightColor: '#F59E0B', icon: '🛏️', view: 'interior', floorId: 'overetage', tasksKey: 'sovevaereelse' },
    { id: 'boernevaereelse_1', label: 'Børneværelse 1', sublabel: 'Børneværelse', highlightColor: '#F59E0B', icon: '🧸', view: 'interior', floorId: 'overetage', tasksKey: 'stue_vaerelser' },
    { id: 'boernevaereelse_2', label: 'Børneværelse 2', sublabel: 'Børneværelse', highlightColor: '#F59E0B', icon: '🧸', view: 'interior', floorId: 'overetage', tasksKey: 'stue_vaerelser' },
    { id: 'badevaereelse_sal', label: 'Badeværelse 1. sal', sublabel: 'Bad og toilet på 1. sal', highlightColor: '#2563EB', icon: '🚿', view: 'interior', floorId: 'overetage', tasksKey: 'badevaereelse' },
    { id: 'gang_repos', label: 'Gang / Repos', sublabel: 'Gang og repos på 1. sal', highlightColor: '#D97706', icon: '🪜', view: 'interior', floorId: 'overetage', tasksKey: 'entree_gang' },
    { id: 'kontor_hobbyrum', label: 'Kontor / Hobbyrum', sublabel: 'Kontor og hobbyrum', highlightColor: '#16A34A', icon: '💼', view: 'interior', floorId: 'overetage', tasksKey: 'kontor_hobbyrum' },
  ],
  kaelder: [
    { id: 'kaelder_rum', label: 'Kælderrum', sublabel: 'Kælder og opbevaring', highlightColor: '#6B7280', icon: '📦', view: 'interior', floorId: 'kaelder', tasksKey: 'kaelder_indvendig' },
    { id: 'teknisk_rum', label: 'Teknisk Rum', sublabel: 'Varme, el og teknik', highlightColor: '#DC2626', icon: '⚙️', view: 'interior', floorId: 'kaelder', tasksKey: 'teknisk_rum' },
    { id: 'kaelder_bad', label: 'Kælder Bad', sublabel: 'Badeværelse i kælder', highlightColor: '#2563EB', icon: '🚿', view: 'interior', floorId: 'kaelder', tasksKey: 'badevaereelse' },
  ],
};

export const APARTMENT_ZONES: ZoneConfig[] = [
  { id: 'tag_ejendom', label: 'Tag (Ejendom)', sublabel: 'Tagbelægning og tagkonstruktion', highlightColor: '#DC2626', icon: '🏠', view: 'apartment', tasksKey: 'tag_og_skorsten' },
  { id: 'facade_ejendom', label: 'Facade (Ejendom)', sublabel: 'Facadebeklædning og isolering', highlightColor: '#2563EB', icon: '🧱', view: 'apartment', tasksKey: 'facade_generel' },
  { id: 'altaner_ejendom', label: 'Altaner (Alle)', sublabel: 'Altaner og rækværk', highlightColor: '#10B981', icon: '🏗️', view: 'apartment', tasksKey: 'altan_balkon' },
  { id: 'lejlighed_indvendig', label: 'Lejlighed (Indvendig)', sublabel: 'Indvendig renovering af lejlighed', highlightColor: '#F59E0B', icon: '🏡', view: 'apartment', tasksKey: 'lejlighed_fuld' },
  { id: 'faellesarealer', label: 'Fællesarealer', sublabel: 'Opgange, kælder og fælles rum', highlightColor: '#8B5CF6', icon: '🏢', view: 'apartment', tasksKey: 'faellesarealer' },
  { id: 'kaelder_ejendom', label: 'Kælder / Teknik', sublabel: 'Kælder, varme og teknik', highlightColor: '#4C1D95', icon: '⚙️', view: 'apartment', tasksKey: 'kaelder_indvendig' },
  { id: 'elevator_trapper', label: 'Elevator & Trapper', sublabel: 'Elevator og trapperum', highlightColor: '#6B7280', icon: '🛗', view: 'apartment', tasksKey: 'elevator_trapper' },
];

// ─── Full Task Library ────────────────────────────────────────────────────────

export const TASKS_BY_ZONE: Record<string, Task[]> = {

  tag_og_skorsten: [
    { id: 'stillads_tag', label: 'Stillads', trade: 'Materiel', icon: '🪜', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'nedrivning_gammelt_tag', label: 'Nedrivning af gammelt tag', trade: 'Tagdækker', icon: '⛏️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, dependsOn: ['stillads_tag'], phase: 1 },
    { id: 'ny_tagbelaegning_tegl', label: 'Ny tagbelægning (tegl/beton)', trade: 'Tagdækker', icon: '🏠', complexity: 3, duration: '3-7 dage', durationDaysMin: 3, durationDaysMax: 7, dependsOn: ['nyt_undertag'], phase: 2 },
    { id: 'ny_tagbelaegning_tagpap', label: 'Ny tagbelægning (tagpap/membran)', trade: 'Tagdækker', icon: '🏠', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'ny_tagbelaegning_staal', label: 'Ny tagbelægning (stålplade)', trade: 'Tagdækker', icon: '🏠', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'groent_tag', label: 'Grønt tag / Sedum', trade: 'Tagdækker', icon: '🌿', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'nyt_undertag', label: 'Nyt undertag / dampspærre', trade: 'Tømrer', icon: '📋', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'ovenlysvinduer', label: 'Ovenlysvinduer', trade: 'Tømrer', icon: '🪟', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'tagrender_nedloeb', label: 'Tagrender & Nedløb', trade: 'Blikkenslager', icon: '💧', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'skotrender_zink', label: 'Skotrender (Zink/Alu)', trade: 'Blikkenslager', icon: '🔩', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'sternbraedder', label: 'Sternbrædder & Underbeklædning', trade: 'Tømrer', icon: '🪵', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'snefang', label: 'Snefang', trade: 'Tømrer', icon: '❄️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'taghatter_ventilation', label: 'Taghætter & Ventilation', trade: 'Tagdækker', icon: '💨', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'reparation_undertag', label: 'Reparation af undertag', trade: 'Tømrer', icon: '🔧', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 2 },
    { id: 'maling_udhaeng', label: 'Maling af Udhæng & Stern', trade: 'Maler', icon: '🎨', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, isMaintenance: true, phase: 3 },
    { id: 'skorsten_reparation', label: 'Skorsten – Reparation', trade: 'Murer', icon: '🏭', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 2 },
    { id: 'skorsten_foring', label: 'Skorstensforing (rustfri)', trade: 'Murer', icon: '🏭', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
  ],

  loft_tagetage: [
    { id: 'efterisolering_loft_100mm', label: 'Efterisolering loft (100 mm)', trade: 'Tømrer', icon: '🌡️', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'efterisolering_loft_200mm', label: 'Efterisolering loft (200 mm)', trade: 'Tømrer', icon: '🌡️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'dampspærre_loft', label: 'Dampspærre', trade: 'Tømrer', icon: '📋', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, dependsOn: ['efterisolering_loft_200mm'], phase: 2 },
    { id: 'loftluge', label: 'Loftluge & Stige', trade: 'Tømrer', icon: '🪜', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'kvistvindue', label: 'Kvist & Kvisttag', trade: 'Tømrer', icon: '🏠', complexity: 3, duration: '3-5 dage', durationDaysMin: 3, durationDaysMax: 5, phase: 2 },
    { id: 'tagetage_indretning', label: 'Tagetage – Indretning/Ombygning', trade: 'Tømrer', icon: '📐', complexity: 3, duration: '5-15 dage', durationDaysMin: 5, durationDaysMax: 15, phase: 2 },
    { id: 'loftrum_gulv', label: 'Gangbro / Gulv i loftrum', trade: 'Tømrer', icon: '🪵', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'ventilation_loft', label: 'Ventilation af tagrum', trade: 'Tømrer', icon: '💨', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
  ],

  solceller_energi: [
    { id: 'solceller_montering', label: 'Solceller – Montering', trade: 'El', icon: '☀️', complexity: 3, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'solfanger_varmt_vand', label: 'Solfanger (varmt vand)', trade: 'VVS', icon: '🌤️', complexity: 3, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'inverter_installation', label: 'Inverter – Installation', trade: 'El', icon: '🔋', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, dependsOn: ['solceller_montering'], phase: 2 },
    { id: 'batteri_lagring', label: 'Batterilager', trade: 'El', icon: '🔋', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'el_tavle_opdatering', label: 'El-tavle opdatering', trade: 'El', icon: '⚡', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ladevaegg_elbil', label: 'Ladeanlæg til elbil', trade: 'El', icon: '🚗', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'smarthome_energi', label: 'Smart Home – Energistyring', trade: 'El', icon: '📱', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  facade_generel: [
    { id: 'stillads_facade', label: 'Stillads', trade: 'Materiel', icon: '🪜', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'nedrivning_gammel_belaegning', label: 'Nedrivning af gammel facadebeklædning', trade: 'Tømrer', icon: '⛏️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, dependsOn: ['stillads_facade'], phase: 1 },
    { id: 'efterisolering_facade_100mm', label: 'Efterisolering facade (100 mm)', trade: 'Tømrer', icon: '🌡️', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'efterisolering_facade_200mm', label: 'Efterisolering facade (200 mm)', trade: 'Tømrer', icon: '🌡️', complexity: 3, duration: '3-5 dage', durationDaysMin: 3, durationDaysMax: 5, phase: 2 },
    { id: 'facadebelaegning_puds', label: 'Ny facadebeklædning – Puds/ETICS', trade: 'Murer', icon: '🧱', complexity: 3, duration: '5-10 dage', durationDaysMin: 5, durationDaysMax: 10, phase: 3 },
    { id: 'facadebelaegning_trae', label: 'Ny facadebeklædning – Træ/Fiber', trade: 'Tømrer', icon: '🪵', complexity: 3, duration: '4-8 dage', durationDaysMin: 4, durationDaysMax: 8, phase: 3 },
    { id: 'facadebelaegning_tegl', label: 'Ny facadebeklædning – Tegl/Klinker', trade: 'Murer', icon: '🧱', complexity: 3, duration: '5-10 dage', durationDaysMin: 5, durationDaysMax: 10, phase: 3 },
    { id: 'facadebelaegning_beton', label: 'Ny facadebeklædning – Fibercementplade', trade: 'Tømrer', icon: '🔲', complexity: 2, duration: '3-6 dage', durationDaysMin: 3, durationDaysMax: 6, phase: 3 },
    { id: 'maling_facade', label: 'Maling af facade', trade: 'Maler', icon: '🎨', complexity: 2, duration: '3-6 dage', durationDaysMin: 3, durationDaysMax: 6, isMaintenance: true, phase: 3 },
    { id: 'fugebehandling', label: 'Fugebehandling & Tætning', trade: 'Murer', icon: '🔩', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, isMaintenance: true, phase: 3 },
    { id: 'sokkelpuds', label: 'Sokkelpuds & Sokkelmaleri', trade: 'Murer', icon: '🏛️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, isMaintenance: true, phase: 3 },
    { id: 'solafskærmning_markise', label: 'Solafskærmning & Markise', trade: 'Diverse', icon: '☂️', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  vinduer_doere: [
    { id: 'vinduer_skift_1fag', label: 'Vinduesskift – Enkelt vindue', trade: 'Tømrer', icon: '🪟', complexity: 2, duration: '0.5 dag/vindue', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'vinduer_skift_alle', label: 'Vinduesskift – Alle vinduer', trade: 'Tømrer', icon: '🪟', complexity: 3, duration: '2-5 dage', durationDaysMin: 2, durationDaysMax: 5, phase: 2 },
    { id: 'ny_hoveddoer', label: 'Ny Hoveddør', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ny_terrassedoer', label: 'Ny Terrassedør / Skydedør', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ny_altandoer', label: 'Ny Altandør', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'karme_fuger', label: 'Karme & Fuger (alle vinduer)', trade: 'Tømrer', icon: '🔩', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, isMaintenance: true, phase: 3 },
    { id: 'glasudskiftning', label: 'Glasudskiftning (ruder)', trade: 'Tømrer', icon: '🪟', complexity: 1, duration: '0.5 dag/rude', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 2 },
    { id: 'solfilm_vinduer', label: 'Solfilm på vinduer', trade: 'Diverse', icon: '☀️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'rullejalousis', label: 'Rullejalousi / Persienner', trade: 'Diverse', icon: '🪟', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  altan_balkon: [
    { id: 'nedrivning_gammel_altan', label: 'Nedrivning af gammel altan', trade: 'Tømrer', icon: '⛏️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'ny_altandaek_trae', label: 'Nyt altandæk – Træ/Komposit', trade: 'Tømrer', icon: '🪵', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'ny_altandaek_beton', label: 'Nyt altandæk – Beton/Fliser', trade: 'Murer', icon: '🧱', complexity: 3, duration: '3-5 dage', durationDaysMin: 3, durationDaysMax: 5, phase: 2 },
    { id: 'altan_membran', label: 'Altanmembran & Vandtætning', trade: 'Tagdækker', icon: '💧', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'raekverk_glas', label: 'Rækværk – Glas', trade: 'Tømrer', icon: '🔲', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'raekverk_metal', label: 'Rækværk – Metal/Stål', trade: 'Tømrer', icon: '🔩', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'altan_belysning', label: 'Altanbelysning (el)', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'altan_afvanding', label: 'Afvanding & Fald', trade: 'VVS', icon: '💧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'altan_trappe', label: 'Trappe til altan/terrasse', trade: 'Tømrer', icon: '🪜', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
  ],

  garage_carport: [
    { id: 'garage_tag_nyt', label: 'Nyt garagetag', trade: 'Tagdækker', icon: '🏠', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'garageport_ny', label: 'Ny garageport', trade: 'Tømrer', icon: '🚗', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'garageport_automatik', label: 'Garageport – Automatik/Motor', trade: 'El', icon: '⚙️', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'garage_gulv_stoebning', label: 'Nyt garagegulv – Støbning', trade: 'Murer', icon: '🧱', complexity: 3, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'garage_gulv_epoxy', label: 'Garagegulv – Epoxybelægning', trade: 'Gulvlægger', icon: '🔲', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'garage_el', label: 'El i garage (stikkontakter/lys)', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'carport_ny', label: 'Nyt carport (træ/stål)', trade: 'Tømrer', icon: '🏗️', complexity: 3, duration: '2-5 dage', durationDaysMin: 2, durationDaysMax: 5, phase: 2 },
    { id: 'garage_isolering', label: 'Isolering af garage', trade: 'Tømrer', icon: '🌡️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'garage_vindue_doer', label: 'Vindue & sidedør til garage', trade: 'Tømrer', icon: '🪟', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  terrasse_udendoers: [
    { id: 'nedrivning_gammel_terrasse', label: 'Nedrivning af gammel terrasse', trade: 'Tømrer', icon: '⛏️', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'ny_terrasse_trae', label: 'Ny terrasse – Trædæk', trade: 'Tømrer', icon: '🪵', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'ny_terrasse_komposit', label: 'Ny terrasse – Komposit', trade: 'Tømrer', icon: '🔲', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'ny_terrasse_fliser', label: 'Ny terrasse – Betonfliser/Natursten', trade: 'Murer', icon: '🧱', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'terrassetrappe', label: 'Trappe til terrasse', trade: 'Tømrer', icon: '🪜', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'raekverk_terrasse', label: 'Rækværk / Terrassegelænder', trade: 'Tømrer', icon: '🔩', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'terrassebelysning', label: 'Terrassebelysning (el)', trade: 'El', icon: '💡', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'udehane_vand', label: 'Udehane / Vandtilslutning', trade: 'VVS', icon: '💧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'terrasse_afvanding', label: 'Afvanding & Fald fra terrasse', trade: 'VVS', icon: '💧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'pergola_overdaekning', label: 'Pergola / Overdækning', trade: 'Tømrer', icon: '☂️', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
  ],

  indkoersel_belaegning: [
    { id: 'opbrydning_gammel_belaegning', label: 'Opbrydning af gammel belægning', trade: 'Murer', icon: '⛏️', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'ny_belaegning_fliser', label: 'Ny belægning – Betonfliser', trade: 'Murer', icon: '🧱', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'ny_belaegning_asfalt', label: 'Ny belægning – Asfalt', trade: 'Murer', icon: '🛣️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'ny_belaegning_granitskærver', label: 'Ny belægning – Grus/Granitskærver', trade: 'Diverse', icon: '⚪', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ny_belaegning_draen', label: 'Ny belægning – Drænfliser', trade: 'Murer', icon: '💧', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 2 },
    { id: 'kantsten', label: 'Kantsten & Afskærmning', trade: 'Murer', icon: '🔲', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'planering_jordarbejde', label: 'Planering & Jordarbejde', trade: 'Diverse', icon: '🚜', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'stikledning_el_indkoersel', label: 'El-stikledning til indkørsel', trade: 'El', icon: '⚡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
  ],

  have_hegn: [
    { id: 'hegn_trae_nyt', label: 'Nyt hegn – Træ', trade: 'Tømrer', icon: '🌳', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'hegn_metal_nyt', label: 'Nyt hegn – Metal/Stål', trade: 'Tømrer', icon: '🔩', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'laage_ny', label: 'Ny indkørselsport / Låge', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'laage_automatik', label: 'Port-automatik / Adgangskontrol', trade: 'El', icon: '⚙️', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'jordarbejde_have', label: 'Jordarbejde & Planering', trade: 'Diverse', icon: '🚜', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 1 },
    { id: 'drænroer_have', label: 'Dræning af have', trade: 'VVS', icon: '💧', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'havebelysning', label: 'Havebelysning (el)', trade: 'El', icon: '💡', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'beplantning_oprenning', label: 'Beplantning & Oprensning', trade: 'Diverse', icon: '🌱', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  fundament_sokkel: [
    { id: 'sokkelpuds_reparation', label: 'Sokkelpuds – Reparation', trade: 'Murer', icon: '🏛️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, isMaintenance: true, phase: 2 },
    { id: 'fugtspærre_sokkel', label: 'Fugtspærre & Sokkeldræn', trade: 'Murer', icon: '💧', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 1 },
    { id: 'radonsikring', label: 'Radonsikring', trade: 'Tømrer', icon: '☢️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'fundamentsforstærkning', label: 'Fundamentsforstærkning', trade: 'Murer', icon: '🏛️', complexity: 3, duration: '3-7 dage', durationDaysMin: 3, durationDaysMax: 7, phase: 1 },
    { id: 'udvendig_drængraevning', label: 'Udvendig Dræning (gravning)', trade: 'Diverse', icon: '🚜', complexity: 3, duration: '3-5 dage', durationDaysMin: 3, durationDaysMax: 5, phase: 1 },
    { id: 'bitumenmembran', label: 'Bitumenmembran (sokkel)', trade: 'Tagdækker', icon: '📋', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, dependsOn: ['udvendig_drængraevning'], phase: 1 },
    { id: 'sokkelbeklædning_ny', label: 'Ny Sokkelbeklædning (fliser/natur)', trade: 'Murer', icon: '🧱', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
  ],

  kaelder_udvendig: [
    { id: 'kaelder_vindue_skift', label: 'Kældervindue – Skift', trade: 'Tømrer', icon: '🪟', complexity: 2, duration: '0.5 dag/vindue', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'lysgraeve', label: 'Lysgrave (nyt/reparation)', trade: 'Murer', icon: '⬇️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'kaelder_udvendig_membran', label: 'Udvendig Kældermembran', trade: 'Tagdækker', icon: '💧', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 1 },
    { id: 'kaelder_draen_udvendig', label: 'Kælderdræn (udvendig)', trade: 'VVS', icon: '💧', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 1 },
    { id: 'kaelder_trappe_udvendig', label: 'Udvendig Kældertrappe', trade: 'Murer', icon: '🪜', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 2 },
  ],

  kloak_forsyning: [
    { id: 'kloakroer_udskiftning', label: 'Kloakrør – Udskiftning/Relining', trade: 'VVS', icon: '🔌', complexity: 3, duration: '2-5 dage', durationDaysMin: 2, durationDaysMax: 5, phase: 1 },
    { id: 'skelbroend', label: 'Skelbrønd & Stikledning', trade: 'VVS', icon: '⭕', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'regnvand_haandtering', label: 'Regnvandshåndtering / Nedsivning', trade: 'VVS', icon: '🌧️', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 1 },
    { id: 'vandforsyning_stikledning', label: 'Vandforsyning – Ny stikledning', trade: 'VVS', icon: '💧', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'fjernvarme_stikledning', label: 'Fjernvarme – Ny stikledning', trade: 'VVS', icon: '🔥', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 1 },
    { id: 'kloakinspektion', label: 'TV-inspektion af kloak', trade: 'VVS', icon: '📹', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 1 },
  ],

  stue_vaerelser: [
    { id: 'nedrivning_vaegge', label: 'Nedrivning / Åbning af vægge', trade: 'Tømrer', icon: '⛏️', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'nye_vaegge_gips', label: 'Nye vægge – Gipsvæg/Skelet', trade: 'Tømrer', icon: '🧱', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 2 },
    { id: 'nye_vaegge_gasbeton', label: 'Nye vægge – Gasbeton/Porebeton', trade: 'Murer', icon: '🧱', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 2 },
    { id: 'nyt_gulv_traeparket', label: 'Nyt gulv – Trægulv/Parket', trade: 'Gulvlægger', icon: '🪵', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'nyt_gulv_laminat_vinyl', label: 'Nyt gulv – Laminat/Vinyl/LVT', trade: 'Gulvlægger', icon: '🔲', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'nyt_gulv_klinker', label: 'Nyt gulv – Klinker/Fliser', trade: 'Gulvlægger', icon: '🔲', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 3 },
    { id: 'gulvvarme_vandbåren', label: 'Gulvvarme – Vandbåren', trade: 'VVS', icon: '🌡️', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, dependsOn: ['nyt_gulv_klinker'], phase: 2 },
    { id: 'gulvvarme_el', label: 'Gulvvarme – El', trade: 'El', icon: '🌡️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'nye_lofter_gips', label: 'Nyt loft – Gipsloft', trade: 'Tømrer', icon: '⬆️', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'nye_lofter_akustik', label: 'Nyt loft – Akustikloft', trade: 'Tømrer', icon: '🎵', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'maling_spartel', label: 'Maling & Spartel', trade: 'Maler', icon: '🎨', complexity: 1, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 4 },
    { id: 'indvendige_doere_karme', label: 'Indvendige Døre & Karme', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '0.5 dag/dør', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'fodlister_gerigter', label: 'Fodlister & Gerigter', trade: 'Tømrer', icon: '📏', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'vinduesplader', label: 'Vinduesplader (indvendige)', trade: 'Tømrer', icon: '🪟', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nyt_el_stikkontakter', label: 'Nyt El / Stikkontakter', trade: 'El', icon: '⚡', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'belysning_spots', label: 'Belysning & Spots i loft', trade: 'El', icon: '💡', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'dataudtag_netvaerk', label: 'Dataudtag & Netværk', trade: 'El', icon: '📶', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'smarthome_styring', label: 'Smart Home – Styring & Automatik', trade: 'El', icon: '📱', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nye_radiatorer', label: 'Nye Radiatorer', trade: 'VVS', icon: '🔥', complexity: 2, duration: '0.5 dag/rum', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'gardiner_skinne', label: 'Gardinstænger / Skinnesystem', trade: 'Diverse', icon: '🪟', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'lydisolering', label: 'Lydisolering (vægge/loft)', trade: 'Tømrer', icon: '🔇', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
  ],

  sovevaereelse: [
    { id: 'indbygget_garderobe', label: 'Indbygget garderobe / skabsvæg', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'nyt_gulv_sovevaereelse', label: 'Nyt gulv – Soveværelse', trade: 'Gulvlægger', icon: '🪵', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'maling_sovevaereelse', label: 'Maling & Tapetsering', trade: 'Maler', icon: '🎨', complexity: 1, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 4 },
    { id: 'el_sovevaereelse', label: 'El & Belysning – Soveværelse', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  koekken: [
    { id: 'nedrivning_gammelt_koekken', label: 'Nedrivning af gammelt køkken', trade: 'Tømrer', icon: '⛏️', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'nyt_koekken_montering', label: 'Nyt køkken – Montering', trade: 'Tømrer', icon: '🍳', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 3 },
    { id: 'bordplade', label: 'Ny Bordplade', trade: 'Tømrer', icon: '🔲', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'staenkplade_fliser', label: 'Stænkplade / Fliser', trade: 'Murer', icon: '🧱', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'vvs_vand_afloeb', label: 'VVS – Vand & Afløb', trade: 'VVS', icon: '💧', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'emhaette_aftaek', label: 'Emhætte & Aftræk', trade: 'Tømrer', icon: '💨', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'el_hvidevarer', label: 'El til Hvidevarer', trade: 'El', icon: '⚡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'stikkontakter_over_bord', label: 'Stikkontakter over bord', trade: 'El', icon: '🔌', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'spots_loft_koekken', label: 'Spots i loft / overskabe', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nyt_gulv_koekken', label: 'Nyt gulv – Køkken', trade: 'Gulvlægger', icon: '🔲', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'affaldssortering', label: 'Affaldssorteringssystem', trade: 'Tømrer', icon: '♻️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'koekken_oeer', label: 'Køkkenø – Montering', trade: 'Tømrer', icon: '🏝️', complexity: 3, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'maling_koekken', label: 'Maling – Køkken', trade: 'Maler', icon: '🎨', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  badevaereelse: [
    { id: 'nedrivning_bad', label: 'Nedrivning af gammelt badeværelse', trade: 'Tømrer', icon: '⛏️', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'vandtaetning_membran', label: 'Vandtætning & Membran', trade: 'Murer', icon: '💧', complexity: 3, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'fliser_gulv', label: 'Fliser – Gulv', trade: 'Gulvlægger', icon: '🔲', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, dependsOn: ['vandtaetning_membran'], phase: 2 },
    { id: 'fliser_vaeg', label: 'Fliser – Væg', trade: 'Murer', icon: '🔲', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'nyt_toilet', label: 'Nyt Toilet', trade: 'VVS', icon: '🚽', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'ny_bruseniche', label: 'Ny Bruseniche / Bruser', trade: 'VVS', icon: '🚿', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nyt_badekar', label: 'Nyt Badekar', trade: 'VVS', icon: '🛁', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'ny_haandvask_moebel', label: 'Ny Håndvask & Møbel', trade: 'VVS', icon: '🪣', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'vvs_ror_bad', label: 'VVS – Rørføring', trade: 'VVS', icon: '🔧', complexity: 3, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'gulvafloeb', label: 'Nyt Gulvafløb', trade: 'VVS', icon: '💧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'haandklaedevarmer', label: 'Håndklædevarmer', trade: 'VVS', icon: '🌡️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'el_fugtsikret', label: 'El – Fugtsikret (SELV/PELV)', trade: 'El', icon: '⚡', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ventilation_bad', label: 'Ventilation / Emhætte', trade: 'El', icon: '💨', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nyt_loft_bad', label: 'Nyt loft – Badeværelse', trade: 'Tømrer', icon: '⬆️', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'spejl_belysning', label: 'Spejl & Badeværelsesbelysning', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'glasvaeg_bruser', label: 'Glasvæg / Bruseadskillelse', trade: 'Tømrer', icon: '🔲', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'wc_skyl_inbygget', label: 'Inbygget Cisterne / Væghængt toilet', trade: 'VVS', icon: '🚽', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'bad_tilgaengelighed', label: 'Tilgængelighed – Støttegreb/Rampe', trade: 'Tømrer', icon: '♿', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  bryggers_vaskerum: [
    { id: 'nedrivning_bryggers', label: 'Nedrivning / Rydning', trade: 'Tømrer', icon: '⛏️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 1 },
    { id: 'vvs_bryggers', label: 'VVS – Vand, Afløb & Vaskemaskine', trade: 'VVS', icon: '💧', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'el_bryggers', label: 'El – Stikkontakter & Belysning', trade: 'El', icon: '⚡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'gulv_bryggers', label: 'Nyt gulv – Klinker/Vinyl', trade: 'Gulvlægger', icon: '🔲', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'vaegge_bryggers', label: 'Nye vægge / Fliser', trade: 'Murer', icon: '🧱', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'opbevaring_bryggers', label: 'Skabe & Opbevaring', trade: 'Tømrer', icon: '🗄️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'vandmaaler_bryggers', label: 'Vandmåler & Stophane', trade: 'VVS', icon: '🔧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 2 },
    { id: 'ventilation_bryggers', label: 'Ventilation – Mekanisk udsugning', trade: 'El', icon: '💨', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'gulvafloeb_bryggers', label: 'Gulvafløb', trade: 'VVS', icon: '💧', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'tørretumbler_tilslutning', label: 'Tørretumbler – Afkasttilslutning', trade: 'Tømrer', icon: '🌀', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  entree_gang: [
    { id: 'nyt_gulv_entree', label: 'Nyt gulv – Entré (klinker/sten)', trade: 'Gulvlægger', icon: '🔲', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'nyt_gulv_gang_laminat', label: 'Nyt gulv – Gang (laminat/vinyl)', trade: 'Gulvlægger', icon: '🔲', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'maling_entree', label: 'Maling – Entré & Gang', trade: 'Maler', icon: '🎨', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'garderobe_entree', label: 'Garderobe / Indbygningsskab', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'ny_gadedoer', label: 'Ny Gadedør / Yderdør', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'doertelefon_adgangskontrol', label: 'Dørtelefon & Adgangskontrol', trade: 'El', icon: '🔔', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'belysning_entree', label: 'Belysning – Entré', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'trappe_renovering', label: 'Trappe – Renovering (gelænder/trin)', trade: 'Tømrer', icon: '🪜', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'trappe_ny', label: 'Ny Trappe (indvendig)', trade: 'Tømrer', icon: '🪜', complexity: 3, duration: '3-7 dage', durationDaysMin: 3, durationDaysMax: 7, phase: 2 },
    { id: 'fodlister_gang', label: 'Fodlister & Gerigter – Gang', trade: 'Tømrer', icon: '📏', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  kontor_hobbyrum: [
    { id: 'nyt_gulv_kontor', label: 'Nyt gulv – Kontor', trade: 'Gulvlægger', icon: '🪵', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'maling_kontor', label: 'Maling – Kontor/Hobbyrum', trade: 'Maler', icon: '🎨', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'el_kontor', label: 'El – Ekstra stikkontakter & Data', trade: 'El', icon: '⚡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'lydisolering_kontor', label: 'Lydisolering – Vægge & Loft', trade: 'Tømrer', icon: '🔇', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'indbygget_reol', label: 'Indbygget reol / skabsvæg', trade: 'Tømrer', icon: '📚', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'ventilation_kontor', label: 'Ventilation – Mekanisk', trade: 'El', icon: '💨', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'projektor_loft', label: 'Projektor/Screen-beslag i loft', trade: 'El', icon: '📽️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
  ],

  kaelder_indvendig: [
    { id: 'kaelder_vaegge_gips', label: 'Nye kældervægge – Gips/Skelet', trade: 'Tømrer', icon: '🧱', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'kaelder_gulv_stoebning', label: 'Kældergulv – Støbning/Udligning', trade: 'Murer', icon: '🔲', complexity: 3, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 1 },
    { id: 'kaelder_gulv_epoxy', label: 'Kældergulv – Epoxy/Vinyl', trade: 'Gulvlægger', icon: '🔲', complexity: 1, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'kaelder_loft_gips', label: 'Kælderloft – Gipsbeklædning', trade: 'Tømrer', icon: '⬆️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'kaelder_isolering', label: 'Kælderydervæg – Indvendig isolering', trade: 'Tømrer', icon: '🌡️', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'kaelder_el', label: 'El – Belysning & Stikkontakter', trade: 'El', icon: '💡', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'kaelder_drænvaeg', label: 'Indvendig Drænvæg (kapillarbrydning)', trade: 'Murer', icon: '💧', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 1 },
    { id: 'kaelder_ventilation', label: 'Kælderventilation', trade: 'El', icon: '💨', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'kaelder_vindue_indvendig', label: 'Kældervindue – Indvendig karm/ramme', trade: 'Tømrer', icon: '🪟', complexity: 1, duration: '0.5 dag/vindue', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  teknisk_rum: [
    { id: 'ny_varmepumpe', label: 'Ny Varmepumpe (luft/vand)', trade: 'VVS', icon: '🔥', complexity: 3, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'ny_varmepumpe_luft_luft', label: 'Ny Varmepumpe (luft/luft)', trade: 'El', icon: '💨', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'fjernvarme_unit', label: 'Fjernvarmeunit – Udskiftning', trade: 'VVS', icon: '🔥', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ny_gasfyr', label: 'Ny Gaskedel / Gasfyr', trade: 'VVS', icon: '🔥', complexity: 3, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 2 },
    { id: 'varmtvandsbeholder', label: 'Ny Varmtvandsbeholder', trade: 'VVS', icon: '💧', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'eltavle_ny', label: 'Ny El-tavle / Sikringsanlæg', trade: 'El', icon: '⚡', complexity: 3, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'ventilationsanlaeg_mek', label: 'Nyt Ventilationsanlæg (mekanisk)', trade: 'El', icon: '💨', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'vandbehandling', label: 'Vandbehandlingsanlæg / Blødgører', trade: 'VVS', icon: '💧', complexity: 2, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 2 },
    { id: 'teknisk_rum_hylde', label: 'Hylder & Opbevaring i teknisk rum', trade: 'Tømrer', icon: '🗄️', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'alarm_brand', label: 'Brandalarmsystem', trade: 'El', icon: '🚨', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'indbrudsalarm', label: 'Indbrudsalarmsystem', trade: 'El', icon: '🔒', complexity: 2, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],

  lejlighed_fuld: [
    { id: 'lejlighed_badevaereelse', label: 'Badeværelse – Fuld renovering', trade: 'VVS', icon: '🚿', complexity: 3, duration: '5-10 dage', durationDaysMin: 5, durationDaysMax: 10, phase: 2 },
    { id: 'lejlighed_koekken', label: 'Køkken – Fuld renovering', trade: 'Tømrer', icon: '🍳', complexity: 3, duration: '3-7 dage', durationDaysMin: 3, durationDaysMax: 7, phase: 2 },
    { id: 'lejlighed_gulve_alle', label: 'Nye gulve – Hele lejlighed', trade: 'Gulvlægger', icon: '🪵', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 3 },
    { id: 'lejlighed_maling_alle', label: 'Maling – Hele lejlighed', trade: 'Maler', icon: '🎨', complexity: 2, duration: '2-5 dage', durationDaysMin: 2, durationDaysMax: 5, phase: 4 },
    { id: 'lejlighed_el_gennemgang', label: 'El-gennemgang & Opdatering', trade: 'El', icon: '⚡', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 2 },
    { id: 'lejlighed_vvs_gennemgang', label: 'VVS – Rørføring & Radiatorer', trade: 'VVS', icon: '💧', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 2 },
    { id: 'lejlighed_doere_karme', label: 'Indvendige Døre & Karme – Alle', trade: 'Tømrer', icon: '🚪', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'lejlighed_vinduer', label: 'Vinduesskift – Alle vinduer', trade: 'Tømrer', icon: '🪟', complexity: 3, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'lejlighed_lofter', label: 'Nye Lofter – Hele lejlighed', trade: 'Tømrer', icon: '⬆️', complexity: 2, duration: '2-3 dage', durationDaysMin: 2, durationDaysMax: 3, phase: 3 },
  ],

  faellesarealer: [
    { id: 'opgang_maling', label: 'Opgang – Maling & Spartel', trade: 'Maler', icon: '🎨', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 4 },
    { id: 'opgang_gulv', label: 'Opgang – Nyt gulv', trade: 'Gulvlægger', icon: '🔲', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'faelles_belysning', label: 'Fælles Belysning (sensorstyret)', trade: 'El', icon: '💡', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'postkasser_ny', label: 'Postkasseanlæg – Nyt', trade: 'Tømrer', icon: '📬', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 4 },
    { id: 'doertelefon_anlaeg', label: 'Dørtelefon/Porttelefon – Anlæg', trade: 'El', icon: '🔔', complexity: 2, duration: '1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'faelles_vaskeri', label: 'Fælles Vaskeri – Renovering', trade: 'VVS', icon: '🌀', complexity: 2, duration: '2-4 dage', durationDaysMin: 2, durationDaysMax: 4, phase: 2 },
    { id: 'cykelkaelder', label: 'Cykelkælder / Cykelparkering', trade: 'Tømrer', icon: '🚲', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'affaldsskakter_rum', label: 'Affaldsrum / Skaktanlæg', trade: 'Tømrer', icon: '♻️', complexity: 2, duration: '1-3 dage', durationDaysMin: 1, durationDaysMax: 3, phase: 3 },
    { id: 'branddoere_faelles', label: 'Branddøre – Kontrol/Udskiftning', trade: 'Tømrer', icon: '🚨', complexity: 2, duration: '0.5 dag/dør', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'handicap_adgang', label: 'Handicapadgang – Rampe/Gelænder', trade: 'Murer', icon: '♿', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
  ],

  elevator_trapper: [
    { id: 'elevator_service', label: 'Elevator – Serviceeftersyn', trade: 'Diverse', icon: '🛗', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, isMaintenance: true, phase: 4 },
    { id: 'elevator_renovering', label: 'Elevator – Renovering/Modernisering', trade: 'Diverse', icon: '🛗', complexity: 3, duration: '5-15 dage', durationDaysMin: 5, durationDaysMax: 15, phase: 2 },
    { id: 'elevator_ny', label: 'Ny Elevator – Etablering', trade: 'Diverse', icon: '🛗', complexity: 3, duration: '10-20 dage', durationDaysMin: 10, durationDaysMax: 20, phase: 2 },
    { id: 'trappe_gelænder_ny', label: 'Nyt Gelænder – Trappe', trade: 'Tømrer', icon: '🪜', complexity: 2, duration: '1-2 dage', durationDaysMin: 1, durationDaysMax: 2, phase: 3 },
    { id: 'trappe_trin_belægning', label: 'Ny Trinbelægning / Trappetæppe', trade: 'Gulvlægger', icon: '🪜', complexity: 1, duration: '0.5-1 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
    { id: 'trappe_belysning', label: 'Trappebelysning (sensor/LED)', trade: 'El', icon: '💡', complexity: 1, duration: '0.5 dag', durationDaysMin: 1, durationDaysMax: 1, phase: 3 },
  ],
};

// ─── Bundle Packages ──────────────────────────────────────────────────────────

export const BUNDLES: Bundle[] = [
  {
    id: 'komplet_badevaereelse',
    label: 'Komplet Badeværelsesrenovering',
    zoneKey: 'badevaereelse',
    icon: '🚿',
    taskIds: ['nedrivning_bad', 'vandtaetning_membran', 'fliser_gulv', 'fliser_vaeg', 'nyt_toilet', 'ny_bruseniche', 'ny_haandvask_moebel', 'vvs_ror_bad', 'gulvafloeb', 'el_fugtsikret', 'ventilation_bad', 'nyt_loft_bad'],
  },
  {
    id: 'komplet_koekken',
    label: 'Nyt Køkken (Fuld)',
    zoneKey: 'koekken',
    icon: '🍳',
    taskIds: ['nedrivning_gammelt_koekken', 'nyt_koekken_montering', 'bordplade', 'staenkplade_fliser', 'vvs_vand_afloeb', 'emhaette_aftaek', 'el_hvidevarer', 'stikkontakter_over_bord', 'spots_loft_koekken', 'nyt_gulv_koekken', 'affaldssortering'],
  },
  {
    id: 'komplet_tag',
    label: 'Komplet Tagudskiftning',
    zoneKey: 'tag_og_skorsten',
    icon: '🏠',
    taskIds: ['stillads_tag', 'nedrivning_gammelt_tag', 'ny_tagbelaegning_tegl', 'nyt_undertag', 'tagrender_nedloeb', 'sternbraedder', 'taghatter_ventilation', 'snefang'],
  },
  {
    id: 'energirenovering_facade',
    label: 'Energirenovering Facade',
    zoneKey: 'facade_generel',
    icon: '🌡️',
    taskIds: ['stillads_facade', 'nedrivning_gammel_belaegning', 'efterisolering_facade_200mm', 'facadebelaegning_puds', 'fugebehandling', 'maling_facade'],
  },
  {
    id: 'solcelle_pakke',
    label: 'Solcelle & Ladeanlæg Pakke',
    zoneKey: 'solceller_energi',
    icon: '☀️',
    taskIds: ['solceller_montering', 'inverter_installation', 'batteri_lagring', 'el_tavle_opdatering', 'ladevaegg_elbil'],
  },
  {
    id: 'ny_terrasse',
    label: 'Ny Terrasse (Komplet)',
    zoneKey: 'terrasse_udendoers',
    icon: '🪴',
    taskIds: ['nedrivning_gammel_terrasse', 'ny_terrasse_trae', 'terrassebelysning', 'raekverk_terrasse', 'terrasse_afvanding'],
  },
  {
    id: 'vaerelsesrenovering',
    label: 'Fuld Værelses-/Stuerenovering',
    zoneKey: 'stue_vaerelser',
    icon: '🛋️',
    taskIds: ['nye_vaegge_gips', 'nyt_gulv_traeparket', 'nye_lofter_gips', 'maling_spartel', 'nyt_el_stikkontakter', 'indvendige_doere_karme', 'fodlister_gerigter', 'belysning_spots'],
  },
];

// ─── Helper: get all zones flat ───────────────────────────────────────────────

export function getAllZones(): ZoneConfig[] {
  const interiorRooms = Object.values(FLOOR_ROOMS).flat();
  // BUILDING_ZONES first: the 3D wizard's definition wins for ids that also
  // exist as a legacy room (e.g. `koekken`).
  return [...BUILDING_ZONES, ...EXTERIOR_ZONES, ...interiorRooms, ...APARTMENT_ZONES];
}

export function getZoneById(id: string): ZoneConfig | undefined {
  return getAllZones().find(z => z.id === id);
}

export function getBundlesForZone(tasksKey: string): Bundle[] {
  return BUNDLES.filter(b => b.zoneKey === tasksKey);
}

export function getTasksForZone(tasksKey: string, maintenanceOnly = false): Task[] {
  const tasks = TASKS_BY_ZONE[tasksKey] ?? [];
  return maintenanceOnly ? tasks.filter(t => t.isMaintenance) : tasks;
}

export const ALL_TRADES: TradeId[] = [
  'Tømrer', 'El', 'VVS', 'Maler', 'Murer',
  'Tagdækker', 'Blikkenslager', 'Gulvlægger', 'Materiel', 'Diverse',
];

// ─────────────────────────────────────────────────────────────────────────────
// 3D building model — zones, categories, layers and tasks
//
// Mirrors the zone table in docs/HOUSE_MODEL_HANDOFF.md. Every id here has
// geometry in modules/projects/components/wizard/house3d/house-scene.js, so ids
// must never be renamed without updating the scene as well.
// ─────────────────────────────────────────────────────────────────────────────

/** One category row in the "Vælg bygningsdele" drawer. */
export interface BuildingSystemGroup {
  id: string;
  title: string;
  desc: string;
  color: string;
  /** Raw 24×24 SVG path, drawn stroked — matches the reference design 1:1. */
  icon: string;
  zoneIds: string[];
}

/** One row in the "Lag" tab — a structural read of the model. */
export interface ModelLayer {
  id: string;
  label: string;
  desc: string;
  color: string;
  icon: string;
}

export const BUILDING_ZONES: ZoneConfig[] = [
  { id: 'tag_og_skorsten', label: 'Tag & Skorsten', sublabel: 'Tagbelægning, tagkonstruktion', highlightColor: '#f97316', icon: '🏠', view: 'model', tasksKey: 'tag_og_skorsten' },
  { id: 'loft_tagetage', label: 'Loft & Tagetage', sublabel: 'Spær, undertag, isolering', highlightColor: '#fb923c', icon: '📐', view: 'model', tasksKey: 'loft_tagetage' },
  { id: 'solceller_energi', label: 'Solceller & Energi', sublabel: 'Solceller, inverter, kabling', highlightColor: '#facc15', icon: '☀️', view: 'model', tasksKey: 'solceller_energi' },
  { id: 'facade_overetage', label: 'Facade 1. Sal', sublabel: 'Beklædning, isolering, puds, maleri', highlightColor: '#38bdf8', icon: '🧱', view: 'model', tasksKey: 'facade_overetage' },
  { id: 'facade_stueetage', label: 'Facade Stueetage', sublabel: 'Murværk, isolering, facade', highlightColor: '#22d3ee', icon: '🧱', view: 'model', tasksKey: 'facade_stueetage' },
  { id: 'vinduer_overetage', label: 'Vinduer 1. Sal', sublabel: 'Vinduer, karme, lysninger', highlightColor: '#a78bfa', icon: '🪟', view: 'model', tasksKey: 'vinduer_overetage' },
  { id: 'vinduer_doere_stueetage', label: 'Vinduer & Døre Stue', sublabel: 'Vinduer, døre, porte', highlightColor: '#c084fc', icon: '🚪', view: 'model', tasksKey: 'vinduer_doere_stueetage' },
  { id: 'altan_balkon', label: 'Altan & Balkon', sublabel: 'Dæk, værn, membran', highlightColor: '#34d399', icon: '🏗️', view: 'model', tasksKey: 'altan_balkon' },
  { id: 'garage_carport', label: 'Garage & Carport', sublabel: 'Port, gulv, tag', highlightColor: '#4ade80', icon: '🚗', view: 'model', tasksKey: 'garage_carport' },
  { id: 'terrasse_udendoers', label: 'Terrasse & Udendørs', sublabel: 'Trædæk, trapper, værn', highlightColor: '#2dd4bf', icon: '🪴', view: 'model', tasksKey: 'terrasse_udendoers' },
  { id: 'indkoersel_belaegning', label: 'Indkørsel & Belægning', sublabel: 'Fliser, asfalt, grus', highlightColor: '#94a3b8', icon: '🛣️', view: 'model', tasksKey: 'indkoersel_belaegning' },
  { id: 'fundament_sokkel', label: 'Fundament & Sokkel', sublabel: 'Gravearbejde, fundament', highlightColor: '#f472b6', icon: '🏛️', view: 'model', tasksKey: 'fundament_sokkel' },
  { id: 'kaelder_udvendig', label: 'Kælder Udvendig', sublabel: 'Kælderydervægge, gulv', highlightColor: '#60a5fa', icon: '⬇️', view: 'model', tasksKey: 'kaelder_udvendig' },
  { id: 'kloak_forsyning', label: 'Kloak & Forsyning', sublabel: 'El, VVS, ventilation, afløb', highlightColor: '#f87171', icon: '🔌', view: 'model', tasksKey: 'kloak_forsyning' },
  { id: 'ladestander_elbil', label: 'Ladestander & Elbil', sublabel: 'Ladeboks, kabling, gruppe', highlightColor: '#22c55e', icon: '🔋', view: 'model', tasksKey: 'ladestander_elbil' },
  { id: 'skorsten_aftraek', label: 'Skorsten & Aftræk', sublabel: 'Skorsten, inddækning, hat', highlightColor: '#fdba74', icon: '🏭', view: 'model', tasksKey: 'skorsten_aftraek' },
  { id: 'tagrender_nedloeb', label: 'Tagrender & Nedløb', sublabel: 'Render, nedløb, brønde', highlightColor: '#fcd34d', icon: '💧', view: 'model', tasksKey: 'tagrender_nedloeb' },
  { id: 'ovenlys_tagvinduer', label: 'Ovenlys & Tagvinduer', sublabel: 'Tagvinduer, inddækning', highlightColor: '#818cf8', icon: '🪟', view: 'model', tasksKey: 'ovenlys_tagvinduer' },
  { id: 'pergola_solafskaermning', label: 'Pergola & Solafskærmning', sublabel: 'Pergola, markise, screens', highlightColor: '#2dd4bf', icon: '☂️', view: 'model', tasksKey: 'pergola_solafskaermning' },
  { id: 'hegn_laage', label: 'Hegn & Låge', sublabel: 'Stolper, rækværk, låge', highlightColor: '#a3e635', icon: '🚧', view: 'model', tasksKey: 'hegn_laage' },
  { id: 'beplantning', label: 'Beplantning', sublabel: 'Træer, buske, bede', highlightColor: '#4d7c0f', icon: '🌳', view: 'model', tasksKey: 'beplantning' },
  { id: 'udebelysning', label: 'Udebelysning', sublabel: 'Havelamper, facadelamper', highlightColor: '#fde68a', icon: '💡', view: 'model', tasksKey: 'udebelysning' },
  { id: 'koekken', label: 'Køkken', sublabel: 'Skabe, bordplade, hvidevarer', highlightColor: '#fb923c', icon: '🍳', view: 'model', tasksKey: 'koekken' },
  { id: 'badevaerelse', label: 'Badeværelse', sublabel: 'Fliser, sanitet, bruseniche', highlightColor: '#38bdf8', icon: '🚿', view: 'model', tasksKey: 'badevaerelse' },
  { id: 'trapper_indvendig', label: 'Trapper Indvendig', sublabel: 'Trappeløb, trin, gelænder', highlightColor: '#d8b4fe', icon: '🪜', view: 'model', tasksKey: 'trapper_indvendig' },
  { id: 'ventilation_anlaeg', label: 'Ventilationsanlæg', sublabel: 'Aggregat, kanaler, hætter', highlightColor: '#67e8f9', icon: '💨', view: 'model', tasksKey: 'ventilation_anlaeg' },
  { id: 'varme_vvs', label: 'Varme & VVS', sublabel: 'Varmtvandsbeholder, rør', highlightColor: '#fca5a5', icon: '🔥', view: 'model', tasksKey: 'varme_vvs' },
  { id: 'varmepumpe_udedel', label: 'Varmepumpe', sublabel: 'Udedel, sokkel, rørføring', highlightColor: '#f43f5e', icon: '♨️', view: 'model', tasksKey: 'varmepumpe_udedel' },
  { id: 'graesplaene', label: 'Græsplæne', sublabel: 'Såning, muld, klipning', highlightColor: '#65a30d', icon: '🌱', view: 'model', tasksKey: 'graesplaene' },
  { id: 'haek_levende', label: 'Hæk & Levende Hegn', sublabel: 'Hæk, klipning, rødder', highlightColor: '#3f6212', icon: '🌿', view: 'model', tasksKey: 'haek_levende' },
  { id: 'stier_traedesten', label: 'Stier & Trædesten', sublabel: 'Trædesten, grus, kantsten', highlightColor: '#a8a29e', icon: '🪨', view: 'model', tasksKey: 'stier_traedesten' },
  { id: 'indvendige_vaegge', label: 'Indvendige Vægge', sublabel: 'Skillevægge, foring, puds', highlightColor: '#e879f9', icon: '🧱', view: 'model', tasksKey: 'indvendige_vaegge' },
  { id: 'etagedaek_gulve', label: 'Etagedæk & Gulve', sublabel: 'Bjælkelag, dæk, gulvopbygning', highlightColor: '#c084fc', icon: '🪵', view: 'model', tasksKey: 'etagedaek_gulve' },
  { id: 'skabe_garderobe', label: 'Skabe & Garderobe', sublabel: 'Garderobe, reoler, opbevaring', highlightColor: '#f0abfc', icon: '🗄️', view: 'model', tasksKey: 'skabe_garderobe' },
  { id: 'hvidevarer', label: 'Hvidevarer', sublabel: 'Køl, ovn, kogeplade, emhætte', highlightColor: '#94a3b8', icon: '🧊', view: 'model', tasksKey: 'hvidevarer' },
  { id: 'indvendig_belysning', label: 'Indvendig Belysning', sublabel: 'Pendler, spots, lamper', highlightColor: '#fef08a', icon: '💡', view: 'model', tasksKey: 'indvendig_belysning' },
  { id: 'skure_udhus', label: 'Skur & Udhus', sublabel: 'Redskabsskur, tag, dør', highlightColor: '#0d9488', icon: '🛖', view: 'model', tasksKey: 'skure_udhus' },
  { id: 'regnvand_faskine', label: 'Regnvand & Faskine', sublabel: 'Regnvandstønde, faskine, dræn', highlightColor: '#22d3ee', icon: '🌧️', view: 'model', tasksKey: 'regnvand_faskine' },
  { id: 'baerende_bjaelker', label: 'Bærende Bjælker', sublabel: 'Overliggere, remme, udveksling', highlightColor: '#a855f7', icon: '🪚', view: 'model', tasksKey: 'baerende_bjaelker' },
  { id: 'soejler_baerende', label: 'Søjler & Bærelinjer', sublabel: 'Søjler, understøtning', highlightColor: '#7c3aed', icon: '🏛️', view: 'model', tasksKey: 'soejler_baerende' },
  { id: 'el_installation', label: 'El-installation', sublabel: 'Tavle, grupper, føringsveje', highlightColor: '#fbbf24', icon: '⚡', view: 'model', tasksKey: 'el_installation' },
  { id: 'stikledninger_forsyning', label: 'Stikledninger & Målere', sublabel: 'Vand, el, fiber, målerskab', highlightColor: '#06b6d4', icon: '🔗', view: 'model', tasksKey: 'stikledninger_forsyning' },
  { id: 'stillads_adgang', label: 'Stillads & Adgang', sublabel: 'Stillads, stiger, adgangsveje', highlightColor: '#f97316', icon: '🪜', view: 'model', tasksKey: 'stillads_adgang' },
  { id: 'byggepladshegn', label: 'Byggepladshegn', sublabel: 'Afskærmning, låge, skiltning', highlightColor: '#eab308', icon: '🚧', view: 'model', tasksKey: 'byggepladshegn' },
  { id: 'skurvogn_materialer', label: 'Skurvogn & Materialer', sublabel: 'Skurvogn, oplag, paller', highlightColor: '#78716c', icon: '🚚', view: 'model', tasksKey: 'skurvogn_materialer' },
  { id: 'container_affald', label: 'Container & Affald', sublabel: 'Container, bortkørsel, deponi', highlightColor: '#ea580c', icon: '🗑️', view: 'model', tasksKey: 'container_affald' },
  { id: 'sortering_genbrug', label: 'Sortering & Genbrug', sublabel: 'Fraktioner, big bags, genbrug', highlightColor: '#84cc16', icon: '♻️', view: 'model', tasksKey: 'sortering_genbrug' },
  { id: 'nedrivning_indvendig', label: 'Nedrivning Indvendig', sublabel: 'Nedrivning, støvvægge, rydning', highlightColor: '#f87171', icon: '⛏️', view: 'model', tasksKey: 'nedrivning_indvendig' },
  { id: 'asbest_miljosanering', label: 'Asbest & Miljøsanering', sublabel: 'Asbest, PCB, bly, skimmel', highlightColor: '#dc2626', icon: '☣️', view: 'model', tasksKey: 'asbest_miljosanering' },
  { id: 'bortkoersel_jord', label: 'Bortkørsel af Jord', sublabel: 'Opgravet jord, analyser, deponi', highlightColor: '#92400e', icon: '🚜', view: 'model', tasksKey: 'bortkoersel_jord' },
  { id: 'inventar_moebler', label: 'Inventar & Møbler', sublabel: 'Køkken, bad, fast inventar', highlightColor: '#fbbf24', icon: '🛋️', view: 'model', tasksKey: 'inventar_moebler' },
];

export const BUILDING_SYSTEM_GROUPS: BuildingSystemGroup[] = [
  { id: 'tag', title: 'Tag', desc: 'Tagbelægning, skorsten, render', color: '#f97316', icon: 'M2.5 11.5 12 4l9.5 7.5M5.5 12.5V20h13v-7.5', zoneIds: ['tag_og_skorsten', 'skorsten_aftraek', 'tagrender_nedloeb', 'loft_tagetage'] },
  { id: 'ydervaegge', title: 'Ydervægge', desc: 'Murværk, isolering, facade', color: '#f59e0b', icon: 'M3 4.5h18v15H3zM3 9.5h18M3 14.5h18M9 4.5v5M15 9.5v5M9 14.5v5', zoneIds: ['facade_overetage', 'facade_stueetage'] },
  { id: 'vinduer', title: 'Vinduer & Døre', desc: 'Vinduer, døre, ovenlys', color: '#a78bfa', icon: 'M4 4h16v16H4zM12 4v16M4 12h16', zoneIds: ['vinduer_overetage', 'vinduer_doere_stueetage', 'ovenlys_tagvinduer'] },
  { id: 'konstruktion', title: 'Konstruktion & Dæk', desc: 'Skillevægge, etagedæk, gulve', color: '#c084fc', icon: 'M4 20V6l8-3 8 3v14M8 20V11h8v9M4 11h16', zoneIds: ['indvendige_vaegge', 'etagedaek_gulve', 'baerende_bjaelker', 'soejler_baerende'] },
  { id: 'uderum', title: 'Tilbygninger & Uderum', desc: 'Altan, garage, terrasse, skur', color: '#34d399', icon: 'M3 10h18v10H3zM6.5 10V5h11v5M8 20v-5h5v5', zoneIds: ['altan_balkon', 'garage_carport', 'terrasse_udendoers', 'pergola_solafskaermning', 'skure_udhus'] },
  { id: 'grund', title: 'Grund & Belægning', desc: 'Indkørsel, fliser, stier', color: '#94a3b8', icon: 'M3 16h18v4.5H3zM3 16l4.5-6h9l4.5 6M9 10v6M15 10v6', zoneIds: ['indkoersel_belaegning', 'stier_traedesten'] },
  { id: 'have', title: 'Have & Grønt', desc: 'Græs, hæk, planter, hegn', color: '#84cc16', icon: 'M12 20V9M12 9a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM12 13l4-3M12 15l-4-3', zoneIds: ['graesplaene', 'haek_levende', 'beplantning', 'hegn_laage'] },
  { id: 'fundament', title: 'Fundament', desc: 'Gravearbejde, fundament', color: '#f472b6', icon: 'M3 15.5h18V20H3zM6 15.5V8h12v7.5M9.5 8V4.5h5V8', zoneIds: ['fundament_sokkel'] },
  { id: 'kaelder', title: 'Kælder', desc: 'Kælderydervægge, gulv', color: '#60a5fa', icon: 'M4 4.5h16v15H4zM4 12h16M12 12v7.5', zoneIds: ['kaelder_udvendig'] },
  { id: 'installationer', title: 'Installationer', desc: 'El, VVS, ventilation, afløb', color: '#f87171', icon: 'M6.5 3.5v7a3 3 0 0 0 6 0v-7M9.5 16.5v4M17.5 20.5v-6.5a2.8 2.8 0 0 0-5.5 0', zoneIds: ['el_installation', 'ventilation_anlaeg', 'udebelysning', 'indvendig_belysning'] },
  { id: 'energi', title: 'Energi & Varme', desc: 'Solceller, varme, ladestander', color: '#facc15', icon: 'M13 2.5 4.5 13.5H10l-1 8 9-11.5h-5.5l.5-7.5Z', zoneIds: ['solceller_energi', 'varme_vvs', 'varmepumpe_udedel', 'ladestander_elbil'] },
  { id: 'inventar', title: 'Inventar & Overflader', desc: 'Køkken, bad, trapper, skabe', color: '#fbbf24', icon: 'M3.5 12.5v6h17v-6M6 12.5V7.5h12v5M6 12.5h12', zoneIds: ['koekken', 'hvidevarer', 'badevaerelse', 'trapper_indvendig', 'skabe_garderobe', 'inventar_moebler'] },
  { id: 'forsyning', title: 'Forsyning & Infrastruktur', desc: 'Stik, kloak, regnvand', color: '#06b6d4', icon: 'M4 20V9.5l8-6 8 6V20M9.5 20v-6h5v6M2 20h20', zoneIds: ['stikledninger_forsyning', 'kloak_forsyning', 'regnvand_faskine'] },
  { id: 'byggeplads', title: 'Byggeplads & Sikkerhed', desc: 'Stillads, hegn, skurvogn', color: '#f97316', icon: 'M3 20h18M6 20V8l6-4 6 4v12M6 12h12M10 20v-5h4v5', zoneIds: ['stillads_adgang', 'byggepladshegn', 'skurvogn_materialer'] },
  { id: 'affald', title: 'Byggeaffald & Sanering', desc: 'Container, nedrivning, miljø', color: '#ea580c', icon: 'M5 7.5h14M9.5 7.5V5h5v2.5M6.5 7.5 7.5 20h9l1-12.5M10 11v5.5M14 11v5.5', zoneIds: ['container_affald', 'sortering_genbrug', 'nedrivning_indvendig', 'asbest_miljosanering', 'bortkoersel_jord'] },
];

export const MODEL_LAYERS: ModelLayer[] = [
  { id: 'alle', label: 'Alle lag', desc: 'Hele modellen', color: '#60a5fa', icon: 'M12 3 3 8l9 5 9-5-9-5M3 13l9 5 9-5' },
  { id: 'terraen', label: 'Terræn & Have', desc: 'Jord, græs, belægning', color: '#84cc16', icon: 'M3 16h18v4.5H3zM3 16l4.5-6h9l4.5 6' },
  { id: 'fundament', label: 'Fundament & Kælder', desc: 'Sokkel, kælderydervægge', color: '#f472b6', icon: 'M3 15.5h18V20H3zM6 15.5V8h12v7.5' },
  { id: 'konstruktion', label: 'Bærende konstruktion', desc: 'Dæk, spær, søjler', color: '#c084fc', icon: 'M4 20V6l8-3 8 3v14M8 20V11h8v9M4 11h16' },
  { id: 'klimaskaerm', label: 'Klimaskærm', desc: 'Tag, facade, vinduer, isolering', color: '#38bdf8', icon: 'M2.5 11.5 12 4l9.5 7.5M5.5 12.5V20h13v-7.5M9.5 20v-5h5v5' },
  { id: 'tilbygning', label: 'Uderum & Tilbygning', desc: 'Garage, altan, terrasse', color: '#34d399', icon: 'M3 10h18v10H3zM6.5 10V5h11v5' },
  { id: 'installationer', label: 'Installationer', desc: 'VVS, el, ventilation, lader', color: '#f87171', icon: 'M6.5 3.5v7a3 3 0 0 0 6 0v-7M9.5 16.5v4M17.5 20.5V14a2.8 2.8 0 0 0-5.5 0' },
  { id: 'inventar', label: 'Overflader & Inventar', desc: 'Gulve, skillevægge, møbler', color: '#fbbf24', icon: 'M3.5 12.5v6h17v-6M6 12.5V7.5h12v5M6 12.5h12' },
  { id: 'byggeplads', label: 'Byggeplads & Affald', desc: 'Stillads, hegn, container, sanering', color: '#ea580c', icon: 'M3 20h18M6 20V8l6-4 6 4v12M6 12h12' },
];

/** Levels the plan view can cut at, in the order the pills are rendered. */
export const MODEL_LEVELS = [
  { id: 'kaelder', num: 'K', label: 'Kælder' },
  { id: 'stue', num: 'ST', label: 'Stueetage' },
  { id: 'etage1', num: '1', label: '1. sal' },
] as const;

export type ModelLevelId = (typeof MODEL_LEVELS)[number]['id'];

export const ALL_BUILDING_ZONE_IDS: string[] = BUILDING_ZONES.map((zone) => zone.id);

export function getBuildingZoneById(id: string): ZoneConfig | undefined {
  return BUILDING_ZONES.find((zone) => zone.id === id);
}

// ─── Tasks for the 3D zones ───────────────────────────────────────────────────
//
// Authored as compact rows: [label, fag, kompleksitet, min dage, max dage, fase].
// Ids are prefixed with the zone id so a zone can inherit legacy tasks from the
// old catalog without id collisions.

type TaskSeed = [string, TradeId, 1 | 2 | 3, number, number, 1 | 2 | 3 | 4];

const TRADE_ICONS: Record<TradeId, string> = {
  'Tømrer': '🪵',
  'El': '⚡',
  'VVS': '💧',
  'Maler': '🎨',
  'Murer': '🧱',
  'Tagdækker': '🏠',
  'Blikkenslager': '🔩',
  'Gulvlægger': '🔲',
  'Materiel': '🪜',
  'Diverse': '🔧',
};

const slugifyTaskLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeTaskLabel = (label: string): string =>
  label.toLowerCase().replace(/[^a-z0-9æøå]+/g, '');

const buildZoneTasks = (zoneId: string, seeds: TaskSeed[]): Task[] =>
  seeds.map(([label, trade, complexity, min, max, phase]) => ({
    id: `${zoneId}__${slugifyTaskLabel(label)}`,
    label,
    trade,
    icon: TRADE_ICONS[trade],
    complexity,
    duration: min === max ? `${min} dag` : `${min}-${max} dage`,
    durationDaysMin: min,
    durationDaysMax: max,
    phase,
  }));

const BUILDING_ZONE_TASK_SEEDS: Record<string, TaskSeed[]> = {
  tag_og_skorsten: [
    ['Ny tagbelægning', 'Tagdækker', 3, 3, 7, 2],
    ['Udskiftning af undertag', 'Tømrer', 2, 1, 3, 2],
    ['Nye tagsten / tagpap', 'Tagdækker', 2, 2, 4, 2],
    ['Rygning & grater', 'Tagdækker', 2, 1, 2, 2],
    ['Vindskeder & stern', 'Tømrer', 2, 1, 2, 3],
    ['Taghætter & gennemføringer', 'Tagdækker', 1, 1, 1, 2],
  ],
  loft_tagetage: [
    ['Efterisolering af loft', 'Tømrer', 2, 1, 2, 2],
    ['Reparation af spær', 'Tømrer', 3, 1, 3, 2],
    ['Gangbro & loftlem', 'Tømrer', 1, 1, 1, 3],
    ['Ventilation af tagrum', 'Tømrer', 1, 1, 1, 2],
  ],
  solceller_energi: [
    ['Montering af solceller', 'El', 3, 2, 3, 2],
    ['Inverter & tilslutning', 'El', 2, 1, 1, 2],
    ['Batteri & styring', 'El', 2, 1, 2, 2],
    ['Nyt gruppeafbryderfelt', 'El', 2, 1, 1, 2],
  ],
  facade_overetage: [
    ['Ny facadepuds', 'Murer', 3, 3, 6, 3],
    ['Malerbehandling', 'Maler', 2, 2, 4, 3],
    ['Udvendig isolering', 'Tømrer', 3, 3, 5, 2],
    ['Reparation af murværk', 'Murer', 2, 1, 3, 2],
  ],
  facade_stueetage: [
    ['Omfugning af murværk', 'Murer', 2, 2, 5, 2],
    ['Ny facadebeklædning', 'Tømrer', 3, 4, 8, 3],
    ['Udvendig isolering', 'Tømrer', 3, 3, 5, 2],
    ['Sokkelpuds & vandskuring', 'Murer', 2, 1, 2, 3],
    ['Reparation af revner', 'Murer', 2, 1, 2, 2],
    ['Algebehandling & rens', 'Maler', 1, 1, 2, 3],
  ],
  vinduer_overetage: [
    ['Nye vinduer 1. sal', 'Tømrer', 3, 1, 3, 2],
    ['Lysninger & fuger', 'Tømrer', 1, 1, 2, 3],
    ['Maling af karme', 'Maler', 1, 1, 2, 3],
    ['Nyt ovenlysvindue', 'Tømrer', 2, 1, 1, 2],
  ],
  vinduer_doere_stueetage: [
    ['Ny hoveddør', 'Tømrer', 2, 1, 1, 2],
    ['Skydedøre til terrasse', 'Tømrer', 3, 1, 2, 2],
    ['Nye vinduer stueetage', 'Tømrer', 3, 2, 4, 2],
    ['Fugning & tætningslister', 'Tømrer', 1, 1, 1, 3],
    ['Nye greb & låsetøj', 'Tømrer', 1, 1, 1, 4],
    ['Insektnet', 'Diverse', 1, 1, 1, 4],
  ],
  altan_balkon: [
    ['Nyt trædæk', 'Tømrer', 2, 2, 3, 2],
    ['Membran & afløb', 'Tagdækker', 2, 1, 2, 2],
    ['Nyt værn i glas', 'Tømrer', 2, 1, 2, 3],
    ['Pergola & solafskærmning', 'Tømrer', 2, 1, 3, 3],
  ],
  garage_carport: [
    ['Ny garageport', 'Tømrer', 2, 1, 1, 3],
    ['Portautomatik', 'El', 2, 1, 1, 3],
    ['Nyt gulv i garage', 'Murer', 3, 2, 3, 2],
    ['Tag på carport', 'Tagdækker', 2, 1, 2, 2],
    ['El, lys & stikkontakter', 'El', 1, 1, 1, 2],
    ['Opbevaring & reoler', 'Tømrer', 1, 1, 1, 4],
  ],
  terrasse_udendoers: [
    ['Nyt trædæk', 'Tømrer', 2, 2, 4, 2],
    ['Trappe & trin', 'Tømrer', 2, 1, 1, 3],
    ['Værn & gelænder', 'Tømrer', 2, 1, 1, 3],
    ['Udendørs belysning', 'El', 1, 1, 1, 3],
  ],
  indkoersel_belaegning: [
    ['Nye fliser', 'Murer', 2, 2, 4, 2],
    ['Asfalt eller grus', 'Diverse', 2, 1, 2, 2],
    ['Kantsten & afgrænsning', 'Murer', 1, 1, 1, 2],
    ['Ny garagerampe', 'Murer', 3, 2, 3, 2],
    ['Linjeafløb ved port', 'VVS', 2, 1, 1, 2],
    ['Dræn i indkørsel', 'VVS', 2, 1, 2, 1],
  ],
  fundament_sokkel: [
    ['Understøbning', 'Murer', 3, 3, 7, 1],
    ['Fugtsikring af sokkel', 'Murer', 2, 2, 4, 1],
    ['Omfangsdræn', 'VVS', 3, 3, 5, 1],
    ['Fundament til tilbygning', 'Murer', 3, 3, 7, 1],
  ],
  kaelder_udvendig: [
    ['Udvendig fugtsikring', 'Murer', 3, 2, 4, 1],
    ['Kælderdræn', 'VVS', 3, 2, 4, 1],
    ['Ny kældertrappe', 'Murer', 2, 1, 3, 2],
    ['Radonsikring', 'Tømrer', 2, 1, 2, 2],
  ],
  kloak_forsyning: [
    ['Kloak & faldstamme', 'VVS', 3, 2, 5, 1],
    ['TV-inspektion af kloak', 'VVS', 1, 1, 1, 1],
    ['Ny eltavle', 'El', 3, 1, 1, 2],
    ['Nye grupper & stikkontakter', 'El', 2, 1, 2, 2],
    ['Vandmåler & stophane', 'VVS', 1, 1, 1, 2],
    ['Regnvandsafledning', 'VVS', 2, 1, 3, 1],
  ],
  ladestander_elbil: [
    ['Ladeboks på væg', 'El', 2, 1, 1, 3],
    ['Ladestander i indkørsel', 'El', 2, 1, 2, 3],
    ['Kabelføring & ny gruppe', 'El', 2, 1, 1, 2],
    ['Lastbalancering', 'El', 2, 1, 1, 3],
  ],
  inventar_moebler: [
    ['Garderobe & skabe', 'Tømrer', 2, 1, 3, 3],
    ['Indbyggede skabe', 'Tømrer', 2, 1, 3, 3],
    ['Nye gulve', 'Gulvlægger', 2, 2, 4, 3],
    ['Fodpaneler & lister', 'Tømrer', 1, 1, 1, 4],
    ['Indvendige døre', 'Tømrer', 2, 1, 2, 3],
  ],
  skorsten_aftraek: [
    ['Ommuring af skorsten', 'Murer', 3, 2, 4, 2],
    ['Ny inddækning', 'Blikkenslager', 2, 1, 1, 2],
    ['Skorstensfoder', 'Murer', 2, 1, 1, 2],
    ['Ny skorstenshat', 'Blikkenslager', 1, 1, 1, 3],
    ['Aftræk til brændeovn', 'Murer', 2, 1, 2, 2],
  ],
  tagrender_nedloeb: [
    ['Nye tagrender', 'Blikkenslager', 2, 1, 2, 3],
    ['Nye nedløbsrør', 'Blikkenslager', 1, 1, 1, 3],
    ['Rensning & justering', 'Blikkenslager', 1, 1, 1, 4],
    ['Nedløbsbrønde', 'VVS', 2, 1, 2, 1],
    ['Løvfang', 'Blikkenslager', 1, 1, 1, 4],
  ],
  ovenlys_tagvinduer: [
    ['Nyt tagvindue', 'Tømrer', 2, 1, 1, 2],
    ['Ny inddækning', 'Blikkenslager', 2, 1, 1, 2],
    ['Udskiftning af rude', 'Tømrer', 1, 1, 1, 2],
    ['Motor & fjernbetjening', 'El', 2, 1, 1, 3],
    ['Mørklægningsgardin', 'Diverse', 1, 1, 1, 4],
  ],
  pergola_solafskaermning: [
    ['Ny pergola', 'Tømrer', 2, 1, 3, 3],
    ['Markise', 'Diverse', 2, 1, 1, 3],
    ['Screens & solsejl', 'Diverse', 1, 1, 1, 3],
    ['Overfladebehandling', 'Maler', 1, 1, 2, 4],
    ['Lys i pergola', 'El', 1, 1, 1, 3],
  ],
  hegn_laage: [
    ['Nyt hegn', 'Tømrer', 2, 1, 3, 3],
    ['Ny låge', 'Tømrer', 1, 1, 1, 3],
    ['Nye stolper', 'Tømrer', 2, 1, 2, 3],
    ['Maling & træbeskyttelse', 'Maler', 1, 1, 2, 4],
    ['Postkasse & nummer', 'Diverse', 1, 1, 1, 4],
  ],
  beplantning: [
    ['Nye træer', 'Diverse', 1, 1, 2, 4],
    ['Buske & hæk', 'Diverse', 1, 1, 2, 4],
    ['Staudebed', 'Diverse', 1, 1, 1, 4],
    ['Højbed & køkkenhave', 'Tømrer', 1, 1, 2, 4],
    ['Muld & jordforbedring', 'Diverse', 1, 1, 2, 1],
    ['Vanding', 'VVS', 1, 1, 1, 4],
  ],
  udebelysning: [
    ['Havelamper', 'El', 1, 1, 1, 3],
    ['Facadelamper', 'El', 1, 1, 1, 3],
    ['Sensor & timer', 'El', 1, 1, 1, 3],
    ['Kabler & gruppe', 'El', 2, 1, 2, 2],
    ['Lys i indkørsel', 'El', 1, 1, 1, 3],
  ],
  koekken: [
    ['Nye køkkenskabe', 'Tømrer', 3, 2, 4, 3],
    ['Ny bordplade', 'Tømrer', 2, 1, 1, 3],
    ['Vask & armatur', 'VVS', 1, 1, 1, 3],
    ['Hvidevarer', 'El', 1, 1, 1, 3],
    ['Emhætte & aftræk', 'Tømrer', 2, 1, 1, 3],
    ['Fliser & stænkpanel', 'Murer', 2, 1, 2, 3],
    ['El & stikkontakter', 'El', 1, 1, 1, 2],
  ],
  badevaerelse: [
    ['Nye gulvfliser', 'Gulvlægger', 2, 1, 2, 2],
    ['Nye vægfliser', 'Murer', 2, 1, 2, 2],
    ['Vådrumsmembran', 'Murer', 3, 1, 2, 2],
    ['Ny bruseniche', 'VVS', 2, 1, 1, 3],
    ['Nyt toilet', 'VVS', 1, 1, 1, 3],
    ['Ny vask & armatur', 'VVS', 1, 1, 1, 3],
    ['Gulvvarme', 'VVS', 2, 1, 2, 2],
    ['Ventilation i bad', 'El', 1, 1, 1, 3],
  ],
  trapper_indvendig: [
    ['Ny trappe', 'Tømrer', 3, 3, 7, 2],
    ['Nye trin', 'Tømrer', 2, 1, 2, 3],
    ['Gelænder & værn', 'Tømrer', 2, 1, 2, 3],
    ['Overfladebehandling', 'Maler', 1, 1, 2, 4],
    ['Lys i trappe', 'El', 1, 1, 1, 3],
  ],
  ventilation_anlaeg: [
    ['Nyt ventilationsaggregat', 'El', 3, 2, 4, 2],
    ['Kanaler & ventiler', 'El', 2, 1, 3, 2],
    ['Tagventilationshætte', 'Tagdækker', 1, 1, 1, 2],
    ['Filterskift & service', 'El', 1, 1, 1, 4],
    ['Køkkenudsugning', 'El', 2, 1, 1, 3],
  ],
  varme_vvs: [
    ['Ny varmtvandsbeholder', 'VVS', 2, 1, 1, 2],
    ['Vandrør & stigstrenge', 'VVS', 3, 2, 4, 2],
    ['Gulvvarmefordeler', 'VVS', 2, 1, 1, 2],
    ['Radiatorer & termostater', 'VVS', 2, 1, 2, 2],
    ['Isolering af rør', 'VVS', 1, 1, 1, 2],
    ['Cirkulationspumpe', 'VVS', 1, 1, 1, 2],
  ],
  varmepumpe_udedel: [
    ['Ny luft/vand-varmepumpe', 'VVS', 3, 1, 2, 2],
    ['Luft/luft-varmepumpe', 'El', 2, 1, 1, 2],
    ['Sokkel & vibrationsdæmpning', 'Murer', 1, 1, 1, 2],
    ['Rør & kondensafløb', 'VVS', 2, 1, 1, 2],
    ['El-tilslutning & gruppe', 'El', 2, 1, 1, 2],
    ['Service & årligt tjek', 'VVS', 1, 1, 1, 4],
  ],
  graesplaene: [
    ['Ny græsplæne (rullegræs)', 'Diverse', 2, 1, 2, 4],
    ['Såning & efterså', 'Diverse', 1, 1, 1, 4],
    ['Muld & topdressing', 'Diverse', 1, 1, 2, 1],
    ['Vertikalskæring', 'Diverse', 1, 1, 1, 4],
    ['Kantskæring', 'Diverse', 1, 1, 1, 4],
    ['Robotplæneklipper', 'El', 1, 1, 1, 4],
  ],
  haek_levende: [
    ['Ny hæk', 'Diverse', 1, 1, 2, 4],
    ['Fældning af gammel hæk', 'Diverse', 2, 1, 2, 1],
    ['Klipning & formning', 'Diverse', 1, 1, 1, 4],
    ['Rodfræsning', 'Diverse', 2, 1, 1, 1],
    ['Gødning & vanding', 'Diverse', 1, 1, 1, 4],
  ],
  stier_traedesten: [
    ['Nye trædesten', 'Murer', 1, 1, 1, 3],
    ['Grussti', 'Diverse', 1, 1, 2, 3],
    ['Flisesti', 'Murer', 2, 1, 3, 3],
    ['Kantsten & afgrænsning', 'Murer', 1, 1, 1, 3],
    ['Ukrudtssikring', 'Diverse', 1, 1, 1, 3],
  ],
  indvendige_vaegge: [
    ['Ny skillevæg', 'Tømrer', 2, 1, 3, 2],
    ['Nedrivning af væg', 'Tømrer', 2, 1, 1, 1],
    ['Forsatsvæg & isolering', 'Tømrer', 2, 1, 3, 2],
    ['Spartling & maling', 'Maler', 1, 1, 3, 4],
    ['Nye dørhuller', 'Tømrer', 2, 1, 2, 2],
    ['Lydisolering', 'Tømrer', 2, 1, 2, 2],
  ],
  etagedaek_gulve: [
    ['Nyt bjælkelag', 'Tømrer', 3, 3, 6, 2],
    ['Efterisolering af dæk', 'Tømrer', 2, 1, 3, 2],
    ['Nyt trægulv', 'Gulvlægger', 2, 2, 4, 3],
    ['Slibning & lakering', 'Gulvlægger', 2, 1, 3, 4],
    ['Klinkegulv', 'Gulvlægger', 2, 2, 4, 3],
    ['Gulvvarme i dæk', 'VVS', 3, 2, 4, 2],
    ['Trinlydsdæmpning', 'Tømrer', 2, 1, 2, 2],
  ],
  skabe_garderobe: [
    ['Ny garderobe', 'Tømrer', 2, 1, 3, 3],
    ['Indbygget skab', 'Tømrer', 2, 1, 3, 3],
    ['Walk-in garderobe', 'Tømrer', 3, 2, 4, 3],
    ['Reoler & opbevaring', 'Tømrer', 1, 1, 2, 4],
    ['Skydedøre', 'Tømrer', 2, 1, 1, 3],
  ],
  hvidevarer: [
    ['Køle-/fryseskab', 'El', 1, 1, 1, 3],
    ['Ovn & mikroovn', 'El', 1, 1, 1, 3],
    ['Kogeplade (induktion)', 'El', 2, 1, 1, 3],
    ['Emhætte', 'El', 2, 1, 1, 3],
    ['Opvaskemaskine', 'VVS', 1, 1, 1, 3],
    ['Vaskemaskine & tørretumbler', 'VVS', 1, 1, 1, 3],
  ],
  indvendig_belysning: [
    ['Ny loftbelysning', 'El', 1, 1, 1, 3],
    ['Spots & downlights', 'El', 2, 1, 2, 3],
    ['Pendler over køkkenø', 'El', 1, 1, 1, 3],
    ['Lysdæmpere', 'El', 1, 1, 1, 3],
    ['Skinnespots', 'El', 1, 1, 1, 3],
    ['Trappebelysning', 'El', 1, 1, 1, 3],
  ],
  skure_udhus: [
    ['Nyt redskabsskur', 'Tømrer', 2, 2, 4, 3],
    ['Nyt tag på skur', 'Tagdækker', 2, 1, 2, 2],
    ['Ny dør & lås', 'Tømrer', 1, 1, 1, 3],
    ['Gulv i skur', 'Tømrer', 2, 1, 2, 2],
    ['Maling & træbeskyttelse', 'Maler', 1, 1, 2, 4],
    ['El & lys i skur', 'El', 1, 1, 1, 3],
  ],
  regnvand_faskine: [
    ['Faskine til regnvand', 'VVS', 2, 1, 3, 1],
    ['Regnvandstønde', 'Diverse', 1, 1, 1, 4],
    ['Omfangsdræn', 'VVS', 3, 3, 5, 1],
    ['Rensebrønd', 'VVS', 2, 1, 1, 1],
    ['Afkobling af regnvand', 'VVS', 2, 1, 2, 1],
    ['Nedløbsbrønde', 'VVS', 2, 1, 2, 1],
  ],
  baerende_bjaelker: [
    ['Ny overligger / udveksling', 'Tømrer', 3, 1, 3, 2],
    ['Understøtning under arbejdet', 'Tømrer', 2, 1, 1, 1],
    ['Ny rem', 'Tømrer', 2, 1, 2, 2],
    ['Stålbjælke ved nedrivning', 'Tømrer', 3, 1, 3, 2],
    ['Statisk beregning', 'Diverse', 2, 1, 3, 1],
    ['Brandmaling af stål', 'Maler', 1, 1, 1, 3],
  ],
  soejler_baerende: [
    ['Ny bærende søjle', 'Tømrer', 3, 1, 3, 2],
    ['Understøbning af søjle', 'Murer', 3, 1, 2, 1],
    ['Udskiftning af søjle', 'Tømrer', 3, 1, 3, 2],
    ['Punktfundament', 'Murer', 2, 1, 2, 1],
    ['Inddækning & finish', 'Tømrer', 1, 1, 1, 3],
  ],
  el_installation: [
    ['Ny eltavle', 'El', 3, 1, 1, 2],
    ['Nye grupper & HPFI', 'El', 2, 1, 2, 2],
    ['Nye stikkontakter', 'El', 1, 1, 2, 2],
    ['Føringsveje & kabelbakker', 'El', 2, 1, 2, 2],
    ['Netværk & fiber indvendigt', 'El', 1, 1, 1, 2],
    ['El-tjek & dokumentation', 'El', 1, 1, 1, 4],
  ],
  stikledninger_forsyning: [
    ['Ny vandstikledning', 'VVS', 2, 1, 2, 1],
    ['Ny elstikledning', 'El', 2, 1, 2, 1],
    ['Fiber / bredbånd', 'El', 1, 1, 1, 1],
    ['Målerskab udvendigt', 'El', 2, 1, 1, 2],
    ['Stophane & vandmåler', 'VVS', 1, 1, 1, 2],
    ['Kabelgrav & retablering', 'Diverse', 2, 1, 3, 1],
  ],
  stillads_adgang: [
    ['Stilladsleje', 'Materiel', 1, 1, 1, 1],
    ['Opstilling & nedtagning', 'Materiel', 2, 1, 2, 1],
    ['Facadestillads', 'Materiel', 2, 1, 2, 1],
    ['Rullestillads indvendigt', 'Materiel', 1, 1, 1, 1],
    ['Stiger & adgangsveje', 'Materiel', 1, 1, 1, 1],
    ['Affaldsskakt', 'Materiel', 1, 1, 1, 1],
    ['Overdækning & inddækning', 'Materiel', 2, 1, 2, 1],
  ],
  byggepladshegn: [
    ['Byggepladshegn', 'Materiel', 1, 1, 1, 1],
    ['Låge & aflåsning', 'Materiel', 1, 1, 1, 1],
    ['Skiltning & afmærkning', 'Materiel', 1, 1, 1, 1],
    ['Sikring mod nedfald', 'Materiel', 2, 1, 1, 1],
    ['Beskyttelse af belægning', 'Materiel', 1, 1, 1, 1],
    ['Vejafspærring & tilladelse', 'Diverse', 2, 1, 2, 1],
  ],
  skurvogn_materialer: [
    ['Skurvogn / mandskabsvogn', 'Materiel', 1, 1, 1, 1],
    ['Toiletvogn', 'Materiel', 1, 1, 1, 1],
    ['Materialeoplag & paller', 'Materiel', 1, 1, 1, 1],
    ['Byggestrøm & byggevand', 'El', 2, 1, 1, 1],
    ['Aflåst værktøjscontainer', 'Materiel', 1, 1, 1, 1],
    ['Vinterforanstaltninger', 'Materiel', 2, 1, 2, 1],
  ],
  container_affald: [
    ['Containerleje', 'Materiel', 1, 1, 1, 1],
    ['Bortkørsel af byggeaffald', 'Diverse', 1, 1, 2, 1],
    ['Ekstra tømninger', 'Diverse', 1, 1, 1, 1],
    ['Deponiafgift', 'Diverse', 1, 1, 1, 1],
    ['Byggeaffald blandet', 'Diverse', 1, 1, 1, 1],
    ['Nedknusning på stedet', 'Diverse', 2, 1, 2, 1],
    ['Anmeldelse af byggeaffald', 'Diverse', 1, 1, 1, 1],
  ],
  sortering_genbrug: [
    ['Sortering i fraktioner', 'Diverse', 1, 1, 2, 1],
    ['Big bags til småt affald', 'Materiel', 1, 1, 1, 1],
    ['Genbrug af tegl & beton', 'Diverse', 2, 1, 2, 1],
    ['Metal & jern til genbrug', 'Diverse', 1, 1, 1, 1],
    ['Træ & gips separat', 'Diverse', 1, 1, 1, 1],
    ['Farligt affald separat', 'Diverse', 2, 1, 1, 1],
    ['Dokumentation af bortskaffelse', 'Diverse', 1, 1, 1, 4],
  ],
  nedrivning_indvendig: [
    ['Nedrivning af skillevægge', 'Tømrer', 2, 1, 2, 1],
    ['Nedrivning af køkken', 'Tømrer', 2, 1, 1, 1],
    ['Nedrivning af badeværelse', 'Tømrer', 2, 1, 1, 1],
    ['Fjernelse af gulve', 'Gulvlægger', 2, 1, 2, 1],
    ['Støvvægge & afdækning', 'Materiel', 1, 1, 1, 1],
    ['Støvsugning & slutrengøring', 'Diverse', 1, 1, 1, 4],
    ['Rydning af kælder & loft', 'Diverse', 1, 1, 2, 1],
  ],
  asbest_miljosanering: [
    ['Miljøscreening før nedrivning', 'Diverse', 2, 1, 2, 1],
    ['Asbestsanering (eternit)', 'Diverse', 3, 2, 5, 1],
    ['Fjernelse af asbestrør', 'Diverse', 3, 1, 3, 1],
    ['PCB-sanering af fuger', 'Diverse', 3, 2, 5, 1],
    ['Blyholdig maling', 'Maler', 2, 1, 3, 1],
    ['Skimmelsanering', 'Diverse', 3, 2, 5, 1],
    ['Radonsikring', 'Tømrer', 2, 1, 2, 2],
    ['Slutkontrol & måling', 'Diverse', 1, 1, 1, 4],
  ],
  bortkoersel_jord: [
    ['Opgravning af jord', 'Diverse', 2, 1, 3, 1],
    ['Bortkørsel af rene jord', 'Diverse', 1, 1, 2, 1],
    ['Jordanalyser & klassificering', 'Diverse', 2, 1, 2, 1],
    ['Forurenet jord til deponi', 'Diverse', 3, 1, 3, 1],
    ['Tilkørsel af ny muld', 'Diverse', 1, 1, 2, 4],
    ['Retablering af terræn', 'Diverse', 2, 1, 3, 4],
  ],
};

/**
 * Zones that should also inherit the richer legacy task rows from the pre-3D
 * catalog, so nothing that used to be selectable disappeared with the port.
 */
const LEGACY_TASK_SOURCES: Record<string, string[]> = {
  facade_overetage: ['facade_generel'],
  facade_stueetage: ['facade_generel'],
  vinduer_overetage: ['vinduer_doere'],
  vinduer_doere_stueetage: ['vinduer_doere'],
  badevaerelse: ['badevaereelse'],
  ladestander_elbil: [],
  indvendige_vaegge: ['stue_vaerelser'],
  etagedaek_gulve: [],
  trapper_indvendig: ['entree_gang'],
  varme_vvs: ['teknisk_rum'],
  varmepumpe_udedel: [],
  ventilation_anlaeg: [],
  el_installation: [],
  inventar_moebler: ['sovevaereelse', 'kontor_hobbyrum', 'bryggers_vaskerum'],
  skure_udhus: [],
  regnvand_faskine: [],
};

for (const [zoneId, seeds] of Object.entries(BUILDING_ZONE_TASK_SEEDS)) {
  const base = buildZoneTasks(zoneId, seeds);
  const seenLabels = new Set(base.map((task) => normalizeTaskLabel(task.label)));
  const seenIds = new Set(base.map((task) => task.id));
  const inherited: Task[] = [];

  for (const sourceKey of [zoneId, ...(LEGACY_TASK_SOURCES[zoneId] ?? [])]) {
    for (const task of TASKS_BY_ZONE[sourceKey] ?? []) {
      const label = normalizeTaskLabel(task.label);
      if (seenLabels.has(label) || seenIds.has(task.id)) continue;
      seenLabels.add(label);
      seenIds.add(task.id);
      inherited.push(task);
    }
  }

  TASKS_BY_ZONE[zoneId] = [...base, ...inherited];
}
