// ─────────────────────────────────────────────────────────────────────────────
// Marketplace catalog — marketing presentation + pricing per module (PRD §12).
//
// This is SALES metadata only: the server (moduleCatalog.js + org_module_
// entitlements) stays the source of truth for what an org may use. Prices are
// per organisation per month in DKK; 0 = included in the free foundation.
// Loaded ONLY by the marketplace pages (lazy route chunks) — keep it out of
// manifests so the startup bundle never carries marketing copy.
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleId } from './types';

/** Stylized UI-preview variant rendered on the module detail page. */
export type ModulePreviewVariant =
  | 'list'      // rows with status pills (tasks, purchasing…)
  | 'board'     // columns of cards (planning, field)
  | 'doc'       // document/report sheet
  | 'chat'      // message bubbles
  | 'stat'      // KPI tiles + progress bars
  | 'scan'      // AR/measure viewport
  | 'grid';     // tool/calculator grid

export interface ModuleMarketing {
  /** DKK per organisation per month. 0 = included in Gratis. */
  priceKr: number;
  /** One-line sales hook shown on cards and the detail hero. */
  tagline: string;
  /** 2-3 sentence pitch for the detail page. */
  pitch: string;
  /** "Det får du" bullet points. */
  features: string[];
  /** 3 short steps for "Sådan virker det". */
  steps: [string, string, string];
  preview: ModulePreviewVariant;
}

