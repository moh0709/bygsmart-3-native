// da-DK translation catalog — the ONLY locale we ship (D-02). One namespace
// ('translation'), nested keys. `as const` gives every key a literal type so
// t('nav.home') is checked at compile time (see ../types.ts).
//
// Module display names live in each module's manifest (the ModuleManifest
// contract calls `name`/`label` the Danish display name); those are not keyed
// here — with a single locale they are already final. This catalog owns the
// app-shell + screen chrome so a second locale later is a drop-in file.
export const da = {
  common: {
    appName: 'BygSmart',
    save: 'Gem',
    cancel: 'Annuller',
    delete: 'Slet',
    retry: 'Prøv igen',
    close: 'Luk',
    back: 'Tilbage',
    confirm: 'Bekræft',
    loading: 'Indlæser…',
  },
  nav: {
    home: 'Hjem',
    projects: 'Projekter',
    tasks: 'Opgaver',
    more: 'Mere',
  },
  states: {
    offlineTitle: 'Offline',
    offlineBody: 'Ændringer gemmes lokalt og synkroniseres, når du er online igen.',
    emptyTitle: 'Ingen data endnu',
    errorTitle: 'Noget gik galt',
  },
  login: {
    title: 'Log ind',
    subtitle: 'Byggeprojekter, offline-først.',
    email: 'E-mail',
    password: 'Adgangskode',
    submit: 'Log ind',
  },
  sync: {
    local: 'Kun lokal',
    synced: 'Synkroniseret',
    syncing: 'Synkroniserer…',
    error: 'Synk-fejl',
    pending: '{{count}} i kø',
    now: 'Synk nu',
  },
  conflict: {
    title: 'Konflikt',
    body: 'En anden har ændret dette, mens du var offline. Vælg hvilken version der gælder.',
    keepServer: 'Behold serverens',
    keepMine: 'Behold min',
    mine: 'Min',
    server: 'Server',
  },
  minDag: {
    title: 'Min Dag',
    subtitle: 'Dine åbne opgaver',
    openCount: '{{count}} åbne opgaver',
    allDoneTitle: 'Alt er klaret',
    allDoneBody: 'Du har ingen åbne opgaver lige nu.',
  },
  more: {
    title: 'Mere',
    appTitle: 'BygSmart 3.0 Native',
    appSubtitle: 'Universal app · P1 foundation',
    badgeDev: 'Udvikling',
  },
  projects: {
    title: 'Projekter',
    emptyTitle: 'Ingen projekter endnu',
    emptyBody: 'Opret dit første projekt for at komme i gang.',
    newProject: 'Nyt projekt',
    defaultName: 'Nyt projekt',
    taskSummary: '{{open}} af {{total}} opgaver åbne',
    noTasks: 'Ingen opgaver endnu',
    syncing: 'Henter…',
    ready: 'Synkroniseret',
  },
  projectDetail: {
    tasksTitle: 'Opgaver',
    addTask: 'Tilføj opgave',
    newTaskTitle: 'Ny opgave',
    notFound: 'Projekt ikke fundet',
  },
  tasks: {
    title: 'Opgaver',
    emptyTitle: 'Ingen opgaver',
    emptyBody: 'Opgaver vises her, når de er tildelt.',
    open: 'Åben',
    done: 'Færdig',
    noProject: 'Uden projekt',
    markDone: 'Markér som færdig',
  },
  capabilities: {
    title: 'Offline-kapacitet',
    detecting: 'Registrerer…',
    tierFull: 'Fuld offline',
    tierSession: 'Offline i denne session',
    tierOnline: 'Kun online',
    full: 'Ændringer gemmes lokalt og synkroniseres, når du er online.',
    session: 'Ændringer gemmes, men kan ryddes — installér appen for fuld offline.',
    online: 'Kræver forbindelse — ændringer kan ikke gemmes offline her.',
  },
} as const;

export type DaResources = typeof da;
