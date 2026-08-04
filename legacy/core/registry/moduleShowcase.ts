// ─────────────────────────────────────────────────────────────────────────────
// Module showcase — the landing-page layer for /moduler/:id.
//
// marketplaceCatalog.ts stays the short-form sales metadata used by the
// storefront CARDS (tagline, price, bullets). This file carries the LONG-form
// presentation only the detail page needs: headline, accent pair, impact
// metrics, feature cards, the "sådan virker det" flow, a before/after
// comparison and the FAQ.
//
// Every number in `metrics` is a product fact derived from the feature list —
// not a measured statistic. Keep it that way: no invented research claims.
//
// Loaded ONLY by the marketplace detail route (lazy chunk), like the catalog.
// ─────────────────────────────────────────────────────────────────────────────

import type React from 'react';
import type { ModuleId } from './types';
import {
  AlertTriangleIcon, BellIcon, BrainIcon, CalculatorIcon, CalendarIcon, CameraIcon,
  CheckCircleIcon, CheckSquareIcon, ChecklistIcon, ClipboardListIcon, ClockIcon,
  CloudIcon, DownloadIcon, EyeIcon, FileTextIcon, FilterIcon, FolderIcon, HashIcon,
  ImageIcon, LayersIcon, LinkIcon, ListIcon, LockIcon, MapPinIcon, MessageSquareIcon,
  PieChartIcon, PinIcon, SearchIcon, SendIcon, SettingsIcon, ShoppingCartIcon,
  SlidersIcon, SparklesIcon, TrendingUpIcon, UploadCloudIcon, UsersIcon, ZapIcon,
} from '../../components/icons';

type IconComponent = React.FC<{ className?: string }>;

/** A single count-up tile in the impact strip under the hero. */
export interface ShowcaseMetric {
  /** Short, punchy — a number, a unit or a one-word fact. */
  value: string;
  /** What the value refers to. */
  label: string;
}

export interface ShowcaseFeature {
  icon: IconComponent;
  title: string;
  body: string;
}

export interface ShowcaseFlowStep {
  title: string;
  body: string;
}

export interface ShowcaseFaq {
  q: string;
  a: string;
}

export interface ModuleShowcase {
  /** Aurora accent pair for the hero stage (`--sc-a` / `--sc-b`). */
  accent: [string, string];
  /** Landing headline — bigger promise than the card tagline. */
  headline: string;
  /** 1–2 sentences directly under the headline. */
  subhead: string;
  /** Three product facts, shown as tiles below the hero. */
  metrics: [ShowcaseMetric, ShowcaseMetric, ShowcaseMetric];
  /** Heading + hint for the interactive demo block. */
  demoTitle: string;
  demoHint: string;
  /** Rich feature cards (replaces the flat bullet list). */
  features: ShowcaseFeature[];
  /** The "sådan virker det" infographic flow. */
  flow: ShowcaseFlowStep[];
  /** Before/after comparison rows. */
  without: [string, string, string];
  withIt: [string, string, string];
  faq: [ShowcaseFaq, ShowcaseFaq, ShowcaseFaq];
  /** Modules that pair naturally with this one. */
  related: ModuleId[];
}