export const MODULE_MARKETING: Record<ModuleId, ModuleMarketing> = {
  projects: {
    priceKr: 0,
    tagline: 'Ét samlet overblik over alle dine byggesager',
    pitch:
      'Projekter er fundamentet i BygSmart. Opret sager på minutter, følg fremdrift, økonomi og team fra ét sted, og lad resten af appen samle sig omkring hvert projekt.',
    features: [
      'Projektoversigt med status, fremdrift og ulæste hændelser',
      'Guidet projekt-wizard med områder, opgavepakker og AI-forslag',
      'Projektdetaljer med faner der følger dine aktive moduler',
      'Tidslinje over opgaver og milepæle',
      'Roller og synlighed pr. deltager',
    ],
    steps: ['Opret projektet med wizarden', 'Invitér teamet og fordel roller', 'Følg fremdrift fra Projekt puls'],
    preview: 'stat',
  },
  tasks: {
    priceKr: 0,
    tagline: 'Opgaver, hurtigopgaver og kanban — altid ajour',
    pitch:
      'Planlæg arbejdet som liste, grupper, split-view eller kanban. Opgaver hænger sammen med projekter, tid og kvalitet, så intet falder mellem to stole.',
    features: [
      'Liste-, gruppe-, split- og kanban-visning',
      'Hurtigopgaver med foto — også uden projekt',
      'Tjeklister, vedhæftninger og @kommentarer',
      'Deadlines med forfaldsvarsler på forsiden',
      'Delegér opgaver til kolleger og partnere',
    ],
    steps: ['Opret opgaven med foto og deadline', 'Tildel ansvarlig og tjekliste', 'Følg status til Udført'],
    preview: 'list',
  },
  tools: {
    priceKr: 0,
    tagline: '~90 fagberegnere lige ved hånden',
    pitch:
      'Beton, tømmer, el, VVS, maling og meget mere — gennemprøvede beregnere med PDF-eksport og direkte kobling til dine projekter og indkøbslister.',
    features: [
      '~90 beregnere i 16 kategorier',
      'Gem resultater direkte på projektet',
      'Opret opgaver og indkøb fra et resultat',
      'PDF-eksport til kunde eller sagsmappe',
      'Opmålingsværktøj med foto',
    ],
    steps: ['Vælg beregner og indtast mål', 'Justér spild og priser', 'Send resultatet til projektet'],
    preview: 'grid',
  },
  knowledge: {
    priceKr: 0,
    tagline: 'BR18, DS/AB18 og guides — søgbart på dansk',
    pitch:
      'Slå bygningsreglementet op midt i arbejdet. Fuldtekstsøgning på tværs af BR18, SBI-anvisninger, standarder og guides — med AI-forslag til relevante paragraffer på dine opgaver.',
    features: [
      'Fuldtekst-søgning i BR18 med filtre',
      'SBI, DS, AB18 og AT-vejledninger samlet',
      'Byggeguides trin for trin',
      'AI-forslag til reglement på opgaver',
      'Deep-links du kan dele med teamet',
    ],
    steps: ['Søg på emne eller paragraf', 'Læs uddraget i konteksten', 'Knyt reglen til opgaven'],
    preview: 'doc',
  },
  field: {
    priceKr: 99,
    tagline: 'Check-in, dokumentation og site-chat på pladsen',
    pitch:
      'Alt udførende arbejde samlet i ét arbejdsrum pr. opgave: mød ind med ét tryk, dokumentér med fotos, chat med sjakket og aflever med digital kvittering.',
    features: [
      'Check-ind/ud der driver timeregistreringen',
      'Foto-dokumentation med tidsstempel',
      'Opgave-chat med @mentions og ulæste-tæller',
      'Digital afleveringsceremoni med underskrift',
      'Team-fane med invitationer og roller pr. opgave',
    ],
    steps: ['Tjek ind på opgaven', 'Dokumentér løbende med fotos', 'Aflever med underskrift'],
    preview: 'chat',
  },
  quality: {
    priceKr: 99,
    tagline: 'KS, mangelliste og afleveringsrapport uden papir',
    pitch:
      'Kvalitetssikring der faktisk bliver lavet: KS-punkter pr. opgave, mangelliste med pins på tegningen og en færdig PDF-rapport til bygherren.',
    features: [
      'KS-skemaer med foto og godkendelse',
      'Mangelliste med pins på plantegning',
      'Statusflow: åben → udbedret → godkendt',
      'PDF-eksport med fotos til aflevering',
      'Historik og ansvarlig pr. punkt',
    ],
    steps: ['Markér manglen på tegningen', 'Tildel og udbedr', 'Eksportér rapporten'],
    preview: 'board',
  },
  time: {
    priceKr: 79,
    tagline: 'Timer på projekter — uden regneark',
    pitch:
      'Registrér timer direkte fra check-in eller manuelt, se dagens og ugens forbrug pr. projekt og medarbejder, og få tallene med i budget og rapporter.',
    features: [
      'Timeregistrering pr. projekt og opgave',
      'Flydende timer-widget mens du arbejder',
      'Dagens timer på forsiden',
      'Uge- og medarbejderoverblik',
      'Excel-eksport til løn og fakturering',
    ],
    steps: ['Start timeren eller tjek ind', 'Godkend dagens linjer', 'Eksportér til Excel'],
    preview: 'stat',
  },
  planning: {
    priceKr: 59,
    tagline: 'Gantt, kalender og opfølgning i ét',
    pitch:
      'Planlæg projektet visuelt, hold aftaler med påmindelser og lad opfølgningsfanen samle løse ender — forfaldne opgaver, ubetalte indkøb og kommende deadlines.',
    features: [
      'Gantt-visning over projekter og opgaver',
      'Zoom mellem kvartal, måned og uge',
      'Opfølgnings-fane med alt der kræver handling',
      'Påmindelser knyttet til projekt og dato',
      'Deler data med Tid & Plan-fanen',
    ],
    steps: ['Sæt datoer på sagen', 'Sæt påmindelser på aftaler', 'Luk løse ender i Opfølgning'],
    preview: 'board',
  },
  documents: {
    priceKr: 69,
    tagline: 'Tegninger og dokumenter med styr på revisioner',
    pitch:
      'Upload tegninger og sagsdokumenter, hold styr på discipliner og revisioner, og styr hvem der må se hvad — alt ligger sikkert i skyen pr. projekt.',
    features: [
      'Dokumentarkiv pr. projekt med kategorier',
      'Tegningsfelter: disciplin, revision, mål og dato',
      'Nyeste revision markeres automatisk',
      'Adgangsniveauer og password-beskyttelse',
      'Upload fra mobil, GDrive, Dropbox m.fl.',
    ],
    steps: ['Upload tegningen', 'Udfyld disciplin og revision', 'Del med teamet'],
    preview: 'doc',
  },
  team: {
    priceKr: 59,
    tagline: 'Invitér, fordel roller og hold styr på sæder',
    pitch:
      'Saml firmaet ét sted: invitér medarbejdere på e-mail, fordel roller og se hvem der er aktive. Team-siden er bindeleddet mellem organisation, projekter og opgaver.',
    features: [
      'E-mail-invitationer med automatisk kobling',
      'Roller: ejer, leder, medarbejder',
      'Sædeoverblik pr. organisation',
      'Invitationsbanner på forsiden',
      'Netværk på tværs af projekter',
    ],
    steps: ['Send invitationen', 'Kollegaen opretter sig', 'Fordel rolle og projekter'],
    preview: 'list',
  },
  budget: {
    priceKr: 79,
    tagline: 'Baseline, revisioner og budget-burn pr. projekt',
    pitch:
      'Læg et realistisk budget fra wizarden eller manuelt, følg forbruget mod baseline og se hvornår en sag er ved at løbe løbsk — før det sker.',
    features: [
      'Budget-baseline med kategorier',
      'Revisioner med historik',
      'Forbrug fra indkøb og timer',
      'Budget-tile i projektoverblikket',
      'Timepriser pr. opgave',
    ],
    steps: ['Læg baseline-budgettet', 'Registrér forbrug løbende', 'Følg burn mod budget'],
    preview: 'stat',
  },
  purchasing: {
    priceKr: 69,
    tagline: 'Indkøb med kvitteringer og leveringsdatoer',
    pitch:
      'Fra beregner til bestilling: opret indkøb med leverandør, pris og forventet levering, vedhæft kvitteringsfotos og se hvad der afventer på forsiden.',
    features: [
      'Indkøbsliste pr. projekt med status',
      'Kvitteringsfotos i skyen',
      'Leverandører med varenumre og priser',
      'Afventer indkøb-tile på forsiden',
      'Opret indkøb direkte fra beregnere',
    ],
    steps: ['Opret indkøbet', 'Vedhæft kvitteringen', 'Markér som leveret'],
    preview: 'list',
  },
  quotations: {
    priceKr: 79,
    tagline: 'Professionelle tilbud med linjer, moms og PDF',
    pitch:
      'Byg tilbud med linjer og moms direkte på sagen, send som PDF med dit firmanavn, og følg status fra kladde til accepteret.',
    features: [
      'Tilbudslinjer med enheder og moms',
      'Statusflow: kladde → sendt → accepteret',
      'PDF med firmaprofil og CVR',
      'Tilbud-fane pr. projekt',
      'Genbrug linjer på tværs af tilbud',
    ],
    steps: ['Byg tilbuddet med linjer', 'Send PDF til kunden', 'Markér som accepteret'],
    preview: 'doc',
  },
  partners: {
    priceKr: 99,
    tagline: 'Underentreprenører med forhandling og delegation',
    pitch:
      'Invitér UE\'er til konkrete opgaver, forhandl pris i en indbygget tråd og delegér arbejdet — partneren ser kun det, du deler.',
    features: [
      'Partner-invitationer pr. opgave',
      'Forhandlingstråd med bud og accept',
      'Partneropgaver på partnerens forside',
      'Afgrænset partner-projektvisning',
      'Delegér hurtigopgaver til netværket',
    ],
    steps: ['Invitér partneren til opgaven', 'Forhandl pris i tråden', 'Følg arbejdet til aflevering'],
    preview: 'chat',
  },
  reporting: {
    priceKr: 89,
    tagline: 'PDF-rapporter og Excel-eksport med ét tryk',
    pitch:
      'Projektrapporter, afleveringsdokumenter og intelligence-analyser som flotte PDF\'er — plus Excel-eksport af projekter, opgaver og timer til bogholderiet.',
    features: [
      'Projektrapport-skabeloner (PDF)',
      'Excel-eksport: projekt, opgave, timer',
      'AI-afleveringsrapport med logo',
      'Rapportindstillinger pr. opgave',
      'Rapportpanel pr. opgave',
    ],
    steps: ['Vælg rapporttype', 'Generér og gennemse', 'Del PDF\'en med kunden'],
    preview: 'doc',
  },
  'client-portal': {
    priceKr: 89,
    tagline: 'Giv bygherren ro i maven — uden telefonopkald',
    pitch:
      'En ren læseadgang til projektets Overblik og Dokumenter. Kunden følger med selv i browseren, og du slipper for statusmøderne.',
    features: [
      'Read-only visning pr. projekt',
      'Fast adgang: Overblik og Dokumenter',
      'Fremdrift og fotodokumentation',
      'Delte dokumenter og rapporter',
      'Ingen app-installation for kunden',
    ],
    steps: ['Invitér kunden som CLIENT', 'Kunden opretter sig via linket', 'Kunden følger selv med'],
    preview: 'stat',
  },
  ai: {
    priceKr: 149,
    tagline: 'Din digitale byggeleder — briefinger, chat og analyse',
    pitch:
      'AI\'en kender dine projekter: få dagens briefing på forsiden, spørg chatten om alt fra reglement til status, og lad intelligence-indekset spotte risiko før mennesker gør.',
    features: [
      'Dagens briefing med vejr og fokus',
      'Chatbot med projektkontekst',
      'Avanceret briefing med dybdeanalyse',
      'Intelligence-indeks pr. projekt',
      'AI-tjeklister og opgaveoptimering',
      'AI-forslag til reglement',
    ],
    steps: ['Læs briefingen om morgenen', 'Spørg chatten undervejs', 'Reagér på risiko-signaler'],
    preview: 'chat',
  },
  ar: {
    priceKr: 129,
    tagline: '3D-scan rum og mål med kameraet',
    pitch:
      'Scan et rum med telefonen og få mål og flader direkte ind i beregnerne. AR-opmåling der sparer turen tilbage efter det glemte mål.',
    features: [
      'RoomMapper 3D-scanning',
      'AR-måling af længder og flader',
      'Send mål direkte til beregnere',
      'Gem scanninger på projektet',
      'Fungerer på nyere mobiler',
    ],
    steps: ['Scan rummet med kameraet', 'Justér punkterne', 'Send målene til beregneren'],
    preview: 'scan',
  },
  integrations: {
    priceKr: 59,
    tagline: 'GDrive, Dropbox, OneDrive og Box — koblet på',
    pitch:
      'Hent filer direkte fra jeres cloud-lager når du vedhæfter dokumenter og fotos. Én gang forbundet, altid ved hånden.',
    features: [
      'Google Drive, Dropbox, OneDrive og Box',
      'Cloud-filvælger i alle upload-flows',
      'Sikker OAuth-forbindelse pr. bruger',
      'Styres under Indstillinger → Integrationer',
      'Flere integrationer på vej',
    ],
    steps: ['Forbind kontoen én gang', 'Vælg filer i upload-dialogen', 'Vedhæft direkte fra skyen'],
    preview: 'grid',
  },
};

export const formatModulePrice = (priceKr: number): string =>
  priceKr === 0 ? 'Inkluderet' : `${priceKr} kr/md.`;

/** 14 days — the self-serve trial length offered on module detail pages. */
export const TRIAL_DAYS = 14;
