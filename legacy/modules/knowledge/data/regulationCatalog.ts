import type { Regulation, RegulationCategory } from '../../../types';
import { PUBLIC_REGULATION_FULL_TEXT } from './publicRegulationFullText.generated';

type CatalogEntry = Omit<Regulation, 'effective_from' | 'version'> & {
  effective_from?: string;
  version?: string;
};

const DEFAULT_EFFECTIVE_FROM = '2026-01-01';
const DEFAULT_VERSION = 'Katalog 2026';

const makeEntry = (entry: CatalogEntry): Regulation => ({
  effective_from: DEFAULT_EFFECTIVE_FROM,
  version: DEFAULT_VERSION,
  ...entry,
});

const br18Chapter = (
  chapterNo: number,
  title: string,
  sectionRef: string,
  tags: string[],
  snippet: string
): Regulation =>
  makeEntry({
    id: `br18-kap${chapterNo}`,
    title: `BR18 kapitel ${chapterNo}: ${title}`,
    chapter: `Kapitel ${chapterNo}`,
    section_ref: sectionRef,
    snippet,
    body_html: `<p>${snippet}</p><p>Dette er en produktionssikker oversigtspost med kapitel, paragrafinterval, praktiske stikord og link til den officielle BR18-kilde. Brug den officielle kilde til den juridisk bindende ordlyd.</p>`,
    tags,
    source_url: 'https://www.bygningsreglementet.dk/',
    category: 'BR18',
    version: 'BR18 aktuelt',
  });

const sourceEntry = (
  category: RegulationCategory,
  id: string,
  title: string,
  chapter: string,
  sectionRef: string,
  snippet: string,
  tags: string[],
  sourceUrl: string
): Regulation =>
  makeEntry({
    id,
    title,
    chapter,
    section_ref: sectionRef,
    snippet,
    body_html: `<p>${snippet}</p><p>Posten er et opslagskort med praktisk resume og kildehenvisning. Kontroller altid den officielle kilde, abonnementsmateriale eller kontraktgrundlag før projektering, tilbud eller aflevering.</p>`,
    tags,
    source_url: sourceUrl,
    category,
  });