export const MODULE_SHOWCASE: Record<ModuleId, ModuleShowcase> = {
  // ── Foundation ────────────────────────────────────────────────────────────
  projects: {
    accent: ['#1E5FFF', '#0E4AE8'],
    headline: 'Hele firmaets byggesager. Ét sted.',
    subhead:
      'Projekter er fundamentet under alt andet i BygSmart. Opret en sag på minutter, og lad opgaver, timer, økonomi og dokumenter samle sig omkring den helt af sig selv.',
    metrics: [
      { value: '1', label: 'hub til alle sager' },
      { value: '5', label: 'faner pr. projekt' },
      { value: '0 kr', label: 'inkluderet i Gratis' },
    ],
    demoTitle: 'Prøv projekt-pulsen',
    demoHint: 'Tryk på en fane — se hvordan projektet skifter fokus uden at du mister overblikket.',
    features: [
      { icon: FolderIcon, title: 'Projektoversigt der prioriterer for dig', body: 'Sagerne sorteres efter det, der kræver handling nu — forfaldne opgaver, ulæste hændelser og fremdrift på tværs.' },
      { icon: SparklesIcon, title: 'Guidet wizard med AI-forslag', body: 'Vælg projekttype, områder og opgavepakker. Wizarden foreslår opgaver, budgetlinjer og et 3D-hus, du kan klikke dig rundt i.' },
      { icon: LayersIcon, title: 'Faner der følger dine moduler', body: 'Projektet viser kun det, I har aktiveret. Slår I Budget til, dukker Økonomi-fanen op — uden opsætning.' },
      { icon: ClockIcon, title: 'Tidslinje over opgaver og milepæle', body: 'Se hele sagens forløb som én linje, fra opstart til aflevering, med milepæle du selv sætter.' },
      { icon: UsersIcon, title: 'Roller og synlighed pr. deltager', body: 'Medarbejder, leder, partner eller bygherre — hver rolle ser præcis det, den skal.' },
      { icon: TrendingUpIcon, title: 'Projekt puls på forsiden', body: 'Fremdrift, økonomi og aktivitet destilleret til ét tal pr. sag, så du ser skævheder før de bliver dyre.' },
    ],
    flow: [
      { title: 'Opret sagen', body: 'Wizarden spørger om type, omfang og adresse — resten udfyldes automatisk.' },
      { title: 'Invitér teamet', body: 'Send invitationer på e-mail og fordel roller pr. projekt.' },
      { title: 'Arbejd i appen', body: 'Opgaver, timer, fotos og indkøb lander automatisk på den rigtige sag.' },
      { title: 'Følg pulsen', body: 'Overblikket opdaterer sig selv — du reagerer kun når noget stikker af.' },
    ],
    without: ['Sager spredt over mapper, mails og hukommelse', 'Ingen ved hvad status faktisk er', 'Ny mand skal have det hele forklaret'],
    withIt: ['Én sag = ét sted med alt', 'Status er altid opdateret og synlig', 'Nye kolleger er selvkørende fra dag ét'],
    faq: [
      { q: 'Koster Projekter noget?', a: 'Nej. Projekter er en del af fundamentet og følger med i Gratis-planen sammen med Opgaver, Beregnere og Viden & Reglement.' },
      { q: 'Hvor mange projekter kan jeg oprette?', a: 'Der er ingen grænse på antal projekter. Det eneste, der er kvoteret, er lagerplads til fotos og dokumenter — den kan udvides som tilkøb.' },
      { q: 'Kan jeg arkivere gamle sager?', a: 'Ja. Afsluttede projekter kan markeres som færdige, så de forsvinder fra det daglige overblik men bevarer al historik, fotos og rapporter.' },
    ],
    related: ['tasks', 'planning', 'budget'],
  },

  tasks: {
    accent: ['#2E90FA', '#1E5FFF'],
    headline: 'Fra “det tager jeg lige” til dokumenteret udført.',
    subhead:
      'Planlæg arbejdet som liste, grupper, split-view eller kanban. Opgaver hænger sammen med projekter, tid og kvalitet, så intet falder mellem to stole.',
    metrics: [
      { value: '4', label: 'visninger af samme data' },
      { value: '0', label: 'projekter krævet til hurtigopgaver' },
      { value: '0 kr', label: 'inkluderet i Gratis' },
    ],
    demoTitle: 'Prøv kanban-tavlen',
    demoHint: 'Tryk på et kort for at flytte det til næste kolonne — status, fremdrift og tæller opdaterer sig med det samme.',
    features: [
      { icon: ListIcon, title: 'Fire visninger, samme opgaver', body: 'Liste når du skal have overblik, grupper når du planlægger, split når du arbejder, kanban når sjakket skal se flowet.' },
      { icon: ZapIcon, title: 'Hurtigopgaver med foto', body: 'Så en revne? Tag et billede og opret opgaven på tre sekunder — også helt uden et projekt.' },
      { icon: ChecklistIcon, title: 'Tjeklister og vedhæftninger', body: 'Bryd opgaven ned i punkter, hæft tegninger og fotos på, og se fremdriften som procent.' },
      { icon: MessageSquareIcon, title: '@kommentarer på opgaven', body: 'Al snak om opgaven bliver på opgaven — ikke i en SMS-tråd ingen kan finde igen.' },
      { icon: BellIcon, title: 'Deadlines med forfaldsvarsler', body: 'Opgaver der brænder på, popper op på forsiden før de bliver forsinkede.' },
      { icon: LinkIcon, title: 'Delegér til kolleger og partnere', body: 'Send opgaven videre til en kollega eller en underentreprenør uden at miste ejerskabet.' },
    ],
    flow: [
      { title: 'Opret opgaven', body: 'Titel, foto og deadline — resten kan vente.' },
      { title: 'Tildel ansvarlig', body: 'Vælg person og læg en tjekliste på, hvis det er en større kasse.' },
      { title: 'Følg flowet', body: 'Kortet flytter sig gennem kolonnerne, efterhånden som arbejdet skrider frem.' },
      { title: 'Luk med dokumentation', body: 'Udført-status gemmer fotos og kommentarer som sagens historik.' },
    ],
    without: ['Opgaver på post-its og i hovedet', 'Ingen ved hvem der har bolden', 'Ting bliver først opdaget ved aflevering'],
    withIt: ['Alt arbejde er synligt for hele sjakket', 'Én ansvarlig og én deadline pr. opgave', 'Fejl fanges mens stilladset stadig står'],
    faq: [
      { q: 'Skal en opgave altid høre til et projekt?', a: 'Nej. Hurtigopgaver kan oprettes frit — typisk til småting du opdager i farten. Du kan altid flytte dem over på et projekt senere.' },
      { q: 'Kan medarbejdere se hinandens opgaver?', a: 'Ja, inden for de projekter de er tilknyttet. Roller styrer, hvem der må oprette, tildele og lukke opgaver.' },
      { q: 'Virker kanban på mobil?', a: 'Ja. Kanban er bygget mobil-først — du flytter kort med ét tryk i stedet for at slæbe dem rundt på en lille skærm.' },
    ],
    related: ['projects', 'field', 'quality'],
  },

  tools: {
    accent: ['#0EA5E9', '#2563EB'],
    headline: 'Regnestykket er lavet, før du har fundet lommeregneren.',
    subhead:
      'Beton, tømmer, el, VVS, maling og meget mere — gennemprøvede fagberegnere med spild, priser, PDF-eksport og direkte kobling til dine projekter og indkøbslister.',
    metrics: [
      { value: '~90', label: 'fagberegnere' },
      { value: '16', label: 'kategorier' },
      { value: 'PDF', label: 'eksport af hvert resultat' },
    ],
    demoTitle: 'Prøv en beregner',
    demoHint: 'Skru på målene — resultatet, spildet og materialelisten regnes om, mens du trækker.',
    features: [
      { icon: CalculatorIcon, title: '~90 beregnere i 16 kategorier', body: 'Fra betonmængde og spærafstand til kabeldimension, faldstammer og malingsforbrug — alle med danske normer i bunden.' },
      { icon: SlidersIcon, title: 'Spild og priser du selv styrer', body: 'Sæt dit eget spildprocent og dine egne enhedspriser, så resultatet passer til din leverandøraftale.' },
      { icon: FolderIcon, title: 'Gem resultatet på projektet', body: 'Beregningen bliver liggende på sagen med dato, så du kan dokumentere hvad der lå til grund for bestillingen.' },
      { icon: ShoppingCartIcon, title: 'Fra resultat til indkøb med ét tryk', body: 'Materialelisten kan sendes direkte videre som indkøb eller som en opgave til sjakket.' },
      { icon: FileTextIcon, title: 'PDF til kunde eller sagsmappe', body: 'Eksportér beregningen som et pænt dokument med dit firmanavn — klar til bygherren.' },
      { icon: CameraIcon, title: 'Opmålingsværktøj med foto', body: 'Tegn mål ind på et billede af rummet, og tag målene med direkte over i beregneren.' },
    ],
    flow: [
      { title: 'Vælg beregner', body: 'Søg på fag eller materiale — 16 kategorier dækker det meste af pladsen.' },
      { title: 'Indtast mål', body: 'Skriv målene ind, eller hent dem fra en opmåling eller en AR-scanning.' },
      { title: 'Justér spild og pris', body: 'Tilpas til din leverandør, så tallet er til at bestille efter.' },
      { title: 'Send videre', body: 'Gem på projektet, lav et indkøb, eller eksportér som PDF.' },
    ],
    without: ['Regneark der kun én mand forstår', 'Bestilt for lidt — ekstra tur til byggemarkedet', 'Ingen dokumentation for hvad der blev regnet'],
    withIt: ['Samme metode hver gang, uanset hvem der regner', 'Spild regnet med fra start', 'Hver beregning gemt med dato på sagen'],
    faq: [
      { q: 'Er beregnerne baseret på danske normer?', a: 'Ja. Beregnerne følger dansk praksis og henviser til BR18/DS hvor det er relevant. De erstatter ikke en ingeniørberegning på bærende konstruktioner — brug dem som arbejdsredskab og overslag.' },
      { q: 'Kan jeg bruge mine egne priser?', a: 'Ja. Enhedspriser og spildprocent kan sættes pr. beregning, så resultatet matcher din faktiske leverandøraftale.' },
      { q: 'Koster Beregnere noget?', a: 'Nej — hele værktøjskassen er en del af fundamentet og følger med i Gratis-planen.' },
    ],
    related: ['purchasing', 'ar', 'knowledge'],
  },

  knowledge: {
    accent: ['#6366F1', '#3B82F6'],
    headline: 'Bygningsreglementet. Uden at forlade opgaven.',
    subhead:
      'Fuldtekstsøgning på tværs af BR18, SBI-anvisninger, DS-standarder, AB18 og AT-vejledninger — på dansk, med deep-links du kan dele med sjakket.',
    metrics: [
      { value: 'BR18', label: 'i fuldtekst' },
      { value: '5', label: 'kildesamlinger' },
      { value: '0 kr', label: 'inkluderet i Gratis' },
    ],
    demoTitle: 'Prøv opslaget',
    demoHint: 'Tryk på et emne — søgningen kører og viser paragraffen med den relevante linje fremhævet.',
    features: [
      { icon: SearchIcon, title: 'Fuldtekstsøgning i BR18', body: 'Søg på ord, ikke kun paragrafnumre. Filtrér på kapitel, så du lander det rigtige sted i første forsøg.' },
      { icon: LayersIcon, title: 'SBI, DS, AB18 og AT samlet', body: 'Fem kildesamlinger i ét søgefelt — du behøver ikke huske, hvilken bog reglen stod i.' },
      { icon: ChecklistIcon, title: 'Byggeguides trin for trin', body: 'Praktiske gennemgange af typiske opgaver, skrevet til håndværkere frem for jurister.' },
      { icon: SparklesIcon, title: 'AI-forslag til reglement på opgaver', body: 'Appen foreslår selv de paragraffer, der plejer at gælde for den type arbejde, du er i gang med.' },
      { icon: LinkIcon, title: 'Deep-links du kan dele', body: 'Send et link direkte til afsnittet i en kommentar — modtageren lander præcis samme sted.' },
      { icon: FilterIcon, title: 'Filtre der skærer støjen fra', body: 'Afgræns på kilde, kapitel og emne, så du slipper for at scrolle gennem 400 siders reglement.' },
    ],
    flow: [
      { title: 'Søg på emne', body: 'Skriv i almindeligt sprog — “brandkrav loft” virker fint.' },
      { title: 'Læs i konteksten', body: 'Uddraget vises med afsnittet omkring, så du ser sammenhængen.' },
      { title: 'Knyt reglen til opgaven', body: 'Gem henvisningen på opgaven, så den følger med til KS og aflevering.' },
      { title: 'Del med teamet', body: 'Deep-linket lander modtageren nøjagtigt samme sted.' },
    ],
    without: ['Google, PDF-filer og gætværk på pladsen', 'Reglen findes først når kontrollen kommer', 'Hver mand har sin egen fortolkning'],
    withIt: ['Reglen slås op på 20 sekunder', 'Henvisningen ligger på opgaven', 'Alle arbejder efter samme kilde'],
    faq: [
      { q: 'Er indholdet opdateret?', a: 'Reglementsteksterne opdateres med udgivelserne. Ved myndighedsafgørelser skal du altid tjekke den officielle kilde — appen er et opslagsværktøj, ikke en juridisk garanti.' },
      { q: 'Kan jeg søge offline?', a: 'Reglementsteksten er en del af app-pakken, så basisopslag virker også når signalet på pladsen er dårligt. AI-forslag kræver forbindelse.' },
      { q: 'Hvad koster Viden & Reglement?', a: 'Ingenting. Det er en del af fundamentet og følger med i Gratis-planen.' },
    ],
    related: ['quality', 'tasks', 'ai'],
  },

  // ── Operations ────────────────────────────────────────────────────────────
  field: {
    accent: ['#F59E0B', '#EA580C'],
    headline: 'Ét tryk på pladsen. Hele dagen dokumenteret.',
    subhead:
      'Alt udførende arbejde samlet i ét arbejdsrum pr. opgave: mød ind med ét tryk, dokumentér med fotos, chat med sjakket og aflever med digital underskrift.',
    metrics: [
      { value: '1 tryk', label: 'starter check-in og timer' },
      { value: 'Foto', label: 'med tidsstempel på hver post' },
      { value: '1', label: 'arbejdsrum pr. opgave' },
    ],
    demoTitle: 'Prøv arbejdsrummet',
    demoHint: 'Tryk “Tjek ind” — timeren starter, dokumentationen åbner, og du kan aflevere med underskrift til sidst.',
    features: [
      { icon: MapPinIcon, title: 'Check-ind/ud der driver timerne', body: 'Ét tryk registrerer fremmøde og starter timeregistreringen — ingen dobbelt indtastning ved fyraften.' },
      { icon: CameraIcon, title: 'Foto-dokumentation med tidsstempel', body: 'Hvert billede får tid, sted og opgave med. Det er den dokumentation, der afgør en tvist et halvt år senere.' },
      { icon: MessageSquareIcon, title: 'Opgave-chat med @mentions', body: 'Sjakket skriver sammen på opgaven, med ulæst-tæller så beskeder ikke drukner i en gruppetråd.' },
      { icon: CheckCircleIcon, title: 'Digital afleveringsceremoni', body: 'Gennemgå opgaven med kunden på skærmen og få underskriften direkte i appen.' },
      { icon: UsersIcon, title: 'Team-fane pr. opgave', body: 'Se hvem der er mødt ind, invitér flere folk og fordel roller uden at forlade opgaven.' },
      { icon: ClipboardListIcon, title: 'Alt arbejde i ét rum', body: 'Check-in, fotos, chat og aflevering ligger samme sted — ikke spredt over fire apps.' },
    ],
    flow: [
      { title: 'Tjek ind', body: 'Ét tryk når du ankommer. Timeren kører i baggrunden.' },
      { title: 'Dokumentér løbende', body: 'Fotos og noter lander automatisk på den rigtige opgave.' },
      { title: 'Koordinér i chatten', body: 'Sjakket holder hinanden opdateret uden at ringe rundt.' },
      { title: 'Aflever med underskrift', body: 'Kvitteringen gemmes på sagen og kan sendes som PDF.' },
    ],
    without: ['Timesedler skrevet fra hukommelsen om fredagen', 'Fotos spredt i private kamerarullen', 'Ord mod ord ved aflevering'],
    withIt: ['Timer registreret i det sekund manden møder ind', 'Al dokumentation samlet på opgaven', 'Underskrevet kvittering på sagen'],
    faq: [
      { q: 'Kræver check-in at appen er åben hele dagen?', a: 'Nej. Du tjekker ind én gang og ud igen — appen behøver ikke at køre imellem. Glemmer nogen at tjekke ud, kan tiden rettes manuelt bagefter.' },
      { q: 'Hvor gemmes billederne?', a: 'I jeres eget projektlager i skyen, knyttet til opgaven. De tæller med i organisationens lagerkvote, som kan udvides.' },
      { q: 'Skal jeg have Tidsregistrering for at bruge check-in?', a: 'Nej, check-in virker alene. Men med Tidsregistrering aktivt bliver check-in automatisk til timelinjer, du kan eksportere til løn og fakturering.' },
    ],
    related: ['time', 'quality', 'tasks'],
  },

  quality: {
    accent: ['#10B981', '#059669'],
    headline: 'Kvalitetssikring der faktisk bliver lavet.',
    subhead:
      'KS-punkter pr. opgave, mangelliste med pins direkte på plantegningen og en færdig PDF-rapport til bygherren — uden et eneste stykke papir.',
    metrics: [
      { value: 'Pins', label: 'direkte på plantegningen' },
      { value: '3', label: 'statustrin pr. mangel' },
      { value: 'PDF', label: 'afleveringsrapport med fotos' },
    ],
    demoTitle: 'Prøv mangellisten',
    demoHint: 'Tryk på plantegningen for at sætte en pin — følg den derefter fra åben til godkendt.',
    features: [
      { icon: PinIcon, title: 'Mangelliste med pins på tegningen', body: 'Sæt manglen præcis dér hvor den er. Sjakket kan ikke tage fejl af hvilket vindue du mener.' },
      { icon: CheckSquareIcon, title: 'KS-skemaer med foto og godkendelse', body: 'Faste kontrolpunkter pr. opgavetype, hvor hvert punkt kræver et billede før det kan godkendes.' },
      { icon: AlertTriangleIcon, title: 'Statusflow: åben → udbedret → godkendt', body: 'Manglen kan ikke lukkes af den, der udbedrede den. To sæt øjne, hver gang.' },
      { icon: FileTextIcon, title: 'PDF-eksport med fotos', body: 'Hele afleveringsrapporten genereres med før/efter-billeder og dit firmalogo.' },
      { icon: ClockIcon, title: 'Historik og ansvarlig pr. punkt', body: 'Hvem meldte den, hvem udbedrede, hvem godkendte — og hvornår. Det hele står der.' },
      { icon: ImageIcon, title: 'Før/efter på hver mangel', body: 'Dokumentationen for udbedringen hænger på manglen, ikke i en mailtråd.' },
    ],
    flow: [
      { title: 'Markér manglen', body: 'Sæt pin på tegningen og tag et billede.' },
      { title: 'Tildel og udbedr', body: 'Manglen lander hos den ansvarlige med deadline.' },
      { title: 'Godkend', body: 'Byggeleder gennemgår og godkender med foto som bevis.' },
      { title: 'Eksportér rapporten', body: 'Bygherren får en samlet PDF ved aflevering.' },
    ],
    without: ['Mangellister på papir der bliver våde og væk', 'Diskussion om hvad “vinduet i stuen” betyder', 'Aflevering trækker ud i ugevis'],
    withIt: ['Manglen sidder på tegningen med foto', 'Ansvarlig og deadline fra dag ét', 'Rapporten er klar samme dag som arbejdet'],
    faq: [
      { q: 'Kan jeg bruge mine egne KS-skemaer?', a: 'Du kan sammensætte kontrolpunkter pr. opgavetype, så de matcher jeres egen kvalitetshåndbog. Punkterne følger med, næste gang samme opgavetype oprettes.' },
      { q: 'Hvilken tegning kan jeg sætte pins på?', a: 'En plantegning uploadet til projektet. Med Dokumenter & Tegninger aktivt kan du sætte pins på den nyeste revision automatisk.' },
      { q: 'Får bygherren adgang til mangellisten?', a: 'Kun hvis du vil. Med Kunde-portal kan du give læseadgang til udvalgte faner — ellers deler du bare den færdige PDF.' },
    ],
    related: ['field', 'documents', 'reporting'],
  },

  time: {
    accent: ['#06B6D4', '#0891B2'],
    headline: 'Timerne er talt op, før du har fundet regnearket.',
    subhead:
      'Registrér timer fra check-in eller manuelt, se dagens og ugens forbrug pr. projekt og medarbejder, og få tallene direkte med i budget og rapporter.',
    metrics: [
      { value: '2', label: 'veje ind: check-in eller manuelt' },
      { value: 'Uge', label: 'overblik pr. medarbejder' },
      { value: 'Excel', label: 'eksport til løn og faktura' },
    ],
    demoTitle: 'Prøv timeren',
    demoHint: 'Tryk start — timeren løber, ugebjælken vokser, og linjen lander på projektet når du stopper.',
    features: [
      { icon: ClockIcon, title: 'Timeregistrering pr. projekt og opgave', body: 'Hver time hører til noget. Det er forskellen på at vide og at gætte, hvor pengene gik.' },
      { icon: ZapIcon, title: 'Flydende timer-widget', body: 'Timeren bliver på skærmen mens du arbejder i resten af appen — du glemmer den ikke.' },
      { icon: TrendingUpIcon, title: 'Dagens timer på forsiden', body: 'Se med det samme om dagen er registreret færdig, eller om nogen mangler at melde ind.' },
      { icon: UsersIcon, title: 'Uge- og medarbejderoverblik', body: 'Hvem har brugt hvor meget hvor — samlet i én tabel du kan gennemgå på fem minutter.' },
      { icon: DownloadIcon, title: 'Excel-eksport', body: 'Træk perioden ud til lønsystemet eller bogholderen i det format, de allerede bruger.' },
      { icon: CheckCircleIcon, title: 'Godkend dagens linjer', body: 'Gennemgå og godkend, så der ikke sendes uafklarede timer videre til fakturering.' },
    ],
    flow: [
      { title: 'Start timeren', body: 'Manuelt eller automatisk ved check-in på opgaven.' },
      { title: 'Arbejd videre', body: 'Widgetten kører i baggrunden, mens du bruger resten af appen.' },
      { title: 'Godkend dagen', body: 'Ret det der skal rettes, og luk dagens linjer.' },
      { title: 'Eksportér', body: 'Ugen eller måneden hentes som Excel til løn og fakturering.' },
    ],
    without: ['Timesedler udfyldt fredag eftermiddag efter hukommelsen', 'Timer der aldrig bliver faktureret', 'Ingen ved om sagen er tjent hjem'],
    withIt: ['Timer registreret i samme øjeblik de bruges', 'Alt faktureringsgrundlag samlet ét sted', 'Forbrug mod budget synligt løbende'],
    faq: [
      { q: 'Er der løn i modulet?', a: 'Nej. Tidsregistrering håndterer timer og fordeling på projekter — ikke lønberegning. Excel-eksporten er lavet til at gå videre ind i jeres lønsystem.' },
      { q: 'Kan en medarbejder rette sine egne timer?', a: 'Ja, indtil dagen er godkendt. Efter godkendelse kræver rettelser en leder, og ændringen bliver logget.' },
      { q: 'Hvad hvis nogen glemmer at tjekke ud?', a: 'Linjen kan rettes manuelt. Du ser tydeligt hvilke linjer der er automatiske og hvilke der er justeret.' },
    ],
    related: ['field', 'budget', 'reporting'],
  },

  planning: {
    accent: ['#8B5CF6', '#6366F1'],
    headline: 'Se hele planen. Og hvad der vælter den.',
    subhead:
      'Planlæg projektet visuelt i Gantt eller kalender, hold aftaler med påmindelser, og lad opfølgningsfanen samle alle løse ender ét sted.',
    // NOTE (verified 2026-08-03): components/planning/GanttView.tsx is a
    // READ-ONLY timeline — zoom quarter/month/week, click-to-open, hover
    // tooltip. It has no dependencies, no draggable bars and no critical path.
    // Do not reintroduce "afhængigheder" here without building them first.
    metrics: [
      { value: '3', label: 'zoom-niveauer: kvartal, måned, uge' },
      { value: '1', label: 'fane med alt der kræver handling' },
      { value: 'Dato', label: 'påmindelser på aftaler' },
    ],
    demoTitle: 'Prøv tidsplanen',
    demoHint: 'Skift zoom og tryk på en bjælke — præcis som i den rigtige Gantt-visning.',
    features: [
      { icon: CalendarIcon, title: 'Gantt over alle sager', body: 'Hele porteføljen som bjælker med fremdrift. Zoom mellem kvartal, måned og uge, og klik en bjælke for at åbne sagen.' },
      { icon: BellIcon, title: 'Påmindelser med varsel', body: 'Aftaler, leveringer og syn får en dato og et varsel, så de ikke drukner i hverdagen.' },
      { icon: AlertTriangleIcon, title: 'Opfølgningsfane med løse ender', body: 'Åbne og udførte punkter i én liste du kan tømme — forfaldne opgaver først.' },
      { icon: MapPinIcon, title: 'Påmindelser knyttet til sag og dato', body: 'Påmindelsen kender projektet, så du ikke skal lede efter konteksten når den popper op.' },
      { icon: ClockIcon, title: 'Plan ved siden af virkeligheden', body: 'Planlagt periode og de faktisk registrerede timer ligger på samme sag.' },
      { icon: LayersIcon, title: 'Flere sager i samme billede', body: 'Se om to projekter kolliderer om samme uge, før du lover kunden en dato.' },
    ],
    flow: [
      { title: 'Sæt datoer på sagen', body: 'Start og slut giver projektet en bjælke på tidslinjen.' },
      { title: 'Zoom til det rette niveau', body: 'Kvartal for overblik, uge når det brænder på.' },
      { title: 'Sæt påmindelser', body: 'Knyt varsler til de datoer der ikke må skride.' },
      { title: 'Tøm opfølgningen', body: 'Fanen viser hvad der er forfaldent lige nu.' },
    ],
    without: ['Tidsplan i et regneark ingen åbner', 'Forsinkelser opdages når kunden ringer', 'Aftaler glemmes mellem to sager'],
    withIt: ['Planen lever samme sted som arbejdet', 'Afvigelser er synlige samme dag', 'Påmindelser fanger aftalerne'],
    faq: [
      { q: 'Kan jeg planlægge på tværs af projekter?', a: 'Ja. Gantt-visningen viser flere sager ad gangen, så du kan se om samme uge er lovet væk to steder.' },
      { q: 'Kan jeg trække i bjælkerne og sætte afhængigheder?', a: 'Nej. Gantt-visningen er et overblik, du zoomer og klikker i — datoerne ændrer du på selve sagen. Træk-og-slip og afhængigheder mellem aktiviteter er ikke en del af modulet.' },
      { q: 'Sender appen påmindelser som notifikation?', a: 'Ja. Påmindelser kan leveres som push og e-mail — hvad der er slået til, styres under Notifikationer i Indstillinger.' },
    ],
    related: ['tasks', 'time', 'projects'],
  },

  documents: {
    accent: ['#0891B2', '#155E75'],
    headline: 'Altid den nyeste revision. Aldrig igen “rev. B”.',
    subhead:
      'Upload tegninger og sagsdokumenter, hold styr på discipliner og revisioner, og styr hvem der må se hvad — alt sikkert i skyen pr. projekt.',
    metrics: [
      { value: 'Rev.', label: 'nyeste markeres automatisk' },
      { value: '5+', label: 'upload-kilder' },
      { value: 'Adgang', label: 'styret pr. niveau' },
    ],
    demoTitle: 'Prøv revisionsstyringen',
    demoHint: 'Upload en ny revision — se hvordan den forrige rykker ned i stakken og mister “Nyeste”-mærket.',
    features: [
      { icon: FolderIcon, title: 'Dokumentarkiv pr. projekt', body: 'Kategorier der matcher en byggesag: tegninger, kontrakter, myndighed, KS og fotos.' },
      { icon: HashIcon, title: 'Tegningsfelter der betyder noget', body: 'Disciplin, revision, målestok og dato — de felter der afgør, om tegningen må bygges efter.' },
      { icon: CheckCircleIcon, title: 'Nyeste revision markeres automatisk', body: 'Når rev. C lander, mister rev. B mærket. Ingen bygger efter en forældet tegning ved et uheld.' },
      { icon: LockIcon, title: 'Adgangsniveauer og password', body: 'Følsomme dokumenter kan lukkes af for alle andre end dem, der skal se dem.' },
      { icon: UploadCloudIcon, title: 'Upload fra mobil eller skyen', body: 'Kameraet, filer på telefonen, GDrive, Dropbox, OneDrive og Box — samme dialog hver gang.' },
      { icon: EyeIcon, title: 'Se på pladsen uden at hente', body: 'Tegningen åbner i appen, så du ikke skal have en PDF-læser og en printer med i bilen.' },
    ],
    flow: [
      { title: 'Upload tegningen', body: 'Fra mobilen, computeren eller jeres cloud-lager.' },
      { title: 'Udfyld felterne', body: 'Disciplin, revision og dato — det tager 15 sekunder.' },
      { title: 'Del med teamet', body: 'De rette roller får adgang; resten ser den ikke.' },
      { title: 'Ny revision', body: 'Den gamle arkiveres automatisk, den nye bliver gældende.' },
    ],
    without: ['Tegninger i mails med navne som “final_v3_ny.pdf”', 'Nogen bygger efter en gammel revision', 'Ingen ved hvem der har set hvad'],
    withIt: ['Én kilde til sandheden pr. tegning', 'Nyeste revision markeret automatisk', 'Adgang styret pr. rolle'],
    faq: [
      { q: 'Hvor meget plads får vi?', a: 'Hver organisation har en lagerkvote, som deles med fotos fra opgaver og KS. Kvoten kan udvides som tilkøb fra modul-siden.' },
      { q: 'Kan jeg dele en tegning med en underentreprenør?', a: 'Ja. Med Partnere kan en UE få adgang til de dokumenter, der hører til den opgave, de er inviteret til — og kun dem.' },
      { q: 'Kan jeg sætte mangler direkte på tegningen?', a: 'Ja, hvis KS & Aflevering er aktivt. Så kan du placere pins på den nyeste revision af plantegningen.' },
    ],
    related: ['quality', 'integrations', 'partners'],
  },

  team: {
    accent: ['#EC4899', '#DB2777'],
    headline: 'Hele firmaet på plads. På fem minutter.',
    subhead:
      'Invitér medarbejdere på e-mail, fordel roller og se hvem der er aktive. Team er bindeleddet mellem organisation, projekter og opgaver.',
    metrics: [
      { value: '3', label: 'roller: ejer, leder, medarbejder' },
      { value: 'E-mail', label: 'invitation med auto-kobling' },
      { value: 'Sæder', label: 'overblik pr. organisation' },
    ],
    demoTitle: 'Prøv invitationen',
    demoHint: 'Send invitationen og vælg en rolle — se hvordan sædeoversigten og adgangen ændrer sig.',
    features: [
      { icon: SendIcon, title: 'E-mail-invitationer med auto-kobling', body: 'Kollegaen opretter sig og lander automatisk i den rigtige organisation og de rigtige projekter.' },
      { icon: LockIcon, title: 'Roller: ejer, leder, medarbejder', body: 'Rollen afgør hvem der må købe moduler, oprette sager, godkende timer og lukke mangler.' },
      { icon: UsersIcon, title: 'Sædeoverblik pr. organisation', body: 'Se præcis hvem der optager en plads, og hvem der aldrig har logget ind.' },
      { icon: BellIcon, title: 'Invitationsbanner på forsiden', body: 'Nye kolleger bliver mødt af invitationen med det samme — ingen mail der forsvinder i spam.' },
      { icon: LinkIcon, title: 'Netværk på tværs af projekter', body: 'Folk du har arbejdet med før, kan tilknyttes en ny sag med to tryk.' },
      { icon: SettingsIcon, title: 'Adgang pr. projekt', body: 'En medarbejder behøver ikke se alle firmaets sager — kun dem hun arbejder på.' },
    ],
    flow: [
      { title: 'Send invitationen', body: 'Skriv e-mailen ind og vælg rolle.' },
      { title: 'Kollegaen opretter sig', body: 'Linket kobler brugeren på jeres organisation automatisk.' },
      { title: 'Fordel projekter', body: 'Vælg hvilke sager personen skal kunne se.' },
      { title: 'Justér løbende', body: 'Roller og adgang kan ændres når som helst.' },
    ],
    without: ['Adgang deles ved at låne en kollegas login', 'Ingen ved hvem der stadig har adgang', 'Ny mand skal sættes op manuelt overalt'],
    withIt: ['Egen bruger til hver medarbejder', 'Sæder og roller synlige i én liste', 'Onboarding tager minutter, ikke dage'],
    faq: [
      { q: 'Hvad koster en ekstra medarbejder?', a: 'Modulprisen er pr. organisation pr. måned — ikke pr. bruger. Sædeoverblikket er til jeres eget styr på hvem der er med.' },
      { q: 'Kan jeg fjerne en medarbejders adgang?', a: 'Ja, med det samme. Personens historik — timer, fotos og kommentarer — bliver stående på sagerne som dokumentation.' },
      { q: 'Er underentreprenører også “team”?', a: 'Nej. Eksterne firmaer inviteres via Partnere & Underentreprenører, hvor de kun ser de opgaver, du deler med dem.' },
    ],
    related: ['partners', 'projects', 'client-portal'],
  },

  // ── Commercial ────────────────────────────────────────────────────────────
  budget: {
    accent: ['#22C55E', '#15803D'],
    headline: 'Se sagen løbe løbsk — mens du stadig kan nå at gribe ind.',
    subhead:
      'Læg et realistist budget fra wizarden eller manuelt, følg forbruget mod baseline, og få et varsel når burn-raten peger den forkerte vej.',
    metrics: [
      { value: 'Baseline', label: 'med revisionshistorik' },
      { value: '2', label: 'forbrugskilder: indkøb og timer' },
      { value: 'Burn', label: 'mod budget pr. kategori' },
    ],
    demoTitle: 'Prøv budget-burn',
    demoHint: 'Registrér forbrug — se bjælken vokse og skifte farve, når kategorien nærmer sig baseline.',
    features: [
      { icon: TrendingUpIcon, title: 'Budget-baseline med kategorier', body: 'Læg budgettet ud på materialer, timer og underentreprise, så du kan se hvor overskridelsen kommer fra.' },
      { icon: LayersIcon, title: 'Revisioner med historik', body: 'Når omfanget ændrer sig, laver du en revision — den oprindelige baseline står stadig til sammenligning.' },
      { icon: ShoppingCartIcon, title: 'Forbrug fra indkøb og timer', body: 'Tallene kommer af sig selv fra de moduler, I allerede bruger. Ingen dobbelt bogføring.' },
      { icon: PieChartIcon, title: 'Budget-tile i projektoverblikket', body: 'Sagens økonomiske status er synlig på forsiden af projektet — ikke gemt tre klik nede.' },
      { icon: ClockIcon, title: 'Timepriser pr. opgave', body: 'Sæt en timepris pr. opgavetype, så registrerede timer omsættes til kroner automatisk.' },
      { icon: AlertTriangleIcon, title: 'Advarsel før overskridelse', body: 'Kategorier der nærmer sig baseline markeres, mens der stadig er noget at gøre ved det.' },
    ],
    flow: [
      { title: 'Læg baseline', body: 'Fra wizarden eller manuelt, fordelt på kategorier.' },
      { title: 'Registrér forbrug', body: 'Indkøb og timer bogfører sig selv på de rigtige poster.' },
      { title: 'Følg burn', body: 'Se forbrug mod baseline pr. kategori, opdateret løbende.' },
      { title: 'Revidér ved ændring', body: 'Ny aftale = ny revision, med den gamle bevaret.' },
    ],
    without: ['Økonomien gøres op når sagen er slut', 'Overskridelsen opdages af bogholderen', 'Ingen ved hvilken post der løb løbsk'],
    withIt: ['Forbrug mod budget opdateret dagligt', 'Advarsel før posten sprænges', 'Fuld historik på hver revision'],
    faq: [
      { q: 'Er det et regnskabssystem?', a: 'Nej. Budget & Økonomistyring er projektøkonomi — baseline, forbrug og burn pr. sag. Bogføring og moms hører hjemme i jeres regnskabsprogram.' },
      { q: 'Hvor kommer forbruget fra?', a: 'Fra Indkøb & Leverandører og fra Tidsregistrering, hvis de er aktive. Uden dem kan du registrere forbrug manuelt.' },
      { q: 'Kan bygherren se budgettet?', a: 'Kun hvis du vælger det. Kunde-portalen deler kun de faner, du eksplicit slår til — økonomi er som udgangspunkt lukket.' },
    ],
    related: ['purchasing', 'time', 'reporting'],
  },

  purchasing: {
    accent: ['#F97316', '#C2410C'],
    headline: 'Fra beregning til bestilling. Uden mellemregninger.',
    subhead:
      'Opret indkøb med leverandør, pris og forventet levering, vedhæft kvitteringsfotos, og se på forsiden hvad der stadig afventer.',
    metrics: [
      { value: 'Foto', label: 'af kvitteringen i skyen' },
      { value: '1 tryk', label: 'fra beregner til indkøb' },
      { value: 'Status', label: 'helt frem til leveret' },
    ],
    demoTitle: 'Prøv indkøbslisten',
    demoHint: 'Tilføj varer og markér som leveret — total og status opdaterer sig, mens du trykker.',
    features: [
      { icon: ShoppingCartIcon, title: 'Indkøbsliste pr. projekt', body: 'Hvert indkøb hører til en sag, så materialeforbruget kan holdes op mod budgettet.' },
      { icon: CameraIcon, title: 'Kvitteringsfotos i skyen', body: 'Tag billedet i byggemarkedet — bilaget er væk fra bilens kopholder og på sagen med det samme.' },
      { icon: UsersIcon, title: 'Leverandører og varenumre', body: 'Vælg leverandør fra listen og hent varen med varenummer, enhed og vejledende pris — i stedet for at taste den ind.' },
      { icon: BellIcon, title: 'Afventer indkøb-tile på forsiden', body: 'Se hvad der er bestilt men ikke leveret, før sjakket står og venter på pladsen.' },
      { icon: CalculatorIcon, title: 'Opret indkøb fra beregnere', body: 'Materialelisten fra en beregning bliver til et indkøb med ét tryk — ingen afskrift.' },
      { icon: CalendarIcon, title: 'Forventet leveringsdato', body: 'Datoen kan ligge i planen, så leveringen ikke kolliderer med den dag sjakket skal bruge varerne.' },
    ],
    flow: [
      { title: 'Opret indkøbet', body: 'Fra en beregning eller manuelt med leverandør og pris.' },
      { title: 'Vedhæft kvitteringen', body: 'Tag billedet i kassen — bilaget lander på sagen.' },
      { title: 'Følg leveringen', body: 'Forventet dato er synlig for hele teamet.' },
      { title: 'Markér som leveret', body: 'Forbruget bogføres mod budgettet automatisk.' },
    ],
    without: ['Kvitteringer i handskerummet til månedsskiftet', 'Sjakket venter på varer ingen har bestilt', 'Materialeforbrug uden kobling til sagen'],
    withIt: ['Bilaget fotograferet ved kassen', 'Leveringsstatus synlig for alle', 'Forbrug direkte ind i budgettet'],
    faq: [
      { q: 'Kan jeg bestille varer gennem appen?', a: 'Nej. Modulet registrerer og dokumenterer indkøbet — selve bestillingen laver du hos leverandøren som hidtil.' },
      { q: 'Går kvitteringerne videre til bogholderiet?', a: 'Indkøb kan eksporteres, og kvitteringsbillederne kan hentes ned. Der er ingen direkte integration til regnskabsprogrammer endnu.' },
      { q: 'Skal jeg have Budget aktivt?', a: 'Nej, Indkøb virker alene. Med Budget aktivt bogføres indkøbene automatisk mod de rigtige budgetposter.' },
    ],
    related: ['budget', 'tools', 'projects'],
  },

  quotations: {
    accent: ['#14B8A6', '#0F766E'],
    headline: 'Tilbud der ligner et firma, ikke en SMS.',
    subhead:
      'Byg tilbud med linjer og moms direkte på sagen, send som PDF med dit firmanavn og CVR, og følg status fra kladde til accepteret.',
    metrics: [
      { value: 'Moms', label: 'beregnet pr. linje' },
      { value: 'PDF', label: 'med firmaprofil og CVR' },
      { value: '3', label: 'statustrin til accept' },
    ],
    demoTitle: 'Prøv tilbudsbyggeren',
    demoHint: 'Tilføj linjer — subtotal, moms og total regnes om med det samme. Send derefter tilbuddet.',
    features: [
      { icon: ListIcon, title: 'Tilbudslinjer med enheder og moms', body: 'Antal, enhed, pris og momssats pr. linje — summen kan ikke regnes forkert.' },
      { icon: CheckCircleIcon, title: 'Statusflow: kladde → sendt → accepteret', body: 'Du kan altid se hvilke tilbud der stadig hænger i luften, og hvilke der er lukket.' },
      { icon: FileTextIcon, title: 'PDF med firmaprofil og CVR', body: 'Dokumentet henter automatisk firmanavn, CVR og logo fra jeres profil.' },
      { icon: FolderIcon, title: 'Tilbud-fane pr. projekt', body: 'Tilbuddet ligger på sagen, så du kan holde det op mod det, der faktisk blev brugt.' },
      { icon: LayersIcon, title: 'Genbrug linjer på tværs af tilbud', body: 'De poster du altid har med, kan hentes ind igen i stedet for at skrives forfra.' },
      { icon: SendIcon, title: 'Send direkte til kunden', body: 'PDF’en deles fra appen — ingen omvej over computeren derhjemme.' },
    ],
    flow: [
      { title: 'Byg tilbuddet', body: 'Tilføj linjer med antal, enhed og pris.' },
      { title: 'Tjek totalen', body: 'Subtotal, moms og total opdateres, mens du skriver.' },
      { title: 'Send som PDF', body: 'Dokumentet får firmaprofil, CVR og logo på.' },
      { title: 'Følg til accept', body: 'Markér som accepteret — sagen kan sættes i gang.' },
    ],
    without: ['Tilbud skrevet i en mail sent om aftenen', 'Momsen regnet forkert i hovedet', 'Ingen ved hvilke tilbud der stadig er åbne'],
    withIt: ['Ensartede tilbud med linjer og moms', 'PDF med firmaprofil hver gang', 'Statusoverblik over alle åbne tilbud'],
    faq: [
      { q: 'Kan kunden acceptere digitalt?', a: 'Kunden modtager PDF’en, og du markerer status i appen når accepten kommer. Digital signering af tilbud er ikke en del af modulet.' },
      { q: 'Kan et tilbud blive til opgaver?', a: 'Tilbuddet ligger på projektet, så linjerne kan bruges som udgangspunkt for opgaver og budgetposter på samme sag.' },
      { q: 'Hvor sættes firmanavn og CVR?', a: 'Under Indstillinger → Firmaprofil. Derfra hentes de automatisk ind i alle tilbud og rapporter.' },
    ],
    related: ['budget', 'projects', 'reporting'],
  },

  partners: {
    accent: ['#A855F7', '#7E22CE'],
    headline: 'Underentreprenører med i systemet — ikke i en SMS-tråd.',
    subhead:
      'Invitér UE’er til konkrete opgaver, forhandl prisen i en indbygget tråd og delegér arbejdet. Partneren ser kun det, du deler.',
    metrics: [
      { value: 'Pr. opgave', label: 'invitation, ikke hele sagen' },
      { value: 'Tråd', label: 'til bud og modbud' },
      { value: 'Afgrænset', label: 'partner-projektvisning' },
    ],
    demoTitle: 'Prøv forhandlingen',
    demoHint: 'Send et modbud — se tråden opdatere sig og opgaven skifte til accepteret.',
    features: [
      { icon: SendIcon, title: 'Partner-invitationer pr. opgave', body: 'Du inviterer til én opgave ad gangen. UE’en får ikke adgang til resten af sagen.' },
      { icon: MessageSquareIcon, title: 'Forhandlingstråd med bud og accept', body: 'Pris, modbud og accept står dokumenteret i samme tråd — ikke i tre forskellige SMS-samtaler.' },
      { icon: ClipboardListIcon, title: 'Partneropgaver på partnerens forside', body: 'UE’en logger ind og ser præcis de opgaver, der er hans — med al dokumentation.' },
      { icon: EyeIcon, title: 'Afgrænset projektvisning', body: 'Partneren ser opgaven, tegningerne og chatten. Økonomi og andre sjaks arbejde er lukket.' },
      { icon: ZapIcon, title: 'Delegér hurtigopgaver', body: 'Småting kan sendes videre til netværket uden at oprette en hel entreprise.' },
      { icon: CheckCircleIcon, title: 'Følg arbejdet til aflevering', body: 'Partnerens fremdrift, fotos og KS lander på din sag som alt andet arbejde.' },
    ],
    flow: [
      { title: 'Invitér partneren', body: 'Vælg opgaven og send invitationen på e-mail.' },
      { title: 'Forhandl prisen', body: 'Bud og modbud udveksles i tråden på opgaven.' },
      { title: 'Accepter og delegér', body: 'Ved accept overtager partneren opgaven.' },
      { title: 'Følg til aflevering', body: 'Fremdrift og dokumentation lander på din sag.' },
    ],
    without: ['Aftaler indgået mundtligt på pladsen', 'Ingen dokumentation for den aftalte pris', 'UE’en har enten for meget eller for lidt adgang'],
    withIt: ['Aftalen står skriftligt i tråden', 'Prisforløbet er dokumenteret', 'Præcis den adgang opgaven kræver'],
    faq: [
      { q: 'Skal partneren betale for BygSmart?', a: 'Nej. Partneren opretter en gratis bruger og får adgang til de opgaver, du inviterer til. Modulet betales af den organisation, der inviterer.' },
      { q: 'Kan partneren se mit budget?', a: 'Nej. Partner-visningen er afgrænset til opgaven — økonomi, andre sager og andre partneres arbejde er ikke synligt.' },
      { q: 'Hvad hvis vi ikke bliver enige om prisen?', a: 'Så lukker du bare forhandlingen. Tråden bliver stående som dokumentation for, hvad der blev budt.' },
    ],
    related: ['team', 'tasks', 'documents'],
  },

  reporting: {
    accent: ['#6366F1', '#4338CA'],
    headline: 'Rapporten der plejer at tage en aften. Nu tager den et tryk.',
    subhead:
      'Projektrapporter, afleveringsdokumenter og analyser som færdige PDF’er — plus Excel-eksport af projekter, opgaver og timer til bogholderiet.',
    metrics: [
      { value: 'PDF', label: 'og Excel side om side' },
      { value: '3', label: 'Excel-eksporter: projekt, opgave, timer' },
      { value: 'Logo', label: 'og CVR fra jeres firmaprofil' },
    ],
    demoTitle: 'Prøv rapportbyggeren',
    demoHint: 'Vælg hvilke afsnit der skal med — se dokumentet bygge sig selv i forhåndsvisningen.',
    features: [
      { icon: FileTextIcon, title: 'Projektrapport-skabeloner', body: 'Færdige opsætninger til status, aflevering og dokumentation — du vælger bare afsnittene.' },
      { icon: DownloadIcon, title: 'Excel-eksport af projekt, opgave og timer', body: 'Tre eksportører sender data ud i det format bogholderen allerede arbejder i, uden manuel afskrift.' },
      { icon: SparklesIcon, title: 'AI-afleveringsrapport med logo', body: 'Lad AI’en samle sagens forløb til en læsevenlig rapport med jeres firmalogo på.' },
      { icon: SettingsIcon, title: 'Rapportindstillinger pr. opgave', body: 'Styr hvad der kommer med i dokumentet — afsnit, fotos og detaljeniveau.' },
      { icon: PieChartIcon, title: 'Rapportpanel pr. opgave', body: 'Generér dokumentation for en enkelt opgave uden at trække hele sagen med.' },
      { icon: ImageIcon, title: 'Fotos med i dokumentet', body: 'Billeddokumentationen fra pladsen kommer med i rapporten, ikke som en separat mail.' },
    ],
    flow: [
      { title: 'Vælg rapporttype', body: 'Status, aflevering eller en ren dataeksport.' },
      { title: 'Vælg afsnit', body: 'Slå til og fra hvad kunden skal se.' },
      { title: 'Generér', body: 'Dokumentet bygges med logo, fotos og tal.' },
      { title: 'Del', body: 'Send PDF’en, eller hent Excel-filen til bogholderiet.' },
    ],
    without: ['Rapporter klippet sammen i Word om aftenen', 'Tal skrevet af manuelt fra tre systemer', 'Dokumentationen ser forskellig ud hver gang'],
    withIt: ['Færdig rapport på under et minut', 'Tallene kommer direkte fra sagen', 'Samme professionelle udtryk hver gang'],
    faq: [
      { q: 'Kan jeg få mit eget logo på?', a: 'Ja. Logo, firmanavn og CVR hentes fra firmaprofilen under Indstillinger og lægges automatisk på PDF’erne.' },
      { q: 'Kræver AI-rapporten AI-modulet?', a: 'Ja. Den almindelige rapportgenerering virker uden, men den AI-skrevne afleveringsrapport kræver at AI-assistent er aktivt.' },
      { q: 'Gemmer appen en historik over sendte rapporter?', a: 'Nej. Rapporter genereres og hentes ned hos dig — der er ingen brugervendt rapportlog i modulet. Gem PDF’en på projektet, hvis den skal kunne findes frem senere.' },
    ],
    related: ['quality', 'time', 'ai'],
  },

  // NOTE (verified 2026-08-03 against the code): this module is currently an
  // entitlement + the CLIENT role — modules/client-portal/manifest.ts states
  // "no shell contributions yet". core/shell/projectTabAccess.ts resolves
  // CLIENT to a fixed branch giving exactly Overblik + Dokumenter; there is no
  // per-project tab picker. Keep the copy inside that boundary.
  'client-portal': {
    accent: ['#0EA5E9', '#0369A1'],
    headline: 'Giv bygherren et login i stedet for et statusopkald.',
    subhead:
      'Invitér kunden som CLIENT, og hun får ren læseadgang til projektets Overblik og Dokumenter — i browseren, uden app og uden at kunne røre jeres data.',
    metrics: [
      { value: '2', label: 'faner: Overblik og Dokumenter' },
      { value: 'Read-only', label: 'kunden kan intet ændre' },
      { value: '0', label: 'installation for kunden' },
    ],
    demoTitle: 'Se bygherrens adgang',
    demoHint: 'Skift mellem din visning og kundens — se præcis hvad CLIENT-rollen giver adgang til, og hvad den ikke gør.',
    features: [
      { icon: EyeIcon, title: 'Read-only pr. projekt', body: 'Kunden kan se, men ikke røre. Ingen risiko for at der bliver rettet i jeres data.' },
      { icon: LockIcon, title: 'Kun de sager du inviterer til', body: 'Adgangen gælder ét projekt ad gangen. Andre sager og andre kunder er usynlige.' },
      { icon: ImageIcon, title: 'Overblik med fremdrift', body: 'Status, fremdrift og projektets billeddokumentation — den statusopdatering kunden ellers ville ringe efter.' },
      { icon: FileTextIcon, title: 'Dokumenter og rapporter', body: 'Tegninger og færdige rapporter på sagen er tilgængelige, uden at du sender mails.' },
      { icon: SettingsIcon, title: 'Økonomi er lukket', body: 'Projektets økonomital vises ikke for CLIENT-rollen — det kræver ingen opsætning fra din side.' },
      { icon: CloudIcon, title: 'Ingen app-installation', body: 'Kunden logger ind i browseren — ingen App Store, ingen support-opkald om installation.' },
    ],
    flow: [
      { title: 'Invitér kunden', body: 'Send invitationen til projektet med rollen CLIENT.' },
      { title: 'Kunden opretter sig', body: 'Linket kobler brugeren på netop den sag.' },
      { title: 'Kunden logger ind', body: 'I browseren — ingen installation nødvendig.' },
      { title: 'Ro på telefonen', body: 'Kunden følger selv med i stedet for at ringe.' },
    ],
    without: ['Kunden ringer for status hver anden dag', 'Statusmails skrevet manuelt hver uge', 'Fotos sendt løst i beskeder'],
    withIt: ['Kunden ser fremdriften selv', 'Ingen manuelle statusopdateringer', 'Dokumenterne ligger, hvor kunden kan finde dem'],
    faq: [
      { q: 'Kan kunden ændre noget?', a: 'Nej. CLIENT-rollen er ren læseadgang til projektets Overblik og Dokumenter.' },
      { q: 'Kan jeg selv vælge hvilke faner kunden ser?', a: 'Ikke i dag. CLIENT-rollen giver et fast sæt — Overblik og Dokumenter — og økonomi er altid skjult. Mere finkornet styring er ikke en del af modulet endnu.' },
      { q: 'Koster det ekstra pr. kunde?', a: 'Nej. Prisen er pr. organisation pr. måned, uanset hvor mange bygherrer I giver adgang.' },
    ],
    related: ['reporting', 'documents', 'projects'],
  },

  // ── Add-ons ───────────────────────────────────────────────────────────────
  ai: {
    accent: ['#7C3AED', '#9333EA'],
    headline: 'En byggeleder der har læst hele sagen. Hver morgen.',
    subhead:
      'AI’en kender dine projekter: dagens briefing på forsiden, en chat der svarer i kontekst, og et intelligence-indeks der spotter risiko før mennesker gør.',
    metrics: [
      { value: 'Daglig', label: 'briefing med vejr og fokus' },
      { value: 'Kontekst', label: 'fra dine egne projekter' },
      { value: 'Indeks', label: 'risikoscore pr. projekt' },
    ],
    demoTitle: 'Prøv assistenten',
    demoHint: 'Tryk på et spørgsmål — svaret skrives frem, som det ville gøre i den rigtige chat.',
    features: [
      { icon: SparklesIcon, title: 'Dagens briefing med vejr og fokus', body: 'En kort morgenopsummering: hvad haster, hvem mangler, og om vejret vælter dagens plan.' },
      { icon: MessageSquareIcon, title: 'Chatbot med projektkontekst', body: 'Spørg til status, reglement eller næste skridt — svaret bygger på dine egne sager, ikke generel viden.' },
      { icon: BrainIcon, title: 'Avanceret briefing med dybdeanalyse', body: 'En længere gennemgang når du skal forberede et byggemøde eller en svær samtale med kunden.' },
      { icon: TrendingUpIcon, title: 'Intelligence-indeks pr. projekt', body: 'Fremdrift, økonomi og aktivitet vejet sammen til ét tal, så skæve sager stikker ud.' },
      { icon: ChecklistIcon, title: 'AI-tjeklister og opgaveoptimering', body: 'Forslag til tjeklistepunkter og rækkefølge, baseret på opgavetypen.' },
      { icon: SearchIcon, title: 'AI-forslag til reglement', body: 'De paragraffer der typisk gælder for arbejdet, foreslået direkte på opgaven.' },
    ],
    flow: [
      { title: 'Læs briefingen', body: 'Dagens fokus står på forsiden, når du åbner appen.' },
      { title: 'Spørg undervejs', body: 'Chatten kender projektet, du står i.' },
      { title: 'Se risikoscoren', body: 'Intelligence-indekset markerer sager der skrider.' },
      { title: 'Reagér i tide', body: 'Handl på signalet, mens det stadig er billigt.' },
    ],
    without: ['Overblikket findes kun i chefens hoved', 'Problemer opdages når de er dyre', 'Ingen når at læse hele sagen igennem'],
    withIt: ['Dagens vigtigste ting serveret hver morgen', 'Risiko markeret før den koster', 'Svar på sagen på få sekunder'],
    faq: [
      { q: 'Hvad ser AI’en?', a: 'Kun jeres egne data i jeres egen organisation — projekter, opgaver, timer og noter. Der deles ikke data på tværs af kunder.' },
      { q: 'Kan jeg stole på svarene?', a: 'Behandl AI’en som en velinformeret kollega, ikke som en facitliste. Ved reglement og myndighedskrav skal du altid verificere i kilden — den linker til den.' },
      { q: 'Hvorfor koster AI mere end de andre moduler?', a: 'Fordi hvert svar koster forbrug hos AI-udbyderen. Prisen dækker den løbende brug oven i selve funktionen.' },
    ],
    related: ['knowledge', 'reporting', 'projects'],
  },

  ar: {
    accent: ['#F43F5E', '#BE123C'],
    headline: 'Målebåndet bliver i bilen.',
    subhead:
      'Scan rummet med telefonens kamera og få mål og flader direkte ind i beregnerne. AR-opmåling der sparer turen tilbage efter det glemte mål.',
    metrics: [
      { value: '3D', label: 'rumscanning med RoomMapper' },
      { value: 'Mål', label: 'direkte videre til beregneren' },
      { value: 'Gem', label: 'scanninger på projektet' },
    ],
    demoTitle: 'Prøv AR-opmålingen',
    demoHint: 'Tryk i viewporten for at sætte målepunkter — arealet regnes ud, efterhånden som rummet lukker sig.',
    features: [
      { icon: CameraIcon, title: 'RoomMapper 3D-scanning', body: 'Gå rundt i rummet med telefonen, og få en 3D-model med vægge, gulv og loft.' },
      { icon: SlidersIcon, title: 'AR-måling af længder og flader', body: 'Sæt punkter i kameraet og aflæs længde, areal og rumfang direkte på skærmen.' },
      { icon: CalculatorIcon, title: 'Send mål til beregnerne', body: 'Arealet fra scanningen hopper direkte ind i maling-, gulv- eller isoleringsberegneren.' },
      { icon: FolderIcon, title: 'Gem scanninger på projektet', body: 'Målingen bliver liggende på sagen som dokumentation for, hvad der blev målt hvornår.' },
      { icon: ImageIcon, title: 'Opmåling på foto', body: 'Kan telefonen ikke AR? Så tegn målene ind på et almindeligt billede i stedet.' },
      { icon: ZapIcon, title: 'Færdig på minutter', body: 'Et rum er målt op og regnet igennem, før du havde nået at rulle båndet ud.' },
    ],
    flow: [
      { title: 'Åbn viewporten', body: 'Ret kameraet mod rummet og lad appen finde fladerne.' },
      { title: 'Sæt punkter', body: 'Tryk i hjørnerne — målene tegnes op live.' },
      { title: 'Justér', body: 'Ret et punkt hvis kanten ikke blev fanget præcist.' },
      { title: 'Send til beregneren', body: 'Areal og længder følger med over i materialeberegningen.' },
    ],
    without: ['Ekstra tur tilbage efter et glemt mål', 'Mål noteret på et stykke gips', 'Bestillinger baseret på skøn'],
    withIt: ['Hele rummet målt på én gang', 'Målene gemt på sagen med dato', 'Materialeberegning på stedet'],
    faq: [
      { q: 'Virker det på min telefon?', a: 'AR-måling kræver en nyere mobil med de rette sensorer. Kan din enhed ikke, falder modulet tilbage til opmåling på foto, som virker overalt.' },
      { q: 'Hvor præcise er målene?', a: 'Præcist nok til materialeberegning og overslag. Til afsætning og udførelse skal du stadig måle efter med båndet.' },
      { q: 'Kan jeg dele en scanning?', a: 'Ja. Scanningen gemmes på projektet, så alle med adgang til sagen kan se målene og bruge dem videre.' },
    ],
    related: ['tools', 'documents', 'projects'],
  },

  integrations: {
    accent: ['#38BDF8', '#0284C7'],
    headline: 'Jeres filer. Uanset hvor de ligger.',
    subhead:
      'Hent filer direkte fra Google Drive, Dropbox, OneDrive og Box når du vedhæfter dokumenter og fotos. Én gang forbundet, altid ved hånden.',
    metrics: [
      { value: '4', label: 'cloud-tjenester understøttet' },
      { value: 'OAuth', label: 'sikker forbindelse pr. bruger' },
      { value: 'Alle', label: 'upload-flows i appen' },
    ],
    demoTitle: 'Prøv forbindelsen',
    demoHint: 'Vælg en tjeneste — se forbindelsen blive oprettet og filvælgeren åbne.',
    features: [
      { icon: CloudIcon, title: 'Google Drive, Dropbox, OneDrive og Box', body: 'De fire lagre de fleste byggefirmaer allerede bruger — koblet på med et enkelt login.' },
      { icon: UploadCloudIcon, title: 'Cloud-filvælger i alle upload-flows', body: 'Samme vælger uanset om du vedhæfter til en opgave, et dokument eller en rapport.' },
      { icon: LockIcon, title: 'Sikker OAuth-forbindelse pr. bruger', body: 'BygSmart får aldrig din adgangskode, og du kan trække adgangen tilbage når som helst.' },
      { icon: SettingsIcon, title: 'Styres under Indstillinger', body: 'Forbindelser oprettes og fjernes ét sted — Indstillinger → Integrationer.' },
      { icon: FolderIcon, title: 'Ingen dobbelte filer', body: 'Du henter filen ind hvor du skal bruge den, i stedet for at kopiere hele arkivet ind i appen.' },
      { icon: LinkIcon, title: 'Flere integrationer på vej', body: 'Lageret er første trin — ruter og regnskab er de næste på listen.' },
    ],
    flow: [
      { title: 'Vælg tjeneste', body: 'Google Drive, Dropbox, OneDrive eller Box.' },
      { title: 'Godkend adgangen', body: 'Log ind hos udbyderen — BygSmart ser aldrig kodeordet.' },
      { title: 'Vælg filer', body: 'Cloud-vælgeren dukker op i alle upload-dialoger.' },
      { title: 'Vedhæft', body: 'Filen lander på opgaven eller projektet med det samme.' },
    ],
    without: ['Filer hentes ned og uploades igen manuelt', 'Fire kopier af samme tegning', 'Upload fra mobilen er et projekt i sig selv'],
    withIt: ['Direkte adgang til jeres eget arkiv', 'Én kilde til hver fil', 'To tryk fra sky til sag'],
    faq: [
      { q: 'Kopieres vores filer over i BygSmart?', a: 'Kun de filer du eksplicit vedhæfter. Resten bliver liggende hos jeres udbyder — appen læser ikke arkivet igennem.' },
      { q: 'Er forbindelsen pr. bruger eller pr. firma?', a: 'Pr. bruger. Hver medarbejder forbinder sin egen konto, så adgangen følger de rettigheder personen allerede har.' },
      { q: 'Kan jeg fjerne adgangen igen?', a: 'Ja, når som helst — under Indstillinger → Integrationer, eller direkte hos udbyderen.' },
    ],
    related: ['documents', 'projects', 'reporting'],
  },
};
