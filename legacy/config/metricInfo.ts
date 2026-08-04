// ─────────────────────────────────────────────────────────────────────────────
// Metric copy catalog (Shared Foundations)
//
// A single source of truth for the Danish explanation strings shown by every
// InfoHint across Goals A (Projekt-sundhed), B (AI Tidsplan) and C
// (Overdragelse PDF). Keying the copy by a stable metric id means all three
// goals reference the same text and it can be reviewed/translated in one place
// (mirrors the content model of components/ui/StandardTooltip.tsx:
// "Hvad viser den?" / "Hvordan måles det?").
// ─────────────────────────────────────────────────────────────────────────────

export interface MetricInfo {
  /** Short human-readable metric name (Danish) — shown in the popover header. */
  title: string;
  /** "Hvad viser den?" — what the metric shows. */
  description: string;
  /** Optional "Hvordan måles det?" — how it is computed. */
  calculation?: string;
}

export const METRIC_INFO = {
  // ── Goal A: Projekt-sundhed dimensions ─────────────────────────────────────
  'health.overall': {
    title: 'Projektsundhed',
    description:
      'Et samlet mål (0–100) for projektets tilstand på tværs af alle dimensioner, oversat til en karakter fra A til F.',
    calculation: 'Vægtet gennemsnit af de seks sundhedsdimensioner.',
  },
  'health.planning': {
    title: 'Planlægning',
    description:
      'Hvor godt projektet er planlagt: antal opgaver, brugbare beskrivelser, deadlines og rækkefølge/afhængigheder.',
    calculation: 'Andel opgaver med beskrivelse, deadline og defineret rækkefølge.',
  },
  'health.schedule': {
    title: 'Tidsplan & fremdrift',
    description:
      'Om projektet følger tidsplanen: fremdriften sammenholdt med den forløbne tid og antallet af forfaldne opgaver.',
    calculation: 'Færdiggjort arbejde ÷ forløben tid, justeret for forfaldne opgaver.',
  },
  'health.budget': {
    title: 'Budget & økonomi',
    description:
      'Forbruget sammenholdt med budgetrammen, og hvor komplette prisdataene på indkøb er.',
    calculation: 'Faktisk forbrug ÷ budgetramme (baseline + revisioner).',
  },
  'health.quality': {
    title: 'Kvalitet & KS',
    description:
      'Kvalitetssikring og dokumentation: KS-godkendelser, afvigelser og mangler samt foto/dokumentation på opgaverne.',
    calculation:
      'KS-godkendelsesrate og andel opgaver med dokumentation, minus åbne afvigelser og mangler.',
  },
  'health.handover': {
    title: 'Aflevering & godkendelse',
    description:
      'Hvor stor en del af opgaverne der er færdigmeldt og formelt godkendt af mester.',
    calculation: 'Andel opgaver med accepteret aflevering (underskrevet af begge parter).',
  },
  'health.staffing': {
    title: 'Bemanding',
    description:
      'Om opgaverne har en ansvarlig, hvor jævnt arbejdsbyrden er fordelt, og hvor stort teamet er.',
    calculation: 'Andel opgaver med ansvarlig og fordelingen af åbne opgaver på teamet.',
  },

  // ── Goal B: AI Tidsplan-KPI'er ─────────────────────────────────────────────
  'schedule.onTimeProbability': {
    title: 'On-time sandsynlighed',
    description:
      'Sandsynligheden for at projektet afsluttes inden deadline, baseret på fremdrift vs. forløben tid og den aktuelle timeforbrugsrate.',
    calculation:
      'SPI = færdiggjort arbejde ÷ forløben tid · justeret for forfaldne opgaver og leverancerisiko.',
  },
  'schedule.forecastCompletion': {
    title: 'Forventet afslutning',
    description:
      'Den forventede afslutningsdato ud fra den nuværende fremdriftshastighed, og hvor mange dage det er før eller efter deadline.',
    calculation:
      'Forventet dato = i dag + (resterende arbejde ÷ aktuel fremdrift pr. dag); dage før/efter = forventet dato − deadline.',
  },
  'schedule.dailyBurn': {
    title: 'Nødvendig vs. aktuel dagsrate',
    description:
      'Den arbejdsmængde der skal fuldføres pr. dag for at nå deadline, sammenholdt med det aktuelle tempo.',
    calculation:
      'Nødvendig dagsrate = resterende arbejde ÷ resterende arbejdsdage; aktuel dagsrate = fuldført arbejde ÷ forløbne arbejdsdage.',
  },
  'schedule.atRiskTasks': {
    title: 'Opgaver i risiko',
    description:
      'Opgaver der er forfaldne eller i fare for at overskride deres deadline givet den nuværende fremdrift.',
    calculation:
      'Opgaver med status Forfalden, eller med deadline før i dag/prognosen og ikke afsluttet.',
  },
  'schedule.deliveryRisks': {
    title: 'Leverancerisici',
    description:
      'Indkøb og leverancer med forfalden eller nært forestående leveringsdato, som kan forsinke afhængige opgaver.',
    calculation:
      'Indkøb hvor forventet leveringsdato er passeret eller nært forestående og status ikke er Modtaget.',
  },

  // ── Goal C: Overdragelses-PDF diagram-legender ─────────────────────────────
  'handover.taskStatusChart': {
    title: 'Opgavestatus',
    description: 'Fordelingen af projektets opgaver på udførte, igangværende og forfaldne.',
    calculation: 'Antal opgaver pr. status ÷ samlet antal opgaver.',
  },
  'handover.qualityChart': {
    title: 'KS-resultater',
    description:
      'Fordelingen af kvalitetskontroller på godkendte og ikke-godkendte samt registrerede afvigelser.',
    calculation: 'Antal kontroller pr. resultat (godkendt / ikke godkendt).',
  },
  'handover.budgetChart': {
    title: 'Budget vs. forbrug',
    description:
      'Den planlagte budgetramme sammenholdt med det faktiske forbrug ved afleveringen.',
    calculation:
      'Faktisk forbrug (indkøb + arbejdsløn + underentreprenører) ÷ budgetramme.',
  },
} satisfies Record<string, MetricInfo>;

/** Union of all known metric ids in the catalog. */
export type MetricInfoId = keyof typeof METRIC_INFO;

/**
 * Typed accessor: look up the Danish copy for a metric id. Accepts an unknown
 * string so dynamically-built ids don't need casting; returns `undefined` when
 * the id is not in the catalog.
 */
export const getMetricInfo = (id: MetricInfoId | (string & {})): MetricInfo | undefined =>
  (METRIC_INFO as Record<string, MetricInfo>)[id];

/** All metric ids currently in the catalog. */
export const metricInfoIds = (): MetricInfoId[] => Object.keys(METRIC_INFO) as MetricInfoId[];