const CATALOG_WITH_SUMMARIES: Regulation[] = [
  br18Chapter(1, 'Administrative bestemmelser', '§ 1 - § 47', ['Generelt', 'Byggetilladelse', 'Dokumentation'], 'Regler om ansøgning, byggesagsbehandling, erklæringer, dokumentation og kommunens behandling af byggesager.'),
  br18Chapter(2, 'Adgangsforhold', '§ 48 - § 62', ['Adgangsforhold', 'Tilgængelighed'], 'Krav til adgangsveje, niveaufri adgang, døre, ramper, trapper og brugbarhed for personer med funktionsnedsættelse.'),
  br18Chapter(3, 'Affaldssystemer', '§ 63 - § 68', ['Affald', 'Drift'], 'Krav til affaldsrum, adgang, hygiejne, håndtering og placering af affaldssystemer i og ved bygninger.'),
  br18Chapter(4, 'Afløb', '§ 69 - § 81', ['Afløb', 'Installationer', 'Fugt'], 'Krav til afløbsinstallationer, afvanding, sikring mod lugt, opstuvning, rotter og uhygiejniske forhold.'),
  br18Chapter(5, 'Brand', '§ 82 - § 158', ['Brand', 'Flugtveje', 'Dokumentation'], 'Krav til brandsikkerhed, flugtveje, brandmodstand, brandtekniske installationer, redningsberedskab og dokumentation.'),
  br18Chapter(6, 'Brugerbetjente anlæg', '§ 159 - § 160', ['Tilgængelighed', 'Installationer'], 'Krav til brugerbetjente anlæg, placering, betjeningshøjde og anvendelighed.'),
  br18Chapter(7, 'Byggepladsen og udførelsen af byggearbejder', '§ 161 - § 165', ['Byggeplads', 'Udførelse', 'Arbejdsmiljø'], 'Krav til forsvarlig udførelse, byggepladsindretning, nabohensyn og sikkerhed under byggearbejdet.'),
  br18Chapter(8, 'Byggeret og helhedsvurdering', '§ 166 - § 195', ['Byggeret', 'Bebyggelse', 'Helhedsvurdering'], 'Regler om bebyggelsesprocent, højde, afstande, etageantal og kommunal helhedsvurdering.'),
  br18Chapter(9, 'Bygningens indretning', '§ 196 - § 241', ['Indretning', 'Bolig', 'Tilgængelighed'], 'Krav til boligers og bygningers rum, funktion, størrelse, lofthøjde, adgang, bad, køkken og fællesarealer.'),
  br18Chapter(10, 'Elevatorer', '§ 242 - § 249', ['Elevatorer', 'Tilgængelighed'], 'Krav til elevatorer, adgang, sikkerhed, dimensionering og drift i relevante bygninger.'),
  br18Chapter(11, 'Energiforbrug og klimapåvirkning', '§ 250 - § 298', ['Energi', 'Klima', 'LCA'], 'Krav til energiramme, varmetab, ombygning, tekniske installationer og bygningers klimapåvirkning.'),
  br18Chapter(12, 'Energiforsyningsanlæg i tilknytning til bygninger', '§ 299 - § 328', ['Energi', 'Installationer'], 'Krav til energiforsyningsanlæg, solceller, kedler, varmepumper og andre anlæg knyttet til bygninger.'),
  br18Chapter(13, 'Forureninger', '§ 329 - § 333', ['Forurening', 'Radon', 'Indeklima'], 'Krav til sikring mod radon, jordforurening, emissioner og skadelige påvirkninger fra byggevarer og undergrund.'),
  br18Chapter(14, 'Fugt og vådrum', '§ 334 - § 339', ['Fugt', 'Vådrum', 'Klimaskærm'], 'Krav til fugtsikring, vådrum, klimaskærm, vandbelastede zoner og forebyggelse af skimmel og byggeskader.'),
  br18Chapter(15, 'Konstruktioner', '§ 340 - § 357', ['Konstruktion', 'Bærende konstruktioner', 'Statik'], 'Krav til mekanisk modstandsevne, stabilitet, robusthed, dimensionering og udførelse af bærende konstruktioner.'),
  br18Chapter(16, 'Legepladser mv.', '§ 358 - § 367', ['Legepladser', 'Sikkerhed'], 'Krav til sikkerhed, indretning, drift og vedligehold af legepladser og lignende anlæg.'),
  br18Chapter(17, 'Lydforhold', '§ 368 - § 376', ['Lydforhold', 'Akustik'], 'Krav til luftlyd, trinlyd, støj fra installationer, efterklang og lydforhold i bygninger.'),
  br18Chapter(18, 'Lys og udsyn', '§ 377 - § 384', ['Lys', 'Dagslys', 'Udsyn'], 'Krav til dagslys, kunstig belysning, udsyn og visuelle forhold i opholdsrum og arbejdsrum.'),
  br18Chapter(19, 'Termisk indeklima og installationer til varme- og køleanlæg', '§ 385 - § 392', ['Indeklima', 'Varme', 'Køling'], 'Krav til termisk komfort, temperaturforhold og varme- og køleanlæg.'),
  br18Chapter(20, 'Ubebyggede arealer ved bebyggelse', '§ 393 - § 402', ['Udearealer', 'Tilgængelighed', 'Afvanding'], 'Krav til opholdsarealer, adgangsarealer, parkering, terræn, afvanding og ubebyggede arealer.'),
  br18Chapter(21, 'Vand', '§ 403 - § 419', ['Vand', 'VVS', 'Installationer'], 'Krav til vandinstallationer, hygiejne, materialer, tilbagestrømning, varmt vand og lækagesikring.'),
  br18Chapter(22, 'Ventilation', '§ 420 - § 452', ['Ventilation', 'Indeklima'], 'Krav til ventilation, luftskifte, luftkvalitet, udsugning, indblæsning og drift af ventilationsanlæg.'),
  br18Chapter(23, 'Beregningsregler', '§ 453 - § 458', ['Beregningsregler', 'Areal'], 'Regler for opgørelse af arealer, højder, etager og beregningsgrundlag i byggesager.'),
  br18Chapter(24, 'Kontrolsystem for vand- og afløbsinstallationer', '§ 459 - § 472', ['Vand', 'Afløb', 'Kontrol'], 'Krav til kontrolsystemer, dokumentation og kvalitetssikring for vand- og afløbsinstallationer.'),
  br18Chapter(25, 'Lavenergiklasse', '§ 473 - § 484', ['Energi', 'Lavenergi'], 'Frivillige og supplerende krav til lavenergiklasse, energibehov og dokumentation.'),
  br18Chapter(26, 'Konstruktionsklasser', '§ 485 - § 489', ['Konstruktion', 'Statik', 'Dokumentation'], 'Regler om konstruktionsklasser og krav til statisk dokumentation og kontrolniveau.'),
  br18Chapter(27, 'Brandklasser', '§ 490 - § 493', ['Brand', 'Dokumentation'], 'Regler om brandklasser og fastlæggelse af krav til brandteknisk dokumentation og kontrol.'),
  br18Chapter(28, 'Dokumentation af bærende konstruktioner', '§ 494 - § 505', ['Konstruktion', 'Dokumentation'], 'Krav til projekteringsgrundlag, statiske beregninger, kontrol og dokumentation af bærende konstruktioner.'),
  br18Chapter(29, 'Dokumentation af brandforhold', '§ 506 - § 522', ['Brand', 'Dokumentation'], 'Krav til brandstrategi, brandteknisk dokumentation, driftsforhold og kontrolplan.'),
  br18Chapter(30, 'Kontrol af dokumentation og udførelse', '§ 523 - § 528', ['Kontrol', 'Brand', 'Konstruktion'], 'Krav til kontrol af dokumentation og udførelse for bærende konstruktioner og brandforhold.'),
  br18Chapter(31, 'Bygværksprojekterende for de bærende konstruktioner', '§ 529 - § 530', ['Statik', 'Roller'], 'Regler om den bygværksprojekterendes ansvar, koordinering og dokumentation for bærende konstruktioner.'),
  br18Chapter(32, 'Certificerede statikers og brandrådgivers virke', '§ 531 - § 535', ['Certificering', 'Statik', 'Brand'], 'Fælles regler om certificerede rådgiveres virke, erklæringer, kontrol og uafhængighed.'),
  br18Chapter(33, 'Certificeret statikers virke', '§ 536 - § 544', ['Certificering', 'Statik'], 'Regler om certificeret statikers opgaver, dokumentation, kontrol og erklæringer.'),
  br18Chapter(34, 'Certificeret brandrådgivers virke', '§ 545 - § 551', ['Certificering', 'Brand'], 'Regler om certificeret brandrådgivers opgaver, dokumentation, kontrol og erklæringer.'),
  br18Chapter(35, 'Anerkendelse af statikere', '§ 552 - § 563', ['Certificering', 'Statik'], 'Regler om anerkendelse, kompetencer og overgangsordninger for statikere.'),

  sourceEntry('SBI', 'sbi-build-272', 'SBi-anvisning 272: Bygningsreglementet 2018', 'SBi/BUILD', 'BR18 vejledning', 'Kapitelopbygget faglig vejledning til BR18 med forklaringer, eksempler og henvisninger til hovedvejledninger.', ['BR18', 'Vejledning', 'Generelt'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-254', 'SBi-anvisning 254: Småhuse - styrke og stabilitet', 'SBi/BUILD', 'Småhuse', 'Praktisk anvisning for stabilitet, lastnedføring, afstivning og konstruktionsprincipper i småhuse.', ['Konstruktion', 'Småhuse', 'Statik'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-267', 'SBi-anvisning 267: Småhuse - klimaskærmen', 'SBi/BUILD', 'Klimaskærm', 'Vejledning om klimaskærm, fugt, isolering, lufttæthed, tag, facade og samlinger i småhuse.', ['Fugt', 'Energi', 'Klimaskærm'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-258', 'SBi-anvisning 258: Anvisning om vådrum', 'SBi/BUILD', 'Vådrum', 'Vejledning til projektering og udførelse af vådrum, vådzoner, membraner, fald og gennemføringer.', ['Vådrum', 'Fugt', 'Udførelse'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-224', 'SBi-anvisning 224: Fugt i bygninger', 'SBi/BUILD', 'Fugt', 'Vejledning om fugtkilder, fugttransport, udtørring, skimmelrisiko og fugtsikker projektering.', ['Fugt', 'Indeklima', 'Klimaskærm'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-213', 'SBi-anvisning 213: Bygningers energibehov', 'SBi/BUILD', 'Energi', 'Vejledning til beregning og dokumentation af bygningers energibehov og energiramme.', ['Energi', 'Dokumentation'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-230', 'SBi-anvisning 230: Varmeisolering af bygninger', 'SBi/BUILD', 'Isolering', 'Opslagskort for isoleringsprincipper, kuldebroer, U-værdier og efterisolering.', ['Energi', 'Isolering', 'Klimaskærm'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-271', 'SBi-anvisning 271: Dokumentation og kontrol af brandforhold', 'SBi/BUILD', 'Brand', 'Vejledning til brandstrategi, brandteknisk dokumentation og kontrol i byggesager.', ['Brand', 'Dokumentation'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-275', 'BUILD/SBi vejledning: Lydforhold i bygninger', 'SBi/BUILD', 'Lyd', 'Praktisk indgang til lydkrav, lydisolering, trinlyd, installationstøj og akustiske løsninger.', ['Lydforhold', 'Akustik'], 'https://build.dk/anvisninger'),
  sourceEntry('SBI', 'sbi-build-274', 'BUILD/SBi vejledning: Ventilation og indeklima', 'SBi/BUILD', 'Ventilation', 'Praktisk indgang til luftskifte, fugtbelastning, udsugning, indblæsning og dokumentation.', ['Ventilation', 'Indeklima'], 'https://build.dk/anvisninger'),

  sourceEntry('DS', 'ds-418', 'DS 418: Beregning af bygningers varmetab', 'Dansk Standard', 'DS 418', 'Standardgrundlag for beregning af transmissionstab, kuldebroer og varmetab i bygninger.', ['Energi', 'Varmetab', 'Beregning'], 'https://webshop.ds.dk/soegeresultater?search=DS%20418'),
  sourceEntry('DS', 'ds-432', 'DS 432: Afløbsinstallationer', 'Dansk Standard', 'DS 432', 'Standard for projektering og udførelse af afløbsinstallationer i bygninger.', ['Afløb', 'Installationer'], 'https://webshop.ds.dk/soegeresultater?search=DS%20432'),
  sourceEntry('DS', 'ds-439', 'DS 439: Vandinstallationer', 'Dansk Standard', 'DS 439', 'Standard for vandinstallationer, dimensionering, materialer, hygiejne og sikring mod tilbagestrømning.', ['Vand', 'VVS', 'Installationer'], 'https://webshop.ds.dk/soegeresultater?search=DS%20439'),
  sourceEntry('DS', 'ds-447', 'DS 447: Ventilation i bygninger', 'Dansk Standard', 'DS 447', 'Standard for ventilationsanlæg, luftmængder, funktion, prøvning og drift.', ['Ventilation', 'Indeklima'], 'https://webshop.ds.dk/soegeresultater?search=DS%20447'),
  sourceEntry('DS', 'ds-452', 'DS 452: Termisk isolering af tekniske installationer', 'Dansk Standard', 'DS 452', 'Standard for isolering af rør, kanaler, beholdere og tekniske installationer.', ['Energi', 'Installationer', 'Isolering'], 'https://webshop.ds.dk/soegeresultater?search=DS%20452'),
  sourceEntry('DS', 'ds-469', 'DS 469: Varme- og køleanlæg i bygninger', 'Dansk Standard', 'DS 469', 'Standard for projektering, regulering, aflevering og drift af varme- og køleanlæg.', ['Varme', 'Køling', 'Installationer'], 'https://webshop.ds.dk/soegeresultater?search=DS%20469'),
  sourceEntry('DS', 'ds-474', 'DS 474: Norm for specifikation af termisk indeklima', 'Dansk Standard', 'DS 474', 'Standard for vurdering og specifikation af termisk indeklima i bygninger.', ['Indeklima', 'Varme'], 'https://webshop.ds.dk/soegeresultater?search=DS%20474'),
  sourceEntry('DS', 'ds-490', 'DS 490: Lydklassifikation af boliger', 'Dansk Standard', 'DS 490', 'Standard for lydklasser, akustiske mål og dokumentation af lydforhold i boliger.', ['Lydforhold', 'Akustik'], 'https://webshop.ds.dk/soegeresultater?search=DS%20490'),
  sourceEntry('DS', 'ds-en-1990', 'Eurocode 0: Projekteringsgrundlag for bærende konstruktioner', 'Dansk Standard', 'DS/EN 1990', 'Grundlag for konstruktionsprojektering, sikkerhed, lastkombinationer og dokumentation.', ['Konstruktion', 'Statik'], 'https://webshop.ds.dk/soegeresultater?search=DS%2FEN%201990'),
  sourceEntry('DS', 'ds-en-1991', 'Eurocode 1: Laster på bærende konstruktioner', 'Dansk Standard', 'DS/EN 1991', 'Standardserie for egenlast, nyttelast, snelast, vindlast og andre påvirkninger.', ['Konstruktion', 'Laster'], 'https://webshop.ds.dk/soegeresultater?search=DS%2FEN%201991'),
  sourceEntry('DS', 'ds-hd-60364', 'DS/HD 60364-serien: Elektriske lavspændingsinstallationer', 'Dansk Standard', 'DS/HD 60364', 'Standardserie for dimensionering, beskyttelse, udførelse og verifikation af elinstallationer.', ['El', 'Installationer', 'Sikkerhed'], 'https://webshop.ds.dk/soegeresultater?search=DS%2FHD%2060364'),
  sourceEntry('DS', 'ds-en-1176', 'DS/EN 1176-serien: Legepladsredskaber og underlag', 'Dansk Standard', 'DS/EN 1176', 'Standardserie for sikkerhed, inspektion, installation og vedligehold af legepladser.', ['Legepladser', 'Sikkerhed'], 'https://webshop.ds.dk/soegeresultater?search=DS%2FEN%201176'),

  sourceEntry('AB18', 'ab18-aftalegrundlag', 'AB 18: Aftalegrundlag og entreprisens omfang', 'Jura (AB18)', 'Aftalegrundlag', 'Opslagskort for kontraktgrundlag, udbud, tilbud, grænseflader og hvilke dokumenter der styrer entreprisen.', ['Kontrakt', 'Tilbud', 'Entreprise'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-sikkerhed', 'AB 18: Sikkerhedsstillelse og forsikring', 'Jura (AB18)', 'Sikkerhed', 'Praktisk overblik over entreprenørens og bygherrens sikkerhedsstillelse, forsikringer og dokumentation.', ['Kontrakt', 'Sikkerhedsstillelse', 'Forsikring'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-tid', 'AB 18: Tidsplan, forsinkelse og fristforlængelse', 'Jura (AB18)', 'Tid', 'Overblik over tidsplan, hindringer, varsling, dagbod, fristforlængelse og dokumentationskrav.', ['Tidsplan', 'Forsinkelse', 'Varsling'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-aendringer', 'AB 18: Ændringer og ekstraarbejder', 'Jura (AB18)', 'Ændringer', 'Opslagskort for ændringsarbejder, ekstraarbejder, krav om skriftlighed, prisfastsættelse og varsling.', ['Ændringer', 'Ekstraarbejde', 'Varsling'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-betaling', 'AB 18: Betaling, regulering og tilbagehold', 'Jura (AB18)', 'Betaling', 'Overblik over betalingsplan, a conto, slutopgørelse, prisregulering og tilbagehold ved mangler.', ['Betaling', 'Økonomi'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-aflevering', 'AB 18: Aflevering og mangler', 'Jura (AB18)', 'Aflevering', 'Praktisk overblik over afleveringsforretning, mangelregistrering, afhjælpning, frister og mangelansvar.', ['Aflevering', 'Mangler', 'Punch List'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),
  sourceEntry('AB18', 'ab18-tvister', 'AB 18: Tvister, syn og skøn, mediation og voldgift', 'Jura (AB18)', 'Tvister', 'Opslagskort for konflikthåndtering, hurtig afgørelse, mediation, syn og skøn samt voldgift.', ['Tvister', 'Voldgift', 'Syn og skøn'], 'https://www.retsinformation.dk/eli/retsinfo/2018/9632'),

  sourceEntry('AT', 'at-arbejdsmiljoeloven', 'Arbejdsmiljøloven: Formål, ansvar og pligter', 'Arbejdsmiljø', 'Arbejdsmiljøloven', 'Grundlag for ansvar, instruktion, tilsyn, samarbejde og krav om et sikkert og sundt arbejdsmiljø.', ['Arbejdsmiljø', 'Ansvar', 'Sikkerhed'], 'https://regler.at.dk/love-eu-forordninger/arbejdsmiljoe-2062-sam/'),
  sourceEntry('AT', 'at-bygge-anlaeg', 'Bekendtgørelse om bygge- og anlægsarbejde', 'Arbejdsmiljø', 'Bek. 2107', 'Krav til byggepladser, samarbejde, adgangsveje, skiltning, nedstyrtningsfare, gravearbejde og velfærd.', ['Byggeplads', 'Sikkerhed', 'Arbejdsmiljø'], 'https://regler.at.dk/bekendtgoerelser/bygge-anlaegsarbejde-2107/'),
  sourceEntry('AT', 'at-bygherre-pligter', 'Bygherrens pligter: Koordinering og PSS', 'Arbejdsmiljø', 'Bygherrens pligter', 'Overblik over bygherrens koordinering, afgrænsning, plan for sikkerhed og sundhed samt fællesområder.', ['PSS', 'Bygherre', 'Koordinering'], 'https://regler.at.dk/at-vejledninger/bygherrens-ansvar-hvem-hvor-hvornaar-25-2/'),
  sourceEntry('AT', 'at-arbejdets-udfoerelse', 'Bekendtgørelse om arbejdets udførelse', 'Arbejdsmiljø', 'Arbejdets udførelse', 'Krav til planlægning, instruktion, forebyggelse, ergonomi, belastninger og forsvarlig udførelse af arbejde.', ['Instruktion', 'Forebyggelse', 'Udførelse'], 'https://regler.at.dk/bekendtgoerelser/arbejdets-udfoerelse-1839-sam/'),
  sourceEntry('AT', 'at-stillads-hoejde', 'Arbejde i højden, stillads og faldsikring', 'Arbejdsmiljø', 'Nedstyrtningsfare', 'Praktisk opslagskort for stillads, rækværk, afdækning, adgangsveje, faldsikring og arbejde på tag.', ['Stillads', 'Faldsikring', 'Tagarbejde'], 'https://regler.at.dk/at-vejledninger/anvendelse-en-flermastede-arbejdsplatforme-2-3-3/'),
  sourceEntry('AT', 'at-asbest-kemi', 'Asbest, kemi, støv og farlige stoffer', 'Arbejdsmiljø', 'Farlige stoffer', 'Overblik over forundersøgelse, instruktion, værnemidler, afskærmning, affald og særlige regler ved farlige stoffer.', ['Asbest', 'Kemi', 'Støv'], 'https://regler.at.dk/'),
  sourceEntry('AT', 'at-velfaerd', 'Velfærdsforanstaltninger på byggepladsen', 'Arbejdsmiljø', 'Velfærd', 'Opslagskort for toilet, omklædning, spiseplads, vask, bad, tørring, opvarmning og adgang til velfærd.', ['Byggeplads', 'Velfærd'], 'https://regler.at.dk/bekendtgoerelser/bygge-anlaegsarbejde-2107/'),
];

export const STATIC_REGULATION_CATEGORIES: RegulationCategory[] = ['BR18', 'SBI', 'DS', 'AB18', 'AT'];

export const STATIC_REGULATION_CATALOG: Regulation[] = CATALOG_WITH_SUMMARIES.map((regulation) => {
  const fullText = PUBLIC_REGULATION_FULL_TEXT[regulation.id];
  if (!fullText) return regulation;

  return {
    ...regulation,
    body_html: fullText.body_html,
    source_url: fullText.source_url,
    version: fullText.version,
  };
});
